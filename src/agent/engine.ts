import * as vscode from 'vscode';
import { DeepSeekClient, delayForNewRequest } from '../client/deepseekClient';
import { ToolExecutor, TOOL_DEFINITIONS } from '../tools';
import { PromptBuilder } from './promptBuilder';
import { SessionManager } from './sessionManager';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage, ToolCall, AgentActivityStep, CommandPermissionRequest, ChatSession } from './types';
import { 
  countConversationTokens, 
  countMessageTokens, 
  DEFAULT_CONTEXT_LIMIT, 
  TokenUsageStats,
  LOCAL_COMPACT_THRESHOLD,
  GENERAL_COMPACT_THRESHOLD,
  ULTRA_COMPACT_THRESHOLD,
  calculateTargetCompactedTokens
} from './tokenizer';
import { logger } from '../logger';

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
  onActivityStep?: (step: AgentActivityStep) => void;
  onTokenUsage?: (usage: TokenUsageStats) => void;
  onCommandPermissionRequest?: (req: CommandPermissionRequest) => Promise<'run_once' | 'always_allow' | 'deny'>;
  onMessagesCompacted?: () => void;
  onApiDelay?: (remainingMs: number, totalMs: number, reason: string) => void;
}

export const COMPACT_THRESHOLD = 80000;

export function isGatewayUnavailableError(err: any): boolean {
  if (!err) return false;
  const msg = (typeof err === 'string' ? err : (err.message || String(err))).toLowerCase();
  return (
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('сервер временно недоступен') ||
    msg.includes('временно недоступен (502') ||
    msg.includes('прокси-сервер')
  );
}

function isConnectionClosedEmptyError(err: any): boolean {
  if (!err) return false;
  if (isGatewayUnavailableError(err)) return false;
  const msg = (typeof err === 'string' ? err : (err.message || String(err))).toLowerCase();
  return (
    msg.includes('empty stream') ||
    msg.includes('0 токенов') ||
    msg.includes('0 tokens') ||
    msg.includes('0 bytes') ||
    msg.includes('пустой ответ') ||
    msg.includes('server closed connection') ||
    msg.includes('connection without response') ||
    msg.includes('account restriction or expired session') ||
    msg.includes('account restriction') ||
    msg.includes('expired session') ||
    msg.includes('session has expired') ||
    msg.includes('session_expired') ||
    msg.includes('сессия устарела') ||
    msg.includes('сессия deepseek устарела') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('deepseek hint error') ||
    msg.includes('service unavailable') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('networkerror') ||
    msg.includes('stream stalled') ||
    msg.includes('connection timeout') ||
    msg.includes('socket hung')
  );
}

export function isAssistantWaitingForUser(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  const prose = trimmed
    .replace(/<(?:tool_call|function_call|tool)\b[^>]*>[\s\S]*?(?:<\/(?:tool_call|function_call|call|tool)>|$)/gi, '')
    .replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}[\s\S]*?(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}>|$)/gi, '')
    .trim();
  if (!prose) return false;

  const questionPatterns = [
    /ожидаю\s+от\s+вас/i,
    /жду\s+(?:вашего\s+)?(?:ответа|уточнения|решения|указания)/i,
    /пожалуйста[,\s]+(?:подскажите|уточните|сообщите|предоставьте|напишите|ответьте|выберите)/i,
    /нужно\s+(?:уточнение|пояснение|описание)/i,
    /что\s+за\s+проект/i,
    /какова\s+цель/i,
    /какие\s+требования/i,
    /отсутствует\s+описание/i,
    /невозможно\s+определить\s+(?:следующее|дальнейшее)/i,
    /what would you like/i,
    /please (?:choose|confirm|specify|tell me|provide|clarify)/i,
    /waiting for your (?:input|response|clarification|instructions)/i,
    /should i proceed/i,
    /how would you like/i,
    /do you want me to/i
  ];

  const hasQuestionWord = questionPatterns.some(p => p.test(prose));
  const endsWithQuestion = /\?\s*$/m.test(prose.slice(-150)) && /(?:подскажите|уточните|как|что|где|какой|какая|почему|which|what|how|where)\b/i.test(prose.slice(-300));

  return Boolean(hasQuestionWord || endsWithQuestion);
}

export function isReadOnlyCommand(command: string | undefined): boolean {
  if (!command || !command.trim()) return false;
  const raw = command.trim();
  const segments = raw.split(/&&|\|\||[;&]/).map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return false;

  const readOnlyPrefixes = [
    'dir', 'ls', 'vdir', 'tree',
    'echo', 'echo.', 'echo\\', 'echo/',
    'cd', 'chdir', 'pwd',
    'type', 'cat', 'head', 'tail', 'more', 'less',
    'find', 'findstr', 'grep', 'rg', 'ag',
    'tasklist', 'ps', 'top', 'htop', 'get-process', 'gps', 'netstat', 'ipconfig', 'ifconfig', 'wmic',
    'git status', 'git log', 'git diff', 'git show', 'git branch', 'git tag', 'git remote', 'git rev-parse',
    'where', 'which', 'whoami', 'hostname', 'ver', 'set', 'env', 'printenv',
    'test', 'true', 'false',
    'get-childitem', 'gci', 'get-item', 'get-content', 'gc', 'select-string', 'sls', 'get-command', 'gcm', 'get-location', 'gl'
  ];

  for (let seg of segments) {
    seg = seg.replace(/2>nul|2>&1|1>nul|>nul/gi, '').trim();
    seg = seg.replace(/^(?:cmd(?:\.exe)?\s+\/c|powershell(?:\.exe)?\s+(?:-command|-c)?)\s+/i, '').trim();
    if (/^[a-zA-Z]:$/i.test(seg)) continue;

    const segLower = seg.toLowerCase();
    const pipeParts = segLower.split('|').map(p => p.trim()).filter(Boolean);
    const isPipeSafe = pipeParts.every(p => {
      return readOnlyPrefixes.some(pref => p.startsWith(pref + ' ') || p === pref || p.startsWith(pref + '/') || p.startsWith(pref + '\\'));
    });

    if (!isPipeSafe) return false;
  }
  return true;
}

const KNOWN_FILE_EXTENSIONS = new Set([
  'js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'jsonc', 'json5', 'py', 'pyw', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh', 'hxx',
  'cs', 'go', 'rs', 'md', 'markdown', 'txt', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'psm1', 'rb', 'php', 'java', 'kt', 'kts', 'swift',
  'sql', 'xml', 'svg', 'wasm', 'lock', 'env', 'lua', 'vue', 'svelte', 'dart', 'r', 'm', 'mm',
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'bmp', 'pdf', 'zip', 'tar', 'gz'
]);

