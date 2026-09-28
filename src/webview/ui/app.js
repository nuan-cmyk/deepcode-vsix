const vscode = acquireVsCodeApi();

// DOM Elements - Navigation & Header
const drawerToggleBtn = document.getElementById('drawerToggleBtn');
const activeProjectBadge = document.getElementById('activeProjectBadge');
const activeProjectName = document.getElementById('activeProjectName');
const chatTitleInput = document.getElementById('chatTitleInput');
const settingsBtn = document.getElementById('settingsBtn');
const newChatBtn = document.getElementById('newChatBtn');

// DOM Elements - Projects Drawer (Screenshot 5 Replica)
const historyDrawer = document.getElementById('historyDrawer');
const drawerNewChatBtn = document.getElementById('drawerNewChatBtn');
const createProjectBtn = document.getElementById('createProjectBtn');
const projectsTreeList = document.getElementById('projectsTreeList');
const drawerSettingsBtn = document.getElementById('drawerSettingsBtn');

// DOM Elements - Create Project Modal
const createProjectModal = document.getElementById('createProjectModal');
const closeCreateProjectModalBtn = document.getElementById('closeCreateProjectModalBtn');
const projectNameInput = document.getElementById('projectNameInput');
const projectPathInput = document.getElementById('projectPathInput');
const browseProjectPathBtn = document.getElementById('browseProjectPathBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');

// DOM Elements - Settings Modal
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const serverUrlInput = document.getElementById('serverUrlInput');
const tokenSetupInput = document.getElementById('tokenSetupInput');
const modelSettingSelect = document.getElementById('modelSettingSelect');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const healthStatusText = document.getElementById('healthStatusText');
const tokenSetupSaveBtn = document.getElementById('tokenSetupSaveBtn');

// DOM Elements - Chat Area
const chatContainer = document.getElementById('chatContainer');
const emptyState = document.getElementById('emptyState');
const messagesList = document.getElementById('messagesList');
const continueRow = document.getElementById('continueRow');
const continueBtn = document.getElementById('continueBtn');
const serverIndicator = document.getElementById('serverIndicator');

// DOM Elements - Onboarding
const onboardingBanner = document.getElementById('onboardingBanner');
const onboardingTokenInput = document.getElementById('onboardingTokenInput');
const onboardingSaveBtn = document.getElementById('onboardingSaveBtn');

// DOM Elements - Composer & Mode Toggles
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const toggleDead = document.getElementById('toggleDead');
const toggleAgent = document.getElementById('toggleAgent');
const toggleThinking = document.getElementById('toggleThinking');
const toggleSearch = document.getElementById('toggleSearch');
const attachContextBtn = document.getElementById('attachContextBtn');

// State
let isGenerating = false;
let modeStates = {
  deadMode: false,
  agentMode: true,
  thinking: true,
  search: false
};
let currentAssistantMsgEl = null;
let currentThinkingAccordion = null;
let currentThinkingContentEl = null;
let thinkingStartTime = null;
let currentActiveProjectId = '';
let currentActiveSessionId = '';
let turnModifiedFiles = new Map();
let currentPlanConfirmed = false;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  vscode.postMessage({ command: 'ready' });
});

// Auto-expand textarea
promptInput.addEventListener('input', () => {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
  updateSendButtonState();
});

function updateSendButtonState() {
  if (isGenerating) {
    sendBtn.classList.add('stop');
    sendBtn.classList.remove('active');
    sendBtn.title = 'Остановить генерацию (Esc)';
    sendBtn.setAttribute('aria-label', 'Остановить');
    sendBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2"></rect>
      </svg>`;
  } else {
    sendBtn.classList.remove('stop');
    sendBtn.title = 'Отправить сообщение';
    sendBtn.setAttribute('aria-label', 'Отправить');
    sendBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>`;
    if (promptInput.value.trim().length > 0) {
      sendBtn.classList.add('active');
    } else {
      sendBtn.classList.remove('active');
    }
  }
}

function handleStop() {
  if (!isGenerating) return;
  isGenerating = false;
  updateSendButtonState();

  if (currentAssistantMsgEl) {
    const pill = currentAssistantMsgEl.querySelector('.working-pill');
    if (pill) {
      pill.innerHTML = `
        <span class="working-pill-icon" style="color: var(--danger)">⏹</span>
        <span class="working-pill-text">Остановлено пользователем</span>
      `;
      pill.className = 'stopped-pill';
    }
  }

  if (currentThinkingAccordion) {
    const title = currentThinkingAccordion.querySelector('.thinking-title');
    if (title) title.textContent = 'Размышления прерваны';
    const toggle = currentThinkingAccordion.querySelector('.thinking-toggle');
    const content = currentThinkingAccordion.querySelector('.thinking-content');
    if (toggle) toggle.classList.remove('open');
    if (content) content.classList.remove('open');
  }

  vscode.postMessage({ command: 'stop' });
}

// Enter to send, Escape to stop
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isGenerating) {
    e.preventDefault();
    handleStop();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isGenerating) {
    e.preventDefault();
    handleStop();
  }
});

function handleSend() {
  if (isGenerating) {
    handleStop();
    return;
  }

  const text = promptInput.value.trim();
  if (!text) return;

  promptInput.value = '';
  promptInput.style.height = 'auto';
  updateSendButtonState();
  continueRow.style.display = 'none';

  appendUserMessage(text);

  isGenerating = true;
  currentPlanConfirmed = false;
  turnModifiedFiles.clear();
  updateSendButtonState();

  vscode.postMessage({
    command: 'sendMessage',
    text,
    ...modeStates
  });
}

sendBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  handleSend();
});

// Mode Toggles UI
function updateTogglesUI() {
  toggleDead.classList.toggle('active', modeStates.deadMode);
  toggleAgent.classList.toggle('active', modeStates.agentMode);
  toggleThinking.classList.toggle('active', modeStates.thinking);
  toggleSearch.classList.toggle('active', modeStates.search);
}

function notifyTogglesChanged() {
  updateTogglesUI();
  vscode.postMessage({
    command: 'setToggles',
    toggles: modeStates
  });
}

toggleDead.addEventListener('click', () => {
  modeStates.deadMode = !modeStates.deadMode;
  notifyTogglesChanged();
});

toggleAgent.addEventListener('click', () => {
  modeStates.agentMode = !modeStates.agentMode;
  notifyTogglesChanged();
});

toggleThinking.addEventListener('click', () => {
  modeStates.thinking = !modeStates.thinking;
  notifyTogglesChanged();
});

toggleSearch.addEventListener('click', () => {
  modeStates.search = !modeStates.search;
  notifyTogglesChanged();
});

// Top Navigation & Drawer Actions
drawerToggleBtn.addEventListener('click', () => {
  historyDrawer.classList.toggle('open');
  if (historyDrawer.classList.contains('open')) {
    vscode.postMessage({ command: 'getProjectsHierarchy' });
  }
});

activeProjectBadge.addEventListener('click', () => {
  historyDrawer.classList.toggle('open');
  if (historyDrawer.classList.contains('open')) {
    vscode.postMessage({ command: 'getProjectsHierarchy' });
  }
});

chatTitleInput.addEventListener('change', () => {
  vscode.postMessage({ command: 'setTitle', title: chatTitleInput.value });
});

newChatBtn.addEventListener('click', () => {
  vscode.postMessage({ command: 'newChat', projectId: currentActiveProjectId });
});

drawerNewChatBtn.addEventListener('click', () => {
  historyDrawer.classList.remove('open');
  vscode.postMessage({ command: 'newChat', projectId: currentActiveProjectId });
});

continueBtn.addEventListener('click', () => {
  continueRow.style.display = 'none';
  isGenerating = true;
  updateSendButtonState();
  vscode.postMessage({ command: 'continue' });
});

attachContextBtn.addEventListener('click', () => {
  vscode.postMessage({ command: 'addContext' });
});

// Create Project Modal
createProjectBtn.addEventListener('click', () => {
  projectNameInput.value = '';
  projectPathInput.value = '';
  createProjectModal.style.display = 'flex';
  projectNameInput.focus();
});

closeCreateProjectModalBtn.addEventListener('click', () => {
  createProjectModal.style.display = 'none';
});

createProjectModal.addEventListener('click', (e) => {
  if (e.target === createProjectModal) {
    createProjectModal.style.display = 'none';
  }
});

browseProjectPathBtn.addEventListener('click', () => {
  vscode.postMessage({ command: 'browseFolder' });
});

saveProjectBtn.addEventListener('click', () => {
  const name = projectNameInput.value.trim() || 'Project';
  const pathVal = projectPathInput.value.trim();
  createProjectModal.style.display = 'none';
  historyDrawer.classList.remove('open');
  vscode.postMessage({
    command: 'createProject',
    name,
    path: pathVal
  });
});

// Settings Modal
settingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
  healthStatusText.textContent = '';
});

drawerSettingsBtn.addEventListener('click', () => {
  historyDrawer.classList.remove('open');
  settingsModal.style.display = 'flex';
  healthStatusText.textContent = '';
});

closeSettingsModalBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
});

testConnectionBtn.addEventListener('click', () => {
  healthStatusText.textContent = 'Проверка...';
  healthStatusText.className = 'health-status-text';
  vscode.postMessage({
    command: 'testConnection',
    baseUrl: serverUrlInput.value.trim(),
    apiKey: tokenSetupInput.value.trim()
  });
});

tokenSetupSaveBtn.addEventListener('click', () => {
  saveCredentials(tokenSetupInput.value, serverUrlInput.value, modelSettingSelect.value);
});

onboardingSaveBtn.addEventListener('click', () => {
  saveCredentials(onboardingTokenInput.value, serverUrlInput.value, modelSettingSelect.value);
});

function saveCredentials(key, url, model) {
  if (!key || !key.trim()) {
    alert('Пожалуйста, введите ваш API-токен.');
    return;
  }
  vscode.postMessage({
    command: 'saveAuth',
    apiKey: key.trim(),
    baseUrl: url ? url.trim() : 'https://api.thenck4.ru/v1',
    model: model || 'deepseek-chat'
  });
}

