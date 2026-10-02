import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentEngine } from '../agent/engine';
import { SessionManager } from '../agent/sessionManager';
import { DeepSeekClient } from '../client/deepseekClient';
import { ToolExecutor, TOOL_DEFINITIONS } from '../tools';
import { countConversationTokens, countMessageTokens, DEFAULT_CONTEXT_LIMIT, TokenUsageStats, updateTokenizerConfig } from '../agent/tokenizer';
import { logger } from '../logger';

export class DeepSeekViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'deepseek.agentView';

  private view?: vscode.WebviewView;
  private extensionContext: vscode.ExtensionContext;
  private engine: AgentEngine;
  private sessionManager: SessionManager;
  private client: DeepSeekClient;
  private toolExecutor: ToolExecutor;
  private pendingPermissionRequests = new Map<string, (decision: 'run_once' | 'always_allow' | 'deny') => void>();

  public handleOpenSettings() {
    if (this.view) {
      this.view.show?.(true);
      this.view.webview.postMessage({ type: 'openSettings' });
    }
  }

  constructor(
    context: vscode.ExtensionContext,
    engine: AgentEngine,
    sessionManager: SessionManager,
    client: DeepSeekClient,
    toolExecutor: ToolExecutor
  ) {
    this.extensionContext = context;
    this.engine = engine;
    this.sessionManager = sessionManager;
    this.client = client;
    this.toolExecutor = toolExecutor;
    const defs = this.sessionManager.getDefaultSettings();
    if (defs.commandTimeoutSec) {
      this.toolExecutor.commandTimeoutMs = defs.commandTimeoutSec * 1000;
    }
    updateTokenizerConfig({
      contextLimitTokens: defs.contextLimitTokens,
      compactThresholdTokens: defs.compactThresholdTokens,
      cyrillicCharsPerToken: defs.cyrillicCharsPerToken,
      latinCharsPerToken: defs.latinCharsPerToken
    });

    const activeProj = this.sessionManager.getActiveProject();
    if (activeProj && activeProj.path) {
      this.toolExecutor.setWorkspaceRoot(activeProj.path);
    }
  }

  public handleWorkspaceFolderChanged() {
    const proj = this.sessionManager.syncWithWorkspaceFolders();
    if (proj && proj.path) {
      this.toolExecutor.setWorkspaceRoot(proj.path);
    }
    this.sendProjectsHierarchy();
    this.sendSessionInit();
  }

  public handleNewChat() {
    const activeProj = this.sessionManager.getActiveProject();
    if (activeProj && activeProj.path) {
      this.toolExecutor.setWorkspaceRoot(activeProj.path);
    }
    this.sessionManager.createNewSession(activeProj?.id);
    this.sendSessionInit();
    this.sendProjectsHierarchy();
  }

  public handleShowHistoryQuickPick() {
    interface ChatQuickPickItem extends vscode.QuickPickItem {
      sessionId?: string;
      isNewChat?: boolean;
    }

    const quickPick = vscode.window.createQuickPick<ChatQuickPickItem>();
    quickPick.placeholder = 'Select a conversation or start new chat...';
    quickPick.matchOnDescription = true;
    quickPick.ignoreFocusOut = true;

    const buildItems = (): ChatQuickPickItem[] => {
      const hierarchy = this.sessionManager.getProjectHierarchy();
      const items: ChatQuickPickItem[] = [];

      items.push({
        label: '$(add) New Chat',
        description: 'Start a new conversation',
        isNewChat: true
      });

      for (const h of hierarchy) {
        for (const s of h.sessions) {
          const activeLabel = s.isActive ? ' • Current' : '';
          const dateStr = new Date(s.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          items.push({
            label: `$(comment-discussion) ${h.project.name}:${s.title || 'Untitled'}`,
            description: `${s.messageCount} msg${s.messageCount === 1 ? '' : 's'} · ${dateStr}${activeLabel}`,
            sessionId: s.id,
            buttons: [
              {
                iconPath: new vscode.ThemeIcon('trash'),
                tooltip: 'Delete chat'
              }
            ]
          });
        }
      }
      return items;
    };

    quickPick.items = buildItems();

    quickPick.onDidTriggerItemButton((e) => {
      if (e.item.sessionId) {
        this.sessionManager.deleteSession(e.item.sessionId);
        this.sendProjectsHierarchy();
        this.sendSessionInit();
        quickPick.items = buildItems();
      }
    });

    quickPick.onDidAccept(() => {
      const picked = quickPick.selectedItems[0];
      quickPick.hide();
      if (!picked) return;

      if (picked.isNewChat) {
        this.handleNewChat();
      } else if (picked.sessionId) {
        this.sessionManager.setCurrentSession(picked.sessionId);
        const activeProj = this.sessionManager.getActiveProject();
        if (activeProj) {
          this.toolExecutor.setWorkspaceRoot(activeProj.path);
        }
        this.sendProjectsHierarchy();
        this.sendSessionInit();
      }

      vscode.commands.executeCommand('deepseek.agentView.focus');
    });

    quickPick.onDidHide(() => {
      quickPick.dispose();
    });

    quickPick.show();
  }

  public handleToggleHistory() {
    this.handleShowHistoryQuickPick();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.extensionContext.extensionPath, 'src', 'webview', 'ui')),
        vscode.Uri.file(path.join(this.extensionContext.extensionPath, 'media'))
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    logger.setWebviewListener((entry) => {
      this.view?.webview.postMessage({ type: 'log_entry', entry });
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      try {
        switch (data.command) {
        case 'ready':
          this.sendSessionInit();
          this.sendProjectsHierarchy();
          break;

        case 'sendMessage':
          if (data.toggles) {
            this.sessionManager.updateToggles(data.toggles);
          } else {
            if (data.planMode !== undefined) {
              this.sessionManager.updateToggles({ planMode: data.planMode });
            }
            if (data.sandboxMode !== undefined) {
              this.sessionManager.updateToggles({ sandboxMode: data.sandboxMode });
            }
          }
          await this.handleUserMessage(data.text);
          break;

        case 'continue':
          await this.handleContinue();
          break;

        case 'stop':
          for (const [reqId, resolver] of this.pendingPermissionRequests) {
            try {
              resolver('deny');
            } catch {}
          }
          this.pendingPermissionRequests.clear();
          this.engine.stop();
          this.view?.webview.postMessage({ type: 'finish', finishReason: 'cancelled' });
          break;

        case 'setAutoMode':
          this.sessionManager.updateAutoMode(Boolean(data.autoMode));
          break;

        case 'setModel':
          this.sessionManager.updateModel(data.model);
          break;

        case 'setTitle':
          this.sessionManager.updateTitle(data.title);
          this.sendProjectsHierarchy();
          break;

        case 'newChat':
          this.sessionManager.createNewSession(data.projectId);
          this.sendSessionInit();
          this.sendProjectsHierarchy();
          break;

        case 'getProjectsHierarchy':
          this.sendProjectsHierarchy();
          break;

        case 'createProject': {
          const name = data.name ? data.name.trim() : 'Project';
          let folderPath = data.path ? data.path.trim() : '';
          if (!folderPath) {
            folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
          }
          const proj = this.sessionManager.createProject(name, folderPath);
          this.toolExecutor.setWorkspaceRoot(proj.path);
          this.sendProjectsHierarchy();
          this.sendSessionInit();
          break;
        }

        case 'selectProject': {
          const proj = this.sessionManager.setActiveProject(data.projectId);
          if (proj) {
            this.toolExecutor.setWorkspaceRoot(proj.path);
          }
          this.sendProjectsHierarchy();
          this.sendSessionInit();
          break;
        }

        case 'deleteProject': {
          this.sessionManager.deleteProject(data.projectId);
          const activeProj = this.sessionManager.getActiveProject();
          if (activeProj) {
            this.toolExecutor.setWorkspaceRoot(activeProj.path);
          }
          this.sendProjectsHierarchy();
          this.sendSessionInit();
          break;
        }

        case 'renameProject': {
          if (data.projectId && data.name) {
            this.sessionManager.renameProject(data.projectId, data.name);
            this.sendProjectsHierarchy();
          }
          break;
        }

        case 'browseFolder': {
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Выбрать папку проекта'
          });
          if (uris && uris.length > 0) {
            this.view?.webview.postMessage({
              type: 'folderSelected',
              path: uris[0].fsPath
            });
          }
          break;
        }

        case 'getHistory':
          this.sendProjectsHierarchy();
          break;

        case 'switchSession': {
          const sess = this.sessionManager.setCurrentSession(data.id);
          const activeProj = this.sessionManager.getActiveProject();
          if (activeProj) {
            this.toolExecutor.setWorkspaceRoot(activeProj.path);
          }
          this.sendProjectsHierarchy();
          this.sendSessionInit();
          break;
        }

        case 'deleteSession':
          this.sessionManager.deleteSession(data.id);
          this.sendProjectsHierarchy();
          this.sendSessionInit();
          break;

        case 'saveAuth': {
          const newKey = data.apiKey ? data.apiKey.trim() : '';
          const newUrl = data.baseUrl ? data.baseUrl.trim() : 'https://api.thenck4.ru/v1';
          const newModel = data.model || 'deepseek-chat';

          if (newKey) {
            await this.extensionContext.secrets.store('deepseek_api_key', newKey);
          }
          const conf = vscode.workspace.getConfiguration('deepseek');
          await conf.update('baseUrl', newUrl, vscode.ConfigurationTarget.Global);
          await conf.update('model', newModel, vscode.ConfigurationTarget.Global);

          if (data.defaults) {
            await this.sessionManager.setDefaultSettings(data.defaults);
            if (data.defaults.sandboxMode) {
              this.sessionManager.updateToggles({ sandboxMode: data.defaults.sandboxMode });
            }
          }

          const defs = this.sessionManager.getDefaultSettings();
          this.client.updateConfig(
            newUrl,
            newKey || (await this.extensionContext.secrets.get('deepseek_api_key') || ''),
            {
              pacingDelayMs: defs.pacingDelayMs,
              requestDelayMs: defs.requestDelayMs,
              connectTimeoutSec: defs.connectTimeoutSec,
              readTimeoutSec: defs.readTimeoutSec,
              thinkingTimeoutSec: defs.thinkingTimeoutSec
            }
          );
          if (defs.commandTimeoutSec) {
            this.toolExecutor.commandTimeoutMs = defs.commandTimeoutSec * 1000;
          }
          updateTokenizerConfig({
            contextLimitTokens: defs.contextLimitTokens,
            compactThresholdTokens: defs.compactThresholdTokens,
            cyrillicCharsPerToken: defs.cyrillicCharsPerToken,
            latinCharsPerToken: defs.latinCharsPerToken
          });
          this.sessionManager.updateModel(newModel);

          vscode.window.showInformationMessage(`DeepSeek подключен к ${newUrl}!`);
          this.view?.webview.postMessage({
            type: 'authSaved',
            hasApiKey: true,
            apiKey: newKey,
            baseUrl: newUrl,
            defaults: this.sessionManager.getDefaultSettings()
          });
          break;
        }

        case 'testConnection': {
          const testClient = new DeepSeekClient(data.baseUrl || 'https://api.thenck4.ru/v1', data.apiKey || '');
          const testRes = await testClient.checkHealth();
          this.view?.webview.postMessage({
            type: 'healthResult',
            ok: testRes.ok,
            status: testRes.status,
            pingMs: testRes.pingMs,
            error: testRes.error
          });
          break;
        }

        case 'setToggles': {
          if (data.toggles) {
            this.sessionManager.updateToggles(data.toggles);
          }
          break;
        }

        case 'commandPermissionResponse': {
          if (data.requestId && this.pendingPermissionRequests.has(data.requestId)) {
            const resolver = this.pendingPermissionRequests.get(data.requestId)!;
            this.pendingPermissionRequests.delete(data.requestId);
            resolver(data.decision || 'deny');
          }
          break;
        }

        case 'killTask': {
          const ok = this.engine.killTask(data.taskId);
          this.view?.webview.postMessage({
            type: 'task_killed',
            taskId: data.taskId,
            success: ok
          });
          break;
        }

        case 'confirmPlan': {
          this.sessionManager.setPlanConfirmed(true);
          await this.handleUserMessage('Plan approved. Proceed with execution step by step. Verify syntax and tests, and complete the tasks.');
          break;
        }

        case 'openFile': {
          if (data.path) {
            const activeProj = this.sessionManager.getActiveProject();
            const root = activeProj ? activeProj.path : (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd());
            const full = path.isAbsolute(data.path) ? data.path : path.join(root, data.path);
            try {
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(full));
              await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });
            } catch {
              vscode.window.showErrorMessage(`Не удалось открыть файл: ${data.path}`);
            }
          }
          break;
        }

        case 'addContext':
          await this.handleAddContext();
          break;

        case 'showHistory':
          this.handleShowHistoryQuickPick();
          break;

        case 'showLogs':
          logger.show();
          break;

        case 'openExternal':
          if (data.url) {
            vscode.env.openExternal(vscode.Uri.parse(data.url));
          }
          break;
      }
    } catch (err) {
      console.error('Error handling webview message:', err);
    }
  });
  }

  private sendProjectsHierarchy() {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: 'projectsHierarchy',
      hierarchy: this.sessionManager.getProjectHierarchy(),
      activeProjectId: this.sessionManager.getActiveProject().id,
      activeSessionId: this.sessionManager.getCurrentSession().id
    });
  }

  private async sendSessionInit() {
    if (!this.view) return;
    const session = this.sessionManager.getCurrentSession();
    const activeProject = this.sessionManager.getActiveProject();
    let apiKey = await this.extensionContext.secrets.get('deepseek_api_key');
    const config = vscode.workspace.getConfiguration('deepseek');
    const baseUrl = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');

    let tokenUsage: TokenUsageStats;
    if (session.totalTokens && session.totalTokens > 0) {
      let userTokens = session.userTokens;
      if (userTokens === undefined && session.messages) {
        userTokens = 0;
        for (const m of session.messages) {
          if (m.role === 'user') {
            userTokens += countMessageTokens(m);
          }
        }
      }
      tokenUsage = {
        promptTokens: session.promptTokens || 7908,
        completionTokens: session.completionTokens || 0,
        totalTokens: session.totalTokens,
        userTokens: userTokens || 0,
        systemTokens: session.promptTokens || 7908,
        contextTokens: session.totalTokens,
        maxTokens: DEFAULT_CONTEXT_LIMIT,
        percent: Math.min(100, Math.round((session.totalTokens / DEFAULT_CONTEXT_LIMIT) * 100)),
        lastCompactTimestamp: session.lastCompactTimestamp,
        cumulativeTokensSpent: session.cumulativeTokensSpent || session.totalTokens,
        rawTokensProcessedTotal: session.rawTokensProcessedTotal
      };
    } else {
      const toolsForInit = session.agentMode ? TOOL_DEFINITIONS : undefined;
      tokenUsage = countConversationTokens(session.messages, toolsForInit, DEFAULT_CONTEXT_LIMIT);
      tokenUsage.cumulativeTokensSpent = session.cumulativeTokensSpent || tokenUsage.totalTokens;
      tokenUsage.rawTokensProcessedTotal = session.rawTokensProcessedTotal;
      this.sessionManager.updateTokens(tokenUsage.totalTokens, tokenUsage.promptTokens, tokenUsage.completionTokens, tokenUsage.userTokens);
    }

    this.view.webview.postMessage({
      type: 'initSession',
      session,
      activeProject,
      defaults: this.sessionManager.getDefaultSettings(),
      hasApiKey: !!apiKey,
      apiKey: apiKey || '',
      baseUrl,
      tokenUsage
    });
  }

  private async getOrPromptApiKey(): Promise<string | undefined> {
    let key = await this.extensionContext.secrets.get('deepseek_api_key');
    if (!key) {
      key = await vscode.window.showInputBox({
        prompt: 'Enter your DeepSeek API Key or Token (sk-...):',
        ignoreFocusOut: true,
        password: true
      });
      if (key) {
        await this.extensionContext.secrets.store('deepseek_api_key', key.trim());
      }
    }
    return key;
  }

  private async handleUserMessage(text: string) {
    try {
      const apiKey = await this.getOrPromptApiKey();
      if (!apiKey) {
        this.view?.webview.postMessage({
          type: 'error',
          message: 'DeepSeek API Key is required to chat. Please provide it.'
        });
        this.view?.webview.postMessage({ type: 'finish', finishReason: 'cancelled' });
        return;
      }

      const config = vscode.workspace.getConfiguration('deepseek');
      const baseUrl = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');
      const defs = this.sessionManager.getDefaultSettings();
      this.client.updateConfig(baseUrl, apiKey, {
        pacingDelayMs: defs.pacingDelayMs,
        requestDelayMs: defs.requestDelayMs,
        connectTimeoutSec: defs.connectTimeoutSec,
        readTimeoutSec: defs.readTimeoutSec,
        thinkingTimeoutSec: defs.thinkingTimeoutSec
      });
      if (defs.commandTimeoutSec) {
        this.toolExecutor.commandTimeoutMs = defs.commandTimeoutSec * 1000;
      }
      updateTokenizerConfig({
        contextLimitTokens: defs.contextLimitTokens,
        compactThresholdTokens: defs.compactThresholdTokens,
        cyrillicCharsPerToken: defs.cyrillicCharsPerToken,
        latinCharsPerToken: defs.latinCharsPerToken
      });

      await this.engine.runUserPrompt(text, {
        onChunk: (delta) => {
          this.view?.webview.postMessage({ type: 'chunk', content: delta });
        },
        onReasoningChunk: (delta) => {
          this.view?.webview.postMessage({ type: 'reasoning_chunk', content: delta });
        },
        onToolStart: (callId, name, args) => {
          this.view?.webview.postMessage({ type: 'tool_call_start', callId, name, args });
        },
        onToolEnd: (callId, name, result, error) => {
          this.view?.webview.postMessage({ type: 'tool_call_end', callId, name, result, error });
        },
        onStatus: (status) => {
          this.view?.webview.postMessage({ type: 'status', text: status });
        },
        onTurnStart: (iteration) => {
          this.view?.webview.postMessage({ type: 'turn_start', iteration });
        },
        onPlanProposed: (planText, planItems) => {
          this.view?.webview.postMessage({ type: 'plan_proposed', planText, planItems });
        },
        onTaskStart: (taskId, command) => {
          this.view?.webview.postMessage({ type: 'task_start', taskId, command });
        },
        onTaskEnd: (taskId, command, exitCode, output) => {
          this.view?.webview.postMessage({ type: 'task_end', taskId, command, exitCode, output });
        },
        onActivityStep: (step) => {
          this.view?.webview.postMessage({ type: 'activity_step', step });
        },
        onTokenUsage: (usage) => {
          const currentSession = this.sessionManager.getCurrentSession();
          this.view?.webview.postMessage({
            type: 'token_usage',
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            userTokens: usage.userTokens,
            systemTokens: usage.systemTokens,
            contextTokens: usage.contextTokens,
            maxTokens: usage.maxTokens,
            percent: usage.percent,
            lastCompactTimestamp: usage.lastCompactTimestamp || currentSession.lastCompactTimestamp,
            cumulativeTokensSpent: usage.cumulativeTokensSpent || currentSession.cumulativeTokensSpent || usage.totalTokens,
            rawTokensProcessedTotal: usage.rawTokensProcessedTotal || currentSession.rawTokensProcessedTotal
          });
        },
        onMessagesCompacted: () => {
          this.sendSessionInit();
        },
        onCommandPermissionRequest: (req) => {
          return new Promise<'run_once' | 'always_allow' | 'deny'>((resolve) => {
            this.pendingPermissionRequests.set(req.requestId, resolve);
            this.view?.webview.postMessage({
              type: 'command_permission_request',
              requestId: req.requestId,
              command: req.command,
              cwd: req.cwd
            });
          });
        },
        onComplete: (finishReason) => {
          logger.log('Chat:Out', `[Turn Complete: ${finishReason}]`);
          this.view?.webview.postMessage({ type: 'finish', finishReason });
        },
        onError: (err: any) => {
          logger.log('Chat:Error', `[Error] ${err?.message || String(err)}`);
          this.view?.webview.postMessage({ type: 'error', message: err, raw: err });
        }
      });
    } catch (err: any) {
      console.error('Error in handleUserMessage:', err);
      this.view?.webview.postMessage({
        type: 'error',
        message: err?.message || String(err),
        code: err?.code || err?.status,
        raw: err?.stack || err?.message || String(err)
      });
      this.view?.webview.postMessage({ type: 'finish', finishReason: 'error' });
    }
  }

  private async handleContinue() {
    try {
      const apiKey = await this.getOrPromptApiKey();
      if (!apiKey) return;

      const config = vscode.workspace.getConfiguration('deepseek');
      const baseUrl = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');
      const defs = this.sessionManager.getDefaultSettings();
      this.client.updateConfig(baseUrl, apiKey, {
        pacingDelayMs: defs.pacingDelayMs,
        requestDelayMs: defs.requestDelayMs,
        connectTimeoutSec: defs.connectTimeoutSec,
        readTimeoutSec: defs.readTimeoutSec,
        thinkingTimeoutSec: defs.thinkingTimeoutSec
      });
      if (defs.commandTimeoutSec) {
        this.toolExecutor.commandTimeoutMs = defs.commandTimeoutSec * 1000;
      }
      updateTokenizerConfig({
        contextLimitTokens: defs.contextLimitTokens,
        compactThresholdTokens: defs.compactThresholdTokens,
        cyrillicCharsPerToken: defs.cyrillicCharsPerToken,
        latinCharsPerToken: defs.latinCharsPerToken
      });

      await this.engine.runContinue({
        onChunk: (delta) => {
          this.view?.webview.postMessage({ type: 'chunk', content: delta });
        },
        onReasoningChunk: (delta) => {
          this.view?.webview.postMessage({ type: 'reasoning_chunk', content: delta });
        },
        onToolStart: (callId, name, args) => {
          this.view?.webview.postMessage({ type: 'tool_call_start', callId, name, args });
        },
        onToolEnd: (callId, name, result, error) => {
          this.view?.webview.postMessage({ type: 'tool_call_end', callId, name, result, error });
        },
        onStatus: (status) => {
          this.view?.webview.postMessage({ type: 'status', text: status });
        },
        onTurnStart: (iteration) => {
          this.view?.webview.postMessage({ type: 'turn_start', iteration });
        },
        onPlanProposed: (planText, planItems) => {
          this.view?.webview.postMessage({ type: 'plan_proposed', planText, planItems });
        },
        onTaskStart: (taskId, command) => {
          this.view?.webview.postMessage({ type: 'task_start', taskId, command });
        },
        onTaskEnd: (taskId, command, exitCode, output) => {
          this.view?.webview.postMessage({ type: 'task_end', taskId, command, exitCode, output });
        },
        onActivityStep: (step) => {
          this.view?.webview.postMessage({ type: 'activity_step', step });
        },
        onMessagesCompacted: () => {
          this.sendSessionInit();
        },
        onCommandPermissionRequest: (req) => {
          return new Promise<'run_once' | 'always_allow' | 'deny'>((resolve) => {
            this.pendingPermissionRequests.set(req.requestId, resolve);
            this.view?.webview.postMessage({
              type: 'command_permission_request',
              requestId: req.requestId,
              command: req.command,
              cwd: req.cwd
            });
          });
        },
        onComplete: (finishReason) => {
          this.view?.webview.postMessage({ type: 'finish', finishReason });
        },
        onError: (err) => {
          this.view?.webview.postMessage({ type: 'error', message: err, raw: err });
        }
      });
    } catch (err: any) {
      console.error('Error in handleContinue:', err);
      this.view?.webview.postMessage({
        type: 'error',
        message: err?.message || String(err),
        code: err?.code || err?.status,
        raw: err?.stack || err?.message || String(err)
      });
      this.view?.webview.postMessage({ type: 'finish', finishReason: 'error' });
    }
  }

  private async handleAddContext() {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      openLabel: 'Add to Chat Context'
    });

    if (uris && uris.length > 0 && this.view) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const fileNames = uris.map(u => '@' + path.relative(workspaceRoot, u.fsPath).replace(/\\/g, '/')).join(' ');
      this.view.webview.postMessage({
        type: 'chunk',
        content: `\nAdded context: ${fileNames}\n`
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const uiDir = path.join(this.extensionContext.extensionPath, 'src', 'webview', 'ui');
    const htmlPath = path.join(uiDir, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    const stylesUri = webview.asWebviewUri(vscode.Uri.file(path.join(uiDir, 'styles.css')));
    const appJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(uiDir, 'app.js')));
    const fileIconsUri = webview.asWebviewUri(vscode.Uri.file(path.join(uiDir, 'file-icons')));

    html = html.replace('href="styles.css"', `href="${stylesUri}"`);
    html = html.replace('src="app.js"', `src="${appJsUri}"`);
    html = html.replace('</head>', `<script>window.FILE_ICONS_URI = "${fileIconsUri}";</script></head>`);

    return html;
  }
}
