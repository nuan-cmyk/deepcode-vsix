import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentEngine } from '../agent/engine';
import { SessionManager } from '../agent/sessionManager';
import { DeepSeekClient } from '../client/deepseekClient';

import { ToolExecutor } from '../tools';

export class DeepSeekViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'deepseek.agentView';

  private view?: vscode.WebviewView;
  private extensionContext: vscode.ExtensionContext;
  private engine: AgentEngine;
  private sessionManager: SessionManager;
  private client: DeepSeekClient;
  private toolExecutor: ToolExecutor;

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

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'ready':
          this.sendSessionInit();
          this.sendProjectsHierarchy();
          break;

        case 'sendMessage':
          await this.handleUserMessage(data.text);
          break;

        case 'continue':
          await this.handleContinue();
          break;

        case 'stop':
          this.engine.stop();
          this.view?.webview.postMessage({ type: 'finish', finishReason: 'cancelled' });
          this.view?.webview.postMessage({ type: 'status', text: 'Остановлено пользователем' });
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

          this.client.updateConfig(newUrl, newKey || (await this.extensionContext.secrets.get('deepseek_api_key') || ''));
          this.sessionManager.updateModel(newModel);

          vscode.window.showInformationMessage(`DeepSeek подключен к ${newUrl}!`);
          this.view?.webview.postMessage({
            type: 'authSaved',
            hasApiKey: true,
            baseUrl: newUrl
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
          await this.handleUserMessage('План утвержден! Начинай выполнять шаги по порядку. Обязательно сверяйся с планом, отмечай выполненные пункты, проводи верификацию синтаксиса и тестов, и не заканчивай цикл, пока все проверки не будут пройдены.');
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
    const apiKey = await this.extensionContext.secrets.get('deepseek_api_key');
    const config = vscode.workspace.getConfiguration('deepseek');
    const baseUrl = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');

    this.view.webview.postMessage({
      type: 'initSession',
      session,
      activeProject,
      hasApiKey: !!apiKey,
      baseUrl
    });

    if (!apiKey) {
      // Proactively prompt user with VS Code InputBox as well
      vscode.window.showInputBox({
        title: 'DeepSeek Agent Authentication',
        prompt: 'Enter your DeepSeek API Key or DeepAuth Token (sk-...):',
        password: true,
        ignoreFocusOut: true
      }).then(async (key) => {
        if (key && key.trim()) {
          await this.extensionContext.secrets.store('deepseek_api_key', key.trim());
          vscode.window.showInformationMessage('DeepSeek API Key saved!');
          this.view?.webview.postMessage({
            type: 'authSaved',
            hasApiKey: true
          });
        }
      });
    }
  }

  private async getOrPromptApiKey(): Promise<string | undefined> {
    let key = await this.extensionContext.secrets.get('deepseek_api_key');
    if (!key) {
      key = await vscode.window.showInputBox({
        title: 'DeepSeek Agent Authentication',
        prompt: 'Enter your DeepSeek API Key or DeepAuth Token (sk-...) to get started',
        password: true,
        ignoreFocusOut: true
      });

      if (key && key.trim()) {
        await this.extensionContext.secrets.store('deepseek_api_key', key.trim());
        vscode.window.showInformationMessage('DeepSeek API Key saved securely in SecretStorage.');
      }
    }
    return key;
  }

  private async handleUserMessage(text: string) {
    const apiKey = await this.getOrPromptApiKey();
    if (!apiKey) {
      this.view?.webview.postMessage({
        type: 'error',
        message: 'DeepSeek API Key is required to chat. Please provide it.'
      });
      return;
    }

    const config = vscode.workspace.getConfiguration('deepseek');
    const baseUrl = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');
    this.client.updateConfig(baseUrl, apiKey);

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
      onComplete: (finishReason) => {
        this.view?.webview.postMessage({ type: 'finish', finishReason });
      },
      onError: (err) => {
        this.view?.webview.postMessage({ type: 'error', message: err });
      }
    });
  }

  private async handleContinue() {
    const apiKey = await this.getOrPromptApiKey();
    if (!apiKey) return;

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
      onComplete: (finishReason) => {
        this.view?.webview.postMessage({ type: 'finish', finishReason });
      },
      onError: (err) => {
        this.view?.webview.postMessage({ type: 'error', message: err });
      }
    });
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

    html = html.replace('href="styles.css"', `href="${stylesUri}"`);
    html = html.replace('src="app.js"', `src="${appJsUri}"`);

    return html;
  }
}