export function isInvalidCodePropertyPath(p: string | undefined, workspaceRoot?: string): boolean {
  if (!p) return true;
  const raw = p.trim().replace(/^['"`]|['"`]$/g, '').trim();
  if (!raw) return true;

  const norm = raw.toLowerCase().replace(/\\/g, '/');
  if (/^(?:путь[\/]|relative[\/]path|path[\/]to|filename\.ext|new_file\.ext|файлу\.ext|file\.ext|\.[\/]file\.ext|test_file\.ext)/i.test(norm) ||
      norm === 'путь' || norm === 'файлу.ext' || norm === 'file.ext' || norm.includes('путь/к/файлу')) {
    return true;
  }

  // If path physically exists on disk in workspace, it is valid
  if (workspaceRoot) {
    try {
      const fullPath = path.isAbsolute(raw) ? raw : path.resolve(workspaceRoot, raw);
      if (fs.existsSync(fullPath)) {
        return false;
      }
    } catch {}
  }

  const hasSlash = raw.includes('/') || raw.includes('\\');
  const ext = path.extname(raw).replace(/^\./, '').toLowerCase();

  // If it has NO slashes and looks like a code property access or single identifier
  // without a standard file extension:
  if (!hasSlash) {
    if (!ext) {
      const base = raw.toLowerCase();
      if (['dockerfile', 'makefile', 'license', 'readme', 'gemini.md', 'agents.md'].includes(base)) {
        return false;
      }
      return true;
    }
    if (!KNOWN_FILE_EXTENSIONS.has(ext)) {
      // e.g. "world.collider", "player.pos", "enemy.speed" -> ext is not a file extension
      return true;
    }
  }

  return false;
}

export function isConcludingAssistantSummary(content: string): boolean {
  if (!content) return false;
  const prose = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<(?:tool_call|function_call|tool)\b[^>]*>[\s\S]*?(?:<\/(?:tool_call|function_call|call|tool)>|$)/gi, '')
    .replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}[\s\S]*?(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}>|$)/gi, '')
    .trim()
    .toLowerCase();

  if (prose.length < 50) return false;

  const conclusionMarkers = [
    'все проверки завершены',
    'все задачи выполнены',
    'все изменения внесены',
    'все изменения успешно внесены',
    'все изменения успешно сохранены',
    'код готов к использованию',
    'готово к использованию',
    'готово к тестированию',
    'полностью готов к работе',
    'код полностью готов',
    'все работает корректно',
    'все работает исправно',
    'задача успешно выполнена',
    'исправление завершено',
    'все готово к запуску',
    'all tasks completed',
    'all checks completed',
    'all tests passed',
    'ready to use',
    'ready for use',
    'ready for testing',
    'implementation complete',
    'everything is ready'
  ];

  return conclusionMarkers.some(marker => prose.includes(marker));
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
        this.activeCallbacks.onStatus('Stopped by user');
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

    // Check if the user manually triggered context compaction
    const trimmed = userText.trim().toLowerCase();
    if (trimmed === '/compact' || trimmed === '/сжать' || trimmed === 'compact' || trimmed === 'сжать контекст') {
      await this.runCompact(callbacks);
      return;
    }

    // Check if the user is confirming a proposed plan
    const isPlanConfirmation = /^(?:confirm\s+plan|approve\s+plan|start\s+execution|proceed|continue|plan\s+approved|confirm|подтверждаю|утверждаю|начинай|выполняй|поехали)/i.test(userText.trim()) ||
                               /^(?:yes|да|ок|ok|go)$/i.test(userText.trim());

    // Check if the user explicitly demands a plan
    const isExplicitPlanRequest = /^(?:make\s+a?\s*plan|create\s+a?\s*plan|\/plan|сделай\s+план|составь\s+план|спланируй|напиши\s+план|новый\s+план|план\b)/i.test(userText.trim());

    if (isPlanConfirmation) {
      session.planConfirmed = true;
      session.planExplicitlyDemanded = false;
      this.sessionManager.setPlanConfirmed(true);
      this.sessionManager.setPlanExplicitlyDemanded(false);
    } else if (isExplicitPlanRequest) {
      session.planConfirmed = false;
      session.planExplicitlyDemanded = true;
      this.sessionManager.setPlanConfirmed(false);
      this.sessionManager.setPlanExplicitlyDemanded(true);
    } else {
      session.planExplicitlyDemanded = false;
      this.sessionManager.setPlanExplicitlyDemanded(false);
    }

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
    const defaultSettings = this.sessionManager.getDefaultSettings();
    const maxRetries = defaultSettings.maxRetries ?? config.get<number>('maxSelfHealingRetries', 3);
    const maxAutoRetries = defaultSettings.maxRetries ?? 3;
    let selfHealingAttempts = 0;
    let iteration = 0;
    let consecutiveNudgeCount = 0;
    let phase1NudgeCount = 0;
    let repromptAttempts = 0;
    let validationRetryCount = 0;
    let emptyResponseCount = 0;
    let touchedCodeFile = false;
    let lastTouchedFile = '';
    let lastReadFilePath = '';
    let consecutiveFileReadCount = 0;
    try {
      while (this.isRunning) {
        iteration++;
        callbacks.onTurnStart?.(iteration);


        const session = this.sessionManager.getCurrentSession();
        const activeProject = this.sessionManager.getActiveProject();
        if (activeProject && activeProject.path) {
          this.toolExecutor.setWorkspaceRoot(activeProject.path);
        }

        const isUnstuckTurn = Boolean(session.agentMode && session.planConfirmed && consecutiveNudgeCount >= 2);
        if (isUnstuckTurn) {
          callbacks.onActivityStep?.({
            type: 'unstuck',
            code: 'resolving',
            title: 'Resolving next step...'
          });
        }

        // Check for automatic compaction threshold
        const visibleMessages = (session.messages || []).filter(m => !m.isInternal && !m.id?.startsWith('compact_') && !m.content?.startsWith('[COMPACTED CONTEXT BRIEFING]'));
        let uncompactedMessages = visibleMessages;
        if (session.compactedSummary && session.compactedAtMessageId) {
          const cutIdx = visibleMessages.findIndex(m => m.id === session.compactedAtMessageId);
          if (cutIdx !== -1) {
            uncompactedMessages = visibleMessages.slice(cutIdx + 1);
          }
        }

        let uncompactedRawTokens = 0;
        for (const m of uncompactedMessages) {
          uncompactedRawTokens += countMessageTokens(m);
        }

        let compactedTokens = 0;
        if (session.compactedSummary) {
          compactedTokens = countMessageTokens({ id: 'summary', role: 'user', content: session.compactedSummary, timestamp: 0 });
        }

        // TIER 2 / TIER 3: General & Ultra Compaction
        // Triggers when accumulated milestone blocks reach GENERAL_COMPACT_THRESHOLD (256k) or ULTRA_COMPACT_THRESHOLD (900k)
        if (compactedTokens >= GENERAL_COMPACT_THRESHOLD && session.compactedBlocks && session.compactedBlocks.length > 2) {
          const isUltra = compactedTokens >= ULTRA_COMPACT_THRESHOLD;
          const statusText = isUltra ? 'Ultra Compacting (900k Ground Truth)...' : 'General Compacting (256k Meta-Archive)...';
          callbacks.onStatus(statusText);
          callbacks.onActivityStep?.({
            type: 'compact',
            title: isUltra ? 'Ultra Compacting' : 'General Compacting'
          });

          const consolidated = await this.generateGeneralCompactSummary(session.compactedBlocks, session, isUltra);
          if (consolidated) {
            const epochNum = (session.epochSummaries?.length || 0) + 1;
            this.sessionManager.applyGeneralCompaction(consolidated, epochNum);
            compactedTokens = countMessageTokens({ id: 'summary', role: 'user', content: this.sessionManager.getCurrentSession().compactedSummary || '', timestamp: 0 });
          }
          callbacks.onActivityStep?.({
            type: 'compact_done',
            title: isUltra ? 'Ultra Compacted' : 'General Compacted'
          });
        }

        // TIER 1: Local Milestone Compaction (every 80k uncompacted raw tokens)
        if (uncompactedRawTokens >= LOCAL_COMPACT_THRESHOLD && uncompactedMessages.length >= 2) {
          callbacks.onStatus('Compacting (80k)...');
          callbacks.onActivityStep?.({
            type: 'compact',
            title: 'Compacting (80k)'
          });

          const lastMsg = uncompactedMessages[uncompactedMessages.length - 1];
          const hasPendingUserMsg = lastMsg && lastMsg.role === 'user';
          const priorMessages = hasPendingUserMsg && uncompactedMessages.length > 2 ? uncompactedMessages.slice(0, -1) : uncompactedMessages;

          this.sessionManager.recordRawTokensProcessed(uncompactedRawTokens);

          const summary = await this.generateCompactSummary(priorMessages, session);
          if (summary) {
            const lastPriorId = priorMessages[priorMessages.length - 1]?.id;
            this.sessionManager.setCompactedContext(summary, lastPriorId);
          }
          callbacks.onActivityStep?.({
            type: 'compact_done',
            title: 'Compacted'
          });
        }

        const userMsgs = (session.messages || []).filter(m => m.role === 'user' && !m.isInternal);
        const lastUserText = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : '';
        const isContinuePrompt = /^(?:continue|proceed|продолжай|дальше|далее|go on|next)$/i.test(lastUserText.trim());

        const effectiveSandbox = session.agentMode === false ? 'bypass' : (session.sandboxMode || 'local');
        const systemPrompt = await this.promptBuilder.buildSystemPrompt(activeProject, {
          agentMode: session.agentMode !== false,
          planMode: session.planMode !== false,
          planConfirmed: Boolean(session.planConfirmed),
          deadMode: Boolean(session.deadMode),
          sandboxMode: effectiveSandbox
        });

        const messagesToSend = this.pruneMessagesForRequest(systemPrompt, session.messages, 120, session);

        // Pre-flight token calculation using tokenizer
        const toolsForRun = session.agentMode ? TOOL_DEFINITIONS : undefined;
        let turnUsage = countConversationTokens(messagesToSend, toolsForRun, DEFAULT_CONTEXT_LIMIT);
        turnUsage.lastCompactTimestamp = session.lastCompactTimestamp;
        this.sessionManager.updateTokens(turnUsage.totalTokens, turnUsage.promptTokens, turnUsage.completionTokens, turnUsage.userTokens, undefined, turnUsage.toolTokens);
        const preLifetime = this.sessionManager.getLifetimeTokenUsage(session);
        turnUsage.cumulativeTokensSpent = preLifetime.cumulativeTokensSpent;
        turnUsage.userTokens = preLifetime.userTokens;
        turnUsage.llmTokens = preLifetime.llmTokens;
        turnUsage.toolTokens = preLifetime.toolTokens;
        turnUsage.cumulativeUserTokens = preLifetime.userTokens;
        turnUsage.cumulativeLlmTokens = preLifetime.llmTokens;
        turnUsage.cumulativeToolTokens = preLifetime.toolTokens;
        callbacks.onTokenUsage?.(turnUsage);

        callbacks.onStatus(session.thinking ? 'Reasoning...' : 'Generating response...');

        let currentAssistantContent = '';
        let currentReasoningContent = '';
        let pendingToolCalls: ToolCall[] = [];
        let receivedApiUsage = false;

        let connectionRecoveryAttempts = 0;
        const maxConnectionRetries = maxAutoRetries;

        while (true) {
          if (!this.isRunning || this.abortController?.signal?.aborted) {
            break;
          }

          currentAssistantContent = '';
          currentReasoningContent = '';
          pendingToolCalls = [];
          receivedApiUsage = false;
          let streamError: any = null;

          // When recovering from a 0-tokens dropped connection, prune to compact context (<=12 messages)
          // so DeepSeek Web never chokes on 100+ raw messages in a fresh stateless chat
          let effectiveMessages = [...messagesToSend];
          if (connectionRecoveryAttempts > 0) {
            if (effectiveMessages.length > 12) {
              const sysMsg = effectiveMessages[0];
              const firstUser = effectiveMessages.find(m => m.role === 'user');
              const recent = effectiveMessages.slice(-10);
              const pruned: ChatMessage[] = [];
              if (sysMsg) pruned.push(sysMsg);
              if (firstUser && !recent.some(m => m.id === firstUser.id)) pruned.push(firstUser);
              for (const m of recent) {
                if (!pruned.some(p => p.id === m.id)) pruned.push(m);
              }
              effectiveMessages = pruned;
            }

            const lastMsg = effectiveMessages[effectiveMessages.length - 1];
            if (lastMsg && (lastMsg.role === 'tool' || lastMsg.role === 'assistant')) {
              effectiveMessages.push({
                id: 'continue_unstuck_' + Date.now(),
                role: 'user',
                content: 'Continue your work and proceed to the next step.',
                timestamp: Date.now()
              });
            }
          }

          // Turn-level Context Anchor (Recency Reminder):
          // Injects identity, workspace paths, active file and tool invocation contracts at the bottom of the latest user message
          if (session.agentMode !== false && effectiveMessages.length > 0) {
            const lastUserIdx = effectiveMessages.map(m => m.role).lastIndexOf('user');
            if (lastUserIdx !== -1) {
              const targetUserMsg = { ...effectiveMessages[lastUserIdx] };
              if (!targetUserMsg.content.includes('[SYSTEM REMINDER]')) {
                const folders = vscode.workspace.workspaceFolders;
                const wsRoot = activeProject ? activeProject.path : (folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd());
                const activeEd = vscode.window.activeTextEditor;
                let activeFileDesc = 'None';
                if (activeEd) {
                  const docP = activeEd.document.uri.fsPath;
                  const relP = path.relative(wsRoot, docP).replace(/\\/g, '/');
                  if (!relP.startsWith('..') && !path.isAbsolute(relP)) {
                    activeFileDesc = `${relP}:${activeEd.selection.active.line + 1}`;
                  }
                }

                const reminderFooter = `\n\n[SYSTEM REMINDER]
- Identity: DeepCode agent, autonomous software engineering AI.
- Workspace: ${wsRoot} (OS: ${process.platform})
- Active File: ${activeFileDesc}
- Sandbox Mode: ${effectiveSandbox.toUpperCase()}
- Tool Invocation Contract:
  * Run terminal: <tool_call name="run_command"><command>...</command></tool_call>
  * Read file: <tool_call name="read_file"><path>...</path><start_line>1</start_line><end_line>65</end_line></tool_call>
  * Edit file: <tool_call name="edit_file"><path>...</path><search>...</search><replace>...</replace></tool_call>
  * Create file: <tool_call name="create_file"><path>...</path><content>...</content></tool_call>
  * List files: <tool_call name="list_files"><path>.</path></tool_call>
  * Diagnostics: <tool_call name="get_diagnostics"><path>...</path></tool_call>
- Directive: When user requests actions, immediately invoke the appropriate tool call. Do NOT output executable code or terminal commands in conversational markdown blocks.`;

                targetUserMsg.content = targetUserMsg.content + reminderFooter;
                effectiveMessages[lastUserIdx] = targetUserMsg;
              }
            }
          }

          try {
            await new Promise<void>((resolve, reject) => {
              if (!this.isRunning || this.abortController?.signal?.aborted) {
                reject(new Error('Operation cancelled by user'));
                return;
              }

              this.client.streamChatCompletion(
                effectiveMessages,
                {
                  model: session.model,
                  thinking: Boolean(session.thinking) && consecutiveNudgeCount < 2,
                  search: session.search,
                  deadMode: session.deadMode,
                  agentMode: session.agentMode,
                  sandboxMode: effectiveSandbox,
                  conversationId: session.conversationId
                },
                {
                  onChunk: (delta) => {
                    if (!this.isRunning || this.abortController?.signal?.aborted) return;
                    connectionRecoveryAttempts = 0; // Model started outputting text: reset recovery counter
                    if (!currentAssistantContent) {
                      callbacks.onStatus(session.agentMode ? 'Formulating actions...' : 'Generating response...');
                    }
                    currentAssistantContent += delta;
                    callbacks.onChunk(delta);
                  },
                  onReasoningChunk: (delta) => {
                    if (!this.isRunning || this.abortController?.signal?.aborted) return;
                    connectionRecoveryAttempts = 0; // Model started reasoning: reset recovery counter
                    currentReasoningContent += delta;
                    callbacks.onReasoningChunk(delta);
                  },
                  onToolCall: (tc) => {
                    // Collect native tool_calls from the JSON SSE stream
                    if (!this.isRunning || this.abortController?.signal?.aborted) return;
                    connectionRecoveryAttempts = 0; // Model invoked tools: reset recovery counter
                    pendingToolCalls.push(tc);
                  },
                  onStatus: (st) => {
                    callbacks.onStatus(st);
                  },
                  onApiDelay: (remainingMs, totalMs, reason) => {
                    callbacks.onApiDelay?.(remainingMs, totalMs, reason);
                  },
                  onConversationId: (convId) => {
                    if (convId && (convId.includes(':') || !session.conversationId)) {
                      this.sessionManager.updateConversationId(convId);
                    }
                  },
                  onUsage: (u) => {
                    receivedApiUsage = true;
                    const maxTokens = DEFAULT_CONTEXT_LIMIT;
                    const percent = Math.min(100, Math.round((u.total_tokens / maxTokens) * 100));

                    let userTokens = 0;
                    for (const m of messagesToSend) {
                      if (m.role === 'user') {
                        userTokens += countMessageTokens(m);
                      }
                    }
                    const systemPromptTokens = Math.max(0, u.prompt_tokens - userTokens);
                    this.sessionManager.updateTokens(u.total_tokens, systemPromptTokens > 0 ? systemPromptTokens : u.prompt_tokens, u.completion_tokens, userTokens);
                    const streamLifetime = this.sessionManager.getLifetimeTokenUsage(session);

                    turnUsage = {
                      promptTokens: streamLifetime.promptTokens,
                      completionTokens: u.completion_tokens,
                      totalTokens: u.total_tokens,
                      maxTokens,
                      percent,
                      userTokens: streamLifetime.userTokens,
                      llmTokens: streamLifetime.llmTokens,
                      toolTokens: streamLifetime.toolTokens,
                      systemTokens: streamLifetime.promptTokens,
                      contextTokens: u.total_tokens,
                      lastCompactTimestamp: session.lastCompactTimestamp,
                      cumulativeTokensSpent: streamLifetime.cumulativeTokensSpent,
                      cumulativeUserTokens: streamLifetime.userTokens,
                      cumulativeLlmTokens: streamLifetime.llmTokens,
                      cumulativeToolTokens: streamLifetime.toolTokens
                    };
                    callbacks.onTokenUsage?.(turnUsage);
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
                this.abortController?.signal,
                session.agentMode ? TOOL_DEFINITIONS : undefined
              );
            });
          } catch (err: any) {
            streamError = err;
          }

          if (streamError) {
            if (this.abortController?.signal?.aborted || streamError.name === 'AbortError' || streamError.message === 'Operation cancelled by user') {
              throw streamError;
            }

            if (isGatewayUnavailableError(streamError)) {
              // Immediately rethrow gateway errors (502/503/504) so stream stops cleanly and user sees the error card
              throw streamError;
            }

            if (isConnectionClosedEmptyError(streamError)) {
              // Retain conversationId on retry so DeepSeek continues in the SAME chat with a 1-message delta.
              // Server-side parent_message_id tracking and Seamless Session Rollover will handle continuation or migration.
              // Only reset to stateless as a last resort if retrying in the same chat fails repeatedly.
              if (connectionRecoveryAttempts >= maxConnectionRetries - 1 && session.conversationId) {
                logger.log('Agent', `Server closed connection repeatedly. Resetting conversationId (${session.conversationId}) to stateless fallback.`);
                session.conversationId = undefined;
                this.sessionManager.updateConversationId('');
              } else if (session.conversationId) {
                logger.log('Agent', `Server returned empty response. Retrying within existing conversation (${session.conversationId}) without creating a new chat.`);
              }

              if (connectionRecoveryAttempts < maxConnectionRetries) {
                connectionRecoveryAttempts++;
                callbacks.onActivityStep?.({
                  type: 'unstuck',
                  code: 'empty_response',
                  title: `Server returned empty response. Auto-retry step (${connectionRecoveryAttempts}/${maxConnectionRetries})...`,
                  attempt: connectionRecoveryAttempts,
                  maxAttempts: maxConnectionRetries,
                  startTime: Date.now()
                });
                callbacks.onStatus(`Unstuck (${connectionRecoveryAttempts}/${maxConnectionRetries})...`);

                const delay = Math.min(8000, 3000 + (connectionRecoveryAttempts - 1) * 1500);
                await new Promise<void>(r => {
                  const tm = setTimeout(r, delay);
                  this.abortController?.signal?.addEventListener('abort', () => {
                    clearTimeout(tm);
                    r();
                  }, { once: true });
                });

                if (!this.isRunning || this.abortController?.signal?.aborted) {
                  break;
                }
                continue;
              } else {
                // If touchedCodeFile is true, the actual coding work is already finished on disk!
                if (touchedCodeFile) {
                  currentAssistantContent = 'Все запланированные изменения файлов успешно выполнены и проверены диагностикой.';
                  callbacks.onChunk?.(currentAssistantContent);
                  break;
                }

                // Exhausted retries: proxy/account restriction or expired session
                callbacks.onActivityStep?.({
                  type: 'unstuck',
                  title: `Server closed connection without response (0 tokens) after ${maxConnectionRetries} attempts.`
                });
                const alertMsg = `Сервер API или прокси закрыл соединение без ответа (0 токенов) после ${maxConnectionRetries} попыток continue.\n\nВозможные причины: истекла сессия на сайте прокси или действует ограничение аккаунта.\nПожалуйста, обновите сессию/токен в настройках расширения или нажмите Continue для повторной попытки.`;
                callbacks.onStatus('Connection closed by server (0 tokens)');
                throw new Error(alertMsg);
              }
            }

            throw streamError;
          }

          break;
        }

        // If server stream didn't provide exact usage, compute completion addition locally
        if (!receivedApiUsage && (currentAssistantContent || currentReasoningContent)) {
          const compTokens = countConversationTokens([
            ...messagesToSend,
            { id: `temp_${Date.now()}`, role: 'assistant', content: currentAssistantContent, reasoningContent: currentReasoningContent, timestamp: Date.now() }
          ], toolsForRun, DEFAULT_CONTEXT_LIMIT);
          compTokens.lastCompactTimestamp = session.lastCompactTimestamp;
          this.sessionManager.updateTokens(compTokens.totalTokens, compTokens.promptTokens, compTokens.completionTokens, compTokens.userTokens, undefined, compTokens.toolTokens);
          const fallbackLifetime = this.sessionManager.getLifetimeTokenUsage(session);
          compTokens.cumulativeTokensSpent = fallbackLifetime.cumulativeTokensSpent;
          compTokens.userTokens = fallbackLifetime.userTokens;
          compTokens.llmTokens = fallbackLifetime.llmTokens;
          compTokens.toolTokens = fallbackLifetime.toolTokens;
          compTokens.cumulativeUserTokens = fallbackLifetime.userTokens;
          compTokens.cumulativeLlmTokens = fallbackLifetime.llmTokens;
          compTokens.cumulativeToolTokens = fallbackLifetime.toolTokens;
          callbacks.onTokenUsage?.(compTokens);
        }

        if (!this.isRunning || this.abortController?.signal?.aborted) {
          break;
        }

        // If inline <think> tags were present in currentAssistantContent, extract to currentReasoningContent
        const inlineThinkMatch = currentAssistantContent.match(/<think>([\s\S]*?)<\/think>/i);
        if (inlineThinkMatch) {
          if (!currentReasoningContent) {
            currentReasoningContent = inlineThinkMatch[1].trim();
          }
          currentAssistantContent = currentAssistantContent.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
        }

        // Only if the model mistakenly placed an actual <plan> tag strictly into reasoningContent and currentAssistantContent is empty:
        if (!currentAssistantContent.trim() && currentReasoningContent.includes('<plan>')) {
          const pMatch = currentReasoningContent.match(/<plan>([\s\S]*?)(?:<\/plan>|$)/i);
          if (pMatch) {
            currentAssistantContent = pMatch[0];
            if (!currentAssistantContent.endsWith('</plan>')) {
              currentAssistantContent += '\n</plan>';
            }
            callbacks.onChunk(currentAssistantContent);
          }
        }

        // Parse XML / DSML tool calls if in Agent mode
        if (session.agentMode) {
          const parsedCalls = this.parseToolCallsFromContent(currentAssistantContent, pendingToolCalls.length, session);
          for (const call of parsedCalls) {
            if (!pendingToolCalls.some(p => p.function.name === call.function.name && p.function.arguments === call.function.arguments)) {
              pendingToolCalls.push(call);
            }
          }
          if (pendingToolCalls.length === 0 && currentReasoningContent) {
            const reasoningCalls = this.parseToolCallsFromContent(currentReasoningContent, 0, session);
            for (const call of reasoningCalls) {
              if (!pendingToolCalls.some(p => p.function.name === call.function.name && p.function.arguments === call.function.arguments)) {
                pendingToolCalls.push(call);
              }
            }
          }
        }


        // Plan Confirmation Check
        const isUserExplicitConfirm = /^(?:confirm\s+plan|approve\s+plan|start\s+execution|proceed|continue|plan\s+approved|confirm|подтверждаю|утверждаю|начинай|выполняй|поехали)/i.test(lastUserText.trim());
        if (isUserExplicitConfirm) {
          session.planConfirmed = true;
          session.planExplicitlyDemanded = false;
          phase1NudgeCount = 0;
          this.sessionManager.setPlanConfirmed(true);
          this.sessionManager.setPlanExplicitlyDemanded(false);
        }

        // Plan Detection: When the model explicitly outputs <plan>...</plan> (either autonomously or when requested)
        let detectedPlanText = '';
        const planTagMatch = currentAssistantContent.match(/<plan>([\s\S]*?)(?:<\/plan>|$)/i);
        if (planTagMatch) {
          detectedPlanText = planTagMatch[1].trim();
        } else if (session.planMode !== false && !session.planConfirmed && /(?:##?\s*(?:план(?:\s+реализации)?|implementation\s+plan)|###?\s*план)/i.test(currentAssistantContent)) {
          // Model formatted plan as markdown checklist instead of <plan> tags
          const listLines = currentAssistantContent.split('\n').filter(l => /^\s*(?:\d+[\.\)]|[-*]\s*\[[ xX]\])/i.test(l));
          if (listLines.length >= 2) {
            detectedPlanText = listLines.join('\n');
          }
        }

        if (session.planMode !== false && !session.planConfirmed && detectedPlanText) {
          const items: string[] = detectedPlanText.split('\n')
            .map(l => l.trim())
            .filter(l => /^\d+[\.\)]/i.test(l) || /^[-*]\s*\[/i.test(l))
            .map(l => l.replace(/^(?:\d+[\.\)]|[-*])\s*(\[[ xX]\]\s*)?/, ''));

          if (items.length > 0) {
            // Planning turn: discard any accidental tool calls and halt for user confirmation
            pendingToolCalls = [];
            callbacks.onPlanProposed?.(detectedPlanText, items);

            const assistantMsg: ChatMessage = {
              id: 'asst_' + Date.now(),
              role: 'assistant',
              content: currentAssistantContent,
              reasoningContent: currentReasoningContent,
              timestamp: Date.now()
            };
            this.sessionManager.addMessage(assistantMsg);
            callbacks.onStatus('Plan proposed. Waiting for confirmation...');
            callbacks.onComplete('plan_proposed');
            break; // Stop turn and await user confirmation!
          }
        }

        // If the user EXPLICITLY demanded a plan and it is not yet confirmed:
        // Hold mutative file edits and destructive commands until plan confirmation
        if (session.planMode !== false && session.planExplicitlyDemanded && !session.planConfirmed) {
          pendingToolCalls = pendingToolCalls.filter(tc => {
            const name = tc.function.name;
            if (['create_file', 'edit_file', 'write_file', 'replace_file_content'].includes(name)) {
              return false;
            }
            if (name === 'run_command' || name === 'run_terminal_command') {
              try {
                const args = JSON.parse(tc.function.arguments || '{}');
                return isReadOnlyCommand(args.command);
              } catch {
                return false;
              }
            }
            return true;
          });
        }

        if (session.planConfirmed) {
          // If the model emitted any stray <plan> tags in execution turns, strip them so no duplicate cards render
          currentAssistantContent = currentAssistantContent.replace(/<plan>[\s\S]*?<\/plan>/gi, '');
        }

        // Filter out phantom/hallucinated tool calls:
        // 1. Spurious read/inspection calls emitted after the model already produced a concluding summary
        // 2. Read calls targeting in-memory code property paths (e.g. world.collider, player.health) that do not exist on disk
        if (pendingToolCalls.length > 0) {
          const wsRoot = this.toolExecutor.getWorkspaceRoot();
          const isFinished = isConcludingAssistantSummary(currentAssistantContent);

          pendingToolCalls = pendingToolCalls.filter(tc => {
            const name = tc.function.name;
            if (name === 'view_file_slice' || name === 'read_file') {
              try {
                const args = JSON.parse(tc.function.arguments || '{}');
                const targetPath = args.path || args.filePath || '';
                if (isInvalidCodePropertyPath(targetPath, wsRoot)) {
                  logger.log('Agent', `Discarded phantom tool call ${name} on invalid property/path: "${targetPath}"`);
                  return false;
                }
                if (isFinished) {
                  logger.log('Agent', `Discarded spurious read call "${targetPath}" after concluding response.`);
                  return false;
                }
              } catch {
                return false;
              }
            } else if (isFinished && (name === 'list_workspace_files' || name === 'search_files' || name === 'get_diagnostics')) {
              logger.log('Agent', `Discarded spurious exploration call ${name} after concluding response.`);
              return false;
            }
            return true;
          });
        }

        // If no tool calls were generated:
        if (pendingToolCalls.length === 0) {
          const isGenuineQuestion = isAssistantWaitingForUser(currentAssistantContent);
          const hasToolTagAttempt = /<(?:tool_call|function_call|tool)\b/i.test(currentAssistantContent);
          
          // Detect malformed/improper tool calls for validation and re-generation
          const malformedCheck = this.detectMalformedToolCall(currentAssistantContent, currentReasoningContent, session);

          // An action promise is an IDLE turn only if it's short (< 350 chars) and just promises an action without executing tools or providing a full summary
          const isShortMonologue = currentAssistantContent.trim().length < 350;
          const hasActionPromise = isShortMonologue && /(?:let me|i will|i'll|следующий шаг|сейчас\s+(?:я\s+)?(?:создам|отредактирую|изменю|запущу|прочитаю|посмотрю|изучу)|провер(?:ю|им|ить)?|посмотр(?:ю|им|еть)?|изуч(?:у|им|ить)?|прочита(?:ю|ем|ть)?|созда(?:м|дим|вать)?|запу(?:щу|стим|стить)?|start server|run implant)/i.test(currentAssistantContent);
          
          const isToolPromiseOnly = Boolean(
            !hasToolTagAttempt && hasActionPromise
          );

          const isFinalSummary = Boolean(
            !malformedCheck.isMalformed && (
              currentAssistantContent.includes('<end_working>') ||
              (!hasToolTagAttempt && !isToolPromiseOnly && currentAssistantContent.trim().length > 0)
            )
          );

          // Phase 1 Nudge: When in Plan Mode and plan is not yet confirmed
          if (session.agentMode && session.planMode !== false && !session.planConfirmed && !isGenuineQuestion) {
            const hadExplorationTools = (session.messages || []).some(m => m.role === 'tool');
            const shouldNudgePlan = isToolPromiseOnly || hadExplorationTools || (!currentAssistantContent.trim() && currentReasoningContent);

            if (shouldNudgePlan && phase1NudgeCount < 2) {
              phase1NudgeCount++;

              if (currentAssistantContent.trim()) {
                const assistantMsg: ChatMessage = {
                  id: 'asst_' + Date.now(),
                  role: 'assistant',
                  content: currentAssistantContent,
                  reasoningContent: currentReasoningContent,
                  timestamp: Date.now()
                };
                this.sessionManager.addMessage(assistantMsg);
              }

              const planNudgeMsg: ChatMessage = {
                id: 'plan_nudge_' + Date.now(),
                role: 'user',
                content: `CRITICAL PLANNING DIRECTIVE: You are in Plan Mode. You explored the workspace or stated an intention without executing a tool or outputting a plan.
If you still need to inspect existing code, invoke the tool call directly (<tool_call name="read_file"> or <tool_call name="view_file_slice">).
If you have gathered sufficient context, output the architectural concept, project file tree, and the implementation checklist inside <plan>...</plan> tags now so the user can review and approve execution.`,
                isInternal: true,
                timestamp: Date.now()
              };
              this.sessionManager.addMessage(planNudgeMsg);
              callbacks.onStatus('Formulating plan...');
              continue;
            }
          }

          // Unstuck Validation: When model produced malformed / improper tool output, send to neural network for validation & re-generation
          if (session.agentMode && malformedCheck.isMalformed && !isGenuineQuestion && (session.planConfirmed || session.planMode === false)) {
            if (validationRetryCount < maxAutoRetries) {
              validationRetryCount++;
              logger.log('Agent:Unstuck', `[Validation Triggered (${validationRetryCount}/${maxAutoRetries})] ${malformedCheck.reason} - fragment: "${malformedCheck.fragment}"`);

              if (currentAssistantContent.trim() || currentReasoningContent.trim()) {
                const cleanedContent = currentAssistantContent.replace(/<(?:tool_call|function_call|tool)\s+[^>]*>[\s\S]*$/i, '').trim();
                const assistantMsg: ChatMessage = {
                  id: 'asst_' + Date.now(),
                  role: 'assistant',
                  content: cleanedContent,
                  reasoningContent: currentReasoningContent,
                  timestamp: Date.now()
                };
                if (cleanedContent || currentReasoningContent) {
                  this.sessionManager.addMessage(assistantMsg);
                }
              }

              callbacks.onActivityStep?.({
                type: 'unstuck',
                code: 'tool_syntax_error',
                reason: malformedCheck.reason,
                title: `Tool call syntax: ${malformedCheck.reason}. Requesting re-generation (${validationRetryCount}/${maxAutoRetries})...`,
                attempt: validationRetryCount,
                maxAttempts: maxAutoRetries,
                startTime: Date.now()
              });
              callbacks.onStatus(`Validation (${validationRetryCount}/${maxAutoRetries})...`);

              const validationMsg: ChatMessage = {
                id: 'validation_' + Date.now(),
                role: 'user',
                content: `CRITICAL SYNTAX VALIDATION ERROR:
Your previous response contained an invalid or incomplete tool call format that was rejected:
Reason: ${malformedCheck.reason}
Detected fragment: "${malformedCheck.fragment}"

CORRECTION REQUIREMENT:
You must strictly re-generate your response using exact and valid XML tool call tags.
Do NOT omit opening tags or closing tags. Do NOT output raw shell commands without tool wrapping.

- For terminal commands:
<tool_call name="run_command">
<command>your_command_here</command>
</tool_call>

- For writing or creating files:
<tool_call name="write_file">
<path>relative/path/to/file</path>
<content>full file content</content>
</tool_call>

- For reading files:
<tool_call name="read_file">
<path>relative/path/to/file</path>
</tool_call>

Re-generate your response now with the proper tool call:`,
                isInternal: true,
                timestamp: Date.now()
              };
              this.sessionManager.addMessage(validationMsg);
              continue;
            } else if (malformedCheck.salvageableCommand) {
              logger.log('Agent:Unstuck', `[Salvage Command] Auto-salvaging command after validation retries: "${malformedCheck.salvageableCommand}"`);
              pendingToolCalls.push({
                id: `call_${Date.now()}_salvaged`,
                type: 'function',
                function: {
                  name: 'run_terminal_command',
                  arguments: JSON.stringify({ command: malformedCheck.salvageableCommand })
                }
              });
            }
          }

          if (session.agentMode && (session.planConfirmed || session.planMode === false) && !isFinalSummary && !isGenuineQuestion) {
            consecutiveNudgeCount++;

            if (consecutiveNudgeCount === 1) {
              // 1st idle turn: record assistant turn if it had content, and send clean execution directive
              if (currentAssistantContent.trim() || currentReasoningContent.trim()) {
                const assistantMsg: ChatMessage = {
                  id: 'asst_' + Date.now(),
                  role: 'assistant',
                  content: currentAssistantContent,
                  reasoningContent: currentReasoningContent,
                  timestamp: Date.now()
                };
                this.sessionManager.addMessage(assistantMsg);
              }

              const nudgeMsg: ChatMessage = {
                id: 'nudge_' + Date.now(),
                role: 'user',
                content: `CRITICAL EXECUTION: Do NOT output conversational monologue or descriptions. Invoke the required tool call (<tool_call name="create_file">, <tool_call name="run_command">, etc.) directly with full code content. No preamble. If all tasks are completed, output <end_working>.`,
                isInternal: true,
                timestamp: Date.now()
              };
              this.sessionManager.addMessage(nudgeMsg);
              callbacks.onActivityStep?.({
                type: 'unstuck',
                code: 'empty_after_reasoning',
                title: `Server returned empty response after reasoning. Auto-retry step (${consecutiveNudgeCount}/${maxAutoRetries})...`,
                attempt: consecutiveNudgeCount,
                maxAttempts: maxAutoRetries,
                startTime: Date.now()
              });
              callbacks.onStatus(`Unstuck (${consecutiveNudgeCount}/${maxAutoRetries})...`);
              continue;
            } else if (consecutiveNudgeCount === 2) {
              // 2nd idle turn: record assistant turn if it had content, and prepare for silent unstuck turn 3
              if (currentAssistantContent.trim() || currentReasoningContent.trim()) {
                const assistantMsg: ChatMessage = {
                  id: 'asst_' + Date.now(),
                  role: 'assistant',
                  content: currentAssistantContent,
                  reasoningContent: currentReasoningContent,
                  timestamp: Date.now()
                };
                this.sessionManager.addMessage(assistantMsg);
              }

              const nudgeMsg: ChatMessage = {
                id: 'nudge_' + Date.now(),
                role: 'user',
                content: `SYSTEM UNSTUCK: You have produced monologue without executing tools. Call the appropriate tool now to proceed with execution, or output <end_working> if all work is completed.`,
                isInternal: true,
                timestamp: Date.now()
              };
              this.sessionManager.addMessage(nudgeMsg);
              callbacks.onActivityStep?.({
                type: 'unstuck',
                code: 'empty_after_reasoning',
                title: `Server returned empty response after reasoning. Auto-retry step (${consecutiveNudgeCount}/${maxAutoRetries})...`,
                attempt: consecutiveNudgeCount,
                maxAttempts: maxAutoRetries,
                startTime: Date.now()
              });
              callbacks.onStatus(`Unstuck (${consecutiveNudgeCount}/${maxAutoRetries})...`);
              continue;
            } else {
              // consecutiveNudgeCount >= 3: 3rd turn (silent unstuck) completed without tools or completion tag
              if (repromptAttempts === 0) {
                repromptAttempts++;
                const originalUserMsgs = session.messages.filter(m => m.role === 'user' && !m.content.startsWith('CRITICAL') && !m.content.startsWith('SYSTEM') && !m.content.startsWith('Task execution'));
                const originalTask = originalUserMsgs.length > 0 ? originalUserMsgs[originalUserMsgs.length - 1].content : 'Complete the planned tasks';

                const repromptMsg: ChatMessage = {
                  id: 'reprompt_' + Date.now(),
                  role: 'user',
                  content: `Task execution prompt:\n${originalTask}\n\nCRITICAL: Execute the next planned task now by invoking a tool call (<tool_call name="create_file">, <tool_call name="run_command">, etc.). Do NOT output conversational monologue. If finished, output <end_working>.`,
                  isInternal: true,
                  timestamp: Date.now()
                };
                this.sessionManager.addMessage(repromptMsg);
                callbacks.onStatus('Agent · Re-sending prompt...');
                continue;
              } else {
                // Halted after prompt re-send still yielded no actions: notify user cleanly
                const alertMsg = 'Автономный цикл приостановлен: модель не смогла вызвать инструмент после нескольких попыток. Пожалуйста, напишите прямое указание или подтвердите продолжение.';
                callbacks.onChunk?.(`\n\n> [!NOTE]\n> ${alertMsg}\n`);
                callbacks.onStatus('Waiting for user input...');
                callbacks.onComplete('stop');
                break;
              }
            }
          }

          // Not an idle stuck turn: genuine question, final summary, or normal turn
          consecutiveNudgeCount = 0;
          phase1NudgeCount = 0;
          repromptAttempts = 0;
          validationRetryCount = 0;

          if (!currentAssistantContent.trim()) {
            if (touchedCodeFile) {
              currentAssistantContent = 'Все запланированные задачи и изменения файлов успешно выполнены.';
              callbacks.onChunk?.(currentAssistantContent);
            } else if (emptyResponseCount < 2 && currentReasoningContent && iteration < 50) {
              emptyResponseCount++;
              const nudgeMsg: ChatMessage = {
                id: 'nudge_' + Date.now(),
                role: 'user',
                content: 'CRITICAL: You produced reasoning/thoughts but did not output your response or execute any tool. Please provide your answer to the user now or execute the required tool call.',
                isInternal: true,
                timestamp: Date.now()
              };
              this.sessionManager.addMessage(nudgeMsg);
              callbacks.onStatus('Awaiting model response...');
              continue;
            } else {
              currentAssistantContent = 'Модель завершила цепочку рассуждений без вывода текста. Пожалуйста, отправьте запрос повторно.';
              callbacks.onChunk?.(currentAssistantContent);
            }
          } else {
            emptyResponseCount = 0;
          }

          if (!currentAssistantContent.includes('<end_working>')) {
            callbacks.onChunk?.('\n<end_working>\n');
          }

          // Clean unexecuted / dropped tool tags so raw XML is never saved as chat text
          const cleanSavedContent = currentAssistantContent
            .replace(/```(?:xml|html|markdown|text|plan|bash|sh|json)?\s*(<(?:tool_call|function_call|tool)[\s>])/gi, '$1')
            .replace(/(<\/(?:tool_call|function_call|call|tool)>)\s*```/gi, '$1')
            .replace(/<(?:tool_call|function_call|tool)\b[^>]*>[\s\S]*?(?:<\/(?:tool_call|function_call|call|tool)>|$)/gi, '')
            .replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+(?:call|invoke)\b[^>]*>[\s\S]*?(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}(?:\s*(?:call|invoke))?>|(?=<[|\uFF5C]{1,2}DSML)|$)/gi, '')
            .replace(/<\/?(?:[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}[^>]*|call|invoke)>/gi, '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();

          const assistantMsg: ChatMessage = {
            id: 'asst_' + Date.now(),
            role: 'assistant',
            content: cleanSavedContent || currentAssistantContent,
            reasoningContent: currentReasoningContent,
            timestamp: Date.now()
          };
          this.sessionManager.addMessage(assistantMsg);

          callbacks.onStatus(isGenuineQuestion ? 'Waiting for user input...' : 'Ready');
          callbacks.onComplete('stop');
          break;
        }

        // Tool calls were found: reset consecutive idle count and reprompt attempts!
        consecutiveNudgeCount = 0;
        phase1NudgeCount = 0;
        repromptAttempts = 0;
        emptyResponseCount = 0;
        validationRetryCount = 0;

        // Record the assistant's turn with tools
        const assistantMsg: ChatMessage = {
          id: 'asst_' + Date.now(),
          role: 'assistant',
          content: currentAssistantContent,
          reasoningContent: currentReasoningContent,
          toolCalls: pendingToolCalls,
          timestamp: Date.now()
        };
        this.sessionManager.addMessage(assistantMsg);

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
            const rootName = path.basename(this.toolExecutor.getWorkspaceRoot()) || 'workspace';
            callbacks.onActivityStep?.({
              type: 'command',
              title: `Ran ${toolArgs.command}`,
              command: toolArgs.command,
              cwd: `...\\${rootName}`,
              status: 'running',
              id: taskId
            });
          }

          callbacks.onToolStart(tc.id, toolName, toolArgs);
          callbacks.onStatus(isCommand ? `Running: ${(toolArgs.command || '').slice(0, 40)}...` : `Executing: ${toolName}...`);

          if (toolName === 'replace_file_content' || toolName === 'write_file' || toolName === 'create_file' || toolName === 'edit_file') {
            touchedCodeFile = true;
            lastTouchedFile = toolArgs.path || '';
            lastReadFilePath = '';
            consecutiveFileReadCount = 0;
          } else if (toolName === 'read_file' || toolName === 'view_file_slice') {
            const currentPath = toolArgs.path || toolArgs.filePath || '';
            if (currentPath === lastReadFilePath) {
              consecutiveFileReadCount++;
            } else {
              lastReadFilePath = currentPath;
              consecutiveFileReadCount = 1;
            }
          }

          let result: { output: string; error?: boolean };
          const toolExecStart = Date.now();
          logger.log('Tool', `[${toolName}] Executing with args: ${JSON.stringify(toolArgs).slice(0, 160)}...`);

          if (session.planConfirmed && (toolName === 'read_file' || toolName === 'view_file_slice') && consecutiveFileReadCount >= 3) {
            result = {
              output: `[HALTED READ-LOOP]: Content of '${lastReadFilePath}' was already retrieved in prior turns. You have the exact lines. You are forbidden from calling read_file again. Proceed directly to replace_file_content, write_file, or run_command now.`,
              error: false
            };
          } else {
            result = await this.toolExecutor.execute(
              toolName,
              toolArgs,
              taskId,
              this.abortController?.signal || undefined,
              {
                sandboxMode: session.agentMode === false ? 'bypass' : (session.sandboxMode || 'local'),
                allowedCommands: session.allowedCommands || [],
                onPermissionRequest: async (req) => {
                  if (!this.isRunning || this.abortController?.signal?.aborted) return 'deny';
                  callbacks.onStatus(`Waiting for permission: ${req.command.slice(0, 35)}...`);
                  if (!callbacks.onCommandPermissionRequest) return 'run_once';
                  const dec = await callbacks.onCommandPermissionRequest(req);
                  if (!this.isRunning || this.abortController?.signal?.aborted) return 'deny';
                  if (dec === 'always_allow') {
                    this.sessionManager.allowCommand(req.command);
                  }
                  callbacks.onStatus(isCommand ? `Running: ${(toolArgs.command || '').slice(0, 40)}...` : `Executing: ${toolName}...`);
                  return dec;
                }
              }
            );

            const toolDur = ((Date.now() - toolExecStart) / 1000).toFixed(2);
            logger.log('Tool', `[${toolName}] Completed in ${toolDur}s (output: ${result.output.length} chars, error: ${Boolean(result.error)})`);

            if (!this.isRunning || this.abortController?.signal?.aborted) {
              break;
            }

            if (session.planConfirmed && (toolName === 'read_file' || toolName === 'view_file_slice') && consecutiveFileReadCount === 2) {
              result.output += `\n\n[NOTICE]: File '${lastReadFilePath}' was re-read. You have sufficient information. Proceed immediately to edit_file/replace_file_content. Do not call read_file on this file again.`;
            }
          }

          if (!this.isRunning || this.abortController?.signal?.aborted) {
            break;
          }
          executedResults.push({ name: toolName, output: result.output, error: result.error });

          // Emit visual activity step matching Antigravity feed (only on success!)
          if (!result.error) {
            if (toolName === 'create_file' || toolName === 'write_file') {
              const lineCount = toolArgs.content ? toolArgs.content.split('\n').length : 0;
              callbacks.onActivityStep?.({
                type: 'create',
                title: `Created ${path.basename(toolArgs.path)} +${lineCount}`,
                path: toolArgs.path,
                added: lineCount,
                removed: 0
              });
            } else if (toolName === 'edit_file' || toolName === 'replace_file_content') {
              const sLines = (toolArgs.targetContent || toolArgs.search || '').split('\n').length;
              const rLines = (toolArgs.replacementContent || toolArgs.replace || '').split('\n').length;
              callbacks.onActivityStep?.({
                type: 'edit',
                title: `Edited ${path.basename(toolArgs.path)} +${rLines} -${sLines}`,
                path: toolArgs.path,
                added: rLines,
                removed: sLines
              });
            } else if (toolName === 'read_file' || toolName === 'view_file_slice') {
              callbacks.onActivityStep?.({
                type: 'analyze',
                title: `Analyzed ${path.basename(toolArgs.path || toolArgs.filePath || '')}`,
                path: toolArgs.path || toolArgs.filePath,
                startLine: toolArgs.startLine || 1,
                endLine: toolArgs.endLine || (toolArgs.startLine ? toolArgs.startLine + 50 : undefined)
              });
            } else if (toolName === 'search_files' || toolName === 'grep_search') {
              const matches = result.output.split('\n').filter(l => l.trim() && !l.includes('No matches found')).length;
              callbacks.onActivityStep?.({
                type: 'search',
                query: toolArgs.query || '',
                resultCount: matches,
                title: `Searched ${toolArgs.query || ''}`
              });
            } else if (toolName === 'list_files' || toolName === 'list_workspace_files') {
              const count = result.output.split('\n').filter(Boolean).length;
              callbacks.onActivityStep?.({
                type: 'explore',
                title: `Explored workspace (${count} items)`,
                detail: result.output
              });
            } else if (toolName === 'get_diagnostics' || toolName === 'diagnostics') {
              callbacks.onActivityStep?.({
                type: 'diagnostics',
                title: `Checked diagnostics ${path.basename(toolArgs.filePath || toolArgs.path || 'workspace')}`,
                path: toolArgs.filePath || toolArgs.path
              });
            }
          }

          if (isCommand) {
            const rootName = path.basename(this.toolExecutor.getWorkspaceRoot()) || 'workspace';
            callbacks.onActivityStep?.({
              type: 'command',
              title: `Ran ${toolArgs.command}`,
              command: toolArgs.command,
              cwd: `...\\${rootName}`,
              output: result.output,
              detail: result.output,
              exitCode: result.error ? 1 : 0,
              status: result.error ? 'error' : 'completed',
              id: taskId
            });
            callbacks.onTaskEnd?.(taskId, toolArgs.command, result.error ? 1 : 0, result.output);
          }

          // If a file was created or modified, open it in VS Code editor (only if enabled in settings)
          const shouldAutoOpen = session?.autoOpenModifiedFiles ?? this.sessionManager.getDefaultSettings()?.autoOpenModifiedFiles ?? false;
          const isFileMutationTool = toolName === 'create_file' || toolName === 'write_file' || toolName === 'edit_file' || toolName === 'replace_file_content' || toolName === 'multi_replace_file_content';
          if (shouldAutoOpen && isFileMutationTool && toolArgs.path && !result.error) {
            try {
              const fullPath = this.toolExecutor.resolvePath(toolArgs.path);
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
              await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });
            } catch {}
          }

          callbacks.onToolEnd(tc.id, toolName, result.output, result.error);

          let stepAdded = 0;
          let stepRemoved = 0;
          if (toolName === 'create_file' || toolName === 'write_file') {
            stepAdded = toolArgs.content ? toolArgs.content.split('\n').length : 0;
          } else if (toolName === 'edit_file' || toolName === 'replace_file_content') {
            stepRemoved = (toolArgs.targetContent || toolArgs.search || '').split('\n').length;
            stepAdded = (toolArgs.replacementContent || toolArgs.replace || '').split('\n').length;
          }

          const toolMsg: ChatMessage = {
            id: 'tool_' + Date.now(),
            role: 'tool',
            content: result.output,
            toolCallId: tc.id,
            name: toolName,
            filePath: toolArgs.path || toolArgs.filePath,
            added: stepAdded,
            removed: stepRemoved,
            timestamp: Date.now()
          };
          this.sessionManager.addMessage(toolMsg);
        }

        if (!this.isRunning || this.abortController?.signal?.aborted) {
          break;
        }

        const hasQuestionTool = pendingToolCalls.some(tc => {
          const n = tc.function.name;
          return n === 'ask_user' || n === 'ask_question' || n === 'confirm' || n === 'notify_user';
        });

        const isWaitingUser = isAssistantWaitingForUser(currentAssistantContent);

        if (hasQuestionTool || isWaitingUser) {
          callbacks.onStatus('Waiting for user input...');
          callbacks.onComplete('stop');
          break;
        }

        // If in Agent Mode, continue the autonomous step loop
        if (session.agentMode && pendingToolCalls.length > 0) {
          callbacks.onStatus(`Agent · Step ${iteration + 1} (autonomous cycle)`);
          continue;
        }

        // Self-Healing Diagnostics Check
        if (touchedCodeFile && selfHealingAttempts < maxRetries) {
          callbacks.onStatus('Checking syntax and diagnostics...');
          const diagResult = await this.toolExecutor.getDiagnostics(lastTouchedFile);

          if (diagResult.error) {
            selfHealingAttempts++;
            callbacks.onStatus(`Errors detected. Self-healing ${selfHealingAttempts}/${maxRetries}...`);

            const autoHealingMsg: ChatMessage = {
              id: 'healing_' + Date.now(),
              role: 'tool',
              content: `[SELF-HEALING] Language server detected syntax/type diagnostics in '${lastTouchedFile}':\n${diagResult.output}\n\nPlease fix these errors using replace_file_content until clean.`,
              timestamp: Date.now()
            };
            this.sessionManager.addMessage(autoHealingMsg);
            continue;
          }
        }
      }

      if (this.isRunning && !this.abortController?.signal?.aborted) {
        callbacks.onStatus('Ready');
        callbacks.onComplete('stop');
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || this.abortController?.signal?.aborted || err.message === 'Operation cancelled by user') {
        callbacks.onStatus('Stopped by user');
        callbacks.onComplete('cancelled');
      } else {
        callbacks.onError(err.message || String(err));
      }
    } finally {
      const currentSession = this.sessionManager.getCurrentSession();
      if (currentSession) {
        currentSession.messages = (currentSession.messages || []).filter(m =>
          !m.isInternal &&
          !m.id?.startsWith('nudge_') &&
          !m.id?.startsWith('plan_nudge_') &&
          !m.id?.startsWith('reprompt_') &&
          !m.content?.startsWith('CRITICAL EXECUTION:') &&
          !m.content?.startsWith('SYSTEM UNSTUCK:') &&
          !m.content?.startsWith('Task execution prompt:') &&
          !m.content?.startsWith('Exploration complete') &&
          !m.content?.startsWith('Present the architectural concept')
        );
      }
      this.sessionManager.saveToStorage();
      this.isRunning = false;
      this.abortController = null;
      this.activeCallbacks = null;
    }
  }

  private pruneMessagesForRequest(systemPrompt: string, allMessages: ChatMessage[], maxLimit: number = 120, session?: ChatSession): ChatMessage[] {
    const sysMsg: ChatMessage = {
      id: 'sys_prompt',
      role: 'system',
      content: systemPrompt,
      timestamp: 0
    };

    // Helper to truncate huge individual message contents to avoid character and token limit blowouts.
    // Tool outputs (terminal outputs, big file reads, dir trees) are the #1 cause of context amnesia!
    const sanitizeMessage = (m: ChatMessage): ChatMessage => {
      // With 1M context, allow rich tool outputs (up to 60,000 chars, safely under 131k API cap), and user/asst up to 100,000 chars
      const limit = m.role === 'tool' ? 60000 : 100000;
      if (m.content && m.content.length > limit) {
        const head = m.content.slice(0, Math.floor(limit * 0.65));
        const tail = m.content.slice(-Math.floor(limit * 0.25));
        return {
          ...m,
          content: `${head}\n\n... [Output truncated (${m.content.length} chars) for context efficiency] ...\n\n${tail}`
        };
      }
      return m;
    };

    const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
    const isTrailingDirective = Boolean(lastMessage && (
      lastMessage.isInternal ||
      lastMessage.id?.startsWith('nudge_') ||
      lastMessage.id?.startsWith('plan_nudge_') ||
      lastMessage.id?.startsWith('reprompt_') ||
      lastMessage.content?.startsWith('CRITICAL EXECUTION:') ||
      lastMessage.content?.startsWith('SYSTEM UNSTUCK:') ||
      lastMessage.content?.startsWith('Task execution prompt:') ||
      lastMessage.content?.startsWith('Exploration complete') ||
      lastMessage.content?.startsWith('Present the architectural concept')
    ));

    let activeMessages = allMessages.filter((m, idx) => {
      // Always preserve the trailing directive / unstuck message for the current turn
      if (isTrailingDirective && idx === allMessages.length - 1) {
        return true;
      }
      return (
        !m.isInternal &&
        !m.id?.startsWith('nudge_') &&
        !m.id?.startsWith('plan_nudge_') &&
        !m.id?.startsWith('reprompt_') &&
        !m.id?.startsWith('compact_') &&
        !m.content?.startsWith('CRITICAL EXECUTION:') &&
        !m.content?.startsWith('SYSTEM UNSTUCK:') &&
        !m.content?.startsWith('Task execution prompt:') &&
        !m.content?.startsWith('Exploration complete') &&
        !m.content?.startsWith('Present the architectural concept') &&
        !m.content?.startsWith('[COMPACTED CONTEXT BRIEFING]')
      );
    });

    const finalizeResult = (list: ChatMessage[]): ChatMessage[] => {
      const merged = this.collapseConsecutiveUserMessages(list);
      // Guarantee that the request sent to LLM never ends on an assistant message
      if (merged.length > 1 && merged[merged.length - 1].role === 'assistant') {
        merged.push({
          id: 'cont_' + Date.now(),
          role: 'user',
          content: 'Continue your work and proceed to the next step.',
          isInternal: true,
          timestamp: Date.now()
        });
      }
      return merged;
    };

    // If compaction summary exists, inject it as internal briefing and slice messages after the compaction boundary
    if (session?.compactedSummary) {
      let cutIdx = -1;
      if (session.compactedAtMessageId) {
        cutIdx = activeMessages.findIndex(m => m.id === session.compactedAtMessageId);
      }
      if (cutIdx !== -1) {
        activeMessages = activeMessages.slice(cutIdx + 1);
      } else {
        activeMessages = activeMessages.slice(Math.max(0, activeMessages.length - 10));
      }

      // Ensure no orphaned tool message at boundary
      let startIdx = 0;
      while (startIdx < activeMessages.length && activeMessages[startIdx].role === 'tool') {
        startIdx++;
      }
      activeMessages = activeMessages.slice(startIdx);

      const briefingMsgs: ChatMessage[] = [];
      const CHUNK_SIZE = 100000;
      const summaryText = session.compactedSummary || '';
      if (summaryText.length <= CHUNK_SIZE) {
        briefingMsgs.push({
          id: 'compact_briefing_user',
          role: 'user',
          content: `[COMPACTED AGENT CONTEXT]\n${summaryText}`,
          isInternal: true,
          timestamp: 0
        });
      } else {
        let offset = 0;
        let partIdx = 1;
        const totalParts = Math.ceil(summaryText.length / CHUNK_SIZE);
        while (offset < summaryText.length) {
          const slice = summaryText.slice(offset, offset + CHUNK_SIZE);
          briefingMsgs.push({
            id: `compact_briefing_user_${partIdx}`,
            role: 'user',
            content: `[COMPACTED AGENT CONTEXT PART ${partIdx}/${totalParts}]\n${slice}`,
            isInternal: true,
            timestamp: 0
          });
          if (partIdx < totalParts) {
            briefingMsgs.push({
              id: `compact_briefing_ack_${partIdx}`,
              role: 'assistant',
              content: `Context part ${partIdx}/${totalParts} loaded.`,
              isInternal: true,
              timestamp: 0
            });
          }
          offset += CHUNK_SIZE;
          partIdx++;
        }
      }

      briefingMsgs.push({
        id: 'compact_briefing_asst',
        role: 'assistant',
        content: 'Context briefing recognized. Ready to proceed with the next task step.',
        isInternal: true,
        timestamp: 0
      });

      const rawResult = [sysMsg, ...briefingMsgs, ...activeMessages.map(sanitizeMessage)];
      return finalizeResult(rawResult);
    }

    // Helper to merge consecutive user messages (e.g. repeated user 'continue' clicks)
    // to strictly preserve clean turn-taking and avoid triggering proxy spam/loop filters.
    if (activeMessages.length <= maxLimit) {
      return finalizeResult([sysMsg, ...activeMessages.map(sanitizeMessage)]);
    }

    // Always preserve the initial user intent (first user message)
    const firstUserMsg = activeMessages.find(m => m.role === 'user');

    // Find any proposed plan message if exists
    const planMsg = activeMessages.find(m => m.role === 'assistant' && (m.content.includes('<plan>') || m.content.includes('### Plan') || m.content.includes('### Implementation Plan')));

    // Get the most recent messages (sliding window)
    const reservedSlots = 1 + (firstUserMsg ? 1 : 0) + (planMsg ? 1 : 0);
    const recentCount = Math.max(8, maxLimit - reservedSlots);
    let startIdx = Math.max(0, activeMessages.length - recentCount);

    // CRITICAL: Prevent orphaned tool messages at the boundary!
    // If startIdx points to a 'tool' message, step backwards to include its parent assistant
    while (startIdx > 0 && activeMessages[startIdx].role === 'tool') {
      startIdx--;
    }
    const recentMessages = activeMessages.slice(startIdx);

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

    return finalizeResult(result);
  }

  private collapseConsecutiveUserMessages(list: ChatMessage[]): ChatMessage[] {
    const merged: ChatMessage[] = [];
    for (const msg of list) {
      if (merged.length > 0 && merged[merged.length - 1].role === 'user' && msg.role === 'user') {
        const prev = merged[merged.length - 1];
        if (prev.content.trim() === msg.content.trim()) {
          continue;
        }
        prev.content = `${prev.content}\n\n${msg.content}`;
      } else {
        merged.push(msg);
      }
    }
    return merged;
  }

  private detectMalformedToolCall(
    content: string,
    reasoning: string,
    session?: ChatSession
  ): { isMalformed: boolean; reason: string; fragment: string; salvageableCommand?: string } {
    const rawContent = (content || '').trim();
    const rawReasoning = (reasoning || '').trim();

    // 1. Orphan closing tag without opening tag: e.g. "mkdir ... </command>" or "echo ... </tool_call>"
    const orphanCloseMatch = rawContent.match(/(?:^|\n|[\s\S]{0,120}?)([\w\s\\/.\-&|;:"']{2,200}?)\s*<\/(command|tool_call|function_call|call|tool|write_file|create_file|replace_file_content|edit_file|read_file)>/i);
    if (orphanCloseMatch) {
      const tag = orphanCloseMatch[2].toLowerCase();
      const snippet = orphanCloseMatch[1].trim();
      const hasMatchingOpen = new RegExp(`<${tag}\\b`, 'i').test(rawContent) ||
        (tag === 'command' && (/<run_command\b/i.test(rawContent) || /<tool_call\b/i.test(rawContent)));
      if (!hasMatchingOpen && snippet) {
        return {
          isMalformed: true,
          reason: `Found closing tag </${tag}> without opening <${tag}> tag`,
          fragment: orphanCloseMatch[0].trim().slice(0, 150),
          salvageableCommand: tag === 'command' ? snippet : undefined
        };
      }
    }

    // 2. Unclosed opening tool tag: e.g. <tool_call name="run_command"> without </tool_call>
    const unclosedToolCall = rawContent.match(/<(?:tool_call|function_call|tool)\s+[^>]*name=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*)$/i);
    if (unclosedToolCall && !/<\/(?:tool_call|function_call|call|tool)>/i.test(unclosedToolCall[0])) {
      return {
        isMalformed: true,
        reason: `Unclosed <tool_call> block for "${unclosedToolCall[1]}" (missing closing tag)`,
        fragment: unclosedToolCall[0].slice(0, 150)
      };
    }

    // 3. Unclosed <command> tag
    if (/<command\b[^>]*>/i.test(rawContent) && !/<\/command>/i.test(rawContent)) {
      return {
        isMalformed: true,
        reason: `Unclosed <command> tag (missing </command>)`,
        fragment: rawContent.slice(0, 150)
      };
    }

    // 4. Broken or unclosed DSML block
    if (/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+(?:call|invoke)/i.test(rawContent) &&
        !/<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}>/i.test(rawContent)) {
      return {
        isMalformed: true,
        reason: `Malformed or unclosed DSML tool invocation block`,
        fragment: rawContent.slice(0, 150)
      };
    }

    // 5. Raw JSON tool call printed in plain text without XML wrapping: e.g. {"name": "run_command", "arguments": ...}
    const rawJsonMatch = rawContent.match(/\{[\s\r\n]*"(?:name|tool|function)"[\s\r\n]*:[\s\r\n]*"(?:run_command|write_file|create_file|replace_file_content|read_file|list_files)"[\s\S]*?\}/i);
    if (rawJsonMatch) {
      return {
        isMalformed: true,
        reason: `Raw JSON tool call passed without required XML tag wrapping (<tool_call name="...">)`,
        fragment: rawJsonMatch[0].slice(0, 150)
      };
    }

    // 6. Model produced empty or whitespace content, but reasoning contains explicit action promise in execution mode
    if (!rawContent && rawReasoning && session?.agentMode && (session.planConfirmed || session.planMode === false)) {
      const reasoningAction = /(?:let me create|let me execute|let me run|i will create|i will now create|i will run|i'll run|i'll create|first create the|создам папку|создам файл|выполню команду|запущу команду)/i.test(rawReasoning);
      if (reasoningAction) {
        return {
          isMalformed: true,
          reason: `Model formulated action in reasoning/thinking, but produced an empty response body without emitting tool calls`,
          fragment: rawReasoning.slice(0, 150)
        };
      }
    }

    // 7. Standalone raw shell command output in execution phase with no narrative text
    if (rawContent && session?.agentMode && (session.planConfirmed || session.planMode === false)) {
      const isSingleShellCmd = /^(?:mkdir|cd|python|node|npm|git|touch|cat|ls|dir|rm|pip)\s+[^\n]{3,150}$/i.test(rawContent);
      if (isSingleShellCmd) {
        return {
          isMalformed: true,
          reason: `Raw shell command emitted without XML tool tags`,
          fragment: rawContent,
          salvageableCommand: rawContent
        };
      }
    }

    return { isMalformed: false, reason: '', fragment: '' };
  }

  public parseToolCallsFromContent(content: string, existingCallsCount: number = 0, session?: ChatSession): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    if (!content) return toolCalls;

    const processSingleCall = (rawToolName: string, inner: string) => {
      const callId = `call_${Date.now()}_${existingCallsCount + toolCalls.length}`;

      // Normalize tool names to supported tool functions
      let toolName = rawToolName.trim();
      if (toolName === 'list_files' || toolName === 'ls' || toolName === 'dir') {
        toolName = 'list_workspace_files';
      } else if (toolName === 'read_file' || toolName === 'view_file' || toolName === 'cat') {
        toolName = 'view_file_slice';
      } else if (toolName === 'edit_file') {
        toolName = 'replace_file_content';
      } else if (toolName === 'create_file') {
        toolName = 'write_file';
      } else if (toolName === 'run_command' || toolName === 'bash' || toolName === 'terminal' || toolName === 'cmd' || toolName === 'exec' || toolName === 'command') {
        toolName = 'run_terminal_command';
      } else if (toolName === 'diagnostics') {
        toolName = 'get_diagnostics';
      } else if (toolName === 'grep' || toolName === 'find_files') {
        toolName = 'search_files';
      } else if (toolName === 'ask_question' || toolName === 'ask' || toolName === 'question' || toolName === 'confirm' || toolName === 'notify_user') {
        toolName = 'ask_user';
      }

      let toolArgs: any = {};

      // If the model wrapped arguments in JSON inside the tag
      if (inner.startsWith('{') && inner.endsWith('}')) {
        try {
          toolArgs = JSON.parse(inner);
        } catch {}
      }

      if (Object.keys(toolArgs).length === 0) {
        // Extract DSML or standard XML parameter tags if present: <parameter name="..." ...>VALUE</parameter>
        const dsmlParams: Record<string, string> = {};
        const dsmlParamRegex = /<(?:[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+)?(?:parameter|param)\s+name=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)(?:<\/(?:[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}(?:\s*(?:parameter|param))?|(?:parameter|param))>|(?=<[|\uFF5C]{1,2}DSML)|(?=<(?:parameter|param)\b)|$)/gi;
        let dMatch: RegExpExecArray | null;
        while ((dMatch = dsmlParamRegex.exec(inner)) !== null) {
          dsmlParams[dMatch[1].trim()] = dMatch[2].trim();
        }

        if (toolName === 'write_file') {
          const pm = inner.match(/<(?:path|file|filepath)>([\s\S]*?)<\/(?:path|file|filepath)>/i);
          const cm = inner.match(/<content>([\s\S]*?)<\/content>/i);
          const om = inner.match(/<overwrite\b[^>]*>\s*(true|false)\s*<\/overwrite>/i) || inner.match(/<overwrite\s+value=["'](true|false)["']/i);
          const pathVal = dsmlParams.path || dsmlParams.file || dsmlParams.filepath || (pm ? pm[1].trim() : '');
          
          let contentVal = dsmlParams.content !== undefined ? dsmlParams.content : (cm ? cm[1] : undefined);
          if (contentVal === undefined) {
            const cStartMatch = inner.match(/<content\b[^>]*>/i);
            if (cStartMatch && cStartMatch.index !== undefined) {
              const afterContentTag = inner.slice(cStartMatch.index + cStartMatch[0].length);
              const closeTagMatch = afterContentTag.match(/<\/(?:content|tool_call|function_call|call|tool)\b[^>]*>/i);
              contentVal = closeTagMatch && closeTagMatch.index !== undefined
                ? afterContentTag.slice(0, closeTagMatch.index)
                : afterContentTag;
            } else {
              contentVal = inner.replace(/<(?:path|file|filepath)>[\s\S]*?<\/(?:path|file|filepath)>/i, '').replace(/<overwrite\b[^>]*>[\s\S]*?<\/overwrite>/i, '').trim();
            }
          }

          const overwriteVal = dsmlParams.overwrite !== undefined
            ? (dsmlParams.overwrite.toLowerCase() === 'true' || dsmlParams.overwrite === '1')
            : (om ? om[1].toLowerCase() === 'true' : false);

          toolArgs = {
            path: pathVal,
            content: contentVal,
            overwrite: overwriteVal
          };
        } else if (toolName === 'replace_file_content') {
          const pm = inner.match(/<(?:path|file|filepath)>([\s\S]*?)<\/(?:path|file|filepath)>/i);
          const pathVal = dsmlParams.path || dsmlParams.file || dsmlParams.filepath || (pm ? pm[1].trim() : '');

          let targetVal = dsmlParams.targetContent || dsmlParams.search || dsmlParams.target || dsmlParams.original || dsmlParams.before || '';
          let replacementVal = dsmlParams.replacementContent || dsmlParams.replace || dsmlParams.replacement || dsmlParams.after || '';
          let hasExplicitReplace = dsmlParams.replacementContent !== undefined || dsmlParams.replace !== undefined || dsmlParams.replacement !== undefined || dsmlParams.after !== undefined;

          // Robust tag boundary parsing for XML tags
          const searchStartRegex = /<(?:search|target|targetContent|original|before)\b[^>]*>/i;
          const replaceStartRegex = /<(?:replace|replacement|replacementContent|after)\b[^>]*>/i;

          const sMatch = inner.match(searchStartRegex);
          const rMatch = inner.match(replaceStartRegex);

          if (!targetVal && sMatch && sMatch.index !== undefined) {
            const sStart = sMatch.index + sMatch[0].length;
            let sEnd = -1;
            if (rMatch && rMatch.index !== undefined && rMatch.index > sStart) {
              const textBeforeReplace = inner.slice(sStart, rMatch.index);
              const closeSMatch = textBeforeReplace.match(/<\/(?:search|target|targetContent|original|before)\b[^>]*>/i);
              sEnd = closeSMatch && closeSMatch.index !== undefined ? sStart + closeSMatch.index : rMatch.index;
            } else {
              const closeSMatch = inner.slice(sStart).match(/<\/(?:search|target|targetContent|original|before)\b[^>]*>/i);
              sEnd = closeSMatch && closeSMatch.index !== undefined ? sStart + closeSMatch.index : inner.length;
            }
            targetVal = inner.slice(sStart, sEnd);
          }

          if (rMatch && rMatch.index !== undefined) {
            hasExplicitReplace = true;
            if (!replacementVal) {
              const rStart = rMatch.index + rMatch[0].length;
              const textAfterReplace = inner.slice(rStart);
              // Handle proper </replace>, but ALSO handle frequent model hallucinations like </search>, </tool_call>, or EOF
              const closeRMatch = textAfterReplace.match(/<\/(?:replace|replacement|replacementContent|after|search|tool_call|function_call|call|tool)\b[^>]*>/i);
              replacementVal = closeRMatch && closeRMatch.index !== undefined
                ? textAfterReplace.slice(0, closeRMatch.index)
                : textAfterReplace;
            }
          }

          toolArgs = {
            path: pathVal,
            targetContent: targetVal,
            replacementContent: replacementVal,
            hasExplicitReplace
          };
        } else if (toolName === 'view_file_slice') {
          const pm = inner.match(/<(?:path|file|filepath)>([\s\S]*?)<\/(?:path|file|filepath)>/i);
          let rawPath = dsmlParams.path || dsmlParams.file || dsmlParams.filepath || (pm ? pm[1].trim() : '');
          let startLine = dsmlParams.start_line ? parseInt(dsmlParams.start_line, 10) : (dsmlParams.startLine ? parseInt(dsmlParams.startLine, 10) : (dsmlParams.start ? parseInt(dsmlParams.start, 10) : 1));
          let endLine = dsmlParams.end_line ? parseInt(dsmlParams.end_line, 10) : (dsmlParams.endLine ? parseInt(dsmlParams.endLine, 10) : (dsmlParams.end ? parseInt(dsmlParams.end, 10) : 200));

          // Parse #L1-65 or :1-65 in path
          const hashMatch = rawPath.match(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i);
          if (hashMatch) {
            startLine = parseInt(hashMatch[1], 10);
            endLine = hashMatch[2] ? parseInt(hashMatch[2], 10) : startLine + 100;
            rawPath = rawPath.replace(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i, '').trim();
          }

          const linesMatch = inner.match(/<(?:lines|range)>(\d+)\s*[-:]\s*(\d+)<\/(?:lines|range)>/i);
          if (linesMatch) {
            startLine = parseInt(linesMatch[1], 10);
            endLine = parseInt(linesMatch[2], 10);
          } else {
            const sMatch = inner.match(/<(?:start_line|startLine|start)>(\d+)<\/(?:start_line|startLine|start)>/i);
            if (sMatch) startLine = parseInt(sMatch[1], 10);
            const eMatch = inner.match(/<(?:end_line|endLine|end)>(\d+)<\/(?:end_line|endLine|end)>/i);
            if (eMatch) endLine = parseInt(eMatch[1], 10);
          }

          toolArgs = { path: rawPath, startLine, endLine };
        } else if (toolName === 'run_terminal_command') {
          const cm = inner.match(/<(?:command|cmd)>([\s\S]*?)<\/(?:command|cmd)>/i);
          const cwdMatch = inner.match(/<(?:cwd|dir)>([\s\S]*?)<\/(?:cwd|dir)>/i);
          let rawCmd = dsmlParams.command || dsmlParams.cmd || (cm ? cm[1].trim() : inner.trim());
          rawCmd = rawCmd
            .replace(/<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}(?:\s*(?:call|invoke))?>/gi, '')
            .replace(/^<(?:[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+)?(?:parameter|param)\s+name=["']?(?:command|cmd)["']?[^>]*>/i, '')
            .replace(/<\/(?:[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+)?(?:parameter|param)>$/i, '')
            .replace(/^<(?:command|cmd)[^>]*>/i, '')
            .replace(/<\/(?:command|cmd)>$/i, '')
            .trim();
          toolArgs = {
            command: rawCmd,
            cwd: dsmlParams.cwd || dsmlParams.dir || (cwdMatch ? cwdMatch[1].trim() : undefined)
          };
        } else if (toolName === 'list_workspace_files') {
          const pm = inner.match(/<(?:path|folder|dir)>([\s\S]*?)<\/(?:path|folder|dir)>/i);
          const rm = inner.match(/<recursive>(true|false)<\/recursive>/i);
          let folder = dsmlParams.path || dsmlParams.folder || dsmlParams.dir || (pm ? pm[1].trim() : (inner.trim() && !inner.trim().includes('<') ? inner.trim() : '.'));
          toolArgs = {
            folder: folder || '.',
            recursive: dsmlParams.recursive !== undefined ? dsmlParams.recursive.toLowerCase() === 'true' : (rm ? rm[1].toLowerCase() === 'true' : false)
          };
        } else if (toolName === 'get_diagnostics') {
          const pm = inner.match(/<(?:filePath|path|file)>([\s\S]*?)<\/(?:filePath|path|file)>/i);
          toolArgs = {
            filePath: dsmlParams.filePath || dsmlParams.path || (pm ? pm[1].trim() : undefined)
          };
        } else if (toolName === 'search_files') {
          const qm = inner.match(/<query>([\s\S]*?)<\/query>/i);
          const pm = inner.match(/<(?:filePattern|pattern)>([\s\S]*?)<\/(?:filePattern|pattern)>/i);
          toolArgs = {
            query: dsmlParams.query || (qm ? qm[1].trim() : inner.trim()),
            filePattern: dsmlParams.filePattern || dsmlParams.pattern || (pm ? pm[1].trim() : undefined)
          };
        } else if (toolName === 'read_rule') {
          const rm = inner.match(/<(?:ruleName|name|rule)>([\s\S]*?)<\/(?:ruleName|name|rule)>/i);
          toolArgs = {
            ruleName: dsmlParams.ruleName || dsmlParams.name || (rm ? rm[1].trim() : inner.trim())
          };
        } else if (toolName === 'ask_user') {
          const qm = inner.match(/<(?:question|prompt|text|message)>([\s\S]*?)<\/(?:question|prompt|text|message)>/i);
          toolArgs = {
            question: dsmlParams.question || dsmlParams.prompt || (qm ? qm[1].trim() : inner.replace(/<[^>]+>/g, '').trim())
          };
        }
      }

      // Check for placeholder / dummy arguments and discard them
      const isDummyPath = (p: string | undefined): boolean => {
        if (!p) return true;
        const norm = p.trim().toLowerCase().replace(/\\/g, '/');
        if (/^(?:путь[\/]|relative[\/]path|path[\/]to|filename\.ext|new_file\.ext|файлу\.ext|file\.ext|\.[\/]file\.ext|test_file\.ext)/i.test(norm) ||
            norm === 'путь' || norm === 'файлу.ext' || norm === 'file.ext' || norm.includes('путь/к/файлу')) {
          return true;
        }
        return isInvalidCodePropertyPath(p, this.toolExecutor.getWorkspaceRoot());
      };

      const isDummyCommand = (cmd: string | undefined): boolean => {
        if (!cmd) return true;
        const norm = cmd.trim().toLowerCase();
        return /^(?:\.{1,}|…|command|команда(?:\s+для\s+запуска)?|command_here|python script\.py arg1 arg2|команда\s+запуска|command to run|todo|your command here)$/i.test(norm) ||
               norm === '...' || norm === '…' || norm === '..' || norm === '.' ||
               norm.includes('команда для запуска') ||
               norm.startsWith('<command>') || norm.endsWith('</command>');
      };

      const isDummyContent = (cnt: string | undefined): boolean => {
        if (!cnt) return true;
        const norm = cnt.trim().toLowerCase();
        return /^(?:полный код нового файла|complete file content here|код нового файла)$/i.test(norm) ||
               norm.includes('полный код нового файла');
      };

      // Discard placeholder calls immediately
      if (toolName === 'write_file' && (isDummyPath(toolArgs.path) || isDummyContent(toolArgs.content))) {
        return;
      }
      if (toolName === 'replace_file_content' && (isDummyPath(toolArgs.path) || !toolArgs.targetContent)) {
        return;
      }
      if (toolName === 'view_file_slice' && isDummyPath(toolArgs.path)) {
        return;
      }
      if (toolName === 'get_diagnostics' && isDummyPath(toolArgs.filePath)) {
        return;
      }
      if (toolName === 'run_terminal_command' && isDummyCommand(toolArgs.command)) {
        return;
      }

      // If in Plan Mode and the user EXPLICITLY demanded a plan that is NOT yet confirmed:
      // Block modifying tools until plan confirmation, but ALLOW read-only inspection commands for exploration.
      if (session && session.planMode !== false && session.planExplicitlyDemanded && !session.planConfirmed) {
        if (toolName === 'write_file' || toolName === 'replace_file_content') {
          return;
        }
        if (toolName === 'run_terminal_command' && !isReadOnlyCommand(toolArgs.command)) {
          return;
        }
      }

      const serializedArgs = JSON.stringify(toolArgs);
      if (toolCalls.some(t => t.function.name === toolName && t.function.arguments === serializedArgs)) {
        return;
      }

      toolCalls.push({
        id: callId,
        type: 'function',
        function: {
          name: toolName,
          arguments: serializedArgs
        }
      });
    };

    // 1. Comprehensive XML Regex matching:
    // - Standard: <tool_call name="...">...</tool_call> or </call> or </tool> or </function_call>
    const toolCallRegex = /<(?:tool_call|function_call|tool)\s+[^>]*?name=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)(?:<\/(?:tool_call|function_call|call|tool)>|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = toolCallRegex.exec(content)) !== null) {
      processSingleCall(m[1], m[2]);
    }

    // Direct tag matching: <create_file>...</create_file>, <write_file>...</write_file>, <replace_file_content>...
    const directTagRegex = /<(create_file|write_file|replace_file_content|edit_file|run_command|run_terminal_command|list_files|read_file|view_file|view_file_slice|get_diagnostics|ask_user)\b[^>]*>([\s\S]*?)(?:<\/\1>|$)/gi;
    while ((m = directTagRegex.exec(content)) !== null) {
      processSingleCall(m[1], m[2]);
    }

    // 2. DSML Format Regex matching:
    // - Matches <｜｜DSML｜｜ call name="..."> or <||DSML|| invoke name="...">
    const dsmlRegex = /<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+(?:call|invoke)\s+name=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}(?:\s*(?:call|invoke))?>|(?=<[|\uFF5C]{1,2}DSML)|$)/gi;
    while ((m = dsmlRegex.exec(content)) !== null) {
      processSingleCall(m[1], m[2]);
    }

    return toolCalls;
  }

  public async runCompact(callbacks: AgentCallbacks): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    const visibleMessages = (session.messages || []).filter(m => !m.isInternal && !m.id?.startsWith('compact_') && !m.content?.startsWith('[COMPACTED CONTEXT BRIEFING]') && !m.content.startsWith('/compact') && !m.content.startsWith('/сжать'));
    if (visibleMessages.length === 0) {
      callbacks.onStatus('Ready');
      callbacks.onComplete?.('stop');
      return;
    }

    callbacks.onStatus('Compacting...');
    callbacks.onActivityStep?.({
      type: 'compact',
      title: 'Compacting'
    });

    let uncompactedMessages = visibleMessages;
    if (session.compactedSummary && session.compactedAtMessageId) {
      const cutIdx = visibleMessages.findIndex(m => m.id === session.compactedAtMessageId);
      if (cutIdx !== -1) {
        uncompactedMessages = visibleMessages.slice(cutIdx + 1);
      }
    }
    const messagesToCompact = uncompactedMessages.length > 0 ? uncompactedMessages : visibleMessages;

    const summary = await this.generateCompactSummary(messagesToCompact, session);
    if (!summary) {
      callbacks.onActivityStep?.({
        type: 'compact_done',
        title: 'Compacted'
      });
      callbacks.onError('Не удалось сформировать сжатый контекст.');
      return;
    }

    const lastMsgId = messagesToCompact[messagesToCompact.length - 1]?.id || visibleMessages[visibleMessages.length - 1]?.id;
    this.sessionManager.setCompactedContext(summary, lastMsgId);

    callbacks.onActivityStep?.({
      type: 'compact_done',
      title: 'Compacted'
    });

    // Recalculate tokens
    const activeProject = this.sessionManager.getActiveProject();
    const systemPrompt = await this.promptBuilder.buildSystemPrompt(activeProject, {
      agentMode: session.agentMode !== false,
      planMode: session.planMode !== false,
      planConfirmed: Boolean(session.planConfirmed),
      deadMode: Boolean(session.deadMode)
    });
    const toolsForRun = session.agentMode ? TOOL_DEFINITIONS : undefined;
    const messagesToSend = this.pruneMessagesForRequest(systemPrompt, session.messages, 120, session);
    let turnUsage = countConversationTokens(messagesToSend, toolsForRun, DEFAULT_CONTEXT_LIMIT);
    turnUsage.lastCompactTimestamp = session.lastCompactTimestamp;
    this.sessionManager.updateTokens(turnUsage.totalTokens, turnUsage.promptTokens, turnUsage.completionTokens, turnUsage.userTokens, undefined, turnUsage.toolTokens);
    const compactLifetime = this.sessionManager.getLifetimeTokenUsage(session);
    turnUsage.cumulativeTokensSpent = compactLifetime.cumulativeTokensSpent;
    turnUsage.userTokens = compactLifetime.userTokens;
    turnUsage.llmTokens = compactLifetime.llmTokens;
    turnUsage.toolTokens = compactLifetime.toolTokens;
    turnUsage.cumulativeUserTokens = compactLifetime.userTokens;
    turnUsage.cumulativeLlmTokens = compactLifetime.llmTokens;
    turnUsage.cumulativeToolTokens = compactLifetime.toolTokens;
    callbacks.onTokenUsage?.(turnUsage);

    callbacks.onChunk?.('История диалога успешно сжата. Все предыдущие сообщения сохранены в интерфейсе, а в запросы к модели передается компактная сводка состояния.');
    callbacks.onStatus('Ready');
    callbacks.onComplete('stop');
  }

  private async generateCompactSummary(messages: ChatMessage[], session: ChatSession): Promise<string> {
    const compactSystemPrompt = this.promptBuilder.getModeSnippet('compact_summary') ||
      `You are the Context Compaction Engine. Distill the conversation into a dense, precise, and actionable state summary. Preserve all file paths, plan tasks, and technical details.`;

    const validMessages = (messages || []).filter(m => !m.isInternal && !m.id?.startsWith('compact_') && !m.content?.startsWith('[COMPACTED CONTEXT BRIEFING]'));

    // Windowing: if message count is large, preserve initial goal messages + recent execution window
    let messagesToInclude: ChatMessage[] = validMessages;
    let omittedCount = 0;
    if (validMessages.length > 30) {
      const head = validMessages.slice(0, 3);
      omittedCount = validMessages.length - 28;
      messagesToInclude = head;
    }

    let historyTranscript = '';
    // Dynamic Compacting: we do NOT inject or re-compact previous summary blocks.
    // Each milestone block summarizes solely the newly executed actions.

    for (let i = 0; i < messagesToInclude.length; i++) {
      const m = messagesToInclude[i];
      const role = m.role.toUpperCase();
      let text = m.content || '';

      // Tighter truncation limits to guarantee staying well under the proxy 131,072 character limit
      const maxChar = m.role === 'tool' ? 1500 : 3000;
      if (text.length > maxChar) {
        text = text.slice(0, Math.floor(maxChar * 0.65)) + '\n...[content truncated for summary]...\n' + text.slice(-Math.floor(maxChar * 0.25));
      }
      historyTranscript += `[${role}]:\n${text}\n\n`;

      if (omittedCount > 0 && i === 2) {
        historyTranscript += `... [${omittedCount} intermediate turns omitted for context compaction] ...\n\n`;
        const tail = validMessages.slice(-25);
        for (const tm of tail) {
          const tRole = tm.role.toUpperCase();
          let tText = tm.content || '';
          const tMax = tm.role === 'tool' ? 1500 : 3000;
          if (tText.length > tMax) {
            tText = tText.slice(0, Math.floor(tMax * 0.65)) + '\n...[content truncated for summary]...\n' + tText.slice(-Math.floor(tMax * 0.25));
          }
          historyTranscript += `[${tRole}]:\n${tText}\n\n`;
        }
        break;
      }
    }

    const requestMessages: ChatMessage[] = [
      {
        id: 'compact_sys',
        role: 'system',
        content: compactSystemPrompt,
        timestamp: 0
      }
    ];

    // Safely chunk historyTranscript so no single message exceeds 100,000 chars (well under 131,072 limit)
    const CHUNK_SIZE = 100000;
    if (historyTranscript.length <= CHUNK_SIZE) {
      requestMessages.push({
        id: 'compact_user',
        role: 'user',
        content: `Distill the following conversation history into the structured COMPACTED AGENT CONTEXT format:\n\n${historyTranscript}`,
        timestamp: Date.now()
      });
    } else {
      let offset = 0;
      let partIdx = 1;
      const totalParts = Math.ceil(historyTranscript.length / CHUNK_SIZE);
      while (offset < historyTranscript.length) {
        const slice = historyTranscript.slice(offset, offset + CHUNK_SIZE);
        requestMessages.push({
          id: `compact_chunk_${partIdx}`,
          role: 'user',
          content: `[CONTEXT HISTORY PART ${partIdx}/${totalParts}]:\n${slice}`,
          timestamp: Date.now()
        });
        if (partIdx < totalParts) {
          requestMessages.push({
            id: `compact_chunk_ack_${partIdx}`,
            role: 'assistant',
            content: `Part ${partIdx}/${totalParts} received. Please provide the remaining context.`,
            timestamp: Date.now()
          });
        }
        offset += CHUNK_SIZE;
        partIdx++;
      }
      requestMessages.push({
        id: 'compact_user_final',
        role: 'user',
        content: 'All history parts provided above. Now distill the entire history into the structured COMPACTED AGENT CONTEXT format.',
        timestamp: Date.now()
      });
    }

    let summary = '';
    try {
      await new Promise<void>((resolve, reject) => {
        this.client.streamChatCompletion(
          requestMessages,
          {
            model: session.model,
            thinking: false,
            search: false,
            deadMode: session.deadMode,
            agentMode: false
          },
          {
            onChunk: (delta) => {
              summary += delta;
            },
            onReasoningChunk: () => {},
            onError: (err) => reject(err),
            onComplete: () => resolve()
          },
          this.abortController?.signal
        );
      });
    } catch (err: any) {
      console.error('[Engine] Failed to generate compact summary:', err);
      return '';
    }

    return summary.trim();
  }

  private async generateGeneralCompactSummary(blocks: string[], session: ChatSession, isUltra: boolean): Promise<string> {
    const targetTokens = calculateTargetCompactedTokens(isUltra ? ULTRA_COMPACT_THRESHOLD : GENERAL_COMPACT_THRESHOLD);
    const systemPrompt = isUltra
      ? `You are the Ultra-Context Ground Truth Engine. Distill the entire cumulative history of the project into an authoritative, dense master technical blueprint. Preserve all exact active file paths, core architecture, data contracts, and immediate pending tasks. Zero fluff.`
      : `You are the Meta-Compaction Engine. Consolidate the preceding milestone stages into a unified, high-level project archive. Reconcile superseded steps and preserve the current ground-truth code state and architecture. Target size: ~${targetTokens} tokens.`;

    // Join all blocks into a combined narrative
    const combinedBlocksText = blocks.map((b, idx) => `[MILESTONE ${idx + 1}]:\n${b}`).join('\n\n');

    const requestMessages: ChatMessage[] = [
      {
        id: 'meta_sys',
        role: 'system',
        content: systemPrompt,
        timestamp: 0
      }
    ];

    // Safely chunk if larger than 100,000 chars so no single message trips the proxy 131k limit
    const CHUNK_SIZE = 100000;
    if (combinedBlocksText.length <= CHUNK_SIZE) {
      requestMessages.push({
        id: 'meta_user',
        role: 'user',
        content: `Consolidate the following milestone stages into a single unified archive:\n\n${combinedBlocksText}`,
        timestamp: Date.now()
      });
    } else {
      let offset = 0;
      let part = 1;
      const totalParts = Math.ceil(combinedBlocksText.length / CHUNK_SIZE);
      while (offset < combinedBlocksText.length) {
        const slice = combinedBlocksText.slice(offset, offset + CHUNK_SIZE);
        requestMessages.push({
          id: `meta_chunk_${part}`,
          role: 'user',
          content: `[ARCHIVE PART ${part}/${totalParts}]:\n${slice}`,
          timestamp: Date.now()
        });
        if (part < totalParts) {
          requestMessages.push({
            id: `meta_ack_${part}`,
            role: 'assistant',
            content: `Part ${part}/${totalParts} received. Please provide the remaining archive blocks.`,
            timestamp: Date.now()
          });
        }
        offset += CHUNK_SIZE;
        part++;
      }
      requestMessages.push({
        id: 'meta_user_final',
        role: 'user',
        content: 'All milestone parts provided above. Now produce the final consolidated summary.',
        timestamp: Date.now()
      });
    }

    let summary = '';
    try {
      await new Promise<void>((resolve, reject) => {
        this.client.streamChatCompletion(
          requestMessages,
          {
            model: session.model,
            thinking: false,
            search: false,
            deadMode: session.deadMode,
            agentMode: false
          },
          {
            onChunk: (delta) => {
              summary += delta;
            },
            onReasoningChunk: () => {},
            onError: (err) => reject(err),
            onComplete: () => resolve()
          },
          this.abortController?.signal
        );
      });
      return summary.trim();
    } catch (err: any) {
      logger.log('Engine', 'General compaction failed:', err);
      return '';
    }
  }
}
