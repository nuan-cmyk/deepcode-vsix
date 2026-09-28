import * as vscode from 'vscode';
import * as fs from 'fs';
import { ChatSession, ChatMessage, Project } from './types';

const PROJECTS_STORAGE_KEY = 'deepseek_agent_projects_v2';
const ACTIVE_PROJECT_KEY = 'deepseek_agent_active_project_id_v2';
const SESSIONS_STORAGE_KEY = 'deepseek_agent_sessions_v2';
const ACTIVE_SESSION_KEY = 'deepseek_agent_active_session_id_v2';

export class SessionManager {
  private context: vscode.ExtensionContext;
  private projects: Map<string, Project> = new Map();
  private sessions: Map<string, ChatSession> = new Map();
  private activeProjectId: string = '';
  private activeSessionId: string = '';

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
          this.sessions.set(s.id, s);
        }
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
  }

  public async saveToStorage(): Promise<void> {
    const projArr = Array.from(this.projects.values());
    await this.context.globalState.update(PROJECTS_STORAGE_KEY, JSON.stringify(projArr));
    await this.context.globalState.update(ACTIVE_PROJECT_KEY, this.activeProjectId);

    const sessArr = Array.from(this.sessions.values());
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

  public getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public renameProject(id: string, newName: string): void {
    const p = this.projects.get(id);
    if (p) {
      p.name = newName.trim();
      this.saveToStorage();
    }
  }

  public updateProjectPath(id: string, newPath: string): void {
    const p = this.projects.get(id);
    if (p) {
      p.path = newPath.trim();
      this.saveToStorage();
    }
  }

  // --- Session Methods ---
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
      deadMode: false,
      agentMode: true,
      thinking: true,
      search: false,
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

  public updateToggles(toggles: { deadMode?: boolean; agentMode?: boolean; thinking?: boolean; search?: boolean }): void {
    const session = this.getCurrentSession();
    if (toggles.deadMode !== undefined) session.deadMode = toggles.deadMode;
    if (toggles.agentMode !== undefined) session.agentMode = toggles.agentMode;
    if (toggles.thinking !== undefined) session.thinking = toggles.thinking;
    if (toggles.search !== undefined) session.search = toggles.search;
    this.saveToStorage();
  }

  public updateConversationId(conversationId: string): void {
    const session = this.getCurrentSession();
    session.conversationId = conversationId;
    this.saveToStorage();
  }
}
