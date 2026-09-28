import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from './types';

export class PromptBuilder {
  private extensionPath: string;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  public async buildSystemPrompt(project?: Project): Promise<string> {
    const basePromptPath = path.join(this.extensionPath, 'src', 'prompts', 'system_agent.md');
    let systemPrompt = '';

    if (fs.existsSync(basePromptPath)) {
      systemPrompt = await fs.promises.readFile(basePromptPath, 'utf-8');
    } else {
      systemPrompt = 'You are DeepSeek Agent, an autonomous software engineering assistant operating in VS Code.';
    }

    // Embed active project context
    const folders = vscode.workspace.workspaceFolders;
    const workspaceName = project ? project.name : (folders && folders.length > 0 ? folders[0].name : 'Default Project');
    const workspaceRoot = project ? project.path : (folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd());

    const activeEditor = vscode.window.activeTextEditor;
    let activeFileInfo = 'None';
    if (activeEditor) {
      const docPath = activeEditor.document.uri.fsPath;
      const activeRel = path.relative(workspaceRoot, docPath).replace(/\\/g, '/');
      if (!activeRel.startsWith('..') && !path.isAbsolute(activeRel)) {
        const lang = activeEditor.document.languageId;
        const lineCount = activeEditor.document.lineCount;
        activeFileInfo = `${activeRel} (Language: ${lang}, Lines: ${lineCount})`;
      } else {
        activeFileInfo = 'None (no open file inside workspace)';
      }
    }

    // List top-level files in project if directory exists
    let filesSummary = '\n- Project Files: (Empty directory — no files or folders)';
    if (fs.existsSync(workspaceRoot)) {
      try {
        const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
        const list = entries
          .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'venv' && e.name !== '__pycache__')
          .slice(0, 40)
          .map(e => e.isDirectory() ? `[DIR] ${e.name}/` : `[FILE] ${e.name}`);
        if (list.length > 0) {
          filesSummary = '\n- Project Files:\n' + list.map(l => '  ' + l).join('\n');
        }
      } catch {}
    }

    const contextBlock = `
---
## Workspace Context
- Project: ${workspaceName}
- Project Directory: ${workspaceRoot}
- Active File: ${activeFileInfo}
- Operating System: ${process.platform}${filesSummary}
`;

    return systemPrompt + '\n' + contextBlock;
  }
}
