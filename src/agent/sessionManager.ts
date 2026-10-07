import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatSession, ChatMessage, Project, SandboxMode, DefaultChatSettings } from './types';
import { countMessageTokens } from './tokenizer';
import { logger } from '../logger';

const PROJECTS_STORAGE_KEY = 'deepseek_agent_projects_v2';
const ACTIVE_PROJECT_KEY = 'deepseek_agent_active_project_id_v2';
const SESSIONS_STORAGE_KEY = 'deepseek_agent_sessions_v2';
const ACTIVE_SESSION_KEY = 'deepseek_agent_active_session_id_v2';
const DEFAULT_SETTINGS_KEY = 'deepseek_agent_default_settings_v1';

export class SessionManager {
  private context: vscode.ExtensionContext;
  private projects: Map<string, Project> = new Map();
  private sessions: Map<string, ChatSession> = new Map();
  private activeProjectId: string = '';
  private activeSessionId: string = '';
  private defaultSettings: DefaultChatSettings = {
    deadMode: false,
    agentMode: true,
    thinking: true,
    search: false,
    planMode: false,
    sandboxMode: 'local',
    debugMode: false,
    autoOpenModifiedFiles: false,
    autoUpdate: false,
    pacingDelayMs: 1500,
    requestDelayMs: 3000,
    connectTimeoutSec: 75,
    readTimeoutSec: 45,
    thinkingTimeoutSec: 9,
    commandTimeoutSec: 180,
    maxRetries: 3,
    contextLimitTokens: 1000000,
    compactThresholdTokens: 80000,
    cyrillicCharsPerToken: 1.7,
    latinCharsPerToken: 3.8,
    removeOldContextFromFile: false,
    hideOldContext: true
  };

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadFromStorage();
  }

  private loadFromStorage() {
    // 1. Load Projects
    const rawProjects = this.context.globalState.get<string>(PROJECTS_STORAGE_KEY);
    if (rawProjects) {
      try {
        const parsed: Project[] = JSON.parse(rawProjects);
        for (const p of parsed) {
          this.projects.set(p.id, p);
        }
      } catch {}
    }

    // Default workspace fallback project
    if (this.projects.size === 0) {
      const folders = vscode.workspace.workspaceFolders;
      const defaultPath = folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();
      const defaultName = folders && folders.length > 0 ? folders[0].name : 'Default Project';
      const defProj: Project = {
        id: 'proj_default',
        name: defaultName,
        path: defaultPath,
        createdAt: Date.now()
      };
      this.projects.set(defProj.id, defProj);
      this.activeProjectId = defProj.id;
    } else {
      const savedActiveProj = this.context.globalState.get<string>(ACTIVE_PROJECT_KEY);
      if (savedActiveProj && this.projects.has(savedActiveProj)) {
        this.activeProjectId = savedActiveProj;
      } else {
        this.activeProjectId = Array.from(this.projects.keys())[0];
      }
    }

    // 2. Load Sessions
    const rawSessions = this.context.globalState.get<string>(SESSIONS_STORAGE_KEY);
    if (rawSessions) {
      try {
        const parsed: ChatSession[] = JSON.parse(rawSessions);
        for (const s of parsed) {
          if (!s.projectId) s.projectId = this.activeProjectId;
          s.messages = (s.messages || []).filter(m =>
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
          this.sessions.set(s.id, s);
          this.getLifetimeTokenUsage(s);
        }
      } catch {}
    }

    const rawDefaults = this.context.globalState.get<string>(DEFAULT_SETTINGS_KEY);
    if (rawDefaults) {
      try {
        const parsed = JSON.parse(rawDefaults);
        this.defaultSettings = { ...this.defaultSettings, ...parsed };
      } catch {}
    }

    const savedActiveId = this.context.globalState.get<string>(ACTIVE_SESSION_KEY);
    if (savedActiveId && this.sessions.has(savedActiveId)) {
      this.activeSessionId = savedActiveId;
      const s = this.sessions.get(savedActiveId);
      if (s && s.projectId && this.projects.has(s.projectId)) {
        this.activeProjectId = s.projectId;
      }
    } else if (this.sessions.size > 0) {
      this.activeSessionId = Array.from(this.sessions.keys())[0];
    } else {
      this.createNewSession();
    }

    // Auto-sync with currently active VS Code workspace folder if one is open
    this.syncWithWorkspaceFolders();
  }

  private normalizePath(p: string): string {
    try {
      return path.resolve(p).toLowerCase().replace(/[\\/]+$/, '');
    } catch {
      return (p || '').toLowerCase().trim();
    }
  }

  public syncWithWorkspaceFolders(): Project | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return this.getActiveProject();
    }

    const currentFolder = folders[0];
    const targetPath = currentFolder.uri.fsPath;
    const targetNorm = this.normalizePath(targetPath);
    const targetName = currentFolder.name || path.basename(targetPath) || 'Workspace';

    // Check if a project matching this workspace folder path already exists
    let matchedProj: Project | undefined;
    for (const p of this.projects.values()) {
      if (p.path && this.normalizePath(p.path) === targetNorm) {
        matchedProj = p;
        break;
      }
    }

    if (!matchedProj) {
      const defProj = this.projects.get('proj_default');
      if (defProj && (this.projects.size === 1 || !fs.existsSync(defProj.path))) {
        defProj.name = targetName;
        defProj.path = targetPath;
        matchedProj = defProj;
      } else {
        const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        matchedProj = {
          id,
          name: targetName,
          path: targetPath,
          createdAt: Date.now()
        };
        this.projects.set(id, matchedProj);
      }
    } else {
      if (targetName && matchedProj.name === 'Default Project') {
        matchedProj.name = targetName;
      }
      matchedProj.path = targetPath;
    }

    if (matchedProj) {
      this.activeProjectId = matchedProj.id;
      // Ensure active session belongs to this project
      const currentSess = this.sessions.get(this.activeSessionId);
      if (!currentSess || currentSess.projectId !== matchedProj.id) {
        const projSessions = Array.from(this.sessions.values())
          .filter(s => s.projectId === matchedProj!.id)
          .sort((a, b) => b.updatedAt - a.updatedAt);

        if (projSessions.length > 0) {
          this.activeSessionId = projSessions[0].id;
        } else {
          this.createNewSession(matchedProj.id);
        }
      }
      this.saveToStorage();
    }

    return matchedProj;
  }

  public async saveToStorage(): Promise<void> {
    const projArr = Array.from(this.projects.values());
    await this.context.globalState.update(PROJECTS_STORAGE_KEY, JSON.stringify(projArr));
    await this.context.globalState.update(ACTIVE_PROJECT_KEY, this.activeProjectId);

    const sessArr = Array.from(this.sessions.values()).map(s => ({
      ...s,
      messages: (s.messages || []).filter(m =>
        !m.isInternal &&
        !m.id?.startsWith('nudge_') &&
        !m.id?.startsWith('plan_nudge_') &&
        !m.id?.startsWith('reprompt_') &&
        !m.content?.startsWith('CRITICAL EXECUTION:') &&
        !m.content?.startsWith('SYSTEM UNSTUCK:') &&
        !m.content?.startsWith('Task execution prompt:') &&
        !m.content?.startsWith('Exploration complete') &&
        !m.content?.startsWith('Present the architectural concept')
      )
    }));
    await this.context.globalState.update(SESSIONS_STORAGE_KEY, JSON.stringify(sessArr));
    await this.context.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
  }

  // --- Project Methods ---
  public createProject(name: string, projectPath: string): Project {
    const cleanPath = projectPath.trim();
    if (!fs.existsSync(cleanPath)) {
      try {
        fs.mkdirSync(cleanPath, { recursive: true });
      } catch {}
    }

    const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const proj: Project = {
      id,
      name: name.trim() || 'Project',
      path: cleanPath,
      createdAt: Date.now()
    };

    this.projects.set(id, proj);
    this.activeProjectId = id;
    this.createNewSession(id);
    this.saveToStorage();
    return proj;
  }

  public getAllProjects(): Project[] {
    return Array.from(this.projects.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  public getActiveProject(): Project {
    let p = this.projects.get(this.activeProjectId);
    if (!p) {
      if (this.projects.size > 0) {
        this.activeProjectId = Array.from(this.projects.keys())[0];
        p = this.projects.get(this.activeProjectId)!;
      } else {
        p = this.createProject('Default', process.cwd());
      }
    }
    return p;
  }

  public setActiveProject(id: string): Project | undefined {
    if (this.projects.has(id)) {
      this.activeProjectId = id;
      // find or create session for this project
      const projSessions = Array.from(this.sessions.values()).filter(s => s.projectId === id);
      if (projSessions.length > 0) {
        this.activeSessionId = projSessions[0].id;
      } else {
        this.createNewSession(id);
      }
      this.saveToStorage();
      return this.projects.get(id);
    }
    return undefined;
  }

  public deleteProject(id: string): void {
    if (this.projects.size <= 1) return; // keep at least 1 project
    this.projects.delete(id);

    // delete all sessions belonging to this project
    for (const [sId, s] of this.sessions.entries()) {
      if (s.projectId === id) {
        this.sessions.delete(sId);
      }
    }

    if (this.activeProjectId === id) {
      this.activeProjectId = Array.from(this.projects.keys())[0];
      const nextSessions = Array.from(this.sessions.values()).filter(s => s.projectId === this.activeProjectId);
      if (nextSessions.length > 0) {
        this.activeSessionId = nextSessions[0].id;
      } else {
        this.createNewSession(this.activeProjectId);
      }
    }
    this.saveToStorage();
  }

  public getProjectHierarchy() {
    const list: { project: Project; sessions: { id: string; title: string; createdAt: number; messageCount: number; isActive: boolean }[] }[] = [];
    const allProjs = this.getAllProjects();

    for (const p of allProjs) {
      const pSessions = Array.from(this.sessions.values())
        .filter(s => s.projectId === p.id)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(s => ({
          id: s.id,
          title: s.title,
          createdAt: s.createdAt,
          messageCount: s.messages.length,
          isActive: s.id === this.activeSessionId
        }));

      list.push({
        project: p,
        sessions: pSessions
      });
    }

    return list;
  }

  public renameProject(id: string, newName: string): void {
    const p = this.projects.get(id);
    if (p) {
      p.name = newName.trim();
      this.saveToStorage();
    }
  }

  // --- Session Methods ---
  public getDefaultSettings(): DefaultChatSettings {
    return { ...this.defaultSettings };
  }

  public async setDefaultSettings(defaults: DefaultChatSettings): Promise<void> {
    this.defaultSettings = { ...this.defaultSettings, ...defaults };
    await this.context.globalState.update(DEFAULT_SETTINGS_KEY, JSON.stringify(this.defaultSettings));
    const session = this.getCurrentSession();
    if (session) {
      if (defaults.sandboxMode) session.sandboxMode = defaults.sandboxMode;
      if (defaults.autoOpenModifiedFiles !== undefined) session.autoOpenModifiedFiles = defaults.autoOpenModifiedFiles;
      if (defaults.debugMode !== undefined) session.debugMode = defaults.debugMode;
      this.saveToStorage();
    }
  }

  public createNewSession(projectId?: string, model: string = 'deepseek-chat', autoMode: boolean = true): ChatSession {
    const targetProjId = projectId || this.activeProjectId || (this.projects.size > 0 ? Array.from(this.projects.keys())[0] : 'proj_default');
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    const session: ChatSession = {
      id,
      projectId: targetProjId,
      title: 'Untitled',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model,
      autoMode,
      deadMode: this.defaultSettings.deadMode ?? false,
      agentMode: this.defaultSettings.agentMode ?? true,
      thinking: this.defaultSettings.thinking ?? true,
      search: this.defaultSettings.search ?? false,
      planMode: this.defaultSettings.planMode ?? true,
      sandboxMode: this.defaultSettings.sandboxMode ?? 'local',
      debugMode: this.defaultSettings.debugMode ?? false,
      autoOpenModifiedFiles: this.defaultSettings.autoOpenModifiedFiles ?? false,
      allowedCommands: [],
      planConfirmed: false,
      planExplicitlyDemanded: false,
      totalTokens: 0
    };

    this.sessions.set(id, session);
    this.activeSessionId = id;
    this.activeProjectId = targetProjId;
    this.saveToStorage();
    return session;
  }

  public getCurrentSession(): ChatSession {
    let session = this.sessions.get(this.activeSessionId);
    if (!session) {
      session = this.createNewSession();
    }
    return session;
  }

  public setCurrentSession(id: string): ChatSession | undefined {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      const s = this.sessions.get(id)!;
      if (s.projectId && this.projects.has(s.projectId)) {
        this.activeProjectId = s.projectId;
      }
      this.saveToStorage();
      return s;
    }
    return undefined;
  }

  public deleteSession(id: string): void {
    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      const remainingForProj = Array.from(this.sessions.values()).filter(s => s.projectId === this.activeProjectId);
      if (remainingForProj.length > 0) {
        this.activeSessionId = remainingForProj[0].id;
      } else if (this.sessions.size > 0) {
        this.activeSessionId = Array.from(this.sessions.keys())[0];
        this.activeProjectId = this.sessions.get(this.activeSessionId)!.projectId;
      } else {
        this.createNewSession(this.activeProjectId);
      }
    }
    this.saveToStorage();
  }

  public addMessage(msg: ChatMessage): void {
    const session = this.getCurrentSession();
    session.messages.push(msg);
    session.updatedAt = Date.now();
    this.getLifetimeTokenUsage(session);

    if (msg.role === 'user') {
      logger.log('Chat:In', `[User] ${msg.content}`);
    } else if (msg.role === 'assistant') {
      if (msg.reasoningContent) {
        logger.log('Chat:Reasoning', `[Thinking] ${msg.reasoningContent}`);
      }
      if (msg.toolCalls?.length) {
        logger.log('Chat:Tools', `[Tool Calls] ${msg.toolCalls.map(tc => `${tc.function?.name || 'unknown'}(${(tc.function?.arguments || '').slice(0, 100)})`).join(', ')}`);
      }
      if (msg.content) {
        logger.log('Chat:Out', `[Agent] ${msg.content}`);
      }
    } else if (msg.role === 'tool') {
      logger.log('Chat:ToolResult', `[Tool: ${msg.name || 'unknown'}] output: ${msg.content.slice(0, 150)}...`);
    }

    if (session.title === 'Untitled' && msg.role === 'user') {
      const clean = msg.content.trim().replace(/\n/g, ' ').slice(0, 32);
      session.title = clean || 'Conversation';
    }

    this.saveToStorage();
  }

  public updateTitle(title: string): void {
    const session = this.getCurrentSession();
    session.title = title.trim() || 'Untitled';
    session.updatedAt = Date.now();
    this.saveToStorage();
  }

  public updateAutoMode(autoMode: boolean): void {
    const session = this.getCurrentSession();
    session.autoMode = autoMode;
    this.saveToStorage();
  }

  public updateModel(model: string): void {
    const session = this.getCurrentSession();
    session.model = model;
    this.saveToStorage();
  }

  public updateToggles(toggles: { deadMode?: boolean; agentMode?: boolean; thinking?: boolean; search?: boolean; plan?: boolean; planMode?: boolean; planConfirmed?: boolean; planExplicitlyDemanded?: boolean; sandboxMode?: SandboxMode }): void {
    const session = this.getCurrentSession();
    if (toggles.deadMode !== undefined) session.deadMode = toggles.deadMode;
    if (toggles.agentMode !== undefined) session.agentMode = toggles.agentMode;
    if (toggles.thinking !== undefined) session.thinking = toggles.thinking;
    if (toggles.search !== undefined) session.search = toggles.search;
    if (toggles.plan !== undefined) session.planMode = toggles.plan;
    if (toggles.planMode !== undefined) session.planMode = toggles.planMode;
    if (toggles.planConfirmed !== undefined) session.planConfirmed = toggles.planConfirmed;
    if (toggles.planExplicitlyDemanded !== undefined) session.planExplicitlyDemanded = toggles.planExplicitlyDemanded;
    if (toggles.sandboxMode !== undefined) session.sandboxMode = toggles.sandboxMode;
    this.saveToStorage();
  }

  public allowCommand(command: string): void {
    const session = this.getCurrentSession();
    if (!session.allowedCommands) {
      session.allowedCommands = [];
    }
    const clean = command.trim();
    if (clean && !session.allowedCommands.includes(clean)) {
      session.allowedCommands.push(clean);
      this.saveToStorage();
    }
  }

  public setPlanConfirmed(confirmed: boolean): void {
    const session = this.getCurrentSession();
    session.planConfirmed = confirmed;
    this.saveToStorage();
  }

  public setPlanExplicitlyDemanded(demanded: boolean): void {
    const session = this.getCurrentSession();
    session.planExplicitlyDemanded = demanded;
    this.saveToStorage();
  }

  public updateConversationId(conversationId: string): void {
    const session = this.getCurrentSession();
    session.conversationId = conversationId;
    this.saveToStorage();
  }

  public getLifetimeTokenUsage(session?: ChatSession): {
    promptTokens: number;
    userTokens: number;
    llmTokens: number;
    toolTokens: number;
    cumulativeTokensSpent: number;
    contextTokens: number;
  } {
    const s = session || this.getCurrentSession();
    const prompt = s.promptTokens || 7908;

    let activeUser = 0;
    let activeLlm = 0;
    let activeTool = 0;
    if (s.messages && s.messages.length > 0) {
      for (const m of s.messages) {
        if (m.role === 'user' && !m.isInternal) {
          activeUser += countMessageTokens(m);
        } else if (m.role === 'assistant') {
          activeLlm += countMessageTokens(m);
        } else if (m.role === 'tool') {
          activeTool += countMessageTokens(m);
        }
      }
    }

    const purgedUser = s.purgedUserTokens || 0;
    const purgedLlm = s.purgedLlmTokens || 0;
    const purgedTool = s.purgedToolTokens || 0;

    const userTokens = purgedUser + activeUser;
    const llmTokens = purgedLlm + activeLlm;
    const toolTokens = purgedTool + activeTool;
    const totalSpent = prompt + userTokens + llmTokens + toolTokens;

    s.userTokens = activeUser;
    s.completionTokens = activeLlm;
    s.toolTokens = activeTool;
    s.cumulativeUserTokens = userTokens;
    s.cumulativeLlmTokens = llmTokens;
    s.cumulativeToolTokens = toolTokens;
    s.cumulativeTokensSpent = totalSpent;

    return {
      promptTokens: prompt,
      userTokens,
      llmTokens,
      toolTokens,
      cumulativeTokensSpent: totalSpent,
      contextTokens: s.totalTokens || (prompt + activeUser + activeLlm + activeTool)
    };
  }

  public updateTokens(totalTokens: number, promptTokens?: number, completionTokens?: number, userTokens?: number, _addedSpent?: number, toolTokens?: number): void {
    const session = this.getCurrentSession();
    session.totalTokens = totalTokens;
    if (promptTokens !== undefined) session.promptTokens = promptTokens;
    if (completionTokens !== undefined) session.completionTokens = completionTokens;
    if (userTokens !== undefined) session.userTokens = userTokens;
    if (toolTokens !== undefined) session.toolTokens = toolTokens;

    this.getLifetimeTokenUsage(session);
    this.saveToStorage();
  }

  public setCompactedContext(summary: string, atMessageId?: string): void {
    const session = this.getCurrentSession();
    
    // Capture rootPrompt from the first non-internal user message if not already set
    if (!session.rootPrompt) {
      const firstUserMsg = (session.messages || []).find(m => m.role === 'user' && !m.isInternal);
      if (firstUserMsg && firstUserMsg.content) {
        session.rootPrompt = firstUserMsg.content.trim();
      }
    }

    if (!session.compactedBlocks) {
      session.compactedBlocks = [];
    }
    session.compactedBlocks.push(summary);

    if (!session.compactMilestones) {
      session.compactMilestones = [];
    }
    const compactIdx = session.compactedBlocks.length; // 1-based index (1, 2, 3...)
    session.compactMilestones.push({
      compactIndex: compactIdx,
      atMessageId,
      timestamp: Date.now()
    });

    // Assemble unified summary with Root Objective + All Milestone Stages
    let combined = '';
    if (session.rootPrompt) {
      combined += `=== PRIMARY PROJECT OBJECTIVE (PERMANENT) ===\n${session.rootPrompt}\n\n`;
    }
    combined += session.compactedBlocks.map((b, idx) => `=== MILESTONE STAGE ${idx + 1} ===\n${b}`).join('\n\n');

    session.compactedSummary = combined;
    session.compactedAtMessageId = atMessageId;
    session.conversationId = undefined; // fresh conversation with upstream server for the new compacted phase
    session.lastCompactTimestamp = Date.now();

    // Check if 3rd compact (or greater) has been reached:
    // If removeOldContextFromFile is enabled, physically purge messages before the 1st compact milestone from file
    if (compactIdx >= 3 && session.compactMilestones.length >= 1) {
      const milestone1 = session.compactMilestones[0];
      if (milestone1 && milestone1.atMessageId) {
        session.historyTruncatedBeforeMessageId = milestone1.atMessageId;
        if (this.defaultSettings.removeOldContextFromFile) {
          const cutIdx = (session.messages || []).findIndex(m => m.id === milestone1.atMessageId);
          if (cutIdx !== -1) {
            const removed = session.messages.slice(0, cutIdx + 1);
            let remUser = 0;
            let remLlm = 0;
            let remTool = 0;
            for (const rm of removed) {
              if (rm.role === 'user' && !rm.isInternal) {
                remUser += countMessageTokens(rm);
              } else if (rm.role === 'assistant') {
                remLlm += countMessageTokens(rm);
              } else if (rm.role === 'tool') {
                remTool += countMessageTokens(rm);
              }
            }
            session.purgedUserTokens = (session.purgedUserTokens || 0) + remUser;
            session.purgedLlmTokens = (session.purgedLlmTokens || 0) + remLlm;
            session.purgedToolTokens = (session.purgedToolTokens || 0) + remTool;
            // Retain messages starting immediately after milestone 1
            session.messages = session.messages.slice(cutIdx + 1);
          }
        }
      }
    }

    this.getLifetimeTokenUsage(session);
    this.saveToStorage();
  }

  public applyGeneralCompaction(consolidatedSummary: string, epochNumber: number = 1): void {
    const session = this.getCurrentSession();
    if (!session.epochSummaries) {
      session.epochSummaries = [];
    }
    if (session.compactedSummary) {
      session.epochSummaries.push(session.compactedSummary);
    }

    session.compactedBlocks = [consolidatedSummary];

    let combined = '';
    if (session.rootPrompt) {
      combined += `=== PRIMARY PROJECT OBJECTIVE (PERMANENT) ===\n${session.rootPrompt}\n\n`;
    }
    combined += `=== CONSOLIDATED ARCHIVE (EPOCH ${epochNumber}) ===\n${consolidatedSummary}`;

    session.compactedSummary = combined;
    session.conversationId = undefined;
    session.lastCompactTimestamp = Date.now();
    this.saveToStorage();
  }

  public recordRawTokensProcessed(tokens: number): void {
    const session = this.getCurrentSession();
    session.rawTokensProcessedTotal = (session.rawTokensProcessedTotal || 0) + tokens;
    this.saveToStorage();
  }
}
