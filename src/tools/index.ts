import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ToolDefinition, SandboxMode, CommandPermissionRequest } from '../agent/types';
import { logger } from '../logger';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read file contents or specific lines from the workspace (e.g. lines 1-65 for imports and definitions).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path to the file' },
          start_line: { type: 'number', description: 'Starting line number (1-indexed)' },
          end_line: { type: 'number', description: 'Ending line number (1-indexed)' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List project files and directories in the workspace to discover project structure.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional directory path or folder to list' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'view_file_slice',
      description: 'View specific lines of a file from the workspace. Use this to inspect imports (lines 1-45), functions, or target areas without loading huge files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path to the file' },
          startLine: { type: 'number', description: 'Starting line number (1-indexed, inclusive)' },
          endLine: { type: 'number', description: 'Ending line number (1-indexed, inclusive)' }
        },
        required: ['path', 'startLine', 'endLine']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'replace_file_content',
      description: 'Surgically replace a single exact block of text in an existing file. targetContent must match the file content character-for-character, including whitespace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path to the file' },
          targetContent: { type: 'string', description: 'The exact lines or block of text to be replaced' },
          replacementContent: { type: 'string', description: 'The new replacement code' }
        },
        required: ['path', 'targetContent', 'replacementContent']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file with the provided content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path to the file' },
          content: { type: 'string', description: 'Full text content to write' },
          overwrite: { type: 'boolean', description: 'Set to true if overwriting an existing file' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_workspace_files',
      description: 'List project files and directories in the workspace to discover project structure.',
      parameters: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Optional subfolder to list' },
          recursive: { type: 'boolean', description: 'Whether to list recursively (defaults to false)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for text or regex across workspace files to find function definitions, imports, or usages.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex search query' },
          filePattern: { type: 'string', description: 'Optional glob pattern to filter files (e.g. *.py, *.ts)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_terminal_command',
      description: 'Execute a terminal command (e.g. test runner, compiler, linter) and capture output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run (e.g. pytest, npm test, tsc --noEmit)' },
          cwd: { type: 'string', description: 'Optional working directory' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Ask the user a clarifying question or request confirmation/input when requirements are ambiguous. Pauses autonomous execution.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question or confirmation prompt for the user' }
        },
        required: ['question']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_diagnostics',
      description: 'Retrieve active language server diagnostics (syntax errors, type issues, linter warnings) from VS Code.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Optional file path to inspect. If omitted, checks all workspace files.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_rule',
      description: 'Retrieve specialized markdown engineering guidance (e.g. chunked_reading, surgical_editing, self_healing).',
      parameters: {
        type: 'object',
        properties: {
          ruleName: { type: 'string', description: 'Name of the rule: chunked_reading, surgical_editing, self_healing, terminal_execution' }
        },
        required: ['ruleName']
      }
    }
  }
];

export class ToolExecutor {
  private workspaceRoot: string;
  private extensionContext: vscode.ExtensionContext;
  public commandTimeoutMs: number = 180000;

  constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
    const folders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();
  }

  public setWorkspaceRoot(newPath: string): void {
    if (newPath && fs.existsSync(newPath)) {
      this.workspaceRoot = newPath;
    }
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public resolvePath(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return targetPath;
    }
    const direct = path.join(this.workspaceRoot, targetPath);
    if (fs.existsSync(direct)) {
      return direct;
    }
    // Only search by basename if targetPath is a bare filename without directory components
    const hasDir = targetPath.includes('/') || targetPath.includes('\\');
    if (!hasDir) {
      const candidate = this.findFileByBasename(this.workspaceRoot, targetPath);
      if (candidate) {
        return candidate;
      }
    }
    return direct;
  }

  private findFileByBasename(dir: string, targetPath: string, depth: number = 0): string | null {
    if (depth > 6 || !fs.existsSync(dir)) return null;
    const normTarget = targetPath.replace(/\\/g, '/');
    const targetBase = path.basename(normTarget);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git') {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isFile()) {
          const rel = path.relative(this.workspaceRoot, full).replace(/\\/g, '/');
          if (rel.endsWith(normTarget) || entry.name.toLowerCase() === targetBase.toLowerCase()) {
            return full;
          }
        } else if (entry.isDirectory()) {
          const sub = this.findFileByBasename(full, targetPath, depth + 1);
          if (sub) return sub;
        }
      }
    } catch {}
    return null;
  }

  public isPathInsideWorkspace(targetPath: string): boolean {
    if (!targetPath) return true;
    try {
      const full = path.resolve(this.resolvePath(targetPath));
      const root = path.resolve(this.workspaceRoot);
      const rel = path.relative(root, full);
      return !rel.startsWith('..') && !path.isAbsolute(rel);
    } catch {
      return false;
    }
  }

  public async execute(
    name: string,
    args: any,
    taskId?: string,
    signal?: AbortSignal,
    options?: {
      sandboxMode?: SandboxMode;
      allowedCommands?: string[];
      onPermissionRequest?: (req: CommandPermissionRequest) => Promise<'run_once' | 'always_allow' | 'deny'>;
    }
  ): Promise<{ output: string; error?: boolean }> {
    if (signal?.aborted) {
      return { output: 'Operation cancelled by user', error: true };
    }

    const sandbox = options?.sandboxMode || 'local';

    // 1. Sandbox Path Containment (local, helper, ask)
    if (sandbox !== 'bypass') {
      const targetPath = args.path || args.folder || args.filePath;
      if (targetPath && !this.isPathInsideWorkspace(targetPath)) {
        return {
          output: `[Sandbox Security Error] Access denied: Path "${targetPath}" is outside the active workspace project.`,
          error: true
        };
      }
    }

    // 2. Sandbox Mode Restrictions
    const isWriteTool = ['replace_file_content', 'edit_file', 'write_file', 'create_file'].includes(name);
    const isCommandTool = ['run_terminal_command', 'run_command'].includes(name);

    if (sandbox === 'ask') {
      if (isWriteTool) {
        return {
          output: '[Sandbox Error] File modifications are disabled in Ask mode (Ask mode is Read-Only: r--).',
          error: true
        };
      }
      if (isCommandTool) {
        return {
          output: '[Sandbox Error] Command execution is disabled in Ask mode (Ask mode is Read-Only: r--).',
          error: true
        };
      }
    } else if (sandbox === 'helper') {
      if (isCommandTool) {
        return {
          output: '[Sandbox Error] Command execution is disabled in Helper mode (Helper mode allows only file read and write operations: rw-).',
          error: true
        };
      }
    } else if (sandbox === 'local') {
      if (isCommandTool) {
        if (args.cwd && !this.isPathInsideWorkspace(args.cwd)) {
          return {
            output: `[Sandbox Security Error] Working directory "${args.cwd}" is outside the active workspace project.`,
            error: true
          };
        }

        const cmdStr = (args.command || '').trim();
        const isWhitelisted = options?.allowedCommands?.some(c => c.trim() === cmdStr);

        if (!isWhitelisted && options?.onPermissionRequest) {
          const decision = await options.onPermissionRequest({
            requestId: 'perm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            command: cmdStr,
            cwd: args.cwd || this.workspaceRoot
          });

          if (decision === 'deny') {
            return {
              output: `[Sandbox] Execution of command "${cmdStr}" was denied by user.`,
              error: true
            };
          }
        }
      }
    }

    const execStart = Date.now();
    logger.log('Tool', `[${name}] Starting execution...`);

    try {
      let toolResult: { output: string; error?: boolean };
      switch (name) {
        case 'view_file_slice':
        case 'read_file': {
          let sLine = 1;
          let eLine = 200;
          let filePath = args.path || '';

          // Parse #L1-65 or :1-65 in path
          const hashMatch = filePath.match(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i);
          if (hashMatch) {
            sLine = parseInt(hashMatch[1], 10);
            eLine = hashMatch[2] ? parseInt(hashMatch[2], 10) : sLine + 100;
            filePath = filePath.replace(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i, '').trim();
          }

          if (args.lines) {
            const lm = String(args.lines).match(/(\d+)\s*[-:]\s*(\d+)/);
            if (lm) {
              sLine = parseInt(lm[1], 10);
              eLine = parseInt(lm[2], 10);
            }
          }
          if (args.startLine !== undefined || args.start_line !== undefined || args.start !== undefined) {
            sLine = Number(args.startLine ?? args.start_line ?? args.start);
          }
          if (args.endLine !== undefined || args.end_line !== undefined || args.end !== undefined) {
            eLine = Number(args.endLine ?? args.end_line ?? args.end);
          }

          toolResult = await this.viewFileSlice(filePath, sLine, eLine);
          break;
        }
        case 'replace_file_content':
        case 'edit_file':
          toolResult = await this.replaceFileContent(
            args.path,
            args.targetContent ?? args.search ?? args.target ?? '',
            args.replacementContent ?? args.replace ?? args.replacement ?? ''
          );
          break;
        case 'write_file':
        case 'create_file': {
          const overwrite = args.overwrite !== undefined ? Boolean(args.overwrite) : false;
          toolResult = await this.writeFile(args.path, args.content || '', overwrite);
          break;
        }
        case 'list_workspace_files':
        case 'list_files':
          toolResult = await this.listWorkspaceFiles(args.folder || args.path, args.recursive);
          break;
        case 'search_files':
          toolResult = await this.searchFiles(args.query, args.filePattern);
          break;
        case 'run_terminal_command':
        case 'run_command':
          toolResult = await this.runTerminalCommand(args.command, args.cwd, args.taskId || taskId, signal);
          break;
        case 'get_diagnostics':
          toolResult = await this.getDiagnostics(args.filePath);
          break;
        case 'read_rule':
          toolResult = await this.readRule(args.ruleName);
          break;
        case 'ask_user':
        case 'ask_question':
        case 'confirm':
        case 'notify_user': {
          const q = args.question || args.prompt || args.message || (typeof args === 'string' ? args : '');
          toolResult = {
            output: q ? `[Вопрос пользователю] ${q}` : 'Ожидание ответа пользователя.',
            error: false
          };
          break;
        }
        default:
          toolResult = { output: `Tool '${name}' not available. Available tools: replace_file_content, write_file, view_file_slice, run_terminal_command, ask_user.`, error: false };
          break;
      }

      const dur = ((Date.now() - execStart) / 1000).toFixed(2);
      logger.log('Tool', `[${name}] Completed in ${dur}s${toolResult.error ? ' (ERROR)' : ''}`);
      return toolResult;
    } catch (err: any) {
      const dur = ((Date.now() - execStart) / 1000).toFixed(2);
      logger.log('Tool', `[${name}] Failed in ${dur}s: ${err.message || String(err)}`);
      return { output: `Tool execution failed: ${err.message || String(err)}`, error: true };
    }
  }

  private async viewFileSlice(filePath: string, startLine: number, endLine: number): Promise<{ output: string; error?: boolean }> {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { output: `File not found: ${filePath}`, error: true };
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    const start = Math.max(1, startLine || 1);
    const end = Math.min(totalLines, endLine || totalLines);

    if (start > totalLines) {
      return { output: `Line ${start} exceeds total file lines (${totalLines}) in ${filePath}`, error: true };
    }

    const actualEnd = Math.max(start, end);
    const sliced = lines.slice(start - 1, actualEnd).map((line, idx) => {
      const lineNum = start + idx;
      return `${lineNum}: ${line}`;
    });

    return {
      output: `File: ${filePath} (lines ${start}-${actualEnd} of ${totalLines})\n\n` + sliced.join('\n')
    };
  }

  private async replaceFileContent(filePath: string, targetContent: string, replacementContent: string): Promise<{ output: string; error?: boolean }> {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { output: `File not found: ${filePath}`, error: true };
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    
    // Normalize line endings for reliable matching
    const normalizedContent = content.replace(/\r\n/g, '\n');
    let normalizedTarget = targetContent.replace(/\r\n/g, '\n');
    let normalizedReplacement = replacementContent.replace(/\r\n/g, '\n');

    // Tier 1: Direct exact match
    let firstIndex = normalizedContent.indexOf(normalizedTarget);

    // Tier 2: Trimming single leading/trailing newline from XML formatting
    if (firstIndex === -1 && normalizedTarget.startsWith('\n')) {
      const candidate = normalizedTarget.slice(1);
      if (normalizedContent.indexOf(candidate) !== -1) {
        normalizedTarget = candidate;
        firstIndex = normalizedContent.indexOf(normalizedTarget);
      }
    }
    if (firstIndex === -1 && normalizedTarget.endsWith('\n')) {
      const candidate = normalizedTarget.slice(0, -1);
      if (normalizedContent.indexOf(candidate) !== -1) {
        normalizedTarget = candidate;
        firstIndex = normalizedContent.indexOf(normalizedTarget);
      }
    }

    // Tier 3: Trimmed block match
    if (firstIndex === -1) {
      const trimmedTarget = normalizedTarget.trim();
      if (trimmedTarget && normalizedContent.indexOf(trimmedTarget) !== -1) {
        normalizedTarget = trimmedTarget;
        firstIndex = normalizedContent.indexOf(normalizedTarget);
      }
    }

    if (firstIndex !== -1) {
      const secondIndex = normalizedContent.indexOf(normalizedTarget, firstIndex + 1);
      if (secondIndex !== -1) {
        return {
          output: `Error: targetContent occurs multiple times in ${filePath}. Provide more surrounding lines to uniquely identify the block.`,
          error: true
        };
      }

      const updated = normalizedContent.replace(normalizedTarget, normalizedReplacement);
      await fs.promises.writeFile(fullPath, updated, 'utf-8');

      const searchLines = normalizedTarget.split('\n').length;
      const repLines = normalizedReplacement.split('\n').length;

      return {
        output: `Successfully replaced content in ${filePath} (-${searchLines} lines, +${repLines} lines).`
      };
    }

    // Tier 4: Line-by-line whitespace-insensitive matching (Fuzzy Indentation Match)
    const fileLines = normalizedContent.split('\n');
    const rawTargetLines = normalizedTarget.split('\n');
    let tStart = 0;
    while (tStart < rawTargetLines.length && !rawTargetLines[tStart].trim()) tStart++;
    let tEnd = rawTargetLines.length - 1;
    while (tEnd >= tStart && !rawTargetLines[tEnd].trim()) tEnd--;
    const targetLines = rawTargetLines.slice(tStart, tEnd + 1);

    if (targetLines.length > 0) {
      const trimmedTargetLines = targetLines.map(l => l.trim());
      const matches: { startLine: number; endLine: number }[] = [];

      for (let i = 0; i <= fileLines.length - targetLines.length; i++) {
        let allMatch = true;
        for (let j = 0; j < targetLines.length; j++) {
          if (fileLines[i + j].trim() !== trimmedTargetLines[j]) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          matches.push({ startLine: i, endLine: i + targetLines.length - 1 });
        }
      }

      if (matches.length === 1) {
        const match = matches[0];
        const fileStartLine = fileLines[match.startLine];
        const fileIndent = fileStartLine.match(/^\s*/)?.[0] || '';
        const targetIndent = targetLines[0].match(/^\s*/)?.[0] || '';

        // Adapt replacement indentation if target had different base indentation
        const repLines = normalizedReplacement.split('\n');
        let adjustedRep = normalizedReplacement;
        if (fileIndent !== targetIndent && targetLines.length > 0) {
          const indentDelta = fileIndent.length - targetIndent.length;
          if (indentDelta > 0) {
            const prefix = ' '.repeat(indentDelta);
            adjustedRep = repLines.map(l => l.trim() ? prefix + l : l).join('\n');
          } else if (indentDelta < 0 && fileIndent === '') {
            const stripCount = Math.abs(indentDelta);
            adjustedRep = repLines.map(l => l.startsWith(' '.repeat(stripCount)) ? l.slice(stripCount) : l).join('\n');
          }
        }

        const before = fileLines.slice(0, match.startLine);
        const after = fileLines.slice(match.endLine + 1);
        const updated = [...before, adjustedRep, ...after].join('\n');
        await fs.promises.writeFile(fullPath, updated, 'utf-8');

        const sCount = match.endLine - match.startLine + 1;
        const rCount = adjustedRep.split('\n').length;

        return {
          output: `Successfully replaced content in ${filePath} (lines ${match.startLine + 1}-${match.endLine + 1}, -${sCount} lines, +${rCount} lines with fuzzy indentation matching).`
        };
      } else if (matches.length > 1) {
        return {
          output: `Error: targetContent matches ${matches.length} different locations in ${filePath} (around lines ${matches.map(m => m.startLine + 1).join(', ')}). Please provide more surrounding lines to uniquely identify the block.`,
          error: true
        };
      }
    }

    // Tier 5: Target not found — provide smart hint for self-healing!
    const firstTargetLine = targetLines[0]?.trim() || '';
    let hintLine = -1;
    for (let i = 0; i < fileLines.length; i++) {
      if (firstTargetLine && fileLines[i].includes(firstTargetLine)) {
        hintLine = i + 1;
        break;
      }
    }

    let hintMsg = '';
    if (hintLine !== -1) {
      const pStart = Math.max(1, hintLine - 3);
      const pEnd = Math.min(fileLines.length, hintLine + 7);
      hintMsg = ` Note: Similar code was detected near line ${hintLine}. Please invoke <tool_call name="read_file"><path>${filePath}</path><start_line>${pStart}</start_line><end_line>${pEnd}</end_line></tool_call> to inspect exact characters before editing.`;
    }

    return {
      output: `Error: targetContent was not found in ${filePath}.${hintMsg}`,
      error: true
    };
  }

  private async writeFile(filePath: string, content: string, overwrite: boolean): Promise<{ output: string; error?: boolean }> {
    // When creating or writing a file, strictly use the explicit path, never resolving to existing files in other folders
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);
    const exists = fs.existsSync(fullPath);

    if (exists) {
      const stats = await fs.promises.stat(fullPath);
      if (stats.size > 0 && !overwrite) {
        return {
          output: `Error: File '${filePath}' already exists (${stats.size} bytes)! To preserve existing code, you MUST use surgical editing with <tool_call name="edit_file"><path>${filePath}</path><search>...</search><replace>...</replace></tool_call>. Overwriting existing files entirely with create_file is forbidden.`,
          error: true
        };
      }
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content, 'utf-8');

    return { output: `Successfully wrote file: ${filePath} (${content.length} bytes)` };
  }

  private async listWorkspaceFiles(folder?: string, recursive?: boolean): Promise<{ output: string; error?: boolean }> {
    const targetDir = folder ? this.resolvePath(folder) : this.workspaceRoot;
    if (!fs.existsSync(targetDir)) {
      return { output: `Directory does not exist: ${folder || '.'}`, error: true };
    }

    const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'out', 'venv', '__pycache__', '.pytest_cache', '.vscode']);

    const scan = async (dir: string, depth: number): Promise<string[]> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const results: string[] = [];

      for (const entry of entries) {
        if (ignoredDirs.has(entry.name)) continue;
        const relative = path.relative(this.workspaceRoot, path.join(dir, entry.name)).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          results.push(`[DIR]  ${relative}/`);
          if (recursive && depth < 4) {
            const children = await scan(path.join(dir, entry.name), depth + 1);
            results.push(...children);
          }
        } else {
          results.push(`[FILE] ${relative}`);
        }
      }
      return results;
    };

    const items = await scan(targetDir, 0);
    return { output: items.join('\n') || 'Empty directory' };
  }

  private async searchFiles(query: string, filePattern?: string): Promise<{ output: string; error?: boolean }> {
    const globPattern = filePattern ? `**/${filePattern}` : '**/*';
    const uris = await vscode.workspace.findFiles(globPattern, '{**/node_modules/**,**/.git/**,**/venv/**,**/dist/**}', 100);

    const matches: string[] = [];
    const regex = new RegExp(query, 'i');

    for (const uri of uris) {
      try {
        const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const relPath = path.relative(this.workspaceRoot, uri.fsPath).replace(/\\/g, '/');
            matches.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
            if (matches.length >= 50) break;
          }
        }
      } catch {}
      if (matches.length >= 50) break;
    }

    if (matches.length === 0) {
      return { output: `No matches found for query: "${query}"` };
    }

    return { output: matches.join('\n') };
  }

  public runningTasks: Map<string, { child: any; command: string; startedAt: number }> = new Map();

  public killTask(taskId: string): boolean {
    const task = this.runningTasks.get(taskId);
    if (task) {
      try {
        if (process.platform === 'win32' && task.child && task.child.pid) {
          exec(`taskkill /pid ${task.child.pid} /T /F`);
        } else if (task.child) {
          task.child.kill('SIGKILL');
        }
      } catch {}
      this.runningTasks.delete(taskId);
      return true;
    }
    return false;
  }

  public killAll(): void {
    for (const [taskId, task] of this.runningTasks.entries()) {
      try {
        if (process.platform === 'win32' && task.child && task.child.pid) {
          exec(`taskkill /pid ${task.child.pid} /T /F`);
        } else if (task.child) {
          task.child.kill('SIGKILL');
        }
      } catch {}
    }
    this.runningTasks.clear();
  }

  public getActiveTasks(): { taskId: string; command: string; startedAt: number }[] {
    return Array.from(this.runningTasks.entries()).map(([taskId, t]) => ({
      taskId,
      command: t.command,
      startedAt: t.startedAt
    }));
  }

  private async runTerminalCommand(command: string, cwd?: string, taskId?: string, signal?: AbortSignal): Promise<{ output: string; error?: boolean; taskId?: string }> {
    const workDir = cwd ? this.resolvePath(cwd) : this.workspaceRoot;
    const currentTaskId = taskId || 'task_' + Date.now();
    const cmdStartTime = Date.now();

    if (signal?.aborted) {
      return { output: 'Command cancelled before execution', error: true, taskId: currentTaskId };
    }

    const timeoutSec = Math.round(this.commandTimeoutMs / 1000);
    logger.log('Command', `[${currentTaskId}] Starting: "${command}" in ${workDir} (timeout: ${timeoutSec}s)`);

    return new Promise((resolve) => {
      let resolved = false;
      const child = exec(command, { cwd: workDir, timeout: this.commandTimeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (resolved) return;
        resolved = true;
        this.runningTasks.delete(currentTaskId);
        const cmdDur = ((Date.now() - cmdStartTime) / 1000).toFixed(2);
        const out = stdout ? stdout.trim() : '';
        const err = stderr ? stderr.trim() : '';
        const exitCode = error?.code ?? (error ? 1 : 0);

        logger.log('Command', `[${currentTaskId}] Finished in ${cmdDur}s with exitCode ${exitCode}${err ? ` (stderr: ${err.slice(0, 100)})` : ''}`);

        let result = `Command: ${command}\nExit Code: ${exitCode}\n`;
        if (out) result += `\nSTDOUT:\n${out}\n`;
        if (err) result += `\nSTDERR:\n${err}\n`;

        resolve({
          output: result,
          error: exitCode !== 0,
          taskId: currentTaskId
        });
      });

      this.runningTasks.set(currentTaskId, {
        child,
        command,
        startedAt: cmdStartTime
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          if (resolved) return;
          resolved = true;
          this.runningTasks.delete(currentTaskId);
          try {
            if (process.platform === 'win32' && child.pid) {
              exec(`taskkill /pid ${child.pid} /T /F`);
            } else {
              child.kill('SIGKILL');
            }
          } catch {}
          resolve({
            output: `Command terminated by user: ${command}`,
            error: true,
            taskId: currentTaskId
          });
        }, { once: true });
      }
    });
  }

  public async getDiagnostics(filePath?: string): Promise<{ output: string; error?: boolean }> {
    const diagnosticsList: { file: string; line: number; severity: string; message: string }[] = [];

    if (filePath) {
      const fullPath = this.resolvePath(filePath);
      const uri = vscode.Uri.file(fullPath);
      const diags = vscode.languages.getDiagnostics(uri);
      for (const d of diags) {
        diagnosticsList.push({
          file: filePath,
          line: d.range.start.line + 1,
          severity: d.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING',
          message: d.message
        });
      }
    } else {
      const allDiags = vscode.languages.getDiagnostics();
      for (const [uri, diags] of allDiags) {
        const rel = path.relative(this.workspaceRoot, uri.fsPath).replace(/\\/g, '/');
        for (const d of diags) {
          diagnosticsList.push({
            file: rel,
            line: d.range.start.line + 1,
            severity: d.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING',
            message: d.message
          });
        }
      }
    }

    if (diagnosticsList.length === 0) {
      return { output: 'All OK (0 errors, 0 warnings)' };
    }

    const formatted = diagnosticsList.map(d => `[${d.severity}] ${d.file}:${d.line} - ${d.message}`).join('\n');
    const hasErrors = diagnosticsList.some(d => d.severity === 'ERROR');

    return {
      output: formatted,
      error: hasErrors
    };
  }

  private async readRule(ruleName: string): Promise<{ output: string; error?: boolean }> {
    const extPath = this.extensionContext.extensionPath;
    const candidates = [
      path.join(extPath, 'src', 'prompts', 'rules', `${ruleName}.md`),
      path.join(extPath, 'src', 'prompts', 'rag', `${ruleName}.md`),
      path.join(extPath, 'src', 'prompts', 'rules', `${ruleName}`),
      path.join(extPath, 'src', 'prompts', 'rag', `${ruleName}`)
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const content = await fs.promises.readFile(p, 'utf-8');
        return { output: content };
      }
    }

    return {
      output: `Rule '${ruleName}' not found. Available RAG rules: plan_and_structure, chunked_reading, surgical_editing, closed_loop_verification, background_tasks, final_summary.`,
      error: true
    };
  }
}
