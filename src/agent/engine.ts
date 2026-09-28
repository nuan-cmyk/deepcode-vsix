import * as vscode from 'vscode';
import { DeepSeekClient } from '../client/deepseekClient';
import { ToolExecutor } from '../tools';
import { PromptBuilder } from './promptBuilder';
import { SessionManager } from './sessionManager';
import * as path from 'path';
import { ChatMessage, ToolCall } from './types';

export interface AgentCallbacks {
  onChunk: (text: string) => void;
  onReasoningChunk: (text: string) => void;
  onToolStart: (callId: string, name: string, args: any) => void;
  onToolEnd: (callId: string, name: string, output: string, error?: boolean) => void;
  onStatus: (status: string) => void;
  onComplete: (finishReason: string) => void;
  onError: (err: string) => void;
  onTurnStart?: (iteration: number) => void;
  onPlanProposed?: (planText: string, planItems: string[]) => void;
  onTaskStart?: (taskId: string, command: string) => void;
  onTaskEnd?: (taskId: string, command: string, exitCode: number, output: string) => void;
  onActivityStep?: (step: {
    type: 'edit' | 'explore' | 'command' | 'thought' | 'verify';
    title: string;
    detail?: string;
    added?: number;
    removed?: number;
    exitCode?: number;
    path?: string;
  }) => void;
}

export class AgentEngine {
  private client: DeepSeekClient;
  private toolExecutor: ToolExecutor;
  private promptBuilder: PromptBuilder;
  private sessionManager: SessionManager;
  private abortController: AbortController | null = null;
  private isRunning: boolean = false;
  private activeCallbacks: AgentCallbacks | null = null;

  constructor(
    client: DeepSeekClient,
    toolExecutor: ToolExecutor,
    promptBuilder: PromptBuilder,
    sessionManager: SessionManager
  ) {
    this.client = client;
    this.toolExecutor = toolExecutor;
    this.promptBuilder = promptBuilder;
    this.sessionManager = sessionManager;
  }

  public updateClient(client: DeepSeekClient) {
    this.client = client;
  }

  public killTask(taskId: string): boolean {
    return this.toolExecutor.killTask(taskId);
  }

  public getActiveTasks() {
    return this.toolExecutor.getActiveTasks();
  }

  public stop() {
    this.isRunning = false;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }

    // Force kill any spawned child processes / background commands immediately
    this.toolExecutor.killAll();

