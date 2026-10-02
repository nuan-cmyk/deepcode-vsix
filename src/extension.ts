import * as vscode from 'vscode';
import { DeepSeekClient } from './client/deepseekClient';
import { ToolExecutor } from './tools';
import { PromptBuilder } from './agent/promptBuilder';
import { SessionManager } from './agent/sessionManager';
import { AgentEngine } from './agent/engine';
import { DeepSeekViewProvider } from './webview/provider';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
  // 1. Core Services Initialization
  logger.init(context);
  logger.log('Extension', 'DeepCode activated.');

  const config = vscode.workspace.getConfiguration('deepseek');
  const baseUrl = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');

  const client = new DeepSeekClient(baseUrl, '');
  const toolExecutor = new ToolExecutor(context);
  const promptBuilder = new PromptBuilder(context.extensionPath);
  const sessionManager = new SessionManager(context);
  const engine = new AgentEngine(client, toolExecutor, promptBuilder, sessionManager);

  // 2. Register Webview Provider
  const provider = new DeepSeekViewProvider(context, engine, sessionManager, client, toolExecutor);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DeepSeekViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      provider.handleWorkspaceFolderChanged();
    })
  );

  // 3. Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('deepseek.showLogs', () => {
      logger.show();
    }),

    vscode.commands.registerCommand('deepseek.newChat', () => {
      provider.handleNewChat();
      vscode.commands.executeCommand('deepseek.agentView.focus');
    }),

    vscode.commands.registerCommand('deepseek.history', () => {
      provider.handleToggleHistory();
    }),

    vscode.commands.registerCommand('deepseek.openSettings', () => {
      provider.handleOpenSettings();
    }),

    vscode.commands.registerCommand('deepseek.toggleAutoMode', () => {
      const session = sessionManager.getCurrentSession();
      sessionManager.updateAutoMode(!session.autoMode);
      vscode.window.showInformationMessage(
        `DeepCode Auto Mode: ${!session.autoMode ? 'ENABLED ⚡' : 'DISABLED'}`
      );
    }),

    vscode.commands.registerCommand('deepseek.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        title: 'DeepCode API Key / DeepAuth Token',
        prompt: 'Enter your API Key or Token (sk-...):',
        password: true,
        ignoreFocusOut: true
      });
      if (key && key.trim()) {
        await context.secrets.store('deepseek_api_key', key.trim());
        vscode.window.showInformationMessage('DeepCode API Key saved securely.');
      }
    }),

    vscode.commands.registerCommand('deepseek.setBaseUrl', async () => {
      const current = config.get<string>('baseUrl', 'https://api.thenck4.ru/v1');
      const newUrl = await vscode.window.showInputBox({
        title: 'DeepCode Server Base URL',
        prompt: 'Enter API endpoint URL:',
        value: current,
        ignoreFocusOut: true
      });
      if (newUrl && newUrl.trim()) {
        await config.update('baseUrl', newUrl.trim(), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`DeepCode Base URL updated to: ${newUrl.trim()}`);
      }
    }),

    vscode.commands.registerCommand('deepseek.focus', () => {
      vscode.commands.executeCommand('deepseek.agentView.focus');
    })
  );
}

export function deactivate() {}
