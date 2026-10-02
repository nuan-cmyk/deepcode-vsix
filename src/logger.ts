import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class LoggerService {
  private channel: vscode.OutputChannel | null = null;
  private webviewListener: ((entry: string) => void) | null = null;
  private logFilePath: string | null = null;

  public init(context?: vscode.ExtensionContext) {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel('DeepCode');
      context?.subscriptions.push(this.channel);
    }
    if (context?.globalStorageUri) {
      try {
        const dir = context.globalStorageUri.fsPath;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.logFilePath = path.join(dir, 'deepcode.log');
      } catch {}
    }
  }

  public setWebviewListener(listener: ((entry: string) => void) | null) {
    this.webviewListener = listener;
  }

  public log(category: string, message: string, ...args: any[]) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const extra = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    const line = `[${timeStr}] [${category}] ${message}${extra}`;
    console.log(line);
    this.channel?.appendLine(line);
    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, line + '\n', 'utf-8');
      } catch {}
    }
    if (this.webviewListener) {
      try {
        this.webviewListener(line);
      } catch {}
    }
  }

  public getLogFilePath(): string | null {
    return this.logFilePath;
  }

  public show() {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel('DeepCode');
    }
    this.channel.show(true);
  }
}

export const logger = new LoggerService();