    // Immediately notify UI that execution has stopped
    if (this.activeCallbacks) {
      try {
        this.activeCallbacks.onStatus('Остановлено пользователем');
        this.activeCallbacks.onComplete('cancelled');
      } catch {}
      this.activeCallbacks = null;
    }
  }

  public async runUserPrompt(userText: string, callbacks: AgentCallbacks): Promise<void> {
    if (this.isRunning) {
      // Never lock the user out! Cleanly terminate previous stuck task and proceed
      this.stop();
      await new Promise(r => setTimeout(r, 60));
    }

    const session = this.sessionManager.getCurrentSession();
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };
    this.sessionManager.addMessage(userMsg);

    await this.runLoop(callbacks);
  }

  public async runContinue(callbacks: AgentCallbacks): Promise<void> {
    if (this.isRunning) {
      this.stop();
      await new Promise(r => setTimeout(r, 60));
    }

    const continueMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: 'Continue your work and proceed to the next step.',
      timestamp: Date.now()
    };
    this.sessionManager.addMessage(continueMsg);

    await this.runLoop(callbacks);
  }

  private async runLoop(callbacks: AgentCallbacks): Promise<void> {
    this.isRunning = true;
    this.abortController = new AbortController();
    this.activeCallbacks = callbacks;

    const config = vscode.workspace.getConfiguration('deepseek');
    const maxRetries = config.get<number>('maxSelfHealingRetries', 3);
    let selfHealingAttempts = 0;
    let iteration = 0;
    let touchedCodeFile = false;
    let lastTouchedFile = '';
    const maxIterations = 10;

    try {
      while (this.isRunning && iteration < maxIterations) {
        iteration++;
        callbacks.onTurnStart?.(iteration);
        const session = this.sessionManager.getCurrentSession();
        const activeProject = this.sessionManager.getActiveProject();
        if (activeProject && activeProject.path) {
          this.toolExecutor.setWorkspaceRoot(activeProject.path);
        }
        const systemPrompt = await this.promptBuilder.buildSystemPrompt(activeProject);

        const messagesToSend = this.pruneMessagesForRequest(systemPrompt, session.messages, 45);

        callbacks.onStatus(session.thinking ? 'Размышляет...' : 'Генерация ответа...');

        let currentAssistantContent = '';
        let currentReasoningContent = '';
        let pendingToolCalls: ToolCall[] = [];

        await new Promise<void>((resolve, reject) => {
          if (!this.isRunning || this.abortController?.signal?.aborted) {
            reject(new Error('Operation cancelled by user'));
            return;
          }

          this.client.streamChatCompletion(
            messagesToSend,
            {
              model: session.model,
              thinking: session.thinking,
              search: session.search,
              deadMode: session.deadMode,
              agentMode: session.agentMode,
              conversationId: session.conversationId
            },
            {
              onChunk: (delta) => {
                if (!this.isRunning || this.abortController?.signal?.aborted) return;
                currentAssistantContent += delta;
                callbacks.onChunk(delta);
              },
              onReasoningChunk: (delta) => {
                if (!this.isRunning || this.abortController?.signal?.aborted) return;
                currentReasoningContent += delta;
                callbacks.onReasoningChunk(delta);
              },
              onConversationId: (convId) => {
                this.sessionManager.updateConversationId(convId);
              },
              onError: (err) => {
                reject(err);
              },
              onComplete: (finishReason) => {
                if (finishReason === 'cancelled' || this.abortController?.signal?.aborted || !this.isRunning) {
                  reject(new Error('Operation cancelled by user'));
                } else {
                  resolve();
                }
              }
            },
            this.abortController?.signal
          );
        });

        if (!this.isRunning || this.abortController?.signal?.aborted) {
          break;
        }

        // Parse XML / DSML tool calls if in Agent mode
        if (session.agentMode && currentAssistantContent.includes('<tool_call')) {
          const xmlToolRegex = /<tool_call\s+name=["']([^"']+)["']>([\s\S]*?)<\/tool_call>/gi;
          let m: RegExpExecArray | null;
          while ((m = xmlToolRegex.exec(currentAssistantContent)) !== null) {
            const toolName = m[1].trim();
            const inner = m[2];
            const callId = `call_${Date.now()}_${pendingToolCalls.length}`;

            if (toolName === 'create_file') {
              const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
              const cm = inner.match(/<content>([\s\S]*?)<\/content>/i);
              const om = inner.match(/<overwrite>(true|false)<\/overwrite>/i);
              if (pm && cm) {
                pendingToolCalls.push({
                  id: callId,
                  type: 'function',
                  function: {
                    name: 'write_file',
                    arguments: JSON.stringify({
                      path: pm[1].trim(),
                      content: cm[1],
                      overwrite: om ? om[1].toLowerCase() === 'true' : false
                    })
                  }
                });
              }
            } else if (toolName === 'edit_file' || toolName === 'replace_file_content') {
              const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
              const sm = inner.match(/<(?:search|target|targetContent)>([\s\S]*?)<\/(?:search|target|targetContent)>/i);
              const rm = inner.match(/<(?:replace|replacement|replacementContent)>([\s\S]*?)<\/(?:replace|replacement|replacementContent)>/i);
              if (pm && sm && rm) {
                pendingToolCalls.push({
                  id: callId,
                  type: 'function',
                  function: {
                    name: 'replace_file_content',
                    arguments: JSON.stringify({
                      path: pm[1].trim(),
                      targetContent: sm[1],
                      replacementContent: rm[1]
                    })
                  }
                });
              }
            } else if (toolName === 'read_file' || toolName === 'view_file_slice') {
              const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
              let rawPath = pm ? pm[1].trim() : '';
              let startLine = 1;
              let endLine = 200;

              // Parse #L1-65 or :1-65 in path
              const hashMatch = rawPath.match(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i);
              if (hashMatch) {
                startLine = parseInt(hashMatch[1], 10);
                endLine = hashMatch[2] ? parseInt(hashMatch[2], 10) : startLine + 100;
                rawPath = rawPath.replace(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i, '').trim();
              }

              // Check <start_line> or <startLine> or <start>
              const startMatch = inner.match(/<(?:start_line|startLine|start)>(\d+)<\/(?:start_line|startLine|start)>/i);
              if (startMatch) {
                startLine = parseInt(startMatch[1], 10);
              }

              // Check <end_line> or <endLine> or <end>
              const endMatch = inner.match(/<(?:end_line|endLine|end)>(\d+)<\/(?:end_line|endLine|end)>/i);
              if (endMatch) {
                endLine = parseInt(endMatch[1], 10);
              }

              // Check <lines>1-65</lines> or <range>1-65</range>
              const linesMatch = inner.match(/<(?:lines|range)>(\d+)\s*[-:]\s*(\d+)<\/(?:lines|range)>/i);
              if (linesMatch) {
                startLine = parseInt(linesMatch[1], 10);
                endLine = parseInt(linesMatch[2], 10);
              }

              if (rawPath) {
                pendingToolCalls.push({
                  id: callId,
                  type: 'function',
                  function: {
                    name: 'view_file_slice',
                    arguments: JSON.stringify({
                      path: rawPath,
                      startLine,
                      endLine
                    })
                  }
                });
              }
            } else if (toolName === 'run_command' || toolName === 'run_terminal_command') {
              const cm = inner.match(/<command>([\s\S]*?)<\/command>/i);
              if (cm) {
                pendingToolCalls.push({
                  id: callId,
                  type: 'function',
                  function: {
                    name: 'run_terminal_command',
                    arguments: JSON.stringify({
                      command: cm[1].trim()
                    })
                  }
                });
              }
            } else if (toolName === 'list_files' || toolName === 'list_workspace_files') {
              const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
              pendingToolCalls.push({
                id: callId,
                type: 'function',
                function: {
                  name: 'list_workspace_files',
                  arguments: JSON.stringify({
                    folder: pm ? pm[1].trim() : '.'
                  })
                }
              });
            }
          }
        }

        // Check if user is asking to explore/inspect files or workspace
        const userMsgs = session.messages.filter(m => m.role === 'user');
        const lastUserText = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : '';

        // Fallback 1: Inspection / Exploration intent
        const isExploreIntent = /(?:что\s+в|что\s+есть|структур|файлы|папк|содержимое|проект|list|files|workspace)/i.test(lastUserText) ||
                                /(?:проверю содержимое|исследую структуру|посмотрю файлы|проверю файлы)/i.test(currentAssistantContent);
        if (pendingToolCalls.length === 0 && session.agentMode && isExploreIntent && iteration === 1) {
          pendingToolCalls.push({
            id: `call_${Date.now()}_auto_list`,
            type: 'function',
            function: {
              name: 'list_workspace_files',
              arguments: JSON.stringify({ folder: '.' })
            }
          });
        }

        // Fallback 2: If user asked to execute a command and model returned code block or python line instead of XML tool_call
        if (pendingToolCalls.length === 0 && session.agentMode) {
          const isCommandIntent = /(?:выполни|запусти|run|execute|start|тест|test)/i.test(lastUserText);

          if (isCommandIntent) {
            let extractedCommand = '';
            // Try matching bash/sh/python block
            const blockMatch = currentAssistantContent.match(/```(?:bash|sh|powershell|cmd|shell)?\s*\n([\s\S]*?)```/i);
            if (blockMatch) {
              const firstLine = blockMatch[1].trim().split('\n').find(l => l.trim() && !l.trim().startsWith('#'));
              if (firstLine) extractedCommand = firstLine.trim();
            }
            if (!extractedCommand) {
              // Try matching lines starting with python / node / npm
              const directLine = currentAssistantContent.split('\n').find(l => /^(?:python3?|node|npm|npx|pytest)\s+[^\n]+$/i.test(l.trim()));
              if (directLine) extractedCommand = directLine.trim();
            }

            if (extractedCommand) {
              pendingToolCalls.push({
                id: `call_${Date.now()}_auto`,
                type: 'function',
                function: {
                  name: 'run_terminal_command',
                  arguments: JSON.stringify({ command: extractedCommand })
                }
              });
            }
          }
        }

        // Plan Detection: if assistant proposes a plan on the first step
        const planMatch = currentAssistantContent.match(/<plan>([\s\S]*?)<\/plan>/i) ||
                          currentAssistantContent.match(/(?:###\s*(?:📋\s*)?План[\s\S]*?)((?:\d+[\.\)]\s*\[[ xX]\][^\n]+\n?)+)/i);
        if (planMatch) {
          const planText = planMatch[1].trim();
          const items = planText.split('\n')
            .map(l => l.trim())
            .filter(l => /^\d+[\.\)]/i.test(l))
            .map(l => l.replace(/^\d+[\.\)]\s*(\[[ xX]\]\s*)?/, ''));
          callbacks.onPlanProposed?.(planText, items);

          // Plan Gate: If this is Turn 1 (new plan proposal) and user has not confirmed yet, PAUSE execution
          const isUserConfirmed = /план утвержден|confirmPlan|выполняй шаги|начинай выполнять|подтверждаю/i.test(lastUserText);
          if (!isUserConfirmed && iteration === 1) {
            const assistantMsg: ChatMessage = {
              id: 'asst_' + Date.now(),
              role: 'assistant',
              content: currentAssistantContent,
              reasoningContent: currentReasoningContent,
              timestamp: Date.now()
            };
            this.sessionManager.addMessage(assistantMsg);
            callbacks.onStatus('План предложен. Ожидает подтверждения...');
            callbacks.onComplete('plan_proposed');
            break; // Stop and wait for user confirmation click!
          }
        }

        // Record the assistant's turn
        const assistantMsg: ChatMessage = {
          id: 'asst_' + Date.now(),
          role: 'assistant',
          content: currentAssistantContent,
          reasoningContent: currentReasoningContent,
          toolCalls: pendingToolCalls.length > 0 ? pendingToolCalls : undefined,
          timestamp: Date.now()
        };
        this.sessionManager.addMessage(assistantMsg);

        // If no tool calls were generated, check if we need to request the mandatory final summary report
        if (pendingToolCalls.length === 0) {
          const hasReport = /(?:###\s*(?:Что было сделано|Что сделано|Итог|Результат))/i.test(currentAssistantContent);
          if (iteration > 1 && touchedCodeFile && !hasReport && !this.abortController?.signal.aborted) {
            const finalReportPrompt: ChatMessage = {
              id: 'req_report_' + Date.now(),
              role: 'user',
              content: 'Все задачи и шаги плана выполнены. Теперь обязательно напиши подробный итоговый отчет на русском языке по шаблону:\n### Что было сделано и реализовано:\n1. ...\n2. [Результаты запуска тестов и верификации]\nКод полностью готов к работе! 🚀',
              timestamp: Date.now()
            };
            this.sessionManager.addMessage(finalReportPrompt);
            continue;
          }

          callbacks.onStatus('Готов');
          callbacks.onComplete('stop');
          break;
        }

        // Execute tool calls
        const executedResults: { name: string; output: string; error?: boolean }[] = [];

        for (const tc of pendingToolCalls) {
          if (!this.isRunning || this.abortController?.signal?.aborted) break;

          const toolName = tc.function.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          const isCommand = toolName === 'run_terminal_command' || toolName === 'run_command';
          const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          if (isCommand) {
            toolArgs.taskId = taskId;
            callbacks.onTaskStart?.(taskId, toolArgs.command);
          }

          callbacks.onToolStart(tc.id, toolName, toolArgs);
          callbacks.onStatus(`Выполнение: ${toolName}...`);

          if (toolName === 'replace_file_content' || toolName === 'write_file' || toolName === 'create_file' || toolName === 'edit_file') {
            touchedCodeFile = true;
            lastTouchedFile = toolArgs.path || '';
          }

          const result = await this.toolExecutor.execute(toolName, toolArgs, taskId, this.abortController?.signal || undefined);
          executedResults.push({ name: toolName, output: result.output, error: result.error });

          // Emit visual activity step matching Antigravity feed
          if (toolName === 'create_file' || toolName === 'write_file') {
            const lineCount = toolArgs.content ? toolArgs.content.split('\n').length : 0;
            const ext = path.extname(toolArgs.path).slice(1).toUpperCase() || 'FILE';
            callbacks.onActivityStep?.({
              type: 'edit',
              title: `Created ${ext} ${path.basename(toolArgs.path)} (+${lineCount} -0)`,
              path: toolArgs.path,
              added: lineCount,
              removed: 0
            });
          } else if (toolName === 'edit_file' || toolName === 'replace_file_content') {
            const sLines = (toolArgs.targetContent || toolArgs.search || '').split('\n').length;
            const rLines = (toolArgs.replacementContent || toolArgs.replace || '').split('\n').length;
            const ext = path.extname(toolArgs.path).slice(1).toUpperCase() || 'FILE';
            callbacks.onActivityStep?.({
              type: 'edit',
              title: `Edited ${ext} ${path.basename(toolArgs.path)} +${rLines} -${sLines}`,
              path: toolArgs.path,
              added: rLines,
              removed: sLines
            });
          } else if (toolName === 'read_file' || toolName === 'view_file_slice') {
            const range = toolArgs.startLine && toolArgs.endLine ? ` (строки ${toolArgs.startLine}-${toolArgs.endLine})` : '';
            callbacks.onActivityStep?.({
              type: 'explore',
              title: `Explored 1 file (${path.basename(toolArgs.path)}${range})`,
              path: toolArgs.path
            });
          } else if (toolName === 'list_files' || toolName === 'list_workspace_files') {
            const count = result.output.split('\n').filter(Boolean).length;
            const isEmp = count === 0 || /empty/i.test(result.output);
            callbacks.onActivityStep?.({
              type: 'explore',
              title: isEmp ? 'Explored workspace (0 files / empty)' : `Explored workspace (${count} items)`,
              detail: result.output
            });
          } else if (isCommand) {
            callbacks.onActivityStep?.({
              type: 'command',
              title: `Ran ${toolArgs.command}`,
              detail: result.output,
              exitCode: result.error ? 1 : 0
            });
            callbacks.onTaskEnd?.(taskId, toolArgs.command, result.error ? 1 : 0, result.output);
          }

          // If a file was created or modified, open it in VS Code editor
          if (toolArgs.path && !result.error) {
            try {
              const fullPath = this.toolExecutor.resolvePath(toolArgs.path);
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
              await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });
            } catch {}
          }

          callbacks.onToolEnd(tc.id, toolName, result.output, result.error);

          const toolMsg: ChatMessage = {
            id: 'tool_' + Date.now(),
            role: 'tool',
            content: result.output,
            toolCallId: tc.id,
            name: toolName,
            timestamp: Date.now()
          };
          this.sessionManager.addMessage(toolMsg);
        }

        if (!this.isRunning || this.abortController?.signal?.aborted) {
          break;
        }

        // If in Agent Mode, continue the autonomous step loop
        if (session.agentMode && pendingToolCalls.length > 0 && iteration < maxIterations) {
          callbacks.onStatus(`ИИ-агент · шаг ${iteration + 1} (автономный цикл)`);
          const observationContent = executedResults
            .map(r => `[Tool Result: ${r.name}]:\n${r.output}`)
            .join('\n\n');

          const stepFollowUp: ChatMessage = {
            id: 'obs_' + Date.now(),
            role: 'tool',
            content: `${observationContent}\n\nProceed with the next steps or finish the implementation. Verify code works cleanly and mark off completed plan items.`,
            timestamp: Date.now()
          };
          this.sessionManager.addMessage(stepFollowUp);
          continue;
        }

        // Self-Healing Diagnostics Check
        if (touchedCodeFile && selfHealingAttempts < maxRetries) {
          callbacks.onStatus('Проверка синтаксиса и диагностики...');
          const diagResult = await this.toolExecutor.getDiagnostics(lastTouchedFile);

          if (diagResult.error) {
            selfHealingAttempts++;
            callbacks.onStatus(`Обнаружены ошибки. Авто-исправление ${selfHealingAttempts}/${maxRetries}...`);

            const autoHealingMsg: ChatMessage = {
              id: 'healing_' + Date.now(),
              role: 'tool',
              content: `[SELF-HEALING] VS Code detected syntax/type diagnostics in '${lastTouchedFile}':\n${diagResult.output}\n\nPlease fix these errors using replace_file_content until clean.`,
              timestamp: Date.now()
            };
            this.sessionManager.addMessage(autoHealingMsg);
            continue;
          }
        }
      }

      if (this.isRunning && !this.abortController?.signal?.aborted) {
        callbacks.onStatus('Готов');
        callbacks.onComplete('stop');
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || this.abortController?.signal?.aborted || err.message === 'Operation cancelled by user') {
        callbacks.onStatus('Остановлено пользователем');
        callbacks.onComplete('cancelled');
      } else {
        callbacks.onError(err.message || String(err));
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
      this.activeCallbacks = null;
    }
  }

  private pruneMessagesForRequest(systemPrompt: string, allMessages: ChatMessage[], maxLimit: number = 45): ChatMessage[] {
    const sysMsg: ChatMessage = {
      id: 'sys_prompt',
      role: 'system',
      content: systemPrompt,
      timestamp: 0
    };

    // Helper to truncate huge individual message contents (>50k chars) to avoid character limit errors
    const sanitizeMessage = (m: ChatMessage): ChatMessage => {
      if (m.content && m.content.length > 50000) {
        const head = m.content.slice(0, 30000);
        const tail = m.content.slice(-15000);
        return {
          ...m,
          content: `${head}\n\n... [Вывод усечен для оптимизации контекста] ...\n\n${tail}`
        };
      }
      return m;
    };

    // If total messages is small, send everything sanitized
    if (allMessages.length <= maxLimit) {
      return [sysMsg, ...allMessages.map(sanitizeMessage)];
    }

    // Always preserve the initial user intent (first user message)
    const firstUserMsg = allMessages.find(m => m.role === 'user');

    // Find any proposed plan message if exists
    const planMsg = allMessages.find(m => m.role === 'assistant' && (m.content.includes('<plan>') || m.content.includes('### План')));

    // Get the most recent messages (sliding window)
    const reservedSlots = 1 + (firstUserMsg ? 1 : 0) + (planMsg ? 1 : 0);
    const recentCount = Math.max(10, maxLimit - reservedSlots);
    const recentMessages = allMessages.slice(-recentCount);

    const result: ChatMessage[] = [sysMsg];

    if (firstUserMsg && !recentMessages.some(m => m.id === firstUserMsg.id)) {
      result.push(sanitizeMessage(firstUserMsg));
    }

    if (planMsg && planMsg.id !== firstUserMsg?.id && !recentMessages.some(m => m.id === planMsg.id)) {
      result.push(sanitizeMessage(planMsg));
    }

    // Add recent messages, avoiding duplicates
    for (const msg of recentMessages) {
      if (!result.some(m => m.id === msg.id)) {
        result.push(sanitizeMessage(msg));
      }
    }

    return result;
  }
}
