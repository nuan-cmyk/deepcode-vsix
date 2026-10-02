import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project, SandboxMode } from './types';

export interface PromptBuildOptions {
  agentMode?: boolean;
  planMode?: boolean;
  planConfirmed?: boolean;
  deadMode?: boolean;
  sandboxMode?: SandboxMode;
}

export class PromptBuilder {
  private extensionPath: string;
  private snippetCache: Map<string, string> = new Map();

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * Reads a prompt markdown file from src/prompts/modes/ with caching.
   * Allows replacing or tuning prompt snippets purely by editing markdown files.
   */
  public getModeSnippet(name: string): string {
    if (this.snippetCache.has(name)) {
      return this.snippetCache.get(name)!;
    }

    const filePath = path.join(this.extensionPath, 'src', 'prompts', 'modes', `${name}.md`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        this.snippetCache.set(name, content);
        return content;
      } catch {
        return '';
      }
    }
    return '';
  }

  /**
   * Builds the complete dynamic system prompt for the current turn.
   */
  public async buildSystemPrompt(project?: Project, options?: PromptBuildOptions): Promise<string> {
    // If agent mode is disabled, use lightweight chat assistant prompt
    if (options && options.agentMode === false) {
      const chatPrompt = this.getModeSnippet('chat_mode');
      return chatPrompt || "You are DeepCode agent, an intelligent programming assistant operating in VS Code. Whenever asked who you are, identify yourself strictly as 'DeepCode agent'. Match the user's language. NO EMOJIS. Keep explanations concise, accurate, and direct.";
    }

    // Base prompt from DEEPSEEK.md
    const basePromptPath = path.join(this.extensionPath, 'src', 'prompts', 'DEEPSEEK.md');
    let systemPrompt = '';

    if (fs.existsSync(basePromptPath)) {
      systemPrompt = await fs.promises.readFile(basePromptPath, 'utf-8');
    } else {
      systemPrompt = 'You are DeepCode agent, an elite autonomous software engineering assistant operating in VS Code. Whenever asked who or what you are, identify yourself strictly as DeepCode agent.';
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

    // Search for project-level instructions (DEEPSEEK.md, AGENTS.md, GEMINI.md, CLAUDE.md)
    let projectInstructions = '';
    const candidateFiles = [
      'DEEPSEEK.md',
      'deepseek.md',
      '.deepseek/rules.md',
      '.deepseek.md',
      'AGENTS.md',
      'GEMINI.md',
      'CLAUDE.md'
    ];

    for (const cName of candidateFiles) {
      const candidatePath = path.isAbsolute(cName) ? cName : path.join(workspaceRoot, cName);
      if (fs.existsSync(candidatePath)) {
        try {
          const raw = fs.readFileSync(candidatePath, 'utf-8');
          const optimized = this.optimizeInstructions(raw);
          if (optimized) {
            projectInstructions = `\n---\n## Project Rules & Directives (${cName})\n${optimized}\n`;
            break;
          }
        } catch {}
      }
    }

    const contextBlock = `
---
## Workspace Context
- Project: ${workspaceName}
- Project Directory: ${workspaceRoot}
- Active File: ${activeFileInfo}
- Operating System: ${process.platform}${filesSummary}
${projectInstructions}
`;

    let assembled = systemPrompt + '\n' + contextBlock;

    // Phase & Mode Snippets from markdown files
    if (options) {
      if (options.planMode === false) {
        const planOffSnippet = this.getModeSnippet('plan_disabled');
        if (planOffSnippet) assembled += '\n\n' + planOffSnippet;
      } else if (!options.planConfirmed) {
        const phase1Snippet = this.getModeSnippet('phase_planning');
        if (phase1Snippet) assembled += '\n\n' + phase1Snippet;
      } else {
        const phase2Snippet = this.getModeSnippet('phase_execution');
        if (phase2Snippet) assembled += '\n\n' + phase2Snippet;
      }

      if (options.deadMode) {
        const deadSnippet = this.getModeSnippet('dead_mode');
        if (deadSnippet) assembled += '\n\n' + deadSnippet;
      }

      if (options.sandboxMode === 'ask') {
        assembled += '\n\n[SANDBOX SECURITY: ASK MODE (READ-ONLY: r--)]\nCRITICAL: You are operating in ASK mode (Read-Only). You do NOT have permission to create, edit, or delete files, and you CANNOT run terminal commands. Any call to create_file, write_file, edit_file, replace_file_content, or run_terminal_command will be automatically REJECTED by the host.\nIf the user asks you to create or modify a file or run a command, DO NOT invoke any tool calls. Directly respond in text explaining that you are in Ask (Read-Only) mode and that they should switch the Sandbox Security mode to Helper or Local to perform file changes.';
      } else if (options.sandboxMode === 'helper') {
        assembled += '\n\n[SANDBOX SECURITY: HELPER MODE (READ & WRITE: rw-)]\nYou are operating in HELPER mode. You can read and modify project files. Terminal commands are disabled. Do NOT attempt to run terminal commands.';
      } else if (options.sandboxMode === 'local') {
        assembled += '\n\n[SANDBOX SECURITY: LOCAL MODE (RWX)]\nYou are operating in LOCAL mode within the active workspace. You can read, write, and execute terminal commands. Commands will be verified and require user authorization.';
      } else if (options.sandboxMode === 'bypass') {
        assembled += '\n\n[SANDBOX SECURITY: BYPASS MODE (UNRESTRICTED RWX)]\nYou are operating in BYPASS mode with unrestricted read, write, and execute permissions.';
      }
    }

    return assembled;
  }

  /**
   * Optimizes rule file content before embedding it into the system prompt:
   * - Normalizes line breaks and collapses excess empty space
   * - Caps size at maxChars (~2000-2500 tokens) so large rule sets don't eat the entire context
   */
  private optimizeInstructions(raw: string, maxChars: number = 8000): string {
    if (!raw) return '';
    let cleaned = raw
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned.length <= maxChars) {
      return cleaned;
    }

    const head = cleaned.slice(0, Math.floor(maxChars * 0.7));
    const tail = cleaned.slice(-Math.floor(maxChars * 0.25));
    return `${head}\n\n... [Project rules truncated for context efficiency] ...\n\n${tail}`;
  }
}