// Format relative time (Screenshot 5: 4m, 3h, 1d, 12d)
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'сейчас';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// Render Projects Hierarchy (Matching Screenshot 5)
function renderProjectsHierarchy(hierarchy, activeProjId, activeSessId) {
  currentActiveProjectId = activeProjId;
  currentActiveSessionId = activeSessId;
  projectsTreeList.innerHTML = '';

  for (const item of hierarchy) {
    const project = item.project;
    const sessions = item.sessions || [];
    const isProjectActive = project.id === activeProjId;

    const groupEl = document.createElement('div');
    groupEl.className = 'project-group';

    // Project Row
    const rowEl = document.createElement('div');
    rowEl.className = 'project-row' + (isProjectActive ? ' active-project' : '');
    rowEl.title = `Путь: ${project.path}`;

    rowEl.innerHTML = `
      <div class="project-row-left">
        <span>📁</span>
        <span class="project-row-name">${escapeHtml(project.name)}</span>
      </div>
      <div class="project-row-actions">
        <button class="icon-btn add-proj-chat-btn" title="Новый диалог в этом проекте" style="padding: 2px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="5"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        ${hierarchy.length > 1 ? `
        <button class="icon-btn delete-proj-btn" title="Удалить проект" style="padding: 2px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>` : ''}
      </div>
    `;

    rowEl.querySelector('.project-row-left').addEventListener('click', () => {
      vscode.postMessage({ command: 'selectProject', projectId: project.id });
    });

    rowEl.querySelector('.add-proj-chat-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      historyDrawer.classList.remove('open');
      vscode.postMessage({ command: 'newChat', projectId: project.id });
    });

    const delProjBtn = rowEl.querySelector('.delete-proj-btn');
    if (delProjBtn) {
      delProjBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Удалить проект "${project.name}" и все его диалоги?`)) {
          vscode.postMessage({ command: 'deleteProject', projectId: project.id });
        }
      });
    }

    groupEl.appendChild(rowEl);

    // Sessions under Project
    const sessionsContainer = document.createElement('div');
    sessionsContainer.className = 'project-sessions';

    for (const s of sessions) {
      const isSessActive = s.id === activeSessId;
      const sessEl = document.createElement('div');
      sessEl.className = 'session-item' + (isSessActive ? ' active' : '');
      sessEl.innerHTML = `
        <span class="session-title-text" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</span>
        <span class="session-time">${formatTimeAgo(s.createdAt)}</span>
        <button class="session-delete-btn" title="Удалить диалог">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      sessEl.querySelector('.session-title-text').addEventListener('click', () => {
        historyDrawer.classList.remove('open');
        vscode.postMessage({ command: 'switchSession', id: s.id });
      });

      sessEl.querySelector('.session-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'deleteSession', id: s.id });
      });

      sessionsContainer.appendChild(sessEl);
    }

    groupEl.appendChild(sessionsContainer);
    projectsTreeList.appendChild(groupEl);
  }
}

function appendUserMessage(text) {
  if (!text) return;
  // Ignore internal observation and self-healing messages from displaying as user bubbles
  if (text.startsWith('[Tool Result:') || text.includes('Proceed with the next steps') || text.startsWith('[SELF-HEALING]')) {
    return;
  }
  emptyState.style.display = 'none';
  onboardingBanner.style.display = 'none';
  const row = document.createElement('div');
  row.className = 'message-row';

  const bubble = document.createElement('div');
  bubble.className = 'user-message';
  bubble.textContent = text;

  row.appendChild(bubble);
  messagesList.appendChild(row);
  scrollToBottom();
}

function ensureAssistantMessage() {
  emptyState.style.display = 'none';
  onboardingBanner.style.display = 'none';
  if (!currentAssistantMsgEl) {
    const row = document.createElement('div');
    row.className = 'message-row';

    currentAssistantMsgEl = document.createElement('div');
    currentAssistantMsgEl.className = 'assistant-message';

    row.appendChild(currentAssistantMsgEl);
    messagesList.appendChild(row);
  }
  return currentAssistantMsgEl;
}

function appendReasoningChunk(chunk) {
  ensureAssistantMessage();
  if (!currentThinkingAccordion) {
    thinkingStartTime = Date.now();
    currentThinkingAccordion = document.createElement('div');
    currentThinkingAccordion.className = 'thinking-accordion';

    currentThinkingAccordion.innerHTML = `
      <div class="thinking-toggle open">
        <div class="thinking-left">
          <span class="thinking-pulse"></span>
          <span class="thinking-title">Размышляет...</span>
        </div>
        <svg class="thinking-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <div class="thinking-content open"></div>
    `;

    const toggle = currentThinkingAccordion.querySelector('.thinking-toggle');
    const content = currentThinkingAccordion.querySelector('.thinking-content');

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      content.classList.toggle('open');
    });

    currentThinkingContentEl = content;
    currentAssistantMsgEl.insertBefore(currentThinkingAccordion, currentAssistantMsgEl.firstChild);
  }

  currentThinkingContentEl.textContent += chunk;
  scrollToBottom();
}

function appendAssistantChunk(chunk) {
  const asstEl = ensureAssistantMessage();
  let textNode = asstEl.querySelector('.assistant-text');
  if (!textNode) {
    textNode = document.createElement('div');
    textNode.className = 'assistant-text';
    asstEl.appendChild(textNode);
  }
  textNode.dataset.raw = (textNode.dataset.raw || '') + chunk;
  textNode.innerHTML = renderFormattedContent(textNode.dataset.raw);
  scrollToBottom();
}

function renderFormattedContent(raw) {
  if (!raw) return '';
  let text = raw;
  const cards = [];

  const addCard = (html) => {
    const idx = cards.length;
    cards.push(html);
    return `___CARD_PLACEHOLDER_${idx}___`;
  };

  // 1. Closed tool calls - PROCESS FIRST
  // create_file
  text = text.replace(/<tool_call\s+name=["']create_file["']>([\s\S]*?)<\/tool_call>/gi, (match, inner) => {
    const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
    const cm = inner.match(/<content>([\s\S]*?)<\/content>/i);
    const filePath = pm ? pm[1].trim() : 'file';
    const content = cm ? cm[1] : '';
    const lineCount = content ? content.split('\n').length : 0;

    return addCard(`
      <div class="file-card-pill" onclick="vscode.postMessage({command:'openFile', path:'${escapeHtml(filePath)}'})">
        <div class="file-card-left">
          <span>📄</span> Создан файл: <code>${escapeHtml(filePath)}</code>
        </div>
        <div class="file-card-right">
          <span>${lineCount} строк • в редакторе &rarr;</span>
        </div>
      </div>
    `.trim());
  });

  // edit_file / replace_file_content (Surgical Diff Card)
  text = text.replace(/<tool_call\s+name=["'](?:edit_file|replace_file_content)["']>([\s\S]*?)<\/tool_call>/gi, (match, inner) => {
    const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
    const sm = inner.match(/<(?:search|target|targetContent)>([\s\S]*?)<\/(?:search|target|targetContent)>/i);
    const rm = inner.match(/<(?:replace|replacement|replacementContent)>([\s\S]*?)<\/(?:replace|replacement|replacementContent)>/i);
    const filePath = pm ? pm[1].trim() : 'file';

    const searchLines = sm && sm[1] ? sm[1].trim().split('\n') : [];
    const replaceLines = rm && rm[1] ? rm[1].trim().split('\n') : [];

    const delMarkup = searchLines.map(l => `<div class="agent-diff-del">- ${escapeHtml(l)}</div>`).join('');
    const addMarkup = replaceLines.map(l => `<div class="agent-diff-add">+ ${escapeHtml(l)}</div>`).join('');

    return addCard(`
      <div class="agent-tool-card">
        <div class="agent-tool-header" onclick="vscode.postMessage({command:'openFile', path:'${escapeHtml(filePath)}'})">
          <span class="agent-tool-title">
            <span>✏️</span> Точечная правка: <code>${escapeHtml(filePath)}</code>
          </span>
          <span class="agent-tool-status status-ok">Патч (-${searchLines.length} / +${replaceLines.length}) • в редакторе &rarr;</span>
        </div>
        <div class="agent-diff-container">
          ${delMarkup}
          ${addMarkup}
        </div>
      </div>
    `.trim());
  });

  // read_file / view_file_slice
  text = text.replace(/<tool_call\s+name=["'](?:read_file|view_file_slice)["']>([\s\S]*?)<\/tool_call>/gi, (match, inner) => {
    const pm = inner.match(/<path>([\s\S]*?)<\/path>/i);
    let filePath = pm ? pm[1].trim() : 'file';
    let rangeText = '';

    const hashMatch = filePath.match(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i);
    if (hashMatch) {
      const s = hashMatch[1];
      const e = hashMatch[2];
      rangeText = e ? `строки ${s}-${e}` : `строка ${s}`;
      filePath = filePath.replace(/[#:](?:L)?(\d+)(?:-(?:L)?(\d+))?$/i, '').trim();
    }
    const sm = inner.match(/<(?:start_line|startLine|start)>(\d+)<\/(?:start_line|startLine|start)>/i);
    const em = inner.match(/<(?:end_line|endLine|end)>(\d+)<\/(?:end_line|endLine|end)>/i);
    const lm = inner.match(/<(?:lines|range)>(\d+\s*[-:]\s*\d+)<\/(?:lines|range)>/i);
    if (lm) {
      rangeText = `строки ${lm[1]}`;
    } else if (sm && em) {
      rangeText = `строки ${sm[1]}-${em[1]}`;
    }

    const rangeBadge = rangeText ? ` (${rangeText})` : '';
    return addCard(`
      <div class="file-card-pill" onclick="vscode.postMessage({command:'openFile', path:'${escapeHtml(filePath)}'})">
        <div class="file-card-left">
          <span>🔍</span> Чтение: <code>${escapeHtml(filePath)}</code>${rangeBadge ? ` <span style="color:var(--text-muted);font-size:11px;">${escapeHtml(rangeBadge)}</span>` : ''}
        </div>
        <div class="file-card-right">
          <span>в редакторе &rarr;</span>
        </div>
      </div>
    `.trim());
  });

  // run_command / run_terminal_command (stripped from text because tool_call_start renders the live interactive card)
  text = text.replace(/<tool_call\s+name=["'](?:run_command|run_terminal_command)["']>([\s\S]*?)<\/tool_call>/gi, '');

  // list_files / list_workspace_files
  text = text.replace(/<tool_call\s+name=["'](?:list_files|list_workspace_files)["']>([\s\S]*?)<\/tool_call>/gi, () => {
    return addCard(`
      <div class="file-card-pill">
        <div class="file-card-left">
          <span>📁</span> Список файлов рабочей области
        </div>
        <div class="file-card-right">
          <span>исследовано</span>
        </div>
      </div>
    `.trim());
  });

  // 2. Plan Card tag parsing
  text = text.replace(/<plan>([\s\S]*?)<\/plan>/gi, (match, inner) => {
    return addCard(renderPlanCard(inner, currentPlanConfirmed));
  });
  text = text.replace(/<plan>((?:(?!<\/plan>)[\s\S])*)$/gi, (match, inner) => {
    return addCard(renderPlanCard(inner, currentPlanConfirmed));
  });

  // 3. Live streaming for in-progress unclosed <tool_call> tags (ONLY matches unclosed tail!)
  text = text.replace(/<tool_call\s+name=["']([^"']+)["']>((?:(?!<\/tool_call>)[\s\S])*)$/i, (match, toolName, inner) => {
    const lower = toolName.toLowerCase();
    const pm = inner.match(/<path>([\s\S]*?)(?:<\/path>|$)/i);
    const cm = inner.match(/<command>([\s\S]*?)(?:<\/command>|$)/i);
    const contentMatch = inner.match(/<content>([\s\S]*)$/i);
    const filePath = pm ? pm[1].trim() : '...';
    const lines = contentMatch ? contentMatch[1].split('\n').length : 1;

    if (lower === 'create_file') {
      return addCard(`
        <div class="file-card-pill streaming-pill">
          <div class="file-card-left">
            <span class="streaming-dot-pulse"></span>
            <span>Создание файла:</span> <code>${escapeHtml(filePath)}</code>
          </div>
          <div class="file-card-right">
            <span class="agent-tool-status">Генерация (${lines} строк)...</span>
          </div>
        </div>
      `.trim());
    } else if (lower === 'edit_file' || lower === 'replace_file_content') {
      return addCard(`
        <div class="file-card-pill streaming-pill">
          <div class="file-card-left">
            <span class="streaming-dot-pulse"></span>
            <span>Точечная правка:</span> <code>${escapeHtml(filePath)}</code>
          </div>
          <div class="file-card-right">
            <span class="agent-tool-status">Подготовка патча...</span>
          </div>
        </div>
      `.trim());
    } else if (lower === 'read_file' || lower === 'view_file_slice') {
      return addCard(`
        <div class="file-card-pill streaming-pill">
          <div class="file-card-left">
            <span class="streaming-dot-pulse"></span>
            <span>Чтение:</span> <code>${escapeHtml(filePath)}</code>
          </div>
          <div class="file-card-right">
            <span class="agent-tool-status">Чтение строк...</span>
          </div>
        </div>
      `.trim());
    } else if (lower === 'run_command' || lower === 'run_terminal_command') {
      return '';
    }
    return '';
  });

  // 4. Render Markdown for text outside the cards
  let rendered = renderMarkdown(text);

  // 5. Reinsert cards back into the rendered HTML
  for (let i = 0; i < cards.length; i++) {
    const ph = `___CARD_PLACEHOLDER_${i}___`;
    rendered = rendered.replace(new RegExp(`(?:<p>)?${ph}(?:<\\/p>)?`, 'g'), cards[i]);
  }

  return rendered;
}

function renderPlanCard(planInner, isConfirmed = false) {
  const lines = (planInner || '').trim().split('\n');
  const itemsHtml = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const isDone = /\[x\]/i.test(trimmed) || /~~/.test(trimmed);
    const cleanText = trimmed.replace(/^\d+[\.\)]\s*(\[[ xX]\]\s*)?/, '').replace(/~~/g, '');
    const numMatch = trimmed.match(/^(\d+)[\.\)]/);
    const num = numMatch ? numMatch[1] : '•';
    
    return `
      <div class="plan-item ${isDone ? 'done' : ''}">
        <div class="plan-item-checkbox">${isDone ? '✓' : num}</div>
        <span class="plan-item-text">${escapeHtml(cleanText)}</span>
      </div>
    `;
  }).filter(Boolean).join('');

  return `
    <div class="plan-card">
      <div class="plan-card-header">
        <span class="plan-card-title">
          <span>📋</span> План реализации
        </span>
        <span class="plan-card-badge">${isConfirmed ? 'Утвержден' : 'Ожидает подтверждения'}</span>
      </div>
      <div class="plan-card-items">
        ${itemsHtml}
      </div>
      ${!isConfirmed ? `
      <div class="plan-card-actions">
        <button class="plan-confirm-btn" onclick="confirmPlanAction(this)">
          <span>Подтвердить план и начать выполнение</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>` : ''}
    </div>
  `;
}

window.confirmPlanAction = function(btn) {
  currentPlanConfirmed = true;
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'default';
    btn.innerHTML = `<span>План утвержден ✓</span>`;
    const badge = btn.closest('.plan-card')?.querySelector('.plan-card-badge');
    if (badge) badge.textContent = 'Утвержден';
  }
  isGenerating = true;
  updateSendButtonState();
  appendUserMessage('План утвержден! Начинай выполнять шаги по порядку.');
  vscode.postMessage({ command: 'confirmPlan' });
};

function trackModifiedFile(filePath, added, removed) {
  if (!filePath) return;
  const existing = turnModifiedFiles.get(filePath) || { added: 0, removed: 0 };
  existing.added += (added || 0);
  existing.removed += (removed || 0);
  turnModifiedFiles.set(filePath, existing);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdown(md) {
  if (!md) return '';

  let html = md
    .replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#888;margin-bottom:4px;"><span>${lang || 'code'}</span><button style="background:transparent;border:none;color:#aaa;cursor:pointer;" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.innerText)">скопировать</button></div><code>${code.trim()}</code></pre>`;
    })
    .replace(/^(\d+[\.\)]|\-)\s*\[x\]\s*(?:~~)?(.*?)(?:~~)?$/gim, (match, p1, text) => {
      return `<div class="plan-item done"><div class="plan-item-checkbox">✓</div><span class="plan-item-text">${escapeHtml(text.trim())}</span></div>`;
    })
    .replace(/^(\d+[\.\)]|\-)\s*\[ \]\s*(.*?)$/gim, (match, p1, text) => {
      const numMatch = p1.match(/\d+/);
      const num = numMatch ? numMatch[0] : '•';
      return `<div class="plan-item"><div class="plan-item-checkbox">${num}</div><span class="plan-item-text">${escapeHtml(text.trim())}</span></div>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3 style="margin:10px 0 4px;font-size:13px;font-weight:600;color:var(--text-primary);">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin:12px 0 6px;font-size:14px;font-weight:600;color:var(--text-primary);">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin:14px 0 8px;font-size:15px;font-weight:600;color:var(--text-primary);">$1</h1>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return html;
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Extension message listener
window.addEventListener('message', (event) => {
  const msg = event.data;

  switch (msg.type) {
    case 'initSession':
      chatTitleInput.value = msg.session.title || 'Untitled';

      if (msg.activeProject) {
        currentActiveProjectId = msg.activeProject.id;
        activeProjectName.textContent = msg.activeProject.name;
        activeProjectBadge.title = `Текущий проект: ${msg.activeProject.name}\nПуть: ${msg.activeProject.path}`;
      }

      modeStates.deadMode = Boolean(msg.session.deadMode);
      modeStates.agentMode = msg.session.agentMode !== undefined ? Boolean(msg.session.agentMode) : true;
      modeStates.thinking = msg.session.thinking !== undefined ? Boolean(msg.session.thinking) : true;
      modeStates.search = Boolean(msg.session.search);
      updateTogglesUI();

      if (msg.baseUrl) {
        serverUrlInput.value = msg.baseUrl;
        serverIndicator.textContent = msg.baseUrl;
      }

      if (msg.session.model) {
        modelSettingSelect.value = msg.session.model;
      }

      if (!msg.hasApiKey) {
        onboardingBanner.style.display = 'block';
        onboardingTokenInput.focus();
      } else {
        onboardingBanner.style.display = 'none';
      }

      messagesList.innerHTML = '';
      currentAssistantMsgEl = null;
      currentThinkingAccordion = null;
      isGenerating = false;
      updateSendButtonState();

      if (!msg.session.messages || msg.session.messages.length === 0) {
        emptyState.style.display = 'flex';
      } else {
        emptyState.style.display = 'none';
        for (const m of msg.session.messages) {
          if (m.role === 'user') {
            appendUserMessage(m.content);
          } else if (m.role === 'assistant') {
            const row = document.createElement('div');
            row.className = 'message-row';
            const asstEl = document.createElement('div');
            asstEl.className = 'assistant-message';

            if (m.reasoningContent) {
              const accordion = document.createElement('div');
              accordion.className = 'thinking-accordion';
              accordion.innerHTML = `
                <div class="thinking-toggle">
                  <div class="thinking-left">
                    <span>💭</span>
                    <span class="thinking-title">Размышления</span>
                  </div>
                  <svg class="thinking-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="thinking-content">${escapeHtml(m.reasoningContent)}</div>
              `;
              const tgl = accordion.querySelector('.thinking-toggle');
              const cnt = accordion.querySelector('.thinking-content');
              tgl.addEventListener('click', () => {
                tgl.classList.toggle('open');
                cnt.classList.toggle('open');
              });
              asstEl.appendChild(accordion);
            }

            if (m.content) {
              const tNode = document.createElement('div');
              tNode.className = 'assistant-text';
              tNode.innerHTML = renderFormattedContent(m.content);
              asstEl.appendChild(tNode);
            }

            row.appendChild(asstEl);
            messagesList.appendChild(row);
          } else if (m.role === 'tool') {
            // Render terminal tool results or diagnostic info
            if (m.name === 'run_terminal_command' || m.name === 'run_command') {
              const cmdMatch = m.content.match(/Command:\s*([^\n]+)/i);
              const exitMatch = m.content.match(/Exit Code:\s*(\d+)/i);
              const cmd = cmdMatch ? cmdMatch[1].trim() : 'терминал';
              const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : 0;
              const isOk = exitCode === 0;

              const row = document.createElement('div');
              row.className = 'message-row';
              const card = document.createElement('div');
              card.className = 'agent-tool-card terminal-card';
              card.innerHTML = `
                <div class="agent-tool-header" onclick="this.nextElementSibling?.classList.toggle('collapsed')">
                  <span class="agent-tool-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                    Терминал: <code>${escapeHtml(cmd)}</code>
                  </span>
                  <span class="agent-tool-status ${isOk ? 'status-ok' : 'status-err'}">${isOk ? '🟢 Выполнено (код 0)' : `🔴 Ошибка (код ${exitCode})`}</span>
                </div>
                <div class="terminal-card-output">${escapeHtml(m.content)}</div>
              `;
              row.appendChild(card);
              messagesList.appendChild(row);
            }
          }
        }
      }
      scrollToBottom();
      break;

    case 'projectsHierarchy':
      renderProjectsHierarchy(msg.hierarchy, msg.activeProjectId, msg.activeSessionId);
      break;

    case 'turn_start': {
      if (currentAssistantMsgEl) {
        const pill = currentAssistantMsgEl.querySelector('.working-pill');
        if (pill) pill.remove();
      }
      currentAssistantMsgEl = null;
      currentThinkingAccordion = null;
      currentThinkingContentEl = null;
      break;
    }

    case 'folderSelected':
      projectPathInput.value = msg.path;
      if (!projectNameInput.value.trim()) {
        const parts = msg.path.split(/[\\/]/);
        projectNameInput.value = parts[parts.length - 1] || 'Project';
      }
      break;

    case 'tool_call_start': {
      if (msg.name === 'run_terminal_command' || msg.name === 'run_command') {
        const asstEl = ensureAssistantMessage();
        const existingCard = asstEl.querySelector(`#term_${msg.callId}`);
        if (!existingCard) {
          const card = document.createElement('div');
          card.id = `term_${msg.callId}`;
          card.className = 'agent-tool-card terminal-card';
          const taskId = msg.args?.taskId;
          card.innerHTML = `
            <div class="agent-tool-header" onclick="this.nextElementSibling?.classList.toggle('collapsed')">
              <span class="agent-tool-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                Терминал: <code>${escapeHtml(msg.args?.command || '')}</code>
              </span>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="agent-tool-status">⏳ Выполняется...</span>
                ${taskId ? `
                  <button class="kill-task-btn" title="Остановить выполнение" onclick="event.stopPropagation();vscode.postMessage({command:'killTask',taskId:'${taskId}'})">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg>
                    <span>Завершить</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
          const workingPill = asstEl.querySelector('.working-pill');
          if (workingPill) {
            asstEl.insertBefore(card, workingPill);
          } else {
            asstEl.appendChild(card);
          }
          scrollToBottom();
        }
      }
      break;
    }

    case 'tool_call_end': {
      if (msg.name === 'run_terminal_command' || msg.name === 'run_command') {
        const card = document.querySelector(`#term_${msg.callId}`);
        if (card) {
          const killBtn = card.querySelector('.kill-task-btn');
          if (killBtn) killBtn.remove();

          const statusBadge = card.querySelector('.agent-tool-status');
          if (statusBadge) {
            if (msg.error) {
              statusBadge.className = 'agent-tool-status status-err';
              statusBadge.textContent = '🔴 Ошибка';
            } else {
              statusBadge.className = 'agent-tool-status status-ok';
              statusBadge.textContent = '🟢 Выполнено (код 0)';
            }
          }
          let outEl = card.querySelector('.terminal-card-output');
          if (!outEl) {
            outEl = document.createElement('div');
            outEl.className = 'terminal-card-output';
            card.appendChild(outEl);
          }
          outEl.textContent = msg.result;
          scrollToBottom();
        }
      }
      break;
    }

    case 'authSaved':
      settingsModal.style.display = 'none';
      onboardingBanner.style.display = 'none';
      if (msg.baseUrl) {
        serverIndicator.textContent = msg.baseUrl;
      }
      break;

    case 'healthResult':
      if (msg.ok) {
        healthStatusText.textContent = `🟢 Доступен (ping: ${msg.pingMs}ms)`;
        healthStatusText.className = 'health-status-text ok';
      } else {
        healthStatusText.textContent = `🔴 Ошибка (${msg.error || 'не отвечает'})`;
        healthStatusText.className = 'health-status-text err';
      }
      break;

    case 'chunk':
      appendAssistantChunk(msg.content);
      break;

    case 'reasoning_chunk':
      appendReasoningChunk(msg.content);
      break;

    case 'plan_proposed': {
      const asstEl = ensureAssistantMessage();
      let planCard = asstEl.querySelector('.plan-card');
      if (!planCard) {
        const cardWrapper = document.createElement('div');
        cardWrapper.innerHTML = renderPlanCard(msg.planText, currentPlanConfirmed);
        asstEl.appendChild(cardWrapper);
        scrollToBottom();
      }
      break;
    }

    case 'activity_step': {
      const asstEl = ensureAssistantMessage();
      let feedEl = asstEl.querySelector('.activity-feed');
      if (!feedEl) {
        feedEl = document.createElement('div');
        feedEl.className = 'activity-feed';
        const workingPill = asstEl.querySelector('.working-pill');
        if (workingPill) {
          asstEl.insertBefore(feedEl, workingPill);
        } else {
          asstEl.appendChild(feedEl);
        }
      }

      const step = msg.step;
      const itemEl = document.createElement('div');
      itemEl.className = 'activity-item';

      if (step.type === 'edit') {
        const ext = step.path ? step.path.split('.').pop().toLowerCase() : 'file';
        const extBadge = ext.toUpperCase().slice(0, 4);
        itemEl.innerHTML = `
          <div class="activity-left">
            <span class="activity-type-badge ${escapeHtml(ext)}">${escapeHtml(extBadge)}</span>
            <span class="activity-title" title="${escapeHtml(step.path || '')}">${escapeHtml(step.title)}</span>
          </div>
          <div class="activity-diff-stat">
            <span class="diff-add">+${step.added || 0}</span>
            <span class="diff-del">-${step.removed || 0}</span>
          </div>
        `;
        if (step.path) {
          itemEl.addEventListener('click', () => {
            vscode.postMessage({ command: 'openFile', path: step.path });
          });
          trackModifiedFile(step.path, step.added || 0, step.removed || 0);
        }
      } else if (step.type === 'explore') {
        itemEl.innerHTML = `
          <div class="activity-left">
            <span style="font-size:12px;">🔍</span>
            <span class="activity-title" title="${escapeHtml(step.path || '')}">${escapeHtml(step.title)}</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;
        if (step.path) {
          itemEl.addEventListener('click', () => {
            vscode.postMessage({ command: 'openFile', path: step.path });
          });
        }
      } else if (step.type === 'command') {
        const isOk = step.exitCode === 0;
        itemEl.innerHTML = `
          <div class="activity-left">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            <span class="activity-title">${escapeHtml(step.title)}</span>
          </div>
          <span class="agent-tool-status ${isOk ? 'status-ok' : 'status-err'}">${isOk ? '🟢 0' : '🔴 1'}</span>
        `;
      } else {
        itemEl.innerHTML = `
          <div class="activity-left">
            <span>⚡</span>
            <span class="activity-title">${escapeHtml(step.title)}</span>
          </div>
        `;
      }

      feedEl.appendChild(itemEl);
      scrollToBottom();
      break;
    }

    case 'task_start':
    case 'task_end':
      break;

    case 'task_killed': {
      const card = document.querySelector('.agent-tool-card:has(.kill-task-btn)') || document.getElementById(`task_${msg.taskId}`);
      if (card) {
        const killBtn = card.querySelector('.kill-task-btn');
        if (killBtn) killBtn.remove();
        const statusBadge = card.querySelector('.agent-tool-status');
        if (statusBadge) {
          statusBadge.className = 'agent-tool-status status-err';
          statusBadge.textContent = '⏹ Остановлено';
        }
      }
      break;
    }

    case 'status': {
      const asstEl = ensureAssistantMessage();
      let pill = asstEl.querySelector('.working-pill');
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'working-pill';
        asstEl.appendChild(pill);
      }
      pill.innerHTML = `
        <span class="working-pulse"></span>
        <span class="working-text">${escapeHtml(msg.text)}</span>
      `;
      scrollToBottom();
      break;
    }

    case 'finish':
      isGenerating = false;
      updateSendButtonState();

      if (currentThinkingAccordion) {
        const title = currentThinkingAccordion.querySelector('.thinking-title');
        const duration = thinkingStartTime ? Math.round((Date.now() - thinkingStartTime) / 100) / 10 : 0;
        if (title) {
          title.textContent = msg.finishReason === 'cancelled'
            ? 'Размышления прерваны'
            : `Размышления завершены (${duration} сек.)`;
        }
        const toggle = currentThinkingAccordion.querySelector('.thinking-toggle');
        const content = currentThinkingAccordion.querySelector('.thinking-content');
        if (toggle) toggle.classList.remove('open');
        if (content) content.classList.remove('open');
      }

      if (currentAssistantMsgEl) {
        const pill = currentAssistantMsgEl.querySelector('.working-pill');
        if (pill) {
          if (msg.finishReason === 'cancelled') {
            pill.innerHTML = `
              <span class="working-pill-icon" style="color: var(--danger)">⏹</span>
              <span class="working-pill-text">Остановлено</span>
            `;
            pill.className = 'stopped-pill';
          } else {
            pill.remove();
          }
        }

        if (turnModifiedFiles.size > 0) {
          let totalAdd = 0;
          let totalDel = 0;
          let firstPath = '';
          for (const [p, stats] of turnModifiedFiles.entries()) {
            if (!firstPath) firstPath = p;
            totalAdd += stats.added;
            totalDel += stats.removed;
          }
          const fileCount = turnModifiedFiles.size;
          const reviewBar = document.createElement('div');
          reviewBar.className = 'review-stat-bar';
          reviewBar.innerHTML = `
            <div><strong>${fileCount} file${fileCount > 1 ? 's' : ''} changed</strong> <span class="diff-add">+${totalAdd}</span> <span class="diff-del">-${totalDel}</span></div>
            <button class="review-btn">Review</button>
          `;
          reviewBar.querySelector('.review-btn').addEventListener('click', () => {
            if (firstPath) {
              vscode.postMessage({ command: 'openFile', path: firstPath });
            }
          });
          currentAssistantMsgEl.appendChild(reviewBar);
          turnModifiedFiles.clear();
        }
      }

      currentAssistantMsgEl = null;
      currentThinkingAccordion = null;
      if (msg.finishReason !== 'cancelled') {
        continueRow.style.display = 'flex';
      }
      break;

    case 'error': {
      isGenerating = false;
      updateSendButtonState();
      if (currentAssistantMsgEl) {
        const pill = currentAssistantMsgEl.querySelector('.working-pill');
        if (pill) pill.remove();
      }

      const errCard = document.createElement('div');
      errCard.className = 'message-row';
      errCard.innerHTML = `
        <div class="assistant-message" style="border-left: 3px solid var(--danger); background: rgba(239, 68, 68, 0.08);">
          <div style="display:flex;align-items:center;gap:8px;color:#f87171;font-size:12.5px;font-weight:500;">
            <span>⚠️</span>
            <span>Ошибка: ${escapeHtml(msg.message)}</span>
          </div>
        </div>
      `;
      messagesList.appendChild(errCard);
      scrollToBottom();
      break;
    }
  }
});
