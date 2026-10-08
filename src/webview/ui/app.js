const vscode = acquireVsCodeApi();

// Lucide Icons SVGs (https://lucide.dev/)
const LUCIDE = {
  folder: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  file: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  activity: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2"/></svg>`,
  book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  brain: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-brain"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v14"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`,
  x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  zap: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  history: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  clipboardList: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
  terminal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>`,
  helpCircle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-help"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  chevron: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  alertCircle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-alert"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  square: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="lucide lucide-square"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
  arrowUp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
  arrowRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  shieldAlert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
  info: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
};

// Localization dictionaries (English default, Russian second)
const I18N = {
  en: {
    newConversation: 'New Conversation',
    conversationHistory: 'Conversation History',
    scheduledTasks: 'Scheduled Tasks',
    projects: 'Projects',
    createProject: 'Create Project',
    projectName: 'Project Name:',
    folderPath: 'Folder Path on Disk:',
    browse: 'Browse...',
    createProjectBtn: 'Create Project',
    settingsTitle: 'Settings',
    language: 'Language / Язык:',
    serverBaseUrl: 'Server Base URL:',
    testConnection: 'Test',
    apiToken: 'API Token (DeepAuth Token):',
    defaultModel: 'Default Model:',
    save: 'Save',
    testing: 'Testing...',
    available: 'Connected',
    error: 'Error',
    connectToDeepCode: 'Connect to DeepCode',
    tokenPlaceholder: 'Paste your sk-... token',
    connect: 'Connect',
    serverPrefix: 'Server:',
    continueBtn: 'Continue',
    composerPlaceholder: 'Ask anything',
    deadModePlaceholder: 'Ask anything, I SAW ANYTHING',
    stopTitle: 'Stop generation (Esc)',
    sendTitle: 'Send message',
    thinkingToggle: 'Thinking',
    searchToggle: 'Search',
    planToggle: 'Plan',
    attachTitle: 'Attach file to context',
    fileCreated: 'File created:',
    fileEdit: 'Surgical edit:',
    fileRead: 'Reading:',
    fileList: 'File list:',
    diagnostics: 'Diagnostics:',
    fileSearch: 'Search in files:',
    devRule: 'Development rule:',
    agentQuestion: 'Question from Agent',
    waitingAnswer: 'Waiting for response',
    terminal: 'Terminal:',
    executed: 'Executed',
    failed: 'Failed',
    running: 'Running...',
    terminate: 'Stop',
    thinkingTitle: 'Reasoning',
    thinkingFinished: 'Reasoning completed',
    thinkingAborted: 'Reasoning interrupted',
    filesChanged: 'file changed',
    filesChangedPlural: 'files changed',
    review: 'Review',
    planTitle: 'Implementation Plan',
    planApproved: 'Approved',
    planPending: 'Pending confirmation',
    planConfirmBtn: 'Approve plan and start execution',
    planConfirmedNotice: 'Plan approved! Proceeding with tasks.',
    workingTitle: 'Working',
    workedTitle: 'Worked',
    workingFinished: 'Completed',
    copy: 'copy',
    copied: 'copied!',
    lines: 'lines',
    inEditor: 'in editor →',
    checked: 'checked',
    explored: 'explored',
    loaded: 'loaded',
    settingsBtn: 'Settings',
    openProxyBtn: 'Open thenck4.ru',
    sessionExpiredHint: 'Please update the session on the proxy website or provide a valid API key in extension settings.',
    errorPrefix: 'Error',
    tokensSpent: 'Tokens Spent:',
    detailUser: 'User:',
    detailLlm: 'LLM:',
    detailTools: 'Tools:',
    detailContext: 'Context:',
    detailPrompt: 'Prompt:',
    detailCompact: 'Last Compact:',
    compactedPlaceholder: '12m ago',
    contextWindow: 'Context Window',
    tokensUnit: 'tokens',
    defDebugModeLabel: 'Debug Mode',
    defAutoOpenFileLabel: 'Auto-open modified files',
    defAutoUpdateLabel: 'Auto Update',
    defRemoveOldContextLabel: 'Remove old context from file',
    defHideOldContextLabel: 'Hide old context',
    historyTooOldBanner: 'History is too old (compacted into memory)',
    lblCheckUpdate: 'Check for Updates',
    lblCurrentVersion: 'Current Version:',
    updateChecking: 'Checking...',
    updateAvailable: 'Update available: v{version}',
    updateDownloading: 'Downloading v{version}...',
    updateInstalling: 'Installing...',
    updateSuccess: 'Updated to v{version}! Restart to apply.',
    updateUpToDate: 'You are up to date ✓',
    updateError: 'Update check failed',
    debugInfoTitle: 'Debug Info',
    errorCodeLabel: 'Code:',
    copyRawError: 'Copy Error',
    copiedRawError: 'Copied!',
    openLogs: 'View Logs',
    unstuckTitle: 'Unstuck',
    unstuckEmptyResponse: 'Server returned empty response. Auto-retrying ({attempt}/{maxAttempts})...',
    unstuckEmptyAfterReasoning: 'Server returned empty response after reasoning. Auto-retrying ({attempt}/{maxAttempts})...',
    unstuckToolSyntaxError: 'Tool call syntax: {reason}. Requesting re-generation ({attempt}/{maxAttempts})...',
    unstuckResolving: 'Resolving next step...',
    lblGeneralSec: 'General',
    lblAuthSec: 'Connection & Authentication',
    lblDevSettingsSec: 'Developer Settings',
    lblDevModelTitle: 'Model Configuration',
    lblDefaultsSec: 'Agent & Chat Modes',
    lblDiagSec: 'Diagnostics & Security',
    lblDefSandbox: 'Default Sandbox',
    lblTimeoutsSec: 'Timeouts & Delays',
    lblRequestDelay: 'API Request Delay (ms):',
    lblPacingDelay: 'Turn Pacing Delay (ms):',
    lblConnectTimeout: 'Connection Timeout (s):',
    lblReadTimeout: 'Stream Stall Timeout (s):',
    lblThinkingTimeout: 'Thinking-to-Content Timeout (s):',
    lblCommandTimeout: 'Command Timeout (s):',
    lblMaxRetries: 'Max Auto-Retries (Unstuck):',
    lblTokenizerSec: 'Tokenizer & Context',
    lblContextLimit: 'Context Limit (tokens):',
    lblCompactThreshold: 'Compact Threshold (tokens):',
    lblCyrillicRatio: 'Cyrillic Chars/Token Ratio:',
    lblLatinRatio: 'Latin/Code Chars/Token Ratio:',
    lblSaveBtn: 'Save',
    lblTestConn: 'Test',
    lblDebugSec: 'Debug',
    lblResetTokenTitle: 'Reset Auth Token',
    lblResetTokenDesc: 'Clears saved API key so the onboarding login screen appears on window reload.',
    lblResetTokenBtn: 'Reset Token'
  },
  ru: {
    lblGeneralSec: 'Основные настройки',
    lblAuthSec: 'Подключение и авторизация',
    lblDevSettingsSec: 'Настройки разработчика',
    lblDevModelTitle: 'Конфигурация модели',
    lblDefaultsSec: 'Режимы агента и чата',
    lblDiagSec: 'Диагностика и безопасность',
    lblDefSandbox: 'Sandbox по умолчанию',
    newConversation: 'Новый диалог',
    conversationHistory: 'История диалогов',
    scheduledTasks: 'Запланированные задачи',
    projects: 'Проекты',
    createProject: 'Создать проект',
    projectName: 'Название проекта:',
    folderPath: 'Путь к папке на диске:',
    browse: 'Обзор...',
    createProjectBtn: 'Создать проект',
    settingsTitle: 'Настройки DeepCode',
    language: 'Язык / Language:',
    serverBaseUrl: 'Адрес сервера (Server Base URL):',
    testConnection: 'Проверить',
    apiToken: 'API-токен (DeepAuth Token):',
    defaultModel: 'Модель по умолчанию:',
    save: 'Сохранить',
    testing: 'Проверка...',
    available: 'Доступен',
    error: 'Ошибка',
    connectToDeepCode: 'Подключение к DeepCode',
    tokenPlaceholder: 'Вставьте ваш sk-... токен',
    connect: 'Подключить',
    serverPrefix: 'Сервер:',
    continueBtn: 'Продолжить',
    composerPlaceholder: 'Ask anything',
    deadModePlaceholder: 'Ask anything, I SAW ANYTHING',
    stopTitle: 'Остановить генерацию (Esc)',
    sendTitle: 'Отправить сообщение',
    thinkingToggle: 'Мышление',
    searchToggle: 'Поиск',
    planToggle: 'План',
    attachTitle: 'Прикрепить файл в контекст',
    fileCreated: 'Создан файл:',
    fileEdit: 'Точечная правка:',
    fileRead: 'Чтение:',
    fileList: 'Список файлов:',
    diagnostics: 'Диагностика:',
    fileSearch: 'Поиск по файлам:',
    devRule: 'Правило разработки:',
    agentQuestion: 'Вопрос от агента',
    waitingAnswer: 'Ожидает ответа',
    terminal: 'Терминал:',
    executed: 'Выполнено',
    failed: 'Ошибка',
    running: 'Выполняется...',
    terminate: 'Завершить',
    thinkingTitle: 'Размышления',
    thinkingFinished: 'Размышления завершены',
    thinkingAborted: 'Размышления прерваны',
    filesChanged: 'файл изменен',
    filesChangedPlural: 'файлов изменено',
    review: 'Review',
    planTitle: 'План реализации',
    planApproved: 'Утвержден',
    planPending: 'Ожидает подтверждения',
    planConfirmBtn: 'Подтвердить план и начать выполнение',
    planConfirmedNotice: 'План утвержден! Начинай выполнять шаги по порядку.',
    workingTitle: 'Работает',
    workedTitle: 'Работал',
    workingFinished: 'Выполнено',
    copy: 'скопировать',
    copied: 'скопировано!',
    lines: 'строк',
    inEditor: 'в редакторе →',
    checked: 'проверено',
    explored: 'исследовано',
    loaded: 'загружено',
    settingsBtn: 'Настройки',
    openProxyBtn: 'Открыть thenck4.ru',
    sessionExpiredHint: 'Для работы требуется обновить токен сессии на сайте прокси или указать собственный API-ключ в настройках расширения.',
    errorPrefix: 'Ошибка',
    tokensSpent: 'Потрачено токенов:',
    detailUser: 'User:',
    detailLlm: 'LLM:',
    detailTools: 'Инструменты:',
    detailContext: 'Контекст:',
    detailPrompt: 'Промпт:',
    detailCompact: 'Компактинг:',
    compactedPlaceholder: '12 мин. назад',
    contextWindow: 'Контекст',
    tokensUnit: 'токенов',
    defDebugModeLabel: 'Режим отладки',
    defAutoOpenFileLabel: 'Автоматически открывать измененные файлы',
    defAutoUpdateLabel: 'Авто-обновление',
    defRemoveOldContextLabel: 'Remove old context from file',
    defHideOldContextLabel: 'Hide old context',
    historyTooOldBanner: 'History is too old (сжато в память агента)',
    lblCheckUpdate: 'Проверить обновления',
    lblCurrentVersion: 'Текущая версия:',
    updateChecking: 'Проверка...',
    updateAvailable: 'Доступно обновление: v{version}',
    updateDownloading: 'Скачивание v{version}...',
    updateInstalling: 'Установка...',
    updateSuccess: 'Обновлено до v{version}! Перезапустите для применения.',
    updateUpToDate: 'Вы используете актуальную версию ✓',
    updateError: 'Ошибка проверки обновлений',
    debugInfoTitle: 'Отладочная информация',
    errorCodeLabel: 'Код:',
    copyRawError: 'Копировать ошибку',
    copiedRawError: 'Скопировано!',
    openLogs: 'Просмотр логов',
    unstuckTitle: 'Unstuck',
    unstuckEmptyResponse: 'Сервер вернул пустой ответ. Авто-повтор шага ({attempt}/{maxAttempts})...',
    unstuckEmptyAfterReasoning: 'Сервер вернул пустой ответ после рассуждений. Авто-повтор шага ({attempt}/{maxAttempts})...',
    unstuckToolSyntaxError: 'Синтаксис вызова инструмента: {reason}. Запрос перегенерации ({attempt}/{maxAttempts})...',
    unstuckResolving: 'Определение следующего шага...',
    lblTimeoutsSec: 'Таймауты и задержки',
    lblRequestDelay: 'Задержка между запросами API (мс):',
    lblPacingDelay: 'Задержка между шагами (мс):',
    lblConnectTimeout: 'Таймаут подключения (сек):',
    lblReadTimeout: 'Таймаут чтения потока (сек):',
    lblThinkingTimeout: 'Таймаут перехода к тексту (сек):',
    lblCommandTimeout: 'Таймаут выполнения команд (сек):',
    lblMaxRetries: 'Макс. авто-повторов (Unstuck):',
    lblTokenizerSec: 'Токенизатор и контекст',
    lblContextLimit: 'Лимит контекста (токенов):',
    lblCompactThreshold: 'Порог сжатия (токенов):',
    lblCyrillicRatio: 'Символов/токен (Кириллица):',
    lblLatinRatio: 'Символов/токен (Латиница/Код):',
    lblSaveBtn: 'Сохранить',
    lblTestConn: 'Проверить',
    lblDebugSec: 'Отладка (Debug)',
    lblResetTokenTitle: 'Сброс API-токена',
    lblResetTokenDesc: 'Удаляет сохранённый ключ, чтобы при перезагрузке окна открылся экран входа.',
    lblResetTokenBtn: 'Сбросить токен'
  }
};

let currentLang = 'en';
try {
  const saved = localStorage.getItem('deepcode_lang');
  if (saved && (saved === 'en' || saved === 'ru')) {
    currentLang = saved;
  }
} catch {
  currentLang = 'en';
}

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en && I18N.en[key]) || key;
}

function parseErrorDetails(raw, msgCode, msgRaw) {
  const fullRaw = String(msgRaw || raw || '');
  let extractedCode = msgCode ? String(msgCode) : '';

  if (!extractedCode) {
    const codeMatch = fullRaw.match(/"code"\s*:\s*"?([A-Za-z0-9_-]+)"?/i) ||
                      fullRaw.match(/code\s*[:=]\s*([A-Za-z0-9_-]+)/i) ||
                      fullRaw.match(/\b(4\d\d|5\d\d)\b/) ||
                      fullRaw.match(/\b(ECONNREFUSED|ENOTFOUND|ETIMEDOUT)\b/i);
    if (codeMatch) {
      extractedCode = codeMatch[1];
    }
  }

  const isRu = (currentLang === 'ru');
  let cleanMsg = '';

  if (fullRaw.includes('user is muted')) {
    cleanMsg = isRu
      ? 'Аккаунт DeepSeek заблокирован или временно ограничен защитой от спама. Используйте другой аккаунт или официальный API.'
      : 'DeepSeek account is temporarily restricted (user is muted). Please use another account or official API.';
    if (!extractedCode) extractedCode = '40003';
  } else if (fullRaw.includes('session_expired') || fullRaw.includes('Сессия DeepSeek устарела') || fullRaw.includes('Сессия устарела') || fullRaw.includes('session has expired')) {
    cleanMsg = isRu
      ? 'Сессия DeepSeek устарела. Нажмите кнопку обновления сессии на сайте прокси или вставьте свежий токен в настройках.'
      : 'DeepSeek session has expired. Please refresh your session on the proxy website or update your token in settings.';
    if (!extractedCode) extractedCode = '401';
  } else if (fullRaw.includes('Authentication Fails') || (fullRaw.includes('invalid') && (fullRaw.includes('api key') || fullRaw.includes('token') || fullRaw.includes('ключ')))) {
    cleanMsg = isRu
      ? 'Ошибка авторизации: указан недействительный API-ключ. Проверьте токен в настройках.'
      : 'Authentication failed: invalid API key or token. Please check your key in settings.';
    if (!extractedCode) extractedCode = '401';
  } else if (extractedCode === '429' || fullRaw.includes('429') || fullRaw.toLowerCase().includes('rate limit') || fullRaw.includes('слишком много запросов')) {
    cleanMsg = isRu
      ? 'Превышен лимит запросов к серверу (Rate Limit). Пожалуйста, подождите немного перед следующим запросом.'
      : 'Server rate limit reached. Please wait a moment before sending another request.';
    if (!extractedCode) extractedCode = '429';
  } else if (fullRaw.includes('empty stream') || fullRaw.includes('0 токенов') || fullRaw.includes('0 bytes') || fullRaw.includes('пустой ответ')) {
    cleanMsg = isRu
      ? 'Сервер закрыл соединение без ответа (0 токенов). Возможна блокировка аккаунта или устаревание сессии на прокси.'
      : 'Server closed connection without response (0 tokens). Possible causes: account restriction or expired session.';
  } else if (fullRaw.includes('502') || fullRaw.includes('503') || fullRaw.includes('504') || fullRaw.includes('Bad gateway') || fullRaw.includes('Gateway Timeout')) {
    cleanMsg = isRu
      ? 'Сервер API временно недоступен или перегружен. Пожалуйста, повторите запрос через пару секунд.'
      : 'API server is temporarily unavailable or overloaded. Please retry in a few seconds.';
    if (!extractedCode && fullRaw.includes('502')) extractedCode = '502';
    if (!extractedCode && fullRaw.includes('504')) extractedCode = '504';
  } else if (fullRaw.includes('Failed to fetch') || fullRaw.includes('NetworkError') || fullRaw.includes('ECONNREFUSED')) {
    cleanMsg = isRu
      ? 'Ошибка подключения к серверу API. Проверьте URL сервера и доступность сети.'
      : 'Connection error to API server. Please check the server URL and network connection.';
    if (!extractedCode && fullRaw.includes('ECONNREFUSED')) extractedCode = 'ECONNREFUSED';
  } else if (fullRaw.includes('API Key is required') || (fullRaw.includes('ключ') && fullRaw.includes('требуется'))) {
    cleanMsg = isRu
      ? 'Для работы требуется указать API-ключ или токен сессии в настройках.'
      : 'DeepSeek API Key or session token is required. Please set it in Settings.';
  } else if (fullRaw.includes('cancelled by user') || fullRaw.includes('Отменено')) {
    cleanMsg = isRu
      ? 'Операция отменена пользователем.'
      : 'Operation cancelled by user.';
  } else {
    // Strip technical payloads so user sees only clean readable text
    let simplified = fullRaw
      .replace(/\[Ответ сервера:[\s\S]*?\]/gi, '')
      .replace(/\{[\s\S]*?"code"[\s\S]*?\}/gi, '')
      .replace(/API error \(\d+\):/gi, '')
      .replace(/^Error:\s*/i, '')
      .trim();

    if (!simplified || simplified.length < 5 || simplified.startsWith('{')) {
      cleanMsg = isRu ? 'Произошла непредвиденная ошибка при обращении к серверу.' : 'An unexpected error occurred while communicating with the server.';
    } else {
      cleanMsg = simplified;
    }
  }

  return {
    cleanMsg,
    errorCode: extractedCode,
    rawDetails: fullRaw
  };
}

function formatErrorMessage(raw) {
  return parseErrorDetails(raw).cleanMsg;
}

function applyLanguage(lang) {
  currentLang = lang;
  try {
    localStorage.setItem('deepcode_lang', lang);
  } catch {}
  vscode.postMessage({ command: 'setLanguage', lang: lang });

  const elMap = [
    ['drawerNewChatText', 'newConversation'],
    ['drawerHistoryText', 'conversationHistory'],
    ['drawerTasksText', 'scheduledTasks'],
    ['drawerProjectsTitle', 'projects'],
    ['createProjectModalTitle', 'createProject'],
    ['lblProjectName', 'projectName'],
    ['lblProjectPath', 'folderPath'],
    ['saveProjectBtn', 'createProjectBtn'],
    ['settingsModalTitle', 'settingsTitle'],
    ['lblLanguage', 'language'],
    ['lblServerUrl', 'serverBaseUrl'],
    ['lblTestConn', 'testConnection'],
    ['lblToken', 'apiToken'],
    ['lblModel', 'defaultModel'],
    ['lblSaveBtn', 'save'],
    ['lblGeneralSec', 'lblGeneralSec'],
    ['lblAuthSec', 'lblAuthSec'],
    ['lblDevSettingsSec', 'lblDevSettingsSec'],
    ['lblDevModelTitle', 'lblDevModelTitle'],
    ['lblDefaultsSec', 'lblDefaultsSec'],
    ['lblDiagSec', 'lblDiagSec'],
    ['lblDefSandbox', 'lblDefSandbox'],
    ['lblDefDebugMode', 'defDebugModeLabel'],
    ['lblDefAutoOpenFile', 'defAutoOpenFileLabel'],
    ['lblDefAutoUpdate', 'defAutoUpdateLabel'],
    ['lblDefRemoveOldContext', 'defRemoveOldContextLabel'],
    ['lblDefHideOldContext', 'defHideOldContextLabel'],
    ['lblCheckUpdate', 'lblCheckUpdate'],
    ['lblTimeoutsSec', 'lblTimeoutsSec'],
    ['lblRequestDelay', 'lblRequestDelay'],
    ['lblPacingDelay', 'lblPacingDelay'],
    ['lblConnectTimeout', 'lblConnectTimeout'],
    ['lblReadTimeout', 'lblReadTimeout'],
    ['lblThinkingTimeout', 'lblThinkingTimeout'],
    ['lblCommandTimeout', 'lblCommandTimeout'],
    ['lblMaxRetries', 'lblMaxRetries'],
    ['lblTokenizerSec', 'lblTokenizerSec'],
    ['lblContextLimit', 'lblContextLimit'],
    ['lblCompactThreshold', 'lblCompactThreshold'],
    ['lblCyrillicRatio', 'lblCyrillicRatio'],
    ['lblLatinRatio', 'lblLatinRatio'],
    ['onboardingTitle', 'connectToDeepCode'],
    ['onboardingSaveBtn', 'connect'],
    ['serverIndicatorPrefix', 'serverPrefix'],
    ['toggleThinkingText', 'thinkingToggle'],
    ['toggleSearchText', 'searchToggle'],
    ['togglePlanText', 'planToggle'],
    ['tokenPopoverTitle', 'contextWindow'],
    ['tokenPopoverSpentLabel', 'tokensSpent'],
    ['tokenDetailUserLabel', 'detailUser'],
    ['tokenDetailLlmLabel', 'detailLlm'],
    ['tokenDetailToolsLabel', 'detailTools'],
    ['tokenDetailContextLabel', 'detailContext'],
    ['tokenDetailPromptLabel', 'detailPrompt'],
    ['tokenDetailCompactLabel', 'detailCompact'],
    ['lblOpenLogs', 'openLogs'],
    ['lblDebugSec', 'lblDebugSec'],
    ['lblResetTokenTitle', 'lblResetTokenTitle'],
    ['lblResetTokenDesc', 'lblResetTokenDesc'],
    ['lblResetTokenBtn', 'lblResetTokenBtn']
  ];

  for (const [id, key] of elMap) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  updateComposerPlaceholder();
  if (onboardingTokenInput) {
    onboardingTokenInput.placeholder = t('tokenPlaceholder');
  }

  updateSendButtonState();
}

// Antigravity Symbol Icon mappings
const FILE_ICON_MAP = {
  'css': 'brackets-sky.svg',
  'scss': 'brackets-sky.svg',
  'less': 'brackets-sky.svg',
  'html': 'code-orange.svg',
  'htm': 'code-orange.svg',
  'xhtml': 'code-orange.svg',
  'js': 'js.svg',
  'jsx': 'react.svg',
  'mjs': 'js.svg',
  'cjs': 'js.svg',
  'ts': 'ts.svg',
  'tsx': 'react.svg',
  'py': 'python.svg',
  'pyw': 'python.svg',
  'json': 'brackets-yellow.svg',
  'md': 'markdown.svg',
  'markdown': 'markdown.svg',
  'sh': 'shell.svg',
  'bash': 'shell.svg',
  'zsh': 'shell.svg',
  'ps1': 'powershell.svg',
  'txt': 'document.svg',
  'yml': 'yaml.svg',
  'yaml': 'yaml.svg',
  'svg': 'image.svg',
  'png': 'image.svg',
  'jpg': 'image.svg',
  'jpeg': 'image.svg',
  'gif': 'image.svg',
  'go': 'go.svg',
  'rs': 'rust.svg',
  'java': 'java.svg',
  'c': 'c.svg',
  'cpp': 'cpp.svg',
  'h': 'cpp.svg',
  'php': 'php.svg',
  'rb': 'ruby.svg',
  'lua': 'lua.svg',
  'sql': 'database.svg',
  'dockerfile': 'docker.svg',
  'gitignore': 'git.svg',
  'package.json': 'npm.svg'
};

function getFileIcon(filePath) {
  if (!filePath) return (window.FILE_ICONS_URI || 'file-icons') + '/document.svg';
  const name = filePath.split(/[\\/]/).pop().toLowerCase();
  const base = window.FILE_ICONS_URI || 'file-icons';
  if (FILE_ICON_MAP[name]) {
    return `${base}/${FILE_ICON_MAP[name]}`;
  }
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const icon = FILE_ICON_MAP[ext] || 'document.svg';
  return `${base}/${icon}`;
}

// DOM Elements - Navigation & Header
const drawerToggleBtn = document.getElementById('drawerToggleBtn');
const chatTitleInput = document.getElementById('chatTitleInput');
const settingsBtn = document.getElementById('settingsBtn');

// DOM Elements - Projects Drawer
const historyDrawer = document.getElementById('historyDrawer');
const drawerNewChatBtn = document.getElementById('drawerNewChatBtn');
const createProjectBtn = document.getElementById('createProjectBtn');
const projectsTreeList = document.getElementById('projectsTreeList');

// DOM Elements - Create Project Modal
const createProjectModal = document.getElementById('createProjectModal');
const closeCreateProjectModalBtn = document.getElementById('closeCreateProjectModalBtn');
const projectNameInput = document.getElementById('projectNameInput');
const projectPathInput = document.getElementById('projectPathInput');
const browseProjectPathBtn = document.getElementById('browseProjectPathBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');

// DOM Elements - Settings Fullscreen View & Nav
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const closeSettingsXBtn = document.getElementById('closeSettingsXBtn');
const tokenSetupSaveHeaderBtn = document.getElementById('tokenSetupSaveHeaderBtn');
const languageSelect = document.getElementById('languageSelect');
const serverUrlInput = document.getElementById('serverUrlInput');
const tokenSetupInput = document.getElementById('tokenSetupInput');
const modelSettingSelect = document.getElementById('modelSettingSelect');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const healthStatusText = document.getElementById('healthStatusText');
const tokenSetupSaveBtn = document.getElementById('tokenSetupSaveBtn');
const openLogsBtn = document.getElementById('openLogsBtn');

// DOM Elements - Token Donut & Popover
const tokenDonutBtn = document.getElementById('tokenDonutBtn');
const tokenDonutProgress = document.getElementById('tokenDonutProgress');
const tokenDonutText = document.getElementById('tokenDonutText');
const tokenPopover = document.getElementById('tokenPopover');
const tokenPopoverSpent = document.getElementById('tokenPopoverSpent');
const tokenProgressBarWrap = document.getElementById('tokenProgressBarWrap');
const tokenSpentDetails = document.getElementById('tokenSpentDetails');
const tokenDetailUser = document.getElementById('tokenDetailUser');
const tokenDetailLlm = document.getElementById('tokenDetailLlm');
const tokenDetailTools = document.getElementById('tokenDetailTools');
const tokenDetailContext = document.getElementById('tokenDetailContext');
const tokenDetailPrompt = document.getElementById('tokenDetailPrompt');
const tokenDetailCompact = document.getElementById('tokenDetailCompact');
const tokenPopoverBar = document.getElementById('tokenPopoverBar');
let sessionLastCompactTimestamp = null;

function formatTokenCount(num) {
  if (!num || isNaN(num)) return '0';
  const val = Math.round(Number(num));
  if (val <= 9999) {
    return val.toLocaleString();
  }
  if (val < 999950) {
    const k = val / 1000;
    const formatted = (k % 1 === 0) ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '');
    return `${formatted}K`;
  }
  const m = val / 1000000;
  const formattedM = (m % 1 === 0) ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
  return `${formattedM}M`;
}

function formatLastCompactTime(timestamp, isRu) {
  if (!timestamp) {
    return isRu ? 'Никогда' : 'Never';
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) {
    return isRu ? 'только что' : 'just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return isRu ? `${diffMin} мин. назад` : `${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return isRu ? `${diffHours} ч. назад` : `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return isRu ? `${diffDays} дн. назад` : `${diffDays}d ago`;
}

// DOM Elements - Chat Area
const chatContainer = document.getElementById('chatContainer');
const emptyState = document.getElementById('emptyState');
const messagesList = document.getElementById('messagesList');
const serverIndicator = document.getElementById('serverIndicator');

// DOM Elements - Onboarding
const onboardingOverlay = document.getElementById('onboardingOverlay');
const onboardingMascot = document.getElementById('onboardingMascot');
const onboardingBanner = document.getElementById('onboardingBanner');
const onboardingTokenInput = document.getElementById('onboardingTokenInput');
const onboardingSaveBtn = document.getElementById('onboardingSaveBtn');
const toggleTokenVisibilityBtn = document.getElementById('toggleTokenVisibilityBtn');
const onboardingServerToggleBtn = document.getElementById('onboardingServerToggleBtn');
const onboardingServerSection = document.getElementById('onboardingServerSection');
const onboardingServerUrlInput = document.getElementById('onboardingServerUrlInput');
const onboardingError = document.getElementById('onboardingError');
const tickerWord = document.getElementById('tickerWord');

function setOnboardingVisible(visible) {
  if (onboardingOverlay) {
    onboardingOverlay.style.display = visible ? 'flex' : 'none';
    if (visible && onboardingTokenInput) {
      setTimeout(() => onboardingTokenInput.focus(), 60);
    }
  }
  if (onboardingBanner) {
    onboardingBanner.style.display = 'none';
  }
}

// DOM Elements - Composer & Mode Toggles
const promptInput = document.getElementById('promptInput');
const sendBtn = document.getElementById('sendBtn');
const toggleDead = document.getElementById('toggleDead');
const toggleAgent = document.getElementById('toggleAgent');
const toggleThinking = document.getElementById('toggleThinking');
const toggleSearch = document.getElementById('toggleSearch');
const togglePlan = document.getElementById('togglePlan');
const attachContextBtn = document.getElementById('attachContextBtn');

// DOM Elements - Cable Button & Inline Controls Drawer
const cableBtn = document.getElementById('cableBtn');
const composerControlsDrawer = document.getElementById('composerControlsDrawer');
const closeControlsDrawerBtn = document.getElementById('closeControlsDrawerBtn');
const sandboxControlSection = document.getElementById('sandboxControlSection');
const sandboxSegmented = document.getElementById('sandboxSegmented');
const sandboxModeDesc = document.getElementById('sandboxModeDesc');

// DOM Elements - External Settings Defaults
const defDeadMode = document.getElementById('defDeadMode');
const defAgentMode = document.getElementById('defAgentMode');
const defThinking = document.getElementById('defThinking');
const defSearch = document.getElementById('defSearch');
const defPlanMode = document.getElementById('defPlanMode');
const defSandboxMode = document.getElementById('defSandboxMode');
const defDebugMode = document.getElementById('defDebugMode');
const defAutoOpenFile = document.getElementById('defAutoOpenFile');
const defAutoUpdate = document.getElementById('defAutoUpdate');
const defRemoveOldContext = document.getElementById('defRemoveOldContext');
const defHideOldContext = document.getElementById('defHideOldContext');
const lblDefHideOldContextRow = document.getElementById('lblDefHideOldContextRow');
const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const updateStatusText = document.getElementById('updateStatusText');
const currentVersionValue = document.getElementById('currentVersionValue');
const devPacingDelayInput = document.getElementById('devPacingDelayInput');
const devRequestDelayInput = document.getElementById('devRequestDelayInput');
const devConnectTimeoutInput = document.getElementById('devConnectTimeoutInput');
const devReadTimeoutInput = document.getElementById('devReadTimeoutInput');
const devThinkingTimeoutInput = document.getElementById('devThinkingTimeoutInput');
const devCommandTimeoutInput = document.getElementById('devCommandTimeoutInput');
const devMaxRetriesInput = document.getElementById('devMaxRetriesInput');
const devContextLimitInput = document.getElementById('devContextLimitInput');
const devCompactThresholdInput = document.getElementById('devCompactThresholdInput');
const devCyrillicRatioInput = document.getElementById('devCyrillicRatioInput');
const devLatinRatioInput = document.getElementById('devLatinRatioInput');

// State
let isGenerating = false;
let savedPlanMode = false;
try {
  const p = localStorage.getItem('deepcode_plan_mode');
  if (p !== null) savedPlanMode = (p === 'true');
} catch {}

let modeStates = {
  deadMode: false,
  agentMode: true,
  thinking: true,
  search: false,
  plan: savedPlanMode,
  sandboxMode: 'local',
  debugMode: false
};

function applyDebugModeUI() {
  if (chatContainer) {
    chatContainer.classList.toggle('debug-mode-active', Boolean(modeStates.debugMode));
  }
  document.querySelectorAll('.error-debug-wrapper').forEach(el => {
    el.style.display = modeStates.debugMode ? 'block' : 'none';
  });
  document.querySelectorAll('.internal-debug-row').forEach(el => {
    el.style.display = modeStates.debugMode ? 'block' : 'none';
  });
  document.querySelectorAll('.working-api-delay').forEach(el => {
    if (!modeStates.debugMode) el.style.display = 'none';
  });
  document.querySelectorAll('.cascade-delay-item').forEach(el => {
    if (!modeStates.debugMode) el.style.display = 'none';
  });
}
let currentAssistantMsgEl = null;
let currentThinkingAccordion = null;
let currentThinkingContentEl = null;
let thinkingStartTime = null;
let currentDebugTraceAccordion = null;
let currentDebugTraceContentEl = null;
let debugTraceStartTime = null;
let currentDebugTraceType = 'trace'; // 'trace' | 'unstuck'
let currentActiveProjectId = '';
let currentActiveSessionId = '';
let turnModifiedFiles = new Map();
let sessionPlanConfirmed = false;
let currentPlanConfirmed = false;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  if (languageSelect) {
    languageSelect.value = currentLang;
  }
  applyLanguage(currentLang);
  vscode.postMessage({ command: 'ready' });
});

if (languageSelect) {
  languageSelect.addEventListener('change', () => {
    applyLanguage(languageSelect.value);
  });
}

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
    sendBtn.title = t('stopTitle');
    sendBtn.setAttribute('aria-label', 'Stop');
    sendBtn.innerHTML = LUCIDE.square;
  } else {
    sendBtn.classList.remove('stop');
    sendBtn.title = t('sendTitle');
    sendBtn.setAttribute('aria-label', 'Send');
    sendBtn.innerHTML = LUCIDE.arrowUp;
    if (promptInput.value.trim().length > 0) {
      sendBtn.classList.add('active');
    } else {
      sendBtn.classList.remove('active');
    }
  }
}

function cleanupActiveSpinners() {
  // 1. Unconditionally terminate any command spinners and running classes anywhere in DOM
  document.querySelectorAll('.cascade-cmd-item.running').forEach(cmd => {
    cmd.classList.remove('running');
    const sp = cmd.querySelector('.cmd-spinner');
    if (sp) sp.style.setProperty('display', 'none', 'important');
  });
  document.querySelectorAll('.cmd-spinner').forEach(sp => {
    sp.style.setProperty('display', 'none', 'important');
  });

  // 2. Unconditionally finalize any active thinking accordions and hide spinning dots
  document.querySelectorAll('.thinking-accordion.active').forEach(acc => {
    acc.classList.remove('active');
    acc.classList.remove('open');
    const dot = acc.querySelector('.thinking-dot, .debug-dot');
    if (dot) dot.style.display = 'none';
    const vp = acc.querySelector('.thinking-stream-viewport');
    if (vp) vp.remove();
  });
  document.querySelectorAll('.thinking-dot, .debug-dot').forEach(dot => {
    dot.style.display = 'none';
  });
  finishThinking();
  finishDebugTrace();

  // 3. Finalize all non-done working blocks
  document.querySelectorAll('.working-block:not(.done)').forEach(wb => {
    wb.classList.add('done');
    const sp = wb.querySelector('.working-spinner');
    if (sp) sp.style.display = 'none';
    const timeEl = wb.querySelector('.working-time');
    if (timeEl && timeEl.style.display === 'none') {
      const asstEl = wb.closest('.assistant-message');
      const start = asstEl?._startTime || executionStartTime || Date.now();
      const elapsedSec = Math.max(1, Math.round((Date.now() - start) / 1000));
      timeEl.textContent = formatDuration(elapsedSec);
      timeEl.style.display = 'inline-block';
    }
    const title = wb.querySelector('.working-title');
    if (title && title.textContent === t('workingTitle')) {
      title.textContent = t('workedTitle') || 'Worked';
    }
  });

  document.querySelectorAll('.working-spinner').forEach(sp => {
    sp.style.display = 'none';
  });
  document.querySelectorAll('.working-pill').forEach(pill => pill.remove());
}

function handleStop() {
  if (!isGenerating) return;
  isGenerating = false;
  updateSendButtonState();

  // Cleanly finalize working blocks, command spinners, and thinking accordions immediately on client
  cleanupActiveSpinners();

  if (currentAssistantMsgEl && turnModifiedFiles.size > 0 && currentAssistantMsgEl.dataset.hasModifiedFiles === 'true') {
    renderReviewStatBar(currentAssistantMsgEl, turnModifiedFiles);
  }
  turnModifiedFiles.clear();

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

sendBtn.addEventListener('click', () => {
  if (isGenerating) {
    handleStop();
  } else {
    handleSend();
  }
});

let executionStartTime = 0;

function handleSend() {
  const text = promptInput.value.trim();
  if (!text || isGenerating) return;

  turnModifiedFiles.clear();
  console.log('[DeepCode Chat Out -> User Prompt]:', text);
  appendUserMessage(text);
  promptInput.value = '';
  promptInput.style.height = 'auto';

  isGenerating = true;
  executionStartTime = Date.now();
  currentAssistantMsgEl = null;
  currentThinkingAccordion = null;
  currentThinkingContentEl = null;
  updateSendButtonState();
  currentPlanConfirmed = sessionPlanConfirmed;

  const asstEl = ensureAssistantMessage();
  asstEl._startTime = Date.now();

  // If already confirmed and executing steps, display the Working block
  if (sessionPlanConfirmed) {
    const wb = ensureWorkingBlock(asstEl);
    wb.classList.remove('done');
    wb.classList.add('open');
    const wbHeader = wb.querySelector('.working-header');
    if (wbHeader) wbHeader.style.display = 'flex';
    const wbTitle = wb.querySelector('.working-title');
    if (wbTitle) wbTitle.textContent = t('workingTitle');
    const wbSpinner = wb.querySelector('.working-spinner');
    if (wbSpinner) wbSpinner.style.display = 'inline-block';
    const wbTime = wb.querySelector('.working-time');
    if (wbTime) wbTime.style.display = 'none';
  }

  vscode.postMessage({
    command: 'sendMessage',
    text,
    planMode: modeStates.plan !== false,
    sandboxMode: modeStates.sandboxMode || 'local',
    toggles: modeStates
  });
}

function updateComposerPlaceholder() {
  if (!promptInput) return;
  if (modeStates.deadMode) {
    promptInput.placeholder = t('deadModePlaceholder') || 'Ask anything, I SAW ANYTHING';
  } else {
    promptInput.placeholder = t('composerPlaceholder') || 'Ask anything';
  }
}

function updateTogglesUI() {
  if (toggleDead) toggleDead.checked = Boolean(modeStates.deadMode);
  if (defDeadMode) defDeadMode.checked = Boolean(modeStates.deadMode);
  if (toggleAgent) toggleAgent.checked = Boolean(modeStates.agentMode);
  if (toggleThinking) toggleThinking.checked = Boolean(modeStates.thinking);
  if (toggleSearch) toggleSearch.checked = Boolean(modeStates.search);
  if (togglePlan) togglePlan.checked = modeStates.plan !== false;
  updateComposerPlaceholder();

  // Sandbox section is disabled when agent mode is off
  if (sandboxControlSection) {
    sandboxControlSection.classList.toggle('disabled', !modeStates.agentMode);
  }

  const currentSandbox = modeStates.sandboxMode || 'local';
  if (sandboxSegmented) {
    sandboxSegmented.querySelectorAll('.sandbox-segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === currentSandbox);
    });
  }

  if (sandboxModeDesc) {
    if (!modeStates.agentMode) {
      sandboxModeDesc.textContent = 'Disabled (Agent Mode is off)';
    } else {
      switch (currentSandbox) {
        case 'bypass':
          sandboxModeDesc.textContent = 'Bypass (unrestricted RWX: global execution)';
          break;
        case 'helper':
          sandboxModeDesc.textContent = 'Helper mode (RW: read & write project files, no commands)';
          break;
        case 'ask':
          sandboxModeDesc.textContent = 'Ask mode (Read-Only: inspect code, no file edits or commands)';
          break;
        case 'local':
        default:
          sandboxModeDesc.textContent = 'Local project (RWX: workspace-contained, prompts for commands)';
          break;
      }
    }
  }
}

function notifyTogglesChanged() {
  updateTogglesUI();
  try {
    localStorage.setItem('deepcode_plan_mode', String(modeStates.plan !== false));
  } catch {}
  vscode.postMessage({
    command: 'setToggles',
    toggles: modeStates
  });
}

// Cable Button Drawer Toggle
if (cableBtn && composerControlsDrawer) {
  cableBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = composerControlsDrawer.style.display === 'none';
    composerControlsDrawer.style.display = isHidden ? 'block' : 'none';
    cableBtn.classList.toggle('active', isHidden);
  });
}

if (closeControlsDrawerBtn && composerControlsDrawer) {
  closeControlsDrawerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    composerControlsDrawer.style.display = 'none';
    if (cableBtn) cableBtn.classList.remove('active');
  });
}

// Checkbox Toggles
if (toggleDead) {
  toggleDead.addEventListener('change', () => {
    modeStates.deadMode = toggleDead.checked;
    notifyTogglesChanged();
  });
}

if (toggleAgent) {
  toggleAgent.addEventListener('change', () => {
    modeStates.agentMode = toggleAgent.checked;
    notifyTogglesChanged();
  });
}

if (toggleThinking) {
  toggleThinking.addEventListener('change', () => {
    modeStates.thinking = toggleThinking.checked;
    notifyTogglesChanged();
  });
}

if (toggleSearch) {
  toggleSearch.addEventListener('change', () => {
    modeStates.search = toggleSearch.checked;
    notifyTogglesChanged();
  });
}

if (togglePlan) {
  togglePlan.addEventListener('change', () => {
    modeStates.plan = togglePlan.checked;
    notifyTogglesChanged();
  });
}

// Sandbox 4-stage Segmented Controls
if (sandboxSegmented) {
  sandboxSegmented.querySelectorAll('.sandbox-segment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!modeStates.agentMode) return;
      modeStates.sandboxMode = btn.dataset.val;
      notifyTogglesChanged();
    });
  });
}

// Top Navigation Actions
if (chatTitleInput) {
  chatTitleInput.addEventListener('change', () => {
    vscode.postMessage({ command: 'setTitle', title: chatTitleInput.value });
  });
}



if (attachContextBtn) {
  attachContextBtn.addEventListener('click', () => {
    vscode.postMessage({ command: 'addContext' });
  });
}

// Settings Fullscreen View
function openSettingsView() {
  if (settingsModal) {
    settingsModal.style.display = 'flex';
    document.body.classList.add('in-settings-view');
    if (healthStatusText) healthStatusText.textContent = '';
  }
}

function closeSettingsView() {
  if (settingsModal) {
    settingsModal.style.display = 'none';
    document.body.classList.remove('in-settings-view');
  }
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', openSettingsView);
}

if (closeSettingsModalBtn) {
  closeSettingsModalBtn.addEventListener('click', closeSettingsView);
}

if (closeSettingsXBtn) {
  closeSettingsXBtn.addEventListener('click', closeSettingsView);
}

if (tokenSetupSaveHeaderBtn) {
  tokenSetupSaveHeaderBtn.addEventListener('click', () => {
    if (tokenSetupSaveBtn) tokenSetupSaveBtn.click();
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsModal && settingsModal.style.display !== 'none') {
    closeSettingsView();
  }
});

if (openLogsBtn) {
  openLogsBtn.addEventListener('click', () => {
    vscode.postMessage({ command: 'showLogs' });
  });
}

const resetTokenBtn = document.getElementById('resetTokenBtn');
if (resetTokenBtn) {
  resetTokenBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetTokenBtn.classList.add('done');
    const resetText = (typeof currentLang !== 'undefined' && currentLang === 'ru') ? 'Токен сброшен ✓' : 'Token reset ✓';
    resetTokenBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg><span>${resetText}</span>`;
    vscode.postMessage({ command: 'resetToken' });
  });
}

if (checkUpdateBtn) {
  checkUpdateBtn.addEventListener('click', () => {
    if (updateStatusText) {
      updateStatusText.textContent = t('updateChecking');
      updateStatusText.style.color = 'var(--text-secondary)';
    }
    checkUpdateBtn.disabled = true;
    vscode.postMessage({ command: 'checkForUpdates' });
  });
}

if (defDeadMode) {
  defDeadMode.addEventListener('change', () => {
    modeStates.deadMode = defDeadMode.checked;
    updateTogglesUI();
  });
}

if (defDebugMode) {
  defDebugMode.addEventListener('change', () => {
    modeStates.debugMode = defDebugMode.checked;
    applyDebugModeUI();
  });
}

function syncOldContextToggles() {
  if (!defRemoveOldContext || !defHideOldContext) return;
  if (defRemoveOldContext.checked) {
    defHideOldContext.disabled = true;
    if (lblDefHideOldContextRow) {
      lblDefHideOldContextRow.style.opacity = '0.45';
      lblDefHideOldContextRow.style.pointerEvents = 'none';
    }
  } else {
    defHideOldContext.disabled = false;
    if (lblDefHideOldContextRow) {
      lblDefHideOldContextRow.style.opacity = '1';
      lblDefHideOldContextRow.style.pointerEvents = 'auto';
    }
  }
}

if (defRemoveOldContext) {
  defRemoveOldContext.addEventListener('change', () => {
    syncOldContextToggles();
  });
}

// Token Donut & Popover Logic
const BPE_SPLIT_REGEX = /'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;

function getClientTokenizerSettings() {
  const maxTokens = devContextLimitInput ? (parseInt(devContextLimitInput.value, 10) || 1000000) : 1000000;
  const cyrillicRatio = devCyrillicRatioInput ? (parseFloat(devCyrillicRatioInput.value) || 1.7) : 1.7;
  const latinRatio = devLatinRatioInput ? (parseFloat(devLatinRatioInput.value) || 3.8) : 3.8;
  return { maxTokens, cyrillicRatio, latinRatio };
}

function countTokensClient(text) {
  if (!text || typeof text !== 'string') return 0;
  const { cyrillicRatio, latinRatio } = getClientTokenizerSettings();
  const matches = text.match(BPE_SPLIT_REGEX);
  if (!matches) return Math.max(1, Math.ceil(text.length / 3.5));
  let tokens = 0;
  for (let i = 0; i < matches.length; i++) {
    const chunk = matches[i];
    if (/[\u0400-\u04FF]/.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.trim().length / cyrillicRatio));
    } else if (/^[\s\r\n]+$/.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.length / 3));
    } else if (/[a-zA-Z]/.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.length / latinRatio));
    } else if (/^\p{N}+$/u.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.length / 3));
    } else {
      tokens += 1;
    }
  }
  return Math.max(1, tokens);
}

function calculateClientTokenUsage(messages, model) {
  const { maxTokens } = getClientTokenizerSettings();
  const basePromptTokens = 7908;
  if (!messages || messages.length === 0) {
    return {
      promptTokens: basePromptTokens,
      completionTokens: 0,
      userTokens: 0,
      llmTokens: 0,
      contextTokens: basePromptTokens,
      totalTokens: 0,
      maxTokens,
      percent: Math.min(100, Math.round((basePromptTokens / maxTokens) * 100))
    };
  }
  let completionTokens = 0;
  let userTokens = 0;
  let otherTokens = 0;
  for (const m of messages) {
    let t = 4;
    if (m.content) t += countTokensClient(m.content);
    if (m.reasoningContent) t += countTokensClient(m.reasoningContent) + 2;
    if (m.toolCalls) {
      for (const tc of m.toolCalls) {
        t += countTokensClient(tc.name || '') + 3;
        if (tc.arguments) {
          t += countTokensClient(typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments));
        }
      }
    }
    if (m.role === 'assistant') {
      completionTokens += t;
    } else if (m.role === 'user') {
      userTokens += t;
    } else if (m.role === 'tool') {
      toolTokens += t;
    } else {
      otherTokens += t;
    }
  }

  const contextTokens = basePromptTokens + userTokens + completionTokens + toolTokens + otherTokens;
  const totalTokens = contextTokens;
  const percent = Math.min(100, Math.round((totalTokens / maxTokens) * 100));
  return {
    promptTokens: basePromptTokens,
    completionTokens,
    userTokens,
    llmTokens: completionTokens,
    toolTokens,
    contextTokens,
    totalTokens,
    maxTokens,
    percent
  };
}

function updateTokenDonut(usage) {
  if (!usage) return;
  const max = usage.maxTokens || 1000000;
  const total = usage.totalTokens || 0;
  const prompt = usage.promptTokens !== undefined ? usage.promptTokens : 7908;
  const completion = usage.completionTokens || 0;
  const user = usage.userTokens !== undefined ? usage.userTokens : (usage.cumulativeUserTokens || 0);
  const llm = usage.llmTokens !== undefined ? usage.llmTokens : (usage.cumulativeLlmTokens || completion);
  const tools = usage.toolTokens !== undefined ? usage.toolTokens : (usage.cumulativeToolTokens || 0);
  const context = usage.contextTokens !== undefined ? usage.contextTokens : (total || (prompt + user + llm + tools));
  const percent = Math.min(100, Math.max(0, Math.round((context / max) * 100)));

  // Cumulative tokens spent across the lifetime of the session: User + LLM + Tools + Prompt (never compressed by compact)
  const totalSpent = usage.cumulativeTokensSpent !== undefined
    ? usage.cumulativeTokensSpent
    : (user + llm + tools + prompt);

  if (tokenDonutProgress) {
    tokenDonutProgress.setAttribute('stroke-dasharray', `${percent}, 100`);
    let color = '#10b981';
    if (percent > 85) color = '#ef4444';
    else if (percent > 60) color = '#f59e0b';
    tokenDonutProgress.setAttribute('stroke', color);
  }

  if (tokenDonutText) {
    tokenDonutText.textContent = `${percent}%`;
  }

  if (tokenDonutBtn) {
    tokenDonutBtn.title = `Context: ${formatTokenCount(context)} / ${formatTokenCount(max)} (${percent}%)`;
  }

  const isRu = (currentLang === 'ru');

  // Top header row: Context: X/1M
  const spentLabelEl = document.getElementById('tokenPopoverSpentLabel');
  if (spentLabelEl) {
    spentLabelEl.textContent = isRu ? 'Контекст:' : 'Context:';
  }

  if (tokenPopoverSpent) {
    tokenPopoverSpent.textContent = `${formatTokenCount(context)}/${formatTokenCount(max)}`;
  }

  if (tokenDetailUser) {
    tokenDetailUser.textContent = formatTokenCount(user);
  }

  if (tokenDetailLlm) {
    tokenDetailLlm.textContent = formatTokenCount(llm);
  }

  if (tokenDetailTools) {
    tokenDetailTools.textContent = formatTokenCount(tools);
  }

  if (tokenDetailPrompt) {
    tokenDetailPrompt.textContent = formatTokenCount(prompt);
  }

  // Tokens Spent row directly above Last Compact
  const totalSpentLabelEl = document.getElementById('tokenDetailTotalSpentLabel');
  if (totalSpentLabelEl) {
    totalSpentLabelEl.textContent = isRu ? 'Потрачено токенов:' : 'Tokens Spent:';
  }

  const totalSpentEl = document.getElementById('tokenDetailTotalSpent');
  if (totalSpentEl) {
    totalSpentEl.textContent = formatTokenCount(totalSpent);
  }

  if (usage && usage.lastCompactTimestamp !== undefined) {
    sessionLastCompactTimestamp = usage.lastCompactTimestamp;
  }

  if (tokenDetailCompact) {
    tokenDetailCompact.textContent = formatLastCompactTime(sessionLastCompactTimestamp, isRu);
  }

  if (tokenPopoverBar) {
    tokenPopoverBar.style.width = `${percent}%`;
    let color = '#10b981';
    if (percent > 85) color = '#ef4444';
    else if (percent > 60) color = '#f59e0b';
    tokenPopoverBar.style.backgroundColor = color;
  }
}

if (tokenProgressBarWrap) {
  tokenProgressBarWrap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tokenSpentDetails) {
      const isVisible = tokenSpentDetails.style.display !== 'none';
      tokenSpentDetails.style.display = isVisible ? 'none' : 'flex';
      tokenProgressBarWrap.classList.toggle('open', !isVisible);
    }
  });
}

if (tokenDonutBtn) {
  tokenDonutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tokenPopover) {
      const isVisible = tokenPopover.style.display === 'block' || tokenPopover.classList.contains('visible');
      if (isVisible) {
        tokenPopover.style.display = 'none';
        tokenPopover.classList.remove('visible');
      } else {
        tokenPopover.style.display = 'block';
        tokenPopover.classList.add('visible');
      }
    }
  });
}

document.addEventListener('click', (e) => {
  if (tokenPopover && (tokenPopover.style.display === 'block' || tokenPopover.classList.contains('visible'))) {
    if (!tokenPopover.contains(e.target) && !tokenDonutBtn.contains(e.target)) {
      tokenPopover.style.display = 'none';
      tokenPopover.classList.remove('visible');
    }
  }
});

if (testConnectionBtn) {
  testConnectionBtn.addEventListener('click', () => {
    healthStatusText.textContent = t('testing');
    healthStatusText.className = 'health-status-text';
    vscode.postMessage({
      command: 'testConnection',
      baseUrl: serverUrlInput.value.trim(),
      apiKey: tokenSetupInput.value.trim()
    });
  });
}

if (tokenSetupSaveBtn) {
  tokenSetupSaveBtn.addEventListener('click', () => {
    saveCredentials(tokenSetupInput.value, serverUrlInput.value, modelSettingSelect.value);
  });
}

if (onboardingMascot && window.DEEPCHAN_URI) {
  onboardingMascot.src = window.DEEPCHAN_URI;
}

if (tickerWord) {
  const tickerWords = [
    'code',
    'analyze',
    'architect',
    'refactor',
    'build',
    'generate',
    'optimize',
    'debug',
    'synthesize',
    'automate',
    'explore',
    'ship'
  ];
  let tickerIdx = 0;
  setInterval(() => {
    tickerWord.style.transition = 'transform 0.16s ease-in, opacity 0.16s ease-in';
    tickerWord.style.transform = 'translateY(-100%)';
    tickerWord.style.opacity = '0';

    setTimeout(() => {
      tickerIdx = (tickerIdx + 1) % tickerWords.length;
      tickerWord.textContent = tickerWords[tickerIdx];
      tickerWord.style.transition = 'none';
      tickerWord.style.transform = 'translateY(100%)';
      tickerWord.style.opacity = '0';

      void tickerWord.offsetHeight;

      tickerWord.style.transition = 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease-out';
      tickerWord.style.transform = 'translateY(0)';
      tickerWord.style.opacity = '1';
    }, 160);
  }, 1400);
}

if (toggleTokenVisibilityBtn && onboardingTokenInput) {
  toggleTokenVisibilityBtn.addEventListener('click', () => {
    if (onboardingTokenInput.type === 'password') {
      onboardingTokenInput.type = 'text';
      toggleTokenVisibilityBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.88 9.88 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
    } else {
      onboardingTokenInput.type = 'password';
      toggleTokenVisibilityBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  });
}

if (onboardingTokenInput) {
  onboardingTokenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onboardingSaveBtn?.click();
    }
  });
  onboardingTokenInput.addEventListener('input', () => {
    if (onboardingError && onboardingError.style.display !== 'none') {
      onboardingError.style.display = 'none';
    }
  });
}

if (onboardingServerUrlInput) {
  onboardingServerUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onboardingSaveBtn?.click();
    }
  });
}

if (onboardingSaveBtn) {
  onboardingSaveBtn.addEventListener('click', () => {
    const key = onboardingTokenInput ? onboardingTokenInput.value.trim() : '';
    if (!key) {
      if (onboardingError) {
        onboardingError.textContent = currentLang === 'ru' ? 'Пожалуйста, введите ваш API-токен.' : 'Please enter your API token.';
        onboardingError.style.display = 'block';
      }
      onboardingTokenInput?.focus();
      return;
    }
    if (/[^\x00-\x7F]/.test(key)) {
      if (onboardingError) {
        onboardingError.textContent = currentLang === 'ru'
          ? 'Введённый токен содержит русские буквы! Переключите раскладку на английскую.'
          : 'Token contains invalid non-ASCII characters.';
        onboardingError.style.display = 'block';
      }
      return;
    }
    if (onboardingError) onboardingError.style.display = 'none';
    const targetUrl = (onboardingServerUrlInput && onboardingServerUrlInput.value.trim())
      || (serverUrlInput && serverUrlInput.value.trim())
      || 'https://api.thenck4.ru/v1';
    saveCredentials(key, targetUrl, modelSettingSelect ? modelSettingSelect.value : 'deepseek-chat');
  });
}

function saveCredentials(key, url, model) {
  if (!key || !key.trim()) {
    alert(currentLang === 'ru' ? 'Пожалуйста, введите ваш API-токен.' : 'Please enter your API token.');
    return;
  }
  const cleanKey = key.trim();
  if (/[^\x00-\x7F]/.test(cleanKey)) {
    alert(currentLang === 'ru'
      ? 'Ошибка: Введённый API-токен содержит русские буквы! Пожалуйста, переключите раскладку на английский и введите правильный ключ (sk-...).'
      : 'Error: API token contains invalid non-ASCII characters. Please ensure English layout and enter a valid key.');
    return;
  }

  const defaults = {
    deadMode: defDeadMode ? defDeadMode.checked : false,
    agentMode: defAgentMode ? defAgentMode.checked : true,
    thinking: defThinking ? defThinking.checked : true,
    search: defSearch ? defSearch.checked : false,
    planMode: defPlanMode ? defPlanMode.checked : false,
    sandboxMode: defSandboxMode ? defSandboxMode.value : 'local',
    debugMode: defDebugMode ? defDebugMode.checked : false,
    autoOpenModifiedFiles: defAutoOpenFile ? defAutoOpenFile.checked : false,
    autoUpdate: defAutoUpdate ? defAutoUpdate.checked : false,
    removeOldContextFromFile: defRemoveOldContext ? defRemoveOldContext.checked : false,
    hideOldContext: defHideOldContext ? defHideOldContext.checked : true,
    pacingDelayMs: devPacingDelayInput ? (parseInt(devPacingDelayInput.value, 10) || 1500) : 1500,
    requestDelayMs: devRequestDelayInput ? (parseInt(devRequestDelayInput.value, 10) || 3000) : 3000,
    connectTimeoutSec: devConnectTimeoutInput ? (parseInt(devConnectTimeoutInput.value, 10) || 75) : 75,
    readTimeoutSec: devReadTimeoutInput ? (parseInt(devReadTimeoutInput.value, 10) || 45) : 45,
    thinkingTimeoutSec: devThinkingTimeoutInput ? (parseInt(devThinkingTimeoutInput.value, 10) || 9) : 9,
    commandTimeoutSec: devCommandTimeoutInput ? (parseInt(devCommandTimeoutInput.value, 10) || 180) : 180,
    maxRetries: devMaxRetriesInput ? (parseInt(devMaxRetriesInput.value, 10) || 3) : 3,
    contextLimitTokens: devContextLimitInput ? (parseInt(devContextLimitInput.value, 10) || 1000000) : 1000000,
    compactThresholdTokens: devCompactThresholdInput ? (parseInt(devCompactThresholdInput.value, 10) || 80000) : 80000,
    cyrillicCharsPerToken: devCyrillicRatioInput ? (parseFloat(devCyrillicRatioInput.value) || 1.7) : 1.7,
    latinCharsPerToken: devLatinRatioInput ? (parseFloat(devLatinRatioInput.value) || 3.8) : 3.8
  };

  if (defaults.sandboxMode) modeStates.sandboxMode = defaults.sandboxMode;
  if (defaults.deadMode !== undefined) modeStates.deadMode = defaults.deadMode;
  if (defaults.agentMode !== undefined) modeStates.agentMode = defaults.agentMode;
  if (defaults.thinking !== undefined) modeStates.thinking = defaults.thinking;
  if (defaults.search !== undefined) modeStates.search = defaults.search;
  if (defaults.planMode !== undefined) modeStates.plan = defaults.planMode;
  if (defaults.debugMode !== undefined) modeStates.debugMode = defaults.debugMode;
  updateTogglesUI();

  vscode.postMessage({
    command: 'saveAuth',
    apiKey: cleanKey,
    baseUrl: url ? url.trim() : 'https://api.thenck4.ru/v1',
    model: model || 'deepseek-chat',
    defaults: defaults,
    lang: currentLang
  });
}

// Format relative time
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return currentLang === 'ru' ? 'сейчас' : 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// Format duration in seconds to human readable (e.g. 57s, 1m 24s)
function formatDuration(sec) {
  const s = Math.max(1, Math.round(sec));
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  return `${s}s`;
}

// Format message timestamp (e.g. 14:32, Вчера, 14:32, 02.10, 14:32)
function formatMessageTime(timestamp, includeSeconds = false) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  const timeStr = includeSeconds ? `${hours}:${minutes}:${sec}` : `${hours}:${minutes}`;

  const isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');

  if (isToday) {
    return timeStr;
  }
  if (isYesterday) {
    return isRu ? `Вчера, ${timeStr}` : `Yesterday, ${timeStr}`;
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (isSameYear) {
    return `${day}.${month}, ${timeStr}`;
  }

  const year = date.getFullYear();
  return `${day}.${month}.${year}, ${timeStr}`;
}

function formatFullTimestamp(timestamp, role) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
  let roleLabel = '';
  if (role === 'user') {
    roleLabel = isRu ? 'Пользователь • ' : 'User • ';
  } else if (role === 'assistant') {
    roleLabel = isRu ? 'Ассистент • ' : 'DeepCode • ';
  }
  return `${roleLabel}${date.toLocaleString(isRu ? 'ru-RU' : 'en-US')}`;
}

function ensureAssistantTimestamp(asstEl, timestamp) {
  if (!asstEl) return;
  const row = asstEl.parentElement;
  if (!row) return;

  const ts = (timestamp && timestamp > 0) ? timestamp : (asstEl._timestamp || asstEl._startTime || Date.now());
  asstEl._timestamp = ts;

  let meta = row.querySelector(':scope > .assistant-meta');
  if (!meta) {
    meta = document.createElement('div');
    meta.className = 'message-meta assistant-meta';
    row.appendChild(meta);
  } else {
    row.appendChild(meta);
  }
  meta.innerHTML = `<span class="message-time" title="${formatFullTimestamp(ts, 'assistant')}">${formatMessageTime(ts)}</span>`;
}

let liveTimerInterval = null;

function startLiveTimer() {
  if (liveTimerInterval) return;
  liveTimerInterval = setInterval(() => {
    // 1. Live update active working block duration
    if (currentAssistantMsgEl) {
      const wb = currentAssistantMsgEl.querySelector('.working-block:not(.done)');
      if (wb) {
        const start = currentAssistantMsgEl._startTime || executionStartTime;
        if (start) {
          const elapsedSec = Math.max(1, Math.round((Date.now() - start) / 1000));
          const timeEl = wb.querySelector('.working-time');
          if (timeEl) {
            timeEl.textContent = formatDuration(elapsedSec);
            timeEl.style.display = 'inline-block';
          }
        }
      }
    }

    // 2. Live update active thinking accordion
    if (currentThinkingAccordion && thinkingStartTime) {
      const elapsedSec = Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000));
      const title = currentThinkingAccordion.querySelector('.thinking-title');
      if (title) {
        title.textContent = `Thinking (${elapsedSec}s)...`;
      }
    }

    if (currentDebugTraceAccordion && currentDebugTraceAccordion.classList.contains('active') && debugTraceStartTime) {
      const elapsedSec = Math.max(1, Math.round((Date.now() - debugTraceStartTime) / 1000));
      const title = currentDebugTraceAccordion.querySelector('.thinking-title');
      if (title) {
        const prefix = currentDebugTraceType === 'unstuck' ? t('unstuckTitle') : 'Debug Trace';
        title.textContent = `${prefix} (${elapsedSec}s)...`;
      }
    }

    // 3. Live update running commands
    document.querySelectorAll('.cascade-cmd-item.running').forEach(cmdItem => {
      const startTime = Number(cmdItem.dataset.startTime || 0);
      if (startTime > 0) {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const prefix = cmdItem.querySelector('.cascade-cmd-prefix');
        if (prefix) {
          prefix.textContent = `Ran (${elapsedSec}s)`;
        }
      }
    });
  }, 1000);
}

function stopLiveTimer() {
  if (liveTimerInterval) {
    clearInterval(liveTimerInterval);
    liveTimerInterval = null;
  }
}

// Render Projects Hierarchy (Formatted as [Project Name]: [Chat Name])
function renderProjectsHierarchy(hierarchy, activeProjId, activeSessId) {
  currentActiveProjectId = activeProjId;
  currentActiveSessionId = activeSessId;
  if (!projectsTreeList) return;
  projectsTreeList.innerHTML = '';

  for (const item of hierarchy) {
    const project = item.project;
    const sessions = item.sessions || [];
    const isProjectActive = project.id === activeProjId;

    const groupEl = document.createElement('div');
    groupEl.className = 'project-group';

    // Project Row with Lucide folder icon
    const rowEl = document.createElement('div');
    rowEl.className = 'project-row' + (isProjectActive ? ' active-project' : '');
    rowEl.title = `Path: ${project.path}`;

    rowEl.innerHTML = `
      <div class="project-row-left">
        ${LUCIDE.folder}
        <span class="project-row-name">${escapeHtml(project.name)}</span>
      </div>
      <div class="project-row-actions">
        <button class="icon-btn add-proj-chat-btn" title="${t('newConversation')}" style="padding: 2px;">
          ${LUCIDE.plus}
        </button>
        ${hierarchy.length > 1 ? `
        <button class="icon-btn delete-proj-btn" title="Delete Project" style="padding: 2px;">
          ${LUCIDE.trash}
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
        if (confirm(`Delete project "${project.name}" and all its chats?`)) {
          vscode.postMessage({ command: 'deleteProject', projectId: project.id });
        }
      });
    }

    groupEl.appendChild(rowEl);

    // Sessions under Project - formatted as "[Project Name]: [Chat Name]"
    const sessionsContainer = document.createElement('div');
    sessionsContainer.className = 'project-sessions';

    for (const s of sessions) {
      const isSessActive = s.id === activeSessId;
      const sessEl = document.createElement('div');
      sessEl.className = 'session-item' + (isSessActive ? ' active' : '');
      const displayTitle = `${project.name}:${s.title || 'Untitled'}`;

      sessEl.innerHTML = `
        <span class="session-title-text" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</span>
        <span class="session-time">${formatTimeAgo(s.createdAt)}</span>
        <button class="session-delete-btn" title="Delete chat" aria-label="Delete chat">
          ${LUCIDE.trash}
        </button>
      `;

      sessEl.addEventListener('click', () => {
        historyDrawer.classList.remove('open');
        vscode.postMessage({ command: 'switchSession', id: s.id });
      });

      const delBtn = sessEl.querySelector('.session-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ command: 'deleteSession', id: s.id });
        });
      }

      sessionsContainer.appendChild(sessEl);
    }

    groupEl.appendChild(sessionsContainer);
    projectsTreeList.appendChild(groupEl);
  }
}

function isInternalMessage(m) {
  if (!m) return false;
  if (m.isInternal) return true;
  const id = typeof m === 'object' ? (m.id || '') : '';
  if (id.startsWith('nudge_') || id.startsWith('plan_nudge_') || id.startsWith('reprompt_') || id.startsWith('compact_')) {
    return true;
  }
  const content = typeof m === 'string' ? m : (m.content || '');
  if (content.startsWith('CRITICAL EXECUTION:') ||
      content.startsWith('SYSTEM UNSTUCK:') ||
      content.startsWith('Task execution prompt:') ||
      content.startsWith('[COMPACTED CONTEXT BRIEFING]') ||
      content.startsWith('[Tool Result:') ||
      content.startsWith('[SELF-HEALING]') ||
      content.includes('Proceed with the next steps') ||
      content.includes('Exploration complete. Now present the architectural concept')) {
    return true;
  }
  return false;
}

function appendInternalDebugMessage(text, label = 'internal_prompt') {
  if (!text) return;
  emptyState.style.display = 'none';
  setOnboardingVisible(false);

  const row = document.createElement('div');
  row.className = 'message-row internal-debug-row';
  row.style.display = modeStates.debugMode ? 'block' : 'none';

  const details = document.createElement('details');
  details.className = 'internal-debug-details';
  if (text.length < 300) {
    details.open = true;
  }

  const summary = document.createElement('summary');
  summary.className = 'internal-debug-summary';

  const badge = document.createElement('span');
  badge.className = 'internal-debug-badge';
  badge.textContent = `[DEBUG PROMPT] ${label}`;

  const hint = document.createElement('span');
  hint.className = 'internal-debug-hint';
  hint.textContent = 'hidden prompt';

  summary.appendChild(badge);
  summary.appendChild(hint);

  const pre = document.createElement('pre');
  pre.className = 'internal-debug-content';
  pre.textContent = text;

  details.appendChild(summary);
  details.appendChild(pre);
  row.appendChild(details);

  messagesList.appendChild(row);
  scrollToBottom();
}

function appendUserMessage(text, timestamp) {
  if (!text) return;
  if (isInternalMessage({ content: text })) {
    appendInternalDebugMessage(text, 'internal_prompt');
    return;
  }

  let cleanText = text;
  let leakedPrompt = '';
  const leakedIdx = text.indexOf('Exploration complete. Now present the architectural concept');
  if (leakedIdx !== -1) {
    leakedPrompt = text.substring(leakedIdx).trim();
    cleanText = text.substring(0, leakedIdx).trim();
  }

  if (!cleanText && leakedPrompt) {
    appendInternalDebugMessage(leakedPrompt, 'plan_nudge');
    return;
  }

  emptyState.style.display = 'none';
  setOnboardingVisible(false);
  const row = document.createElement('div');
  row.className = 'message-row user-row';

  const bubble = document.createElement('div');
  bubble.className = 'user-message';
  bubble.textContent = cleanText;

  const ts = (timestamp && timestamp > 0) ? timestamp : Date.now();
  const meta = document.createElement('div');
  meta.className = 'message-meta user-meta';
  meta.innerHTML = `<span class="message-time" title="${formatFullTimestamp(ts, 'user')}">${formatMessageTime(ts)}</span>`;

  row.appendChild(bubble);
  row.appendChild(meta);
  messagesList.appendChild(row);

  if (leakedPrompt) {
    appendInternalDebugMessage(leakedPrompt, 'plan_nudge (stripped)');
  }

  scrollToBottom();
}

function ensureAssistantMessage(timestamp) {
  emptyState.style.display = 'none';
  setOnboardingVisible(false);
  if (!currentAssistantMsgEl) {
    const row = document.createElement('div');
    row.className = 'message-row assistant-row';

    currentAssistantMsgEl = document.createElement('div');
    currentAssistantMsgEl.className = 'assistant-message';
    const ts = (timestamp && timestamp > 0) ? timestamp : Date.now();
    currentAssistantMsgEl._startTime = ts;
    currentAssistantMsgEl._timestamp = ts;

    row.appendChild(currentAssistantMsgEl);
    messagesList.appendChild(row);

    ensureAssistantTimestamp(currentAssistantMsgEl, ts);
  }
  return currentAssistantMsgEl;
}

function ensureWorkingBlock(asstEl) {
  if (asstEl && !asstEl._startTime) {
    asstEl._startTime = Date.now();
  }
  let block = asstEl.querySelector('.working-block');
  if (!block) {
    block = document.createElement('div');
    block.className = 'working-block open';
    block.innerHTML = `
      <div class="working-header" style="display: flex;">
        <div class="working-header-left">
          <span class="working-title">${t('workingTitle')}</span>
          <span class="working-spinner"></span>
          <span class="working-time" style="display: none;"></span>
        </div>
        <span class="working-chevron">${LUCIDE.chevron}</span>
      </div>
      <div class="working-body">
        <div class="activity-feed"></div>
      </div>
    `;

    const header = block.querySelector('.working-header');
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      block.classList.toggle('open');
    });

    const textNode = asstEl.querySelector('.assistant-text');
    if (textNode) {
      asstEl.insertBefore(block, textNode);
    } else {
      asstEl.appendChild(block);
    }
  }
  return block;
}

function cleanTerminalOutput(raw) {
  if (!raw) return '';
  let cleaned = raw;
  cleaned = cleaned.replace(/^Command:\s*[^\n]*\r?\n*/gim, '');
  cleaned = cleaned.replace(/^Exit Code:\s*\d+\r?\n*/gim, '');
  cleaned = cleaned.replace(/^STDOUT:\s*\r?\n*/gim, '');
  cleaned = cleaned.replace(/^STDERR:\s*\r?\n*/gim, '');
  return cleaned.trim();
}

function stopCmdItemRunning(cmdWrapper, exitCode, output, error) {
  if (!cmdWrapper) return;
  cmdWrapper.classList.remove('running');
  const spinner = cmdWrapper.querySelector('.cmd-spinner');
  if (spinner) {
    spinner.style.setProperty('display', 'none', 'important');
  }

  const isErr = (exitCode !== undefined && exitCode !== 0) || Boolean(error);
  const errIcon = cmdWrapper.querySelector('.cascade-error-icon');
  if (errIcon) errIcon.style.display = isErr ? 'inline-flex' : 'none';

  if (output !== undefined && output !== null && output !== '') {
    const cleanOut = cleanTerminalOutput(output);
    const outPre = cmdWrapper.querySelector('.cascade-terminal-output');
    if (outPre) {
      outPre.textContent = cleanOut;
      outPre.style.display = cleanOut ? 'block' : 'none';
      if (isErr) {
        outPre.classList.add('has-error');
      } else {
        outPre.classList.remove('has-error');
      }
    }
  }
}

function stopAllRunningCommands(scopeEl) {
  const root = scopeEl || document;
  root.querySelectorAll('.cascade-cmd-item.running').forEach(cmd => {
    stopCmdItemRunning(cmd);
  });
  root.querySelectorAll('.cmd-spinner').forEach(sp => {
    sp.style.setProperty('display', 'none', 'important');
  });
}

function findCommandItem(scopeEl, stepId, command) {
  const root = scopeEl || document;
  if (stepId) {
    const byId = root.querySelector(`.cascade-cmd-item[data-cmd-id="${stepId}"]`) ||
                 document.querySelector(`.cascade-cmd-item[data-cmd-id="${stepId}"]`);
    if (byId) return byId;
  }
  const allCmds = Array.from(root.querySelectorAll('.cascade-cmd-item'));
  if (command) {
    const clean = command.trim();
    // 1. Prefer currently running item that matches command
    const runningMatch = allCmds.find(el => el.classList.contains('running') &&
      ((el.dataset.cmdCode || '').trim() === clean || (el.querySelector('.cascade-cmd-code')?.textContent || '').trim() === clean));
    if (runningMatch) return runningMatch;

    // 2. Any item matching command
    const anyMatch = allCmds.find(el =>
      (el.dataset.cmdCode || '').trim() === clean || (el.querySelector('.cascade-cmd-code')?.textContent || '').trim() === clean);
    if (anyMatch) return anyMatch;
  }
  // 3. Fallback: most recent running command item
  const running = allCmds.filter(el => el.classList.contains('running'));
  if (running.length > 0) return running[running.length - 1];
  return null;
}

function createCmdItem(step) {
  const cmdWrapper = document.createElement('div');
  cmdWrapper.className = 'cascade-cmd-item' + (step.status === 'running' ? ' running' : '');
  if (step.id) cmdWrapper.dataset.cmdId = step.id;
  cmdWrapper.dataset.cmdCode = step.command || '';

  const cleanOut = cleanTerminalOutput(step.output);
  const isRunning = step.status === 'running';
  const isErr = (step.exitCode !== undefined && step.exitCode !== 0) || Boolean(step.error);

  cmdWrapper.innerHTML = `
    <div class="cascade-cmd-subhead">
      <span class="cascade-cmd-prefix">Ran</span>
      <span class="working-spinner cmd-spinner" style="${isRunning ? 'display:inline-block;' : 'display:none;'}width:11px;height:11px;margin:0 4px 0 2px;"></span>
      <span class="cascade-cmd-code" title="${escapeHtml(step.command || '')}">${escapeHtml(step.command || '')}</span>
      <span class="cascade-cmd-chevron">${LUCIDE.chevron}</span>
    </div>
    <div class="cascade-terminal-card" style="display: none;">
      <div class="cascade-terminal-prompt">
        <div class="cascade-prompt-left">
          <span class="cwd">${escapeHtml(step.cwd || '...\\workspace')}</span> <span class="prompt-sym">&gt;</span> <span class="cmd">${escapeHtml(step.command || '')}</span>
        </div>
        <div class="cascade-prompt-actions">
          <button type="button" class="cascade-copy-btn" title="Copy output">${LUCIDE.copy}</button>
          <span class="cascade-error-icon" style="${isErr ? 'display:inline-flex;' : 'display:none;'}" title="Command failed with error">${LUCIDE.alertCircle}</span>
        </div>
      </div>
      <pre class="cascade-terminal-output ${isErr ? 'has-error' : ''}" style="${cleanOut ? '' : 'display:none;'}">${escapeHtml(cleanOut)}</pre>
    </div>
  `;

  const subhead = cmdWrapper.querySelector('.cascade-cmd-subhead');
  const termCard = cmdWrapper.querySelector('.cascade-terminal-card');
  const copyBtn = cmdWrapper.querySelector('.cascade-copy-btn');

  subhead.addEventListener('click', (e) => {
    e.stopPropagation();
    subhead.classList.toggle('open');
    termCard.style.display = subhead.classList.contains('open') ? 'block' : 'none';
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = cleanOut || step.command || '';
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy);
      }
    });
  }

  return cmdWrapper;
}

function finishThinking() {
  document.querySelectorAll('.thinking-accordion.active').forEach(acc => {
    acc.classList.remove('active');
    acc.classList.remove('open');
    const dot = acc.querySelector('.thinking-dot, .debug-dot');
    if (dot) dot.style.display = 'none';
    const vp = acc.querySelector('.thinking-stream-viewport');
    if (vp) vp.remove();
    const content = acc.querySelector('.thinking-content');
    if (content && !content.textContent.trim()) {
      acc.remove();
    }
  });

  if (!currentThinkingAccordion) {
    document.querySelectorAll('.thinking-dot, .debug-dot').forEach(dot => {
      dot.style.display = 'none';
    });
    return;
  }

  const content = currentThinkingAccordion.querySelector('.thinking-content');
  if (content && !content.textContent.trim()) {
    currentThinkingAccordion.remove();
    currentThinkingAccordion = null;
    currentThinkingContentEl = null;
    thinkingStartTime = null;
    return;
  }

  const duration = thinkingStartTime ? Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000)) : 1;
  const title = currentThinkingAccordion.querySelector('.thinking-title');
  if (title) {
    title.textContent = `Thought for ${duration}s`;
  }
  const ts = currentThinkingAccordion._timestamp || thinkingStartTime || Date.now();
  let timeEl = currentThinkingAccordion.querySelector('.thinking-time');
  if (!timeEl) {
    timeEl = document.createElement('span');
    timeEl.className = 'thinking-time';
    const chevron = currentThinkingAccordion.querySelector('.thinking-chevron');
    const header = currentThinkingAccordion.querySelector('.thinking-header');
    if (header) {
      if (chevron) header.insertBefore(timeEl, chevron);
      else header.appendChild(timeEl);
    }
  }
  if (timeEl) {
    timeEl.textContent = formatMessageTime(ts, true);
    timeEl.title = formatFullTimestamp(ts);
  }
  const streamViewport = currentThinkingAccordion.querySelector('.thinking-stream-viewport');
  if (streamViewport) {
    streamViewport.remove();
  }
  currentThinkingAccordion.classList.remove('active');
  // Collapse by default so user is not overwhelmed, but can click to open anytime
  currentThinkingAccordion.classList.remove('open');
  const dot = currentThinkingAccordion.querySelector('.thinking-dot, .debug-dot');
  if (dot) dot.style.display = 'none';

  currentThinkingAccordion = null;
  currentThinkingContentEl = null;
  thinkingStartTime = null;
}

function ensureDebugTraceAccordion(feedEl, type = 'trace') {
  if (!feedEl) return null;

  // Enforce strictly one unstuck / debug trace element across the entire feed
  const allExisting = document.querySelectorAll('.thinking-accordion.debug-trace-accordion');
  if (allExisting.length > 0) {
    allExisting.forEach((el, index) => {
      if (index === 0 && !el.classList.contains('fade-out-up')) {
        currentDebugTraceAccordion = el;
      } else {
        el.remove();
      }
    });
  }

  if (currentDebugTraceAccordion && !currentDebugTraceAccordion.classList.contains('fade-out-up')) {
    // Keep it positioned at the very end of the feed
    if (currentDebugTraceAccordion.parentNode !== feedEl || feedEl.lastElementChild !== currentDebugTraceAccordion) {
      feedEl.appendChild(currentDebugTraceAccordion);
    }
    currentDebugTraceAccordion.classList.remove('done');
    currentDebugTraceAccordion.classList.add('active');
    if (type === 'unstuck') {
      currentDebugTraceType = 'unstuck';
      const titleEl = currentDebugTraceAccordion.querySelector('.thinking-title');
      if (titleEl) titleEl.textContent = t('unstuckTitle');
      const streamViewport = currentDebugTraceAccordion.querySelector('.thinking-stream-viewport');
      if (streamViewport) streamViewport.remove();
    }
    currentDebugTraceContentEl = currentDebugTraceAccordion.querySelector('.thinking-content');
    return currentDebugTraceAccordion;
  }

  debugTraceStartTime = Date.now();
  const ts = debugTraceStartTime;
  currentDebugTraceType = type;
  currentDebugTraceAccordion = document.createElement('div');
  currentDebugTraceAccordion.className = 'thinking-accordion debug-trace-accordion active';
  currentDebugTraceAccordion._timestamp = ts;

  const titleText = type === 'unstuck' ? t('unstuckTitle') : 'Debug Trace...';
  const streamViewportHtml = type === 'unstuck'
    ? ''
    : `
    <div class="thinking-stream-viewport">
      <div class="thinking-stream-text"></div>
    </div>`;

  currentDebugTraceAccordion.innerHTML = `
    <div class="thinking-header">
      <span class="thinking-title">${escapeHtml(titleText)}</span>
      <span class="thinking-dot debug-dot"></span>
      <span class="thinking-time" title="${formatFullTimestamp(ts)}">${formatMessageTime(ts, true)}</span>
      <span class="thinking-chevron">${LUCIDE.chevron}</span>
    </div>
    ${streamViewportHtml}
    <div class="thinking-content"></div>
  `;

  const targetAccordion = currentDebugTraceAccordion;
  const header = targetAccordion.querySelector('.thinking-header');
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    targetAccordion.classList.toggle('open');
  });

  currentDebugTraceContentEl = currentDebugTraceAccordion.querySelector('.thinking-content');
  feedEl.appendChild(currentDebugTraceAccordion);
  return currentDebugTraceAccordion;
}

function appendDebugTraceChunk(chunk, type = 'trace') {
  if (!chunk) return;
  const asstEl = ensureAssistantMessage();
  const workingBlock = ensureWorkingBlock(asstEl);
  const feedEl = workingBlock.querySelector('.activity-feed') || workingBlock.querySelector('.working-body');

  ensureDebugTraceAccordion(feedEl, type);

  if (currentDebugTraceContentEl) {
    currentDebugTraceContentEl.textContent += chunk;
  }
  const streamText = currentDebugTraceAccordion?.querySelector('.thinking-stream-text');
  if (streamText) {
    streamText.textContent += chunk;
    if (streamText.textContent.length > 300) {
      streamText.textContent = streamText.textContent.slice(-300);
    }
  }
  scrollToBottom();
}

function finishDebugTrace() {
  const allTraces = document.querySelectorAll('.thinking-accordion.debug-trace-accordion');
  allTraces.forEach(accordion => {
    if (accordion.classList.contains('fade-out-up')) return;

    const streamViewport = accordion.querySelector('.thinking-stream-viewport');
    if (streamViewport) {
      streamViewport.remove();
    }

    accordion.classList.remove('active', 'open');
    accordion.classList.add('fade-out-up');
    setTimeout(() => {
      if (accordion.parentNode) {
        accordion.remove();
      }
    }, 350);
  });

  currentDebugTraceAccordion = null;
  currentDebugTraceContentEl = null;
  debugTraceStartTime = null;
  currentDebugTraceType = 'trace';
}


function dismissThinkingOnUnstuck(feedEl) {
  // Find strictly the currently active/in-flight thinking accordion that was interrupted
  let interruptedAccordion = currentThinkingAccordion;
  if (!interruptedAccordion && feedEl) {
    interruptedAccordion = feedEl.querySelector('.thinking-accordion.active:not(.debug-trace-accordion)');
  }

  if (!interruptedAccordion) {
    return;
  }

  // Explicitly tag this element as a bad/interrupted thought
  interruptedAccordion.dataset.badThought = 'true';
  interruptedAccordion.classList.add('bad-thought');

  // In Debug Mode: preserve the bad_thought so user can inspect it, but format its title clearly
  if (modeStates.debugMode) {
    const duration = thinkingStartTime ? Math.max(1, Math.round((Date.now() - thinkingStartTime) / 1000)) : 1;
    const title = interruptedAccordion.querySelector('.thinking-title');
    if (title) {
      title.textContent = `Thought (interrupted) • ${duration}s`;
    }
    interruptedAccordion.classList.remove('active');
    interruptedAccordion.classList.remove('open');
    const dot = interruptedAccordion.querySelector('.thinking-dot, .debug-dot');
    if (dot) dot.style.display = 'none';
    const streamViewport = interruptedAccordion.querySelector('.thinking-stream-viewport');
    if (streamViewport) streamViewport.remove();
  } else {
    // Normal mode: smoothly fade out and remove ONLY the marked bad_thought
    if (!interruptedAccordion.classList.contains('fade-out-up')) {
      const streamViewport = interruptedAccordion.querySelector('.thinking-stream-viewport');
      if (streamViewport) streamViewport.remove();
      interruptedAccordion.classList.remove('active', 'open');
      interruptedAccordion.classList.add('fade-out-up');
      setTimeout(() => {
        if (interruptedAccordion.parentNode) {
          interruptedAccordion.remove();
        }
      }, 350);
    }
  }

  currentThinkingAccordion = null;
  currentThinkingContentEl = null;
  thinkingStartTime = null;
}

function finishUnstuck() {
  finishDebugTrace();
}

function getUnstuckText(step) {
  if (!step) return t('unstuckEmptyResponse').replace('{attempt}', '1').replace('{maxAttempts}', '3');
  const attempt = step.attempt || 1;
  const maxAttempts = step.maxAttempts || 3;
  const reason = step.reason || '';

  if (step.code === 'empty_response' || step.code === 'connection_dropped') {
    return t('unstuckEmptyResponse').replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
  }
  if (step.code === 'empty_after_reasoning') {
    return t('unstuckEmptyAfterReasoning').replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
  }
  if (step.code === 'tool_syntax_error') {
    return t('unstuckToolSyntaxError').replace('{reason}', reason).replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
  }
  if (step.code === 'resolving') {
    return t('unstuckResolving');
  }

  // Fallback pattern matching for backward compatibility
  const raw = String(step.title || '');
  if (raw.includes('пустой ответ после рассуждений') || raw.toLowerCase().includes('empty response after reasoning')) {
    return t('unstuckEmptyAfterReasoning').replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
  }
  if (raw.includes('пустой ответ') || raw.toLowerCase().includes('empty response')) {
    return t('unstuckEmptyResponse').replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
  }
  if (raw.includes('Синтаксис') || raw.toLowerCase().includes('syntax')) {
    return t('unstuckToolSyntaxError').replace('{reason}', reason || 'syntax error').replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
  }
  if (raw.includes('Resolving') || raw.includes('Определение')) {
    return t('unstuckResolving');
  }
  return raw || t('unstuckEmptyResponse').replace('{attempt}', String(attempt)).replace('{maxAttempts}', String(maxAttempts));
}

function renderUnstuckAccordion(feedEl, step) {
  if (!feedEl) return;
  dismissThinkingOnUnstuck(feedEl);

  const accordion = ensureDebugTraceAccordion(feedEl, 'unstuck');
  if (!accordion) return;

  if (step && step.startTime) {
    debugTraceStartTime = step.startTime;
  }

  // Default hidden: strictly remove running text lines under Unstuck header
  const streamViewport = accordion.querySelector('.thinking-stream-viewport');
  if (streamViewport) {
    streamViewport.remove();
  }

  const localizedText = getUnstuckText(step);
  if (currentDebugTraceContentEl) {
    currentDebugTraceContentEl.textContent = localizedText;
  }

  scrollToBottom();
}

function appendReasoningChunk(chunk) {
  finishDebugTrace();
  currentDebugTraceType = 'trace';
  const asstEl = ensureAssistantMessage();
  const workingBlock = ensureWorkingBlock(asstEl);
  const workingBody = workingBlock.querySelector('.working-body');
  const feedEl = workingBody.querySelector('.activity-feed');

  if (!currentThinkingAccordion) {
    thinkingStartTime = Date.now();
    const ts = thinkingStartTime;
    currentThinkingAccordion = document.createElement('div');
    currentThinkingAccordion.className = 'thinking-accordion active';
    currentThinkingAccordion._timestamp = ts;

    currentThinkingAccordion.innerHTML = `
      <div class="thinking-header">
        <span class="thinking-title">Thinking...</span>
        <span class="thinking-dot"></span>
        <span class="thinking-time" title="${formatFullTimestamp(ts)}">${formatMessageTime(ts, true)}</span>
        <span class="thinking-chevron">${LUCIDE.chevron}</span>
      </div>
      <div class="thinking-stream-viewport">
        <div class="thinking-stream-text"></div>
      </div>
      <div class="thinking-content"></div>
    `;

    const targetAccordion = currentThinkingAccordion;
    const header = targetAccordion.querySelector('.thinking-header');
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      targetAccordion.classList.toggle('open');
    });

    currentThinkingContentEl = currentThinkingAccordion.querySelector('.thinking-content');

    // Always append to the bottom of the feed to keep chronological order
    if (feedEl) {
      feedEl.appendChild(currentThinkingAccordion);
    } else {
      workingBody.appendChild(currentThinkingAccordion);
    }
  }

  currentThinkingContentEl.textContent += chunk;
  const streamText = currentThinkingAccordion.querySelector('.thinking-stream-text');
  if (streamText) {
    streamText.textContent += chunk;
    if (streamText.textContent.length > 300) {
      streamText.textContent = streamText.textContent.slice(-300);
    }
  }

  scrollToBottom();
}

function appendAssistantChunk(chunk) {
  finishThinking();
  const asstEl = ensureAssistantMessage();
  asstEl._rawStream = (asstEl._rawStream || '') + chunk;
  const raw = asstEl._rawStream;

  // Extract clean text by stripping all XML tags (<tool_call>, <working>, <end_working>, <plan>)
  let clean = raw.replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}[\s\S]*?(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}>|$)/gi, '');
  clean = clean.replace(/<(?:tool_call|function_call|tool)\b[\s\S]*?(?:<\/(?:tool_call|function_call|call|tool)>|$)/gi, '');
  clean = clean.replace(/<\/?(?:working|end_working)>/gi, '');
  clean = clean.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
  clean = clean.replace(/<plan>[\s\S]*?<\/plan>/gi, '');
  clean = clean.trim();

  const hasToolTagInTurn = /<(?:tool_call|function_call|tool)\b/i.test(raw) ||
                           /<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+(?:call|invoke)\b/i.test(raw);

  // If this turn is not executing a tool, stream conversational text live!
  if (!hasToolTagInTurn && clean) {
    let textNode = asstEl.querySelector('.assistant-text');
    if (!textNode) {
      textNode = document.createElement('div');
      textNode.className = 'assistant-text';
      asstEl.appendChild(textNode);
    }
    textNode.dataset.raw = clean;
    textNode.innerHTML = renderFormattedContent(clean);
  }

  // Stream into unstuck accordion only if explicitly designated as unstuck
  if (currentDebugTraceType === 'unstuck') {
    let traceChunk = chunk.replace(/<\/?(?:working|end_working)>/gi, '');
    if (traceChunk.trim()) {
      appendDebugTraceChunk(traceChunk, 'unstuck');
    }
  }

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

  // 0. Strip completed <think>...</think> blocks from output prose
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 0. Pre-clean code fences enclosing <plan> or tool tags
  // (DeepSeek models frequently wrap <plan> or <tool_call> in ```xml ... ``` fences)
  text = text.replace(/```(?:xml|html|markdown|text|plan)?\s*(<plan>[\s\S]*?<\/plan>)\s*```/gi, '$1');
  text = text.replace(/```(?:xml|html|markdown|text|plan)?\s*(<plan>(?:(?!<\/plan>)[\s\S])*)$/gi, '$1');
  text = text.replace(/(<\/plan>)\s*```/gi, '$1');
  text = text.replace(/```(?:xml|html|markdown|text|plan)?\s*(<plan>)/gi, '$1');

  text = text.replace(/```(?:xml|html|markdown|text|plan|bash|sh|json)?\s*(<(?:tool_call|function_call|tool)[\s>])/gi, '$1');
  text = text.replace(/(<\/(?:tool_call|function_call|call|tool)>)\s*```/gi, '$1');

  // Strip empty markdown code fences (e.g. left behind after tool call removal)
  text = text.replace(/```[\w-]*\s*```/g, '');

  // 0.1 DSML tool calls support (DeepSeek native modeling language)
  text = text.replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+calls>/gi, '');
  text = text.replace(/<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+calls>/gi, '');

  text = text.replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+(?:call|invoke)\s+name=["']?(?:run_command|run_terminal_command|bash|terminal|cmd|exec)["']?[^>]*>([\s\S]*?)(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}(?:\s*(?:call|invoke))?>|(?=<[|\uFF5C]{1,2}DSML)|$)/gi, '');

  // DSML list_files
  text = text.replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}\s+(?:call|invoke)\s+name=["']?(?:list_files|list_workspace_files|ls|dir)["']?[^>]*>([\s\S]*?)(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}(?:\s*(?:call|invoke))?>|(?=<[|\uFF5C]{1,2}DSML)|$)/gi, (match, inner) => {
    const pm = inner ? inner.match(/<(?:path|folder|dir)>([\s\S]*?)<\/(?:path|folder|dir)>/i) : null;
    const folder = pm ? pm[1].trim() : (inner.trim() && !inner.trim().includes('<') ? inner.trim() : '.');
    return addCard(`
      <div class="file-card-pill">
        <div class="file-card-left">
          <span>${LUCIDE.folder}</span> ${t('fileList')} <code>${escapeHtml(folder)}</code>
        </div>
        <div class="file-card-right">
          <span>${t('explored')}</span>
        </div>
      </div>
    `.trim());
  });

  text = text.replace(/<\/?(?:[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}[^>]*|call|invoke)>/gi, '');

  // Strip all emojis from assistant text unless explicitly requested
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '');

  // 1. Tool calls and raw tool outputs are stripped from chat prose because they are displayed inside Working
  text = text.replace(/<(?:tool_call|function_call|tool)\b[^>]*>[\s\S]*?<\/(?:tool_call|function_call|call|tool)>/gi, '');
  text = text.replace(/<(?:tool_call|function_call|tool)\b[^>]*>[\s\S]*$/gi, '');

  // Strip diagnostic path dumps and language server cache echoes
  text = text.replace(/Looked in these locations:[\s\S]*?(?=\n\n(?:[A-Z]|$)|$)/gi, '');
  text = text.replace(/Fallback search path[^:\n]*:\s*\[[\s\S]*?\]/gi, '');
  text = text.replace(/Site package path queried from interpreter:\s*\[[\s\S]*?\]/gi, '');
  text = text.replace(/^(?:Assistant|User):\s*/gmi, '');

  // Strip tool outputs and command execution echoes from assistant prose
  text = text.replace(/(?:^|\n)(?:We need to|The user asked|Let me check|Actually, the user|Looking at the flow|The system prompt says)[\s\S]*?(?=(?:\n\s*(?:###|Ran|Explored|Created|Edited|Summary|\[FILE\]|\[DIR\])|$))/gi, '');
  text = text.replace(/(?:^|\n)(?:\[(?:FILE|DIR)\]\s*[^\n]+\n?){3,}/g, '');
  text = text.replace(/(?:^|\n)(?:Tool:\s*)?File:\s*[^\s\(\n]+\s*\([^\n\)]*\)\s*\n+[\s\S]*?(?=(?:\n\s*(?:(?:Tool:\s*)?File:|Assistant:|User:|<tool|<\/tool|<plan|###|\n\n\n)|$))/gi, '');
  text = text.replace(/(?:^|\n)(?:⚙️\s*)?(?:Tool:\s*)?Command:\s*[^\n]+\s*\n+(?:Exit Code:\s*\d+\s*\n+)?(?:(?:STDOUT|STDERR):\s*\n+)?[\s\S]*?(?=(?:\n\s*(?:(?:Tool:\s*)?(?:Command:|File:|Assistant:|User:)|<tool|<\/tool|<plan|###|\n\n\n)|$))/gi, '');
  text = text.replace(/(?:^|\n)(?:⚙️\s*)?(?:Tool:\s*)?Successfully replaced content in [^\n]*/gi, '');
  text = text.replace(/(?:^|\n)(?:⚙️\s*)?(?:Tool:\s*)?All OK \(0 errors, 0 warnings\)[^\n]*/gi, '');
  text = text.replace(/(?:^|\n)(?:⚙️\s*)?(?:Tool:\s*)?File not found:[^\n]*/gi, '');
  text = text.replace(/(?:^|\n)(?:\d+:\s*[^\n]*\n){3,}/g, '');
  text = text.replace(/(?:^|\n)Tool:\s*[^\n]*/gi, '');

  // Strip duplicate English summary if Russian summary is present
  if (/(?:Что было сделано|Итоги работы|Итоги|Результат)/i.test(text)) {
    text = text.replace(/(?:###\s*(?:Summary of Changes|Summary and Verification|Summary)[\s\S]*)$/i, '');
  }

  // Strip raw command test reports and exit code echoes
  text = text.replace(/(?:^|\n)(?:Environment Test Report|Test Report|===+)[\s\S]*?(?:Exit Code:\s*\d+|All checks passed|Some checks failed)[^\n]*/gi, '');
  text = text.replace(/(?:^|\n)Exit Code:\s*\d+/gi, '');

  // Strip intermediate conversational chatter lines
  text = text.replace(/(?:^|\n)I(?:'ll| will)\s+(?:create|run|make|write|check|implement|build|test|start|inspect)[^\n]*/gi, '');

  // Strip stray dumped code / file snippets before summary
  text = text.replace(/(?:^|\n)[a-zA-Z0-9_\-\.\/]+\.(?:py|js|ts|cpp|c|html|css|json)\s*\n+["']{3}[\s\S]*?(?=(?:\n\s*(?:Что было|Итоги|###|[1-9]\.))|$)/gi, '');
  text = text.replace(/(?:^|\n)print\([^\n]+\)/gi, '');

  // Strip leaked Chain-of-Thought / meta-reasoning blocks (e.g. "> before final response...")
  text = text.replace(/(?:^|\n)>\s*before final response[\s\S]*?(?:(?:Thus|So|The)\s+final\s+answer:?|Ответ:?|Итак:?|\n\n(?=[А-ЯA-Z]))/gi, '');
  text = text.replace(/(?:^|\n)(?:Thus|So|The)\s+final\s+answer:?\s*/gi, '');

  // Collapse multiple empty newlines left over from stripped tool blocks
  text = text.trim().replace(/\n{3,}/g, '\n\n');
  text = text.replace(/<think\b[\s\S]*$/gi, '');
  text = text.replace(/<(?:tool_call|function_call|tool|call|invoke)\b[\s\S]*$/gi, '');
  text = text.replace(/<\/(?:tool_call|function_call|tool|call|invoke|working|end_working)\b[\s\S]*$/gi, '');
  text = text.replace(/<[a-zA-Z_\-]*$/g, '');
  text = text.replace(/<\s*$/g, '').trim();

  // 2. Plan Card tag parsing
  text = text.replace(/<plan>([\s\S]*?)<\/plan>/gi, (match, inner) => {
    return addCard(renderPlanCard(inner, currentPlanConfirmed));
  });
  text = text.replace(/<plan>((?:(?!<\/plan>)[\s\S])*)$/gi, (match, inner) => {
    return addCard(renderPlanCard(inner, currentPlanConfirmed));
  });

  // Also support markdown checklist plans: "### Implementation Plan" or "### План"
  text = text.replace(/(?:^|\n)(?:###\s*(?:📋\s*)?(?:Implementation\s+Plan|План\s+реализации|План)[^\n]*\n+)((?:\s*(?:\d+[\.\)]|[-*•])\s*(?:\[[ xX]\])?[^\n]+\n?)+)/gi, (match, itemsText) => {
    return addCard(renderPlanCard(itemsText, currentPlanConfirmed));
  });

  // 3. Live streaming for in-progress unclosed <tool_call> tags
  text = text.replace(/<tool_call\s+name=["']([^"']+)["']>((?:(?!<\/tool_call>)[\s\S])*)$/i, (match, toolName, inner) => {
    const lower = toolName.toLowerCase();
    const pm = inner.match(/<path>([\s\S]*?)(?:<\/path>|$)/i);
    const filePath = pm ? pm[1].trim() : '...';
    const fileName = filePath.split(/[\\/]/).pop();

    if (lower === 'create_file') {
      return addCard(`
        <div class="cascade-step-line">
          <span class="streaming-dot-pulse"></span>
          <span class="cascade-action-label">Creating</span>
          <img src="${getFileIcon(filePath)}" class="cascade-file-icon" />
          <span class="cascade-file-name">${escapeHtml(fileName)}</span>
        </div>
      `.trim());
    } else if (lower === 'edit_file' || lower === 'replace_file_content') {
      return addCard(`
        <div class="cascade-step-line">
          <span class="streaming-dot-pulse"></span>
          <span class="cascade-action-label">Editing</span>
          <img src="${getFileIcon(filePath)}" class="cascade-file-icon" />
          <span class="cascade-file-name">${escapeHtml(fileName)}</span>
        </div>
      `.trim());
    } else if (lower === 'read_file' || lower === 'view_file_slice') {
      return addCard(`
        <div class="cascade-step-line">
          <span class="streaming-dot-pulse"></span>
          <span class="cascade-action-label">Reading</span>
          <img src="${getFileIcon(filePath)}" class="cascade-file-icon" />
          <span class="cascade-file-name">${escapeHtml(fileName)}</span>
        </div>
      `.trim());
    }
    return '';
  });

  // 4. Render Markdown for text outside the cards
  let rendered = renderMarkdown(text);

  // 5. Reinsert cards back into the rendered HTML
  for (let i = 0; i < cards.length; i++) {
    const ph = `___CARD_PLACEHOLDER_${i}___`;
    // If the placeholder got wrapped inside a <pre>...</pre> code block (e.g. from ```xml fences), strip the <pre> block
    const preRegex = new RegExp(`<pre>[\\s\\S]*?<code>\\s*${ph}\\s*<\\/code><\\/pre>`, 'g');
    rendered = rendered.replace(preRegex, cards[i]);
    // Also standard paragraph unwrapping
    rendered = rendered.replace(new RegExp(`(?:<p>)?${ph}(?:<\\/p>)?`, 'g'), cards[i]);
  }

  // Strip any leading or trailing line breaks
  rendered = rendered.replace(/^(?:\s*<br\s*\/?>\s*)+/gi, '').replace(/(?:\s*<br\s*\/?>\s*)+$/gi, '');

  return rendered;
}

function renderPlanCard(planInner, isConfirmed = false) {
  const confirmed = isConfirmed || sessionPlanConfirmed || currentPlanConfirmed;
  const lines = (planInner || '').trim().split('\n');
  let currentNum = 1;
  const itemsHtml = lines.map(line => {
    let trimmed = line.trim();
    if (!trimmed) return '';

    // Ignore header lines inside <plan>
    if (/^(?:#{1,4}\s*)?(?:implementation\s+)?plan:?$/i.test(trimmed) || /^(?:#{1,4}\s*)?(?:план\s+реализации|план):?$/i.test(trimmed)) {
      return '';
    }

    const isDone = /\[x\]/i.test(trimmed) || /~~/.test(trimmed) || /^\s*✓/.test(trimmed);
    const numMatch = trimmed.match(/^(\d+)[\.\)]/);
    const num = numMatch ? numMatch[1] : (trimmed.startsWith('-') || trimmed.startsWith('*') ? currentNum++ : '•');
    
    let cleanText = trimmed
      .replace(/^[\d\.\)\-\*•\s]+/, '')
      .replace(/^\[[ xX]\]\s*/, '')
      .replace(/~~/g, '')
      .trim();

    if (!cleanText) return '';

    return `
      <div class="plan-item ${isDone ? 'done' : ''}">
        <div class="plan-item-checkbox">${isDone ? LUCIDE.check : num}</div>
        <span class="plan-item-text">${escapeHtml(cleanText)}</span>
      </div>
    `;
  }).filter(Boolean).join('');

  return `
    <div class="plan-card">
      <div class="plan-card-header">
        <span class="plan-card-title">
          <span class="plan-card-icon">${LUCIDE.clipboardList}</span>
          <span>${t('planTitle')}</span>
        </span>
        <span class="plan-card-badge ${confirmed ? 'approved' : 'pending'}">
          <span class="plan-status-dot ${confirmed ? 'green' : 'amber'}"></span>
          ${confirmed ? t('planApproved') : t('planPending')}
        </span>
      </div>
      <div class="plan-card-items">
        ${itemsHtml}
      </div>
      ${!confirmed ? `
      <div class="plan-card-actions">
        <button class="plan-confirm-btn" onclick="confirmPlanAction(this)">
          <span>${t('planConfirmBtn')}</span>
          ${LUCIDE.arrowRight}
        </button>
      </div>` : ''}
    </div>
  `;
}

window.confirmPlanAction = function(btn) {
  sessionPlanConfirmed = true;
  currentPlanConfirmed = true;

  // Immediately update ALL plan cards on the page to approved state and remove button
  document.querySelectorAll('.plan-card').forEach(card => {
    const badge = card.querySelector('.plan-card-badge');
    if (badge) {
      badge.className = 'plan-card-badge approved';
      badge.innerHTML = `<span class="plan-status-dot green"></span> ${t('planApproved')}`;
    }
    const actions = card.querySelector('.plan-card-actions');
    if (actions) actions.remove();
  });

  isGenerating = true;
  executionStartTime = Date.now();
  turnModifiedFiles.clear();

  // 1. Post the user's approval message into the chat UI
  appendUserMessage(t('planConfirmedNotice'));

  // 2. Clear previous assistant message references so response starts in a brand new message row
  currentAssistantMsgEl = null;
  currentThinkingAccordion = null;
  currentThinkingContentEl = null;
  updateSendButtonState();

  // 3. Immediately create and attach the new assistant message row & working block below the user's message
  const asstEl = ensureAssistantMessage();
  asstEl._startTime = Date.now();
  const wb = ensureWorkingBlock(asstEl);
  wb.classList.remove('done');
  wb.classList.add('open');
  const wbHeader = wb.querySelector('.working-header');
  if (wbHeader) wbHeader.style.display = 'flex';
  const wbTitle = wb.querySelector('.working-title');
  if (wbTitle) wbTitle.textContent = t('workingTitle');
  const wbSpinner = wb.querySelector('.working-spinner');
  if (wbSpinner) wbSpinner.style.display = 'inline-block';
  const wbTime = wb.querySelector('.working-time');
  if (wbTime) wbTime.style.display = 'none';

  // 4. Notify extension host to start execution
  vscode.postMessage({ command: 'confirmPlan' });
};


function trackModifiedFile(filePath, added, removed, isOverwrite = false) {
  if (!filePath) return;
  const existing = turnModifiedFiles.get(filePath) || { added: 0, removed: 0 };
  if (isOverwrite) {
    existing.added = added || 0;
    existing.removed = 0;
  } else {
    existing.added += (added || 0);
    existing.removed += (removed || 0);
  }
  turnModifiedFiles.set(filePath, existing);
  if (currentAssistantMsgEl) {
    currentAssistantMsgEl.dataset.hasModifiedFiles = 'true';
  }
}

function renderReviewStatBar(targetAsstEl, modifiedMap) {
  if (!targetAsstEl || !modifiedMap || modifiedMap.size === 0) return;
  if (targetAsstEl.dataset.hasModifiedFiles !== 'true') return;
  if (targetAsstEl.querySelector('.review-stat-bar')) return;

  let totalAdd = 0;
  let totalDel = 0;
  let firstPath = '';
  for (const [p, stats] of modifiedMap.entries()) {
    if (!firstPath) firstPath = p;
    totalAdd += (stats.added || 0);
    totalDel += (stats.removed || 0);
  }
  const fileCount = modifiedMap.size;
  const reviewBar = document.createElement('div');
  reviewBar.className = 'review-stat-bar';
  reviewBar.innerHTML = `
    <div><strong>${fileCount} ${fileCount > 1 ? t('filesChangedPlural') : t('filesChanged')}</strong> <span class="diff-add">+${totalAdd}</span> <span class="diff-del">-${totalDel}</span></div>
    <button class="review-btn">${t('review')}</button>
  `;
  reviewBar.querySelector('.review-btn').addEventListener('click', () => {
    if (firstPath) {
      vscode.postMessage({ command: 'openFile', path: firstPath });
    }
  });
  targetAsstEl.appendChild(reviewBar);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInlineMarkdown(str) {
  if (!str) return '';
  let s = escapeHtml(str);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*([^*\s\n](?:[^*\n]*?[^*\s\n])?)\*(?!\*)/g, '<em>$1</em>');
  return s;
}

function renderMarkdown(md) {
  if (!md) return '';
  let trimmed = md.trim();
  if (!trimmed) return '';

  // 1. Extract and placeholder code blocks
  const codeBlocks = [];
  let text = trimmed.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#888;margin-bottom:4px;"><span>${lang || 'code'}</span><button style="background:transparent;border:none;color:#aaa;cursor:pointer;" onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.innerText);this.textContent='${t('copied')}';setTimeout(()=>this.textContent='${t('copy')}',1500)">${t('copy')}</button></div><code>${escapeHtml(code.trim())}</code></pre>`);
    return `___CODE_BLOCK_${idx}___`;
  });

  // 2. Extract and parse markdown tables
  const tables = [];
  const tableRegex = /((?:^[ \t]*\|[^\n]+(?:\r?\n))(?:^[ \t]*\|[ \t]*(?::?-+:?[ \t]*\|?)+[ \t]*(?:\r?\n))(?:^[ \t]*\|[^\n]+(?:\r?\n|$))+)/gm;

  text = text.replace(tableRegex, (block) => {
    const rawLines = block.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length < 2) return block;

    function splitRow(line) {
      let inner = line.trim();
      if (inner.startsWith('|')) inner = inner.slice(1);
      if (inner.endsWith('|')) inner = inner.slice(0, -1);
      inner = inner.replace(/`([^`]+)`/g, (m) => m.replace(/\|/g, '__PIPE__'));
      inner = inner.replace(/\\\|/g, '__ESCPIPE__');
      return inner.split('|').map(s => s.replace(/__ESCPIPE__/g, '|').replace(/__PIPE__/g, '|'));
    }

    const headerParts = splitRow(rawLines[0]).map(s => s.trim());
    const numCols = headerParts.length;
    const alignParts = splitRow(rawLines[1]).map(s => s.trim());
    const aligns = alignParts.map(c => {
      const left = c.startsWith(':');
      const right = c.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      if (left) return 'left';
      return '';
    });

    const thead = `<thead><tr>${headerParts.map((h, i) => {
      const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
      return `<th${align}>${renderInlineMarkdown(h)}</th>`;
    }).join('')}</tr></thead>`;

    const bodyLines = rawLines.slice(2);
    const tbody = `<tbody>${bodyLines.map(r => {
      const parts = splitRow(r);
      let cells = [];
      if (parts.length <= numCols) {
        cells = parts.map(s => s.trim());
        while (cells.length < numCols) cells.push('');
      } else {
        cells = parts.slice(0, numCols - 1).map(s => s.trim());
        cells.push(parts.slice(numCols - 1).join('|').trim());
      }
      return `<tr>${cells.map((c, i) => {
        const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
        return `<td${align}>${renderInlineMarkdown(c)}</td>`;
      }).join('')}</tr>`;
    }).join('')}</tbody>`;

    const idx = tables.length;
    tables.push(`<div class="table-wrapper"><table class="markdown-table">${thead}${tbody}</table></div>`);
    return `___TABLE_BLOCK_${idx}___`;
  });

  // 3. Plan items, inline code, bold, italics, headings
  let html = text
    .replace(/^(\d+[\.\)]|\-)\s*\[x\]\s*(?:~~)?(.*?)(?:~~)?$/gim, (match, p1, t) => {
      return `<div class="plan-item done"><div class="plan-item-checkbox">✓</div><span class="plan-item-text">${escapeHtml(t.trim())}</span></div>`;
    })
    .replace(/^(\d+[\.\)]|\-)\s*\[ \]\s*(.*?)$/gim, (match, p1, t) => {
      const numMatch = p1.match(/\d+/);
      const num = numMatch ? numMatch[0] : '•';
      return `<div class="plan-item"><div class="plan-item-checkbox">${num}</div><span class="plan-item-text">${escapeHtml(t.trim())}</span></div>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\s\n](?:[^*\n]*?[^*\s\n])?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3 style="margin:10px 0 4px;font-size:13px;font-weight:600;color:var(--text-primary);">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin:12px 0 6px;font-size:14px;font-weight:600;color:var(--text-primary);">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin:14px 0 8px;font-size:15px;font-weight:600;color:var(--text-primary);">$1</h1>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  // 4. Restore tables
  for (let i = 0; i < tables.length; i++) {
    const ph = `___TABLE_BLOCK_${i}___`;
    html = html.replace(new RegExp(`(?:<br\\s*\\/?>\\s*)*${ph}(?:\\s*<br\\s*\\/?>)*`, 'g'), tables[i]);
  }

  // 5. Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    const ph = `___CODE_BLOCK_${i}___`;
    html = html.replace(new RegExp(`(?:<br\\s*\\/?>\\s*)*${ph}(?:\\s*<br\\s*\\/?>)*`, 'g'), codeBlocks[i]);
  }

  // Strip leading and trailing line breaks and collapse stacked breaks
  html = html.replace(/^(?:\s*<br\s*\/?>\s*)+/gi, '').replace(/(?:\s*<br\s*\/?>\s*)+$/gi, '');
  html = html.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');

  return html;
}

let userScrolledUp = false;

chatContainer.addEventListener('scroll', () => {
  const distFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
  userScrolledUp = distFromBottom > 60;
});

function scrollToBottom(force = false) {
  if (force || !userScrolledUp) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Extension message listener
window.addEventListener('message', (event) => {
  try {
    const msg = event.data;
    if (!msg) return;

    switch (msg.type) {
      case 'toggleHistory':
        if (historyDrawer) {
          historyDrawer.classList.toggle('open');
          if (historyDrawer.classList.contains('open')) {
            vscode.postMessage({ command: 'getProjectsHierarchy' });
          }
        } else {
          vscode.postMessage({ command: 'showHistory' });
        }
        break;

      case 'authSaved':
        if (msg.defaults) {
          if (defDeadMode) defDeadMode.checked = Boolean(msg.defaults.deadMode);
          if (defAgentMode) defAgentMode.checked = msg.defaults.agentMode !== false;
          if (defThinking) defThinking.checked = msg.defaults.thinking !== false;
          if (defSearch) defSearch.checked = Boolean(msg.defaults.search);
          if (defPlanMode) defPlanMode.checked = msg.defaults.planMode !== false;
          if (defSandboxMode) defSandboxMode.value = msg.defaults.sandboxMode || 'local';
          if (defDebugMode) defDebugMode.checked = Boolean(msg.defaults.debugMode);
          if (defAutoOpenFile) defAutoOpenFile.checked = Boolean(msg.defaults.autoOpenModifiedFiles);
          if (defAutoUpdate) defAutoUpdate.checked = Boolean(msg.defaults.autoUpdate);
          if (defRemoveOldContext) defRemoveOldContext.checked = Boolean(msg.defaults.removeOldContextFromFile);
          if (defHideOldContext) defHideOldContext.checked = msg.defaults.hideOldContext !== undefined ? Boolean(msg.defaults.hideOldContext) : true;
          syncOldContextToggles();
          if (devPacingDelayInput && msg.defaults.pacingDelayMs !== undefined) devPacingDelayInput.value = msg.defaults.pacingDelayMs;
          if (devRequestDelayInput && msg.defaults.requestDelayMs !== undefined) devRequestDelayInput.value = msg.defaults.requestDelayMs;
          if (devConnectTimeoutInput && msg.defaults.connectTimeoutSec !== undefined) devConnectTimeoutInput.value = msg.defaults.connectTimeoutSec;
          if (devReadTimeoutInput && msg.defaults.readTimeoutSec !== undefined) devReadTimeoutInput.value = msg.defaults.readTimeoutSec;
          if (devThinkingTimeoutInput && msg.defaults.thinkingTimeoutSec !== undefined) devThinkingTimeoutInput.value = msg.defaults.thinkingTimeoutSec;
          if (devCommandTimeoutInput && msg.defaults.commandTimeoutSec !== undefined) devCommandTimeoutInput.value = msg.defaults.commandTimeoutSec;
          if (devMaxRetriesInput && msg.defaults.maxRetries !== undefined) devMaxRetriesInput.value = msg.defaults.maxRetries;
          if (devContextLimitInput && msg.defaults.contextLimitTokens !== undefined) devContextLimitInput.value = msg.defaults.contextLimitTokens;
          if (devCompactThresholdInput && msg.defaults.compactThresholdTokens !== undefined) devCompactThresholdInput.value = msg.defaults.compactThresholdTokens;
          if (devCyrillicRatioInput && msg.defaults.cyrillicCharsPerToken !== undefined) devCyrillicRatioInput.value = msg.defaults.cyrillicCharsPerToken;
          if (devLatinRatioInput && msg.defaults.latinCharsPerToken !== undefined) devLatinRatioInput.value = msg.defaults.latinCharsPerToken;
          modeStates.debugMode = Boolean(msg.defaults.debugMode);
          applyDebugModeUI();
        }
        setOnboardingVisible(false);
        closeSettingsView();
        break;

      case 'log_entry':
        if (msg.entry) {
          console.log('[DeepCode Log]', msg.entry);
        }
        break;

      case 'updateStatus': {
        if (checkUpdateBtn) checkUpdateBtn.disabled = false;
        if (updateStatusText) {
          if (msg.status === 'up-to-date') {
            updateStatusText.textContent = t('updateUpToDate');
            updateStatusText.style.color = '#4caf50';
          } else if (msg.status === 'available') {
            updateStatusText.textContent = t('updateAvailable').replace('{version}', msg.version || '?');
            updateStatusText.style.color = '#ff9800';
          } else if (msg.status === 'downloading') {
            updateStatusText.textContent = t('updateDownloading').replace('{version}', msg.version || '?');
            updateStatusText.style.color = 'var(--text-secondary)';
          } else if (msg.status === 'installing') {
            updateStatusText.textContent = t('updateInstalling');
            updateStatusText.style.color = 'var(--text-secondary)';
          } else if (msg.status === 'success') {
            updateStatusText.textContent = t('updateSuccess').replace('{version}', msg.version || '?');
            updateStatusText.style.color = '#4caf50';
          } else if (msg.status === 'error') {
            updateStatusText.textContent = t('updateError') + (msg.error ? ': ' + msg.error : '');
            updateStatusText.style.color = '#f44336';
          }
        }
        break;
      }

      case 'extensionVersion': {
        if (currentVersionValue) {
          currentVersionValue.textContent = msg.version || '?';
        }
        break;
      }

      case 'initSession':
        turnModifiedFiles.clear();
        if (!msg.session) break;
        if (chatTitleInput) {
          chatTitleInput.value = msg.session.title || 'Untitled';
        }

      if (msg.activeProject) {
        currentActiveProjectId = msg.activeProject.id;
      }

      modeStates.deadMode = Boolean(msg.session.deadMode);
      modeStates.agentMode = msg.session.agentMode !== undefined ? Boolean(msg.session.agentMode) : true;
      modeStates.thinking = msg.session.thinking !== undefined ? Boolean(msg.session.thinking) : true;
      modeStates.search = Boolean(msg.session.search);
      if (msg.session.planMode !== undefined) {
        modeStates.plan = Boolean(msg.session.planMode);
      }
      modeStates.sandboxMode = msg.session.sandboxMode || 'local';
      sessionPlanConfirmed = Boolean(msg.session.planConfirmed);
      currentPlanConfirmed = sessionPlanConfirmed;

      if (msg.defaults) {
        if (defDeadMode) defDeadMode.checked = Boolean(msg.defaults.deadMode);
        if (defAgentMode) defAgentMode.checked = msg.defaults.agentMode !== false;
        if (defThinking) defThinking.checked = msg.defaults.thinking !== false;
        if (defSearch) defSearch.checked = Boolean(msg.defaults.search);
        if (defPlanMode) defPlanMode.checked = msg.defaults.planMode !== false;
        if (defSandboxMode) defSandboxMode.value = msg.defaults.sandboxMode || 'local';
        if (defDebugMode) defDebugMode.checked = Boolean(msg.defaults.debugMode);
        if (defAutoOpenFile) defAutoOpenFile.checked = Boolean(msg.defaults.autoOpenModifiedFiles);
        if (defAutoUpdate) defAutoUpdate.checked = Boolean(msg.defaults.autoUpdate);
        if (defRemoveOldContext) defRemoveOldContext.checked = Boolean(msg.defaults.removeOldContextFromFile);
        if (defHideOldContext) defHideOldContext.checked = msg.defaults.hideOldContext !== undefined ? Boolean(msg.defaults.hideOldContext) : true;
        syncOldContextToggles();
        if (devPacingDelayInput && msg.defaults.pacingDelayMs !== undefined) devPacingDelayInput.value = msg.defaults.pacingDelayMs;
        if (devRequestDelayInput && msg.defaults.requestDelayMs !== undefined) devRequestDelayInput.value = msg.defaults.requestDelayMs;
        if (devConnectTimeoutInput && msg.defaults.connectTimeoutSec !== undefined) devConnectTimeoutInput.value = msg.defaults.connectTimeoutSec;
        if (devReadTimeoutInput && msg.defaults.readTimeoutSec !== undefined) devReadTimeoutInput.value = msg.defaults.readTimeoutSec;
        if (devThinkingTimeoutInput && msg.defaults.thinkingTimeoutSec !== undefined) devThinkingTimeoutInput.value = msg.defaults.thinkingTimeoutSec;
        if (devCommandTimeoutInput && msg.defaults.commandTimeoutSec !== undefined) devCommandTimeoutInput.value = msg.defaults.commandTimeoutSec;
        if (devMaxRetriesInput && msg.defaults.maxRetries !== undefined) devMaxRetriesInput.value = msg.defaults.maxRetries;
        if (devContextLimitInput && msg.defaults.contextLimitTokens !== undefined) devContextLimitInput.value = msg.defaults.contextLimitTokens;
        if (devCompactThresholdInput && msg.defaults.compactThresholdTokens !== undefined) devCompactThresholdInput.value = msg.defaults.compactThresholdTokens;
        if (devCyrillicRatioInput && msg.defaults.cyrillicCharsPerToken !== undefined) devCyrillicRatioInput.value = msg.defaults.cyrillicCharsPerToken;
        if (devLatinRatioInput && msg.defaults.latinCharsPerToken !== undefined) devLatinRatioInput.value = msg.defaults.latinCharsPerToken;
        modeStates.debugMode = Boolean(msg.defaults.debugMode);
        applyDebugModeUI();
      }

      updateTogglesUI();

      if (msg.baseUrl) {
        serverUrlInput.value = msg.baseUrl;
        if (serverIndicator) serverIndicator.textContent = msg.baseUrl;
      }

      if (tokenSetupInput) {
        tokenSetupInput.value = msg.apiKey || '';
      }
      if (onboardingTokenInput && msg.apiKey) {
        onboardingTokenInput.value = msg.apiKey;
      }

      if (msg.session.model) {
        modelSettingSelect.value = msg.session.model;
      }

      setOnboardingVisible(!msg.hasApiKey);

      messagesList.innerHTML = '';
      currentAssistantMsgEl = null;
      currentThinkingAccordion = null;
      isGenerating = false;
      updateSendButtonState();

      // Update token usage in donut & popover
      sessionLastCompactTimestamp = msg.session?.lastCompactTimestamp || null;
      if (msg.tokenUsage) {
        updateTokenDonut(msg.tokenUsage);
      } else if (msg.session && msg.session.totalTokens) {
        const userTokens = msg.session.cumulativeUserTokens !== undefined
          ? msg.session.cumulativeUserTokens
          : (msg.session.userTokens || 0);
        const llmTokens = msg.session.cumulativeLlmTokens !== undefined
          ? msg.session.cumulativeLlmTokens
          : (msg.session.completionTokens || 0);
        const toolTokens = msg.session.cumulativeToolTokens !== undefined
          ? msg.session.cumulativeToolTokens
          : (msg.session.toolTokens || 0);
        const promptTokens = msg.session.promptTokens || 7908;
        const totalSpent = msg.session.cumulativeTokensSpent !== undefined
          ? msg.session.cumulativeTokensSpent
          : (userTokens + llmTokens + toolTokens + promptTokens);

        updateTokenDonut({
          totalTokens: msg.session.totalTokens,
          promptTokens,
          completionTokens: msg.session.completionTokens || 0,
          userTokens,
          llmTokens,
          toolTokens,
          contextTokens: msg.session.totalTokens,
          maxTokens: 1000000,
          lastCompactTimestamp: sessionLastCompactTimestamp,
          cumulativeTokensSpent: totalSpent,
          cumulativeUserTokens: userTokens,
          cumulativeLlmTokens: llmTokens,
          cumulativeToolTokens: toolTokens
        });
      } else if (msg.session) {
        const usage = calculateClientTokenUsage(msg.session.messages, msg.session.model);
        updateTokenDonut(usage);
      }

      if (!msg.session.messages || msg.session.messages.length === 0) {
        emptyState.style.display = 'flex';
      } else {
        emptyState.style.display = 'none';
        let currentTurnAsstEl = null;
        let turnUserTimestamp = 0;
        let turnEndTimestamp = 0;
        let currentWorkingBlock = null;
        let turnFiles = new Map();

        const finalizeWorkingBlock = (wb, startTs, endTs) => {
          if (!wb) return;
          wb.classList.add('done');
          wb.classList.remove('open');

          const spinner = wb.querySelector('.working-spinner');
          if (spinner) spinner.style.display = 'none';

          let diffSec = 0;
          if (startTs && endTs && endTs >= startTs) {
            diffSec = Math.max(1, Math.round((endTs - startTs) / 1000));
          }
          if (!diffSec || diffSec <= 0) {
            const activitiesCount = wb.querySelectorAll('.activity-feed > *').length;
            diffSec = Math.max(2, activitiesCount * 3);
          }
          const timeStr = formatDuration(diffSec);

          const timeEl = wb.querySelector('.working-time');
          if (timeEl) {
            timeEl.textContent = timeStr;
            timeEl.style.display = 'inline-block';
          }

          const title = wb.querySelector('.working-title');
          if (title) {
            title.textContent = t('workedTitle') || 'Worked';
          }
        };

        let rawMessages = msg.session.messages || [];
        const isRemoveOld = Boolean(msg.defaults?.removeOldContextFromFile || defRemoveOldContext?.checked);
        const isHideOld = Boolean(msg.defaults?.hideOldContext || defHideOldContext?.checked);
        const compactBlocksCount = (msg.session.compactedBlocks || []).length;
        const compactMilestones = msg.session.compactMilestones || [];
        const firstMilestone = compactMilestones[0];

        let isTruncated = false;
        // Check if history was already truncated on disk:
        if (msg.session.historyTruncatedBeforeMessageId) {
          isTruncated = true;
        }

        // If at least 3 compacts have occurred:
        // And either removeOldContextFromFile or hideOldContext is enabled:
        if (compactBlocksCount >= 3 && (isRemoveOld || isHideOld)) {
          if (firstMilestone && firstMilestone.atMessageId) {
            const cutIdx = rawMessages.findIndex(m => m.id === firstMilestone.atMessageId);
            if (cutIdx !== -1) {
              rawMessages = rawMessages.slice(cutIdx + 1);
              isTruncated = true;
            }
          }
        }

        // If history is truncated, prepend the "History is too old" banner at the top of chat
        if (isTruncated) {
          const bannerEl = document.createElement('div');
          bannerEl.className = 'history-truncated-banner';
          bannerEl.innerHTML = `
            ${LUCIDE.history || ''}
            <span class="banner-text">${t('historyTooOldBanner') || 'History is too old (compacted into memory)'}</span>
          `;
          messagesList.appendChild(bannerEl);
        }

        for (const m of rawMessages) {
          if (m.role === 'user') {
            if (isInternalMessage(m)) {
              appendInternalDebugMessage(m.content, m.id || 'internal_prompt');
              continue;
            }
            if (currentWorkingBlock) {
              finalizeWorkingBlock(currentWorkingBlock, turnUserTimestamp, turnEndTimestamp);
              currentWorkingBlock = null;
            }
            if (currentTurnAsstEl) {
              renderReviewStatBar(currentTurnAsstEl, turnFiles);
              ensureAssistantTimestamp(currentTurnAsstEl, currentTurnAsstEl._timestamp || turnEndTimestamp);
              turnFiles.clear();
            }

            let userContent = m.content || '';
            let leakedPrompt = '';
            const leakedIdx = userContent.indexOf('Exploration complete. Now present the architectural concept');
            if (leakedIdx !== -1) {
              leakedPrompt = userContent.substring(leakedIdx).trim();
              userContent = userContent.substring(0, leakedIdx).trim();
            }

            if (userContent) {
              appendUserMessage(userContent, m.timestamp);
            }
            if (leakedPrompt) {
              appendInternalDebugMessage(leakedPrompt, 'plan_nudge (stripped)');
            }

            currentTurnAsstEl = null;
            turnUserTimestamp = m.timestamp || 0;
            turnEndTimestamp = m.timestamp || 0;
          } else if (m.role === 'assistant' || m.role === 'tool') {
            if (m.timestamp) {
              turnEndTimestamp = Math.max(turnEndTimestamp, m.timestamp);
            }
            if (!currentTurnAsstEl) {
              const row = document.createElement('div');
              row.className = 'message-row assistant-row';
              currentTurnAsstEl = document.createElement('div');
              currentTurnAsstEl.className = 'assistant-message';
              const asstTs = m.timestamp || turnUserTimestamp || Date.now();
              currentTurnAsstEl._startTime = asstTs;
              currentTurnAsstEl._timestamp = asstTs;
              row.appendChild(currentTurnAsstEl);
              messagesList.appendChild(row);
              ensureAssistantTimestamp(currentTurnAsstEl, asstTs);
            }

            const getFeed = () => {
              const wb = ensureWorkingBlock(currentTurnAsstEl);
              currentWorkingBlock = wb;
              return wb.querySelector('.activity-feed');
            };

            if (m.role === 'assistant') {
              if (m.reasoningContent) {
                const feed = getFeed();
                const accordion = document.createElement('div');
                accordion.className = 'thinking-accordion';
                const ts = m.timestamp || turnUserTimestamp || Date.now();
                accordion._timestamp = ts;
                const estSec = Math.max(1, Math.round(m.reasoningContent.length / 160));
                accordion.innerHTML = `
                  <div class="thinking-header">
                    <span class="thinking-title">Thought for ${formatDuration(estSec)}</span>
                    <span class="thinking-time" title="${formatFullTimestamp(ts)}">${formatMessageTime(ts, true)}</span>
                    <span class="thinking-chevron">${LUCIDE.chevron}</span>
                  </div>
                  <div class="thinking-content">${escapeHtml(m.reasoningContent)}</div>
                `;
                const hdr = accordion.querySelector('.thinking-header');
                hdr.addEventListener('click', (e) => {
                  e.stopPropagation();
                  accordion.classList.toggle('open');
                });
                feed.appendChild(accordion);
              }

              let contentToDisplay = (m.content || '').trim();

              // If assistant content is empty (e.g. model output only reasoning/tools), but tools were executed before it:
              if (!contentToDisplay && (turnFiles.size > 0 || currentWorkingBlock)) {
                contentToDisplay = 'Все запланированные задачи и изменения файлов успешно выполнены.';
              }

              if (contentToDisplay) {
                const endWorkingMatch = contentToDisplay.match(/<(?:end_working|\/working)>/i);
                if (endWorkingMatch) {
                  const splitIdx = endWorkingMatch.index;
                  const tagLength = endWorkingMatch[0].length;
                  const pre = contentToDisplay.substring(0, splitIdx).replace(/<\/?working>/gi, '').trim();
                  const post = contentToDisplay.substring(splitIdx + tagLength).trim();

                  if (pre) {
                    const feed = getFeed();
                    const narrativeEl = document.createElement('div');
                    narrativeEl.className = 'working-narrative';
                    narrativeEl.textContent = pre;
                    feed.appendChild(narrativeEl);
                  }

                  if (post) {
                    let tNode = currentTurnAsstEl.querySelector('.assistant-text');
                    if (!tNode) {
                      tNode = document.createElement('div');
                      tNode.className = 'assistant-text';
                      currentTurnAsstEl.appendChild(tNode);
                    }
                    tNode.dataset.raw = post;
                    tNode.innerHTML = renderFormattedContent(post);
                  }
                } else {
                  const hasTools = m.toolCalls && m.toolCalls.length > 0;
                  let tNode = currentTurnAsstEl.querySelector('.assistant-text');
                  if (!tNode) {
                    tNode = document.createElement('div');
                    tNode.className = 'assistant-text';
                    currentTurnAsstEl.appendChild(tNode);
                  }
                  if (hasTools) {
                    // Only set if no content is present yet
                    if (!tNode.dataset.raw) {
                      tNode.dataset.raw = contentToDisplay;
                    }
                  } else {
                    // Final completion response replaces any transient pre-tool chatter
                    tNode.dataset.raw = contentToDisplay;
                  }
                  tNode.innerHTML = renderFormattedContent(tNode.dataset.raw);
                }
              }
            } else if (m.role === 'tool') {
              const allToolCalls = (msg.session.messages || []).flatMap(x => x.toolCalls || []);
              const tc = allToolCalls.find(t => t.id === m.toolCallId);
              let toolArgs = {};
              if (tc?.function?.arguments) {
                try { toolArgs = JSON.parse(tc.function.arguments); } catch {}
              }

              if (m.name === 'run_terminal_command' || m.name === 'run_command') {
                const cmdMatch = m.content.match(/Command:\s*([^\n]+)/i);
                const exitMatch = m.content.match(/Exit Code:\s*(\d+)/i);
                const cmd = toolArgs.command || (cmdMatch ? cmdMatch[1].trim() : 'terminal');
                const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : 0;

                const feed = getFeed();
                const cmdItem = createCmdItem({
                  command: cmd,
                  output: m.content,
                  exitCode: exitCode
                });
                feed.appendChild(cmdItem);
              } else if (m.name === 'create_file' || m.name === 'write_file') {
                const rawPath = m.filePath || toolArgs.path || (m.content.match(/(?:File|Created file):\s*([^\n\s]+)/i)?.[1]?.trim());
                if (rawPath) {
                  const filePath = rawPath.trim();
                  const added = m.added !== undefined ? m.added : (toolArgs.content ? toolArgs.content.split('\n').length : 1);
                  const cur = turnFiles.get(filePath) || { added: 0, removed: 0 };
                  cur.added = added;
                  cur.removed = 0;
                  turnFiles.set(filePath, cur);

                  const feed = getFeed();
                  const itemEl = document.createElement('div');
                  itemEl.className = 'cascade-step-line clickable';
                  const fileName = filePath.split(/[\\/]/).pop();
                  itemEl.innerHTML = `
                    <span class="cascade-action-label">Created</span>
                    <img src="${getFileIcon(filePath)}" class="cascade-file-icon" />
                    <span class="cascade-file-name">${escapeHtml(fileName)}</span>
                    <span class="diff-add">+${added}</span>
                  `;
                  itemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ command: 'openFile', path: filePath });
                  });
                  feed.appendChild(itemEl);
                }
              } else if (m.name === 'edit_file' || m.name === 'replace_file_content') {
                const rawPath = m.filePath || toolArgs.path || (m.content.match(/(?:File|content in)\s*([^\n\s]+)/i)?.[1]?.trim());
                if (rawPath) {
                  const filePath = rawPath.trim();
                  const added = m.added !== undefined ? m.added : ((toolArgs.replacementContent || toolArgs.replace || '').split('\n').length);
                  const removed = m.removed !== undefined ? m.removed : ((toolArgs.targetContent || toolArgs.search || '').split('\n').length);
                  const cur = turnFiles.get(filePath) || { added: 0, removed: 0 };
                  cur.added += added;
                  cur.removed += removed;
                  turnFiles.set(filePath, cur);

                  const feed = getFeed();
                  const itemEl = document.createElement('div');
                  itemEl.className = 'cascade-step-line clickable';
                  const fileName = filePath.split(/[\\/]/).pop();
                  itemEl.innerHTML = `
                    <span class="cascade-action-label">Edited</span>
                    <img src="${getFileIcon(filePath)}" class="cascade-file-icon" />
                    <span class="cascade-file-name">${escapeHtml(fileName)}</span>
                    <span class="diff-add">+${added}</span>
                    <span class="diff-del">-${removed}</span>
                  `;
                  itemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ command: 'openFile', path: filePath });
                  });
                  feed.appendChild(itemEl);
                }
              }
            }
          }
        }

        if (currentWorkingBlock) {
          finalizeWorkingBlock(currentWorkingBlock, turnUserTimestamp, turnEndTimestamp);
          currentWorkingBlock = null;
        }
        if (currentTurnAsstEl) {
          renderReviewStatBar(currentTurnAsstEl, turnFiles);
          ensureAssistantTimestamp(currentTurnAsstEl, currentTurnAsstEl._timestamp || turnEndTimestamp);
          turnFiles.clear();
        }
      }
      scrollToBottom();
      break;

    case 'projectsHierarchy':
      renderProjectsHierarchy(msg.hierarchy, msg.activeProjectId, msg.activeSessionId);
      break;

    case 'turn_start': {
      // Keep current assistant message and working block intact across multi-turn steps
      finishThinking();
      finishDebugTrace();
      const asstEl = ensureAssistantMessage();
      const wb = ensureWorkingBlock(asstEl);
      wb.classList.remove('done');
      wb.classList.add('open');
      const wbHeader = wb.querySelector('.working-header');
      if (wbHeader) wbHeader.style.display = 'flex';
      const wbTitle = wb.querySelector('.working-title');
      if (wbTitle) wbTitle.textContent = t('workingTitle');
      const wbSpinner = wb.querySelector('.working-spinner');
      if (wbSpinner) wbSpinner.style.display = 'inline-block';
      const wbTime = wb.querySelector('.working-time');
      if (wbTime) wbTime.style.display = 'none';
      const wbDelay = wb.querySelector('.working-api-delay');
      if (wbDelay) wbDelay.style.display = 'none';

      if (currentAssistantMsgEl) {
        currentAssistantMsgEl._rawStream = '';
      }
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
      finishThinking();
      finishDebugTrace();
      if (currentAssistantMsgEl) {
        const textNode = currentAssistantMsgEl.querySelector('.assistant-text');
        if (textNode && !textNode.querySelector('.plan-card') && !textNode.dataset.raw?.includes('<plan>')) {
          currentAssistantMsgEl._rawStream = '';
          textNode.dataset.raw = '';
          textNode.innerHTML = '';
        }
        const workingBlock = ensureWorkingBlock(currentAssistantMsgEl);
        workingBlock.classList.remove('done');
        workingBlock.classList.add('open');
        const wbHeader = workingBlock.querySelector('.working-header');
        if (wbHeader) wbHeader.style.display = 'flex';
        const wbTitle = workingBlock.querySelector('.working-title');
        if (wbTitle) wbTitle.textContent = t('workingTitle');
        const wbSpinner = workingBlock.querySelector('.working-spinner');
        if (wbSpinner) wbSpinner.style.display = 'inline-block';
        const wbTime = workingBlock.querySelector('.working-time');
        if (wbTime) wbTime.style.display = 'none';
        finishUnstuck();
      }
      break;
    }

    case 'tool_call_end':
      finishThinking();
      finishDebugTrace();
      finishUnstuck();
      break;

    case 'token_usage':
      updateTokenDonut(msg);
      break;

    case 'openSettings':
      openSettingsView();
      break;

    case 'authSaved':
      closeSettingsView();
      setOnboardingVisible(false);
      if (tokenSetupInput && msg.apiKey) {
        tokenSetupInput.value = msg.apiKey;
      }
      if (serverIndicator && msg.baseUrl) {
        serverIndicator.textContent = msg.baseUrl;
      }
      break;

    case 'tokenReset':
      if (tokenSetupInput) tokenSetupInput.value = '';
      if (onboardingTokenInput) onboardingTokenInput.value = '';
      closeSettingsView();
      setOnboardingVisible(true);
      break;

    case 'healthResult':
      if (msg.ok) {
        healthStatusText.innerHTML = `${LUCIDE.check} ${t('available')} (${msg.pingMs}ms)`;
        healthStatusText.className = 'health-status-text ok';
      } else {
        healthStatusText.innerHTML = `${LUCIDE.x} ${t('error')} (${msg.error || 'unreachable'})`;
        healthStatusText.className = 'health-status-text err';
      }
      break;

    case 'chunk':
      if (!isGenerating) break;
      appendAssistantChunk(msg.content);
      break;

    case 'reasoning_chunk':
      if (!isGenerating) break;
      appendReasoningChunk(msg.content);
      break;

    case 'activity_step': {
      if (!isGenerating) break;
      const step = msg.step;
      if (step && step.type === 'unstuck') {
        dismissThinkingOnUnstuck();
      } else {
        finishThinking();
      }
      const asstEl = ensureAssistantMessage();
      const workingBlock = ensureWorkingBlock(asstEl);
      workingBlock.classList.remove('done');
      workingBlock.classList.add('open');
      const wbHeader = workingBlock.querySelector('.working-header');
      if (wbHeader) wbHeader.style.display = 'flex';
      const wbTitle = workingBlock.querySelector('.working-title');
      if (wbTitle) wbTitle.textContent = t('workingTitle');
      const wbSpinner = workingBlock.querySelector('.working-spinner');
      if (wbSpinner) wbSpinner.style.display = 'inline-block';
      const wbTime = workingBlock.querySelector('.working-time');
      if (wbTime) wbTime.style.display = 'none';
      const feedEl = workingBlock.querySelector('.activity-feed');

      if (step.type !== 'unstuck') {
        finishDebugTrace();
        finishUnstuck();
        currentDebugTraceType = 'trace';
      }

      if (step.type === 'create') {
        stopAllRunningCommands(workingBlock);
        const itemEl = document.createElement('div');
        itemEl.className = 'cascade-step-line clickable';
        const fileName = step.path ? step.path.split(/[\\/]/).pop() : 'file';
        itemEl.innerHTML = `
          <span class="cascade-action-label">Created</span>
          <img src="${getFileIcon(step.path)}" class="cascade-file-icon" />
          <span class="cascade-file-name">${escapeHtml(fileName)}</span>
          <span class="diff-add">+${step.added || 0}</span>
        `;
        if (step.path) {
          itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            vscode.postMessage({ command: 'openFile', path: step.path });
          });
          trackModifiedFile(step.path, step.added || 0, 0, true);
        }
        feedEl.appendChild(itemEl);
      } else if (step.type === 'edit') {
        stopAllRunningCommands(workingBlock);
        const itemEl = document.createElement('div');
        itemEl.className = 'cascade-step-line clickable';
        const fileName = step.path ? step.path.split(/[\\/]/).pop() : 'file';
        itemEl.innerHTML = `
          <span class="cascade-action-label">Edited</span>
          <img src="${getFileIcon(step.path)}" class="cascade-file-icon" />
          <span class="cascade-file-name">${escapeHtml(fileName)}</span>
          <span class="diff-add">+${step.added || 0}</span>
          <span class="diff-del">-${step.removed || 0}</span>
        `;
        if (step.path) {
          itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            vscode.postMessage({ command: 'openFile', path: step.path });
          });
          trackModifiedFile(step.path, step.added || 0, step.removed || 0);
        }
        feedEl.appendChild(itemEl);
      } else if (step.type === 'diagnostics') {
        stopAllRunningCommands(workingBlock);
        const itemEl = document.createElement('div');
        itemEl.className = 'cascade-step-line clickable';
        const fileName = step.path ? step.path.split(/[\\/]/).pop() : 'workspace';
        itemEl.innerHTML = `
          <span class="cascade-action-label">Checked diagnostics</span>
          <img src="${getFileIcon(step.path)}" class="cascade-file-icon" />
          <span class="cascade-file-name">${escapeHtml(fileName)}</span>
        `;
        if (step.path) {
          itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            vscode.postMessage({ command: 'openFile', path: step.path });
          });
        }
        feedEl.appendChild(itemEl);
      } else if (step.type === 'command') {
        const existingCmd = findCommandItem(feedEl, step.id, step.command);

        if (existingCmd && step.status !== 'running') {
          stopCmdItemRunning(existingCmd, step.exitCode, step.output, step.error);
          stopAllRunningCommands(workingBlock);
          scrollToBottom();
          break;
        }

        if (step.status !== 'running') {
          stopAllRunningCommands(workingBlock);
        }

        stopAllRunningCommands(workingBlock);
        const cmdItem = createCmdItem(step);
        const lastEl = feedEl.lastElementChild;
        let cmdGroup = (lastEl && lastEl.classList.contains('command-group')) ? lastEl : null;
        let singleCmd = (lastEl && lastEl.classList.contains('single-cmd')) ? lastEl : null;

        if (cmdGroup) {
          const count = (parseInt(cmdGroup.dataset.cmdCount, 10) || 0) + 1;
          cmdGroup.dataset.cmdCount = String(count);
          cmdGroup.querySelector('.cascade-group-title').textContent = `Ran ${count} commands`;
          cmdGroup.querySelector('.cascade-group-body').appendChild(cmdItem);
        } else if (singleCmd) {
          singleCmd.classList.remove('single-cmd');
          cmdGroup = document.createElement('div');
          cmdGroup.className = 'cascade-group command-group open';
          cmdGroup.dataset.cmdCount = '2';
          cmdGroup.innerHTML = `
            <div class="cascade-group-header">
              <span class="cascade-group-title">Ran 2 commands</span>
              <span class="cascade-group-chevron">${LUCIDE.chevron}</span>
            </div>
            <div class="cascade-group-body"></div>
          `;
          const hdr = cmdGroup.querySelector('.cascade-group-header');
          hdr.addEventListener('click', (e) => {
            e.stopPropagation();
            cmdGroup.classList.toggle('open');
          });
          const body = cmdGroup.querySelector('.cascade-group-body');
          singleCmd.parentNode.replaceChild(cmdGroup, singleCmd);
          body.appendChild(singleCmd);
          body.appendChild(cmdItem);
        } else {
          cmdItem.classList.add('single-cmd');
          feedEl.appendChild(cmdItem);
        }
      } else if (step.type === 'analyze' || step.type === 'explore' || step.type === 'search') {
        const itemEl = document.createElement('div');
        itemEl.className = 'cascade-step-line';

        if (step.type === 'analyze') {
          itemEl.classList.add('clickable');
          const fileName = step.path ? step.path.split(/[\\/]/).pop() : 'file';
          const lineRef = step.startLine ? `<span class="cascade-line-ref">#L${step.startLine}${step.endLine ? '-' + step.endLine : ''}</span>` : '';
          itemEl.innerHTML = `
            <span class="cascade-action-label">Analyzed</span>
            <img src="${getFileIcon(step.path)}" class="cascade-file-icon" />
            <span class="cascade-file-name">${escapeHtml(fileName)}</span>
            ${lineRef}
          `;
          if (step.path) {
            itemEl.addEventListener('click', (e) => {
              e.stopPropagation();
              vscode.postMessage({ command: 'openFile', path: step.path });
            });
          }
        } else if (step.type === 'explore') {
          const titleText = step.title ? step.title.replace(/^Explored\s*/i, '') : 'workspace';
          itemEl.innerHTML = `
            <span class="cascade-action-label">Explored</span>
            <span class="cascade-file-name">${escapeHtml(titleText)}</span>
          `;
        } else if (step.type === 'search') {
          const badge = step.resultCount !== undefined
            ? `<span class="cascade-search-badge">${step.resultCount} result${step.resultCount === 1 ? '' : 's'}</span>`
            : '';
          itemEl.innerHTML = `
            <span class="cascade-action-label">Searched</span>
            <span class="cascade-file-name">${escapeHtml(step.query || '')}</span>
            ${badge}
          `;
        }

        const lastEl = feedEl.lastElementChild;
        let exploreGroup = (lastEl && lastEl.classList.contains('explore-group')) ? lastEl : null;
        let singleExplore = (lastEl && lastEl.classList.contains('single-explore')) ? lastEl : null;

        if (exploreGroup) {
          let fileCount = parseInt(exploreGroup.dataset.fileCount, 10) || 0;
          let searchCount = parseInt(exploreGroup.dataset.searchCount, 10) || 0;
          if (step.type === 'search') {
            searchCount++;
            exploreGroup.dataset.searchCount = String(searchCount);
          } else {
            fileCount++;
            exploreGroup.dataset.fileCount = String(fileCount);
          }
          const parts = [];
          if (fileCount > 0) parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`);
          if (searchCount > 0) parts.push(`${searchCount} search${searchCount === 1 ? '' : 'es'}`);
          exploreGroup.querySelector('.cascade-group-title').textContent = `Explored ${parts.join(', ') || 'workspace'}`;
          exploreGroup.querySelector('.cascade-group-body').appendChild(itemEl);
        } else if (singleExplore) {
          singleExplore.classList.remove('single-explore');
          exploreGroup = document.createElement('div');
          exploreGroup.className = 'cascade-group explore-group open';
          let fileCount = 0;
          let searchCount = 0;
          if (singleExplore.querySelector('.cascade-action-label')?.textContent?.trim() === 'Searched') {
            searchCount++;
          } else {
            fileCount++;
          }
          if (step.type === 'search') {
            searchCount++;
          } else {
            fileCount++;
          }
          exploreGroup.dataset.fileCount = String(fileCount);
          exploreGroup.dataset.searchCount = String(searchCount);
          const parts = [];
          if (fileCount > 0) parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`);
          if (searchCount > 0) parts.push(`${searchCount} search${searchCount === 1 ? '' : 'es'}`);
          exploreGroup.innerHTML = `
            <div class="cascade-group-header">
              <span class="cascade-group-title">Explored ${parts.join(', ') || 'workspace'}</span>
              <span class="cascade-group-chevron">${LUCIDE.chevron}</span>
            </div>
            <div class="cascade-group-body"></div>
          `;
          const hdr = exploreGroup.querySelector('.cascade-group-header');
          hdr.addEventListener('click', (e) => {
            e.stopPropagation();
            exploreGroup.classList.toggle('open');
          });
          const body = exploreGroup.querySelector('.cascade-group-body');
          singleExplore.parentNode.replaceChild(exploreGroup, singleExplore);
          body.appendChild(singleExplore);
          body.appendChild(itemEl);
        } else {
          itemEl.classList.add('single-explore');
          feedEl.appendChild(itemEl);
        }
      } else if (step.type === 'unstuck') {
        renderUnstuckAccordion(feedEl, step);
      } else if (step.type === 'compact') {
        let compactEl = feedEl.querySelector('.cascade-compact-item');
        if (!compactEl) {
          compactEl = document.createElement('div');
          compactEl.className = 'cascade-step-line cascade-compact-item';
          compactEl.innerHTML = `
            <span class="cascade-action-label" style="font-weight:500;">Compacting</span>
            <span class="working-spinner" style="display:inline-block; margin-left:6px;"></span>
          `;
          feedEl.appendChild(compactEl);
        }
      } else if (step.type === 'compact_done') {
        let compactEl = feedEl.querySelector('.cascade-compact-item');
        if (compactEl) {
          const spinner = compactEl.querySelector('.working-spinner');
          if (spinner) spinner.style.display = 'none';
          const label = compactEl.querySelector('.cascade-action-label');
          if (label) label.textContent = 'Compacted';
          compactEl.classList.add('done');
        } else {
          const itemEl = document.createElement('div');
          itemEl.className = 'cascade-step-line cascade-compact-item done';
          itemEl.innerHTML = `
            <span class="cascade-action-label" style="font-weight:500;">Compacted</span>
          `;
          feedEl.appendChild(itemEl);
        }
      }

      scrollToBottom();
      break;
    }

    case 'command_permission_request': {
      finishThinking();
      finishDebugTrace();
      const asstEl = ensureAssistantMessage();
      const workingBlock = ensureWorkingBlock(asstEl);
      workingBlock.classList.remove('done');
      workingBlock.classList.add('open');
      const wbHeader = workingBlock.querySelector('.working-header');
      if (wbHeader) wbHeader.style.display = 'flex';
      const wbTitle = workingBlock.querySelector('.working-title');
      if (wbTitle) wbTitle.textContent = t('workingTitle');
      const feedEl = workingBlock.querySelector('.activity-feed');

      const card = document.createElement('div');
      card.className = 'command-permission-card';
      card.id = `perm_${msg.requestId}`;
      card.innerHTML = `
        <div class="perm-header">
          ${LUCIDE.shieldAlert}
          <span>Command Execution Permission</span>
        </div>
        <div class="perm-cmd-box">${escapeHtml(msg.command || '')}</div>
        <div class="perm-actions">
          <button type="button" class="perm-btn perm-btn-run">Run once</button>
          <button type="button" class="perm-btn perm-btn-always">Always allow this command</button>
          <button type="button" class="perm-btn perm-btn-deny">Don't run</button>
        </div>
      `;

      const actionsDiv = card.querySelector('.perm-actions');
      const respond = (decision) => {
        if (!isGenerating) {
          actionsDiv.innerHTML = `<span class="perm-resolved-status" style="color:var(--text-muted, #71717a);">Cancelled</span>`;
          return;
        }
        vscode.postMessage({
          command: 'commandPermissionResponse',
          requestId: msg.requestId,
          decision: decision
        });
        const label = decision === 'run_once' ? 'Run once' : decision === 'always_allow' ? 'Always allowed' : 'Don\'t run';
        actionsDiv.innerHTML = `<span class="perm-resolved-status">Decision: ${label}</span>`;
        if (decision === 'deny') {
          const relatedCmd = findCommandItem(feedEl, null, msg.command);
          if (relatedCmd) {
            stopCmdItemRunning(relatedCmd, 1, 'Command rejected by user', true);
          }
          stopAllRunningCommands(workingBlock);
        }
      };

      card.querySelector('.perm-btn-run').addEventListener('click', () => respond('run_once'));
      card.querySelector('.perm-btn-always').addEventListener('click', () => respond('always_allow'));
      card.querySelector('.perm-btn-deny').addEventListener('click', () => respond('deny'));

      feedEl.appendChild(card);
      scrollToBottom();
      break;
    }

    case 'task_start':
      break;

    case 'task_end': {
      // Unconditionally terminate the running state of this command on client
      let matched = false;
      if (msg.taskId) {
        document.querySelectorAll(`.cascade-cmd-item[data-cmd-id="${msg.taskId}"]`).forEach(cmd => {
          stopCmdItemRunning(cmd, msg.exitCode, msg.output);
          matched = true;
        });
      }
      if (msg.command) {
        const cleanCmd = msg.command.trim();
        document.querySelectorAll('.cascade-cmd-item.running').forEach(cmd => {
          if ((cmd.dataset.cmdCode || '').trim() === cleanCmd || (cmd.querySelector('.cascade-cmd-code')?.textContent || '').trim() === cleanCmd) {
            stopCmdItemRunning(cmd, msg.exitCode, msg.output);
            matched = true;
          }
        });
      }
      // Unconditionally stop any remaining running command spinners anywhere in DOM
      stopAllRunningCommands();
      break;
    }

    case 'task_killed': {
      const card = document.querySelector('.agent-tool-card:has(.kill-task-btn)') || document.getElementById(`task_${msg.taskId}`);
      if (card) {
        const killBtn = card.querySelector('.kill-task-btn');
        if (killBtn) killBtn.remove();
        const statusBadge = card.querySelector('.agent-tool-status');
        if (statusBadge) {
          statusBadge.className = 'agent-tool-status status-err';
          statusBadge.innerHTML = `${LUCIDE.x} ${t('failed')}`;
        }
      }
      break;
    }

    case 'plan_proposed': {
      isGenerating = false;
      updateSendButtonState();
      finishThinking();

      currentPlanConfirmed = false;
      sessionPlanConfirmed = false;

      const asstEl = ensureAssistantMessage();
      let textNode = asstEl.querySelector('.assistant-text');
      if (!textNode) {
        textNode = document.createElement('div');
        textNode.className = 'assistant-text';
        asstEl.appendChild(textNode);
      }
      let fullContent = (asstEl._rawStream && asstEl._rawStream.trim()) || '';
      if (!fullContent.includes('<plan>') && msg.planText) {
        fullContent = (fullContent ? fullContent + '\n\n' : '') + `<plan>\n${msg.planText}\n</plan>`;
      }
      textNode.dataset.raw = fullContent;
      textNode.innerHTML = renderFormattedContent(fullContent);
      const narrative = asstEl.querySelector('.working-narrative');
      if (narrative) narrative.remove();
      const wb = asstEl.querySelector('.working-block');
      if (wb) {
        wb.classList.add('done');
        wb.classList.remove('open');
        const spinner = wb.querySelector('.working-spinner');
        if (spinner) spinner.style.display = 'none';
        const start = asstEl._startTime || executionStartTime || Date.now();
        const elapsedSec = Math.max(1, Math.round((Date.now() - start) / 1000));
        const timeStr = formatDuration(elapsedSec);
        const timeEl = wb.querySelector('.working-time');
        if (timeEl) {
          timeEl.textContent = timeStr;
          timeEl.style.display = 'inline-block';
        }
        const title = wb.querySelector('.working-title');
        if (title) {
          title.textContent = t('workedTitle') || 'Worked';
        }
        const feed = wb.querySelector('.activity-feed');
        if (!feed || feed.children.length === 0) {
          wb.style.display = 'none';
        }
      }
      scrollToBottom();
      // Plan proposal turn is finished: reset assistant message pointers so that the user's approval
      // and subsequent execution are placed in new messages below
      currentAssistantMsgEl = null;
      currentThinkingAccordion = null;
      currentThinkingContentEl = null;
      break;
    }

    case 'api_delay': {
      if (!modeStates.debugMode) break;
      const asstEl = ensureAssistantMessage();
      const wb = ensureWorkingBlock(asstEl);
      wb.classList.remove('done');
      wb.classList.add('open');
      const wbHeader = wb.querySelector('.working-header');
      if (wbHeader) wbHeader.style.display = 'flex';
      const wbSpinner = wb.querySelector('.working-spinner');
      if (wbSpinner) wbSpinner.style.display = 'inline-block';
      const wbTime = wb.querySelector('.working-time');
      if (wbTime) wbTime.style.display = 'none';

      const feedEl = wb.querySelector('.activity-feed');

      if (msg.remainingMs > 0) {
        const secStr = (msg.remainingMs / 1000).toFixed(1);
        const reasonStr = msg.reason || 'pacing';

        if (feedEl) {
          let delayItem = feedEl.querySelector('.cascade-delay-item');
          if (!delayItem) {
            delayItem = document.createElement('div');
            delayItem.className = 'cascade-step-line cascade-delay-item';
            feedEl.appendChild(delayItem);
          }
          delayItem.innerHTML = `
            <span class="cascade-action-label">API Delay</span>
            <span style="font-family:var(--vscode-editor-font-family, monospace);">${secStr}s</span>
            <span style="color:var(--text-muted, #71717a); font-size:10.5px;">(${escapeHtml(reasonStr)})</span>
          `;
        }
      } else {
        if (feedEl) {
          const delayItem = feedEl.querySelector('.cascade-delay-item');
          if (delayItem) {
            delayItem.innerHTML = `
              <span class="cascade-action-label">API Request</span>
              <span style="color:var(--text-muted, #71717a); font-size:10.5px;">Dispatched</span>
            `;
            setTimeout(() => {
              if (delayItem && delayItem.parentNode) delayItem.remove();
            }, 1200);
          }
        }
      }
      scrollToBottom();
      break;
    }

    case 'status': {
      // Remove any stray working-pill from assistant message DOM
      if (currentAssistantMsgEl) {
        const pill = currentAssistantMsgEl.querySelector('.working-pill');
        if (pill) pill.remove();
      }
      break;
    }

    case 'finish':
      isGenerating = false;
      updateSendButtonState();
      cleanupActiveSpinners();
      finishThinking();
      finishDebugTrace();

      document.querySelectorAll('.working-api-delay').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.cascade-delay-item').forEach(el => el.remove());

      document.querySelectorAll('.command-permission-card').forEach(card => {
        const actionsDiv = card.querySelector('.perm-actions');
        if (actionsDiv && !actionsDiv.querySelector('.perm-resolved-status')) {
          actionsDiv.innerHTML = `<span class="perm-resolved-status" style="color:var(--text-muted, #71717a);">Cancelled</span>`;
        }
      });

      if (currentAssistantMsgEl) {
        if (modeStates.agentMode) {
          let textNode = currentAssistantMsgEl.querySelector('.assistant-text');
          const currentRaw = (textNode?.dataset?.raw || '').trim();

          if (!textNode || !currentRaw) {
            let finalCleanText = '';
            const fullRaw = currentAssistantMsgEl._rawStream || '';

            // 1. Look for <end_working> in _rawStream
            const endMatch = fullRaw.match(/<(?:end_working|\/working)>/i);
            if (endMatch) {
              finalCleanText = fullRaw.substring(endMatch.index + endMatch[0].length).replace(/^<\/working>\s*/i, '').trim();
            }

            // 2. If no <end_working>, look for text after the last tool call or DSML invocation
            if (!finalCleanText && fullRaw) {
              let stripped = fullRaw.replace(/<[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}[\s\S]*?(?:<\/[|\uFF5C]{1,2}DSML[|\uFF5C]{1,2}>|$)/gi, '');
              stripped = stripped.replace(/<(?:tool_call|function_call|tool)\b[\s\S]*?(?:<\/(?:tool_call|function_call|call|tool)>|$)/gi, '');
              stripped = stripped.replace(/<\/?(?:working|end_working)>/gi, '');
              stripped = stripped.replace(/<think>[\s\S]*?<\/think>/gi, '');
              stripped = stripped.replace(/<plan>[\s\S]*?<\/plan>/gi, '');
              finalCleanText = stripped.trim();
            }

            // 3. If fullRaw was cleared or empty, check if text was trapped in a debug trace accordion
            if (!finalCleanText) {
              const traceContentEl = currentAssistantMsgEl.querySelector('.debug-trace-accordion .thinking-content');
              if (traceContentEl && traceContentEl.textContent.trim().length > 20) {
                const traceText = traceContentEl.textContent.trim();
                if (!traceText.startsWith('<') && !traceText.startsWith('{')) {
                  finalCleanText = traceText;
                  traceContentEl.closest('.debug-trace-accordion')?.remove();
                }
              }
            }

            if (finalCleanText) {
              if (!textNode) {
                textNode = document.createElement('div');
                textNode.className = 'assistant-text';
                currentAssistantMsgEl.appendChild(textNode);
              }
              const cleanDisplay = finalCleanText.replace(/<\/?(?:end_working|working)>/gi, '').trim();
              textNode.dataset.raw = cleanDisplay;
              textNode.innerHTML = renderFormattedContent(cleanDisplay);
              const narrative = currentAssistantMsgEl.querySelector('.working-narrative');
              if (narrative) narrative.remove();
            }
          }
        }

        const workingBlock = currentAssistantMsgEl.querySelector('.working-block');
        if (workingBlock) {
          finishUnstuck();
          workingBlock.classList.add('done');
          const spinner = workingBlock.querySelector('.working-spinner');
          if (spinner) spinner.style.display = 'none';
          const start = currentAssistantMsgEl._startTime || executionStartTime || Date.now();
          const elapsedSec = Math.max(1, Math.round((Date.now() - start) / 1000));
          const timeStr = formatDuration(elapsedSec);
          const timeEl = workingBlock.querySelector('.working-time');
          if (timeEl) {
            timeEl.textContent = timeStr;
            timeEl.style.display = 'inline-block';
          }
          const title = workingBlock.querySelector('.working-title');
          if (title) {
            title.textContent = t('workedTitle') || 'Worked';
          }
          const feed = workingBlock.querySelector('.activity-feed');
          if (feed && feed.children.length === 0) {
            workingBlock.style.display = 'none';
          }
        }

        // Remove working indicator without showing redundant stopped badge
        const pill = currentAssistantMsgEl.querySelector('.working-pill');
        if (pill) pill.remove();

        if (turnModifiedFiles.size > 0 && currentAssistantMsgEl.dataset.hasModifiedFiles === 'true') {
          renderReviewStatBar(currentAssistantMsgEl, turnModifiedFiles);
        }
        ensureAssistantTimestamp(currentAssistantMsgEl, currentAssistantMsgEl._startTime || executionStartTime || Date.now());
        const finalTextNode = currentAssistantMsgEl.querySelector('.assistant-text');
        const finalText = finalTextNode?.dataset?.raw || finalTextNode?.textContent || currentAssistantMsgEl._rawStream || '';
        console.log('[DeepCode Chat In <- Agent Response]:', finalText);
        turnModifiedFiles.clear();
      }

      turnModifiedFiles.clear();
      currentAssistantMsgEl = null;
      currentThinkingAccordion = null;
      break;

    case 'error': {
      isGenerating = false;
      updateSendButtonState();
      cleanupActiveSpinners();
      finishThinking();
      finishDebugTrace();

      if (currentAssistantMsgEl) {
        if (turnModifiedFiles.size > 0 && currentAssistantMsgEl.dataset.hasModifiedFiles === 'true') {
          renderReviewStatBar(currentAssistantMsgEl, turnModifiedFiles);
        }
        const pill = currentAssistantMsgEl.querySelector('.working-pill');
        if (pill) pill.remove();

        const wb = currentAssistantMsgEl.querySelector('.working-block');
        const feed = wb?.querySelector('.activity-feed');
        const textNode = currentAssistantMsgEl.querySelector('.assistant-text');
        // Clean up empty ghost assistant message bubble
        if ((!feed || feed.children.length === 0) && (!textNode || !textNode.textContent.trim())) {
          currentAssistantMsgEl.parentElement?.remove();
        } else {
          if (wb) {
            wb.classList.add('done');
            const spinner = wb.querySelector('.working-spinner');
            if (spinner) spinner.style.display = 'none';
          }
          ensureAssistantTimestamp(currentAssistantMsgEl, currentAssistantMsgEl._startTime || executionStartTime || Date.now());
        }
      }
      turnModifiedFiles.clear();
      currentAssistantMsgEl = null;

      const { cleanMsg, errorCode, rawDetails } = parseErrorDetails(msg.message, msg.code, msg.raw);

      const isSessionError = rawDetails && (
        rawDetails.includes('Сессия') ||
        rawDetails.includes('session_expired') ||
        rawDetails.includes('401') ||
        rawDetails.includes('API Key') ||
        rawDetails.includes('empty stream') ||
        rawDetails.includes('0 токенов') ||
        rawDetails.includes('user is muted')
      );

      const errCard = document.createElement('div');
      errCard.className = 'message-row error-message-row';
      errCard.dataset.rawError = rawDetails;
      errCard.dataset.errorCode = errorCode || '';
      errCard.dataset.timestamp = String(Date.now());

      errCard.innerHTML = `
        <div class="assistant-message error-card-bubble" style="border-left: 3px solid var(--danger); background: rgba(239, 68, 68, 0.08); padding: 12px 14px; border-radius: 8px;">
          <div style="display:flex;align-items:flex-start;gap:10px;color:#f87171;font-size:13px;line-height:1.5;">
            <span style="flex-shrink:0;margin-top:2px;">${LUCIDE.alert}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;margin-bottom:4px;word-break:break-word;">${escapeHtml(cleanMsg)}</div>
              ${isSessionError ? `
                <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;line-height:1.4;">
                  ${escapeHtml(t('sessionExpiredHint'))}
                </div>
              ` : ''}

              <!-- Debug trace: stored in DOM, hidden unless Debug Mode is active -->
              <div class="error-debug-wrapper" style="display: ${modeStates.debugMode ? 'block' : 'none'}; margin-top: 10px;">
                <details class="error-debug-details">
                  <summary class="error-debug-summary">
                    <span class="error-debug-title">
                      ${LUCIDE.info}
                      ${escapeHtml(t('debugInfoTitle') || 'Debug Info')} ${errorCode ? `<span class="error-code-badge">${escapeHtml(t('errorCodeLabel') || 'Code:')} ${escapeHtml(errorCode)}</span>` : ''}
                    </span>
                    <button type="button" class="error-copy-raw-btn" title="Copy raw error">
                      ${LUCIDE.copy} <span>${escapeHtml(t('copy') || 'copy')}</span>
                    </button>
                  </summary>
                  <pre class="error-debug-pre">${escapeHtml(rawDetails || cleanMsg)}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      `;

      const errTs = Date.now();
      const errMeta = document.createElement('div');
      errMeta.className = 'message-meta assistant-meta';
      errMeta.innerHTML = `<span class="message-time" title="${formatFullTimestamp(errTs, 'assistant')}">${formatMessageTime(errTs)}</span>`;
      errCard.appendChild(errMeta);

      // Copy raw error handler
      const copyBtn = errCard.querySelector('.error-copy-raw-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(rawDetails || cleanMsg).then(() => {
            const span = copyBtn.querySelector('span');
            if (span) span.textContent = t('copied') || 'copied!';
            setTimeout(() => {
              if (span) span.textContent = t('copy') || 'copy';
            }, 1800);
          }).catch(() => {});
        });
      }

      messagesList.appendChild(errCard);
      scrollToBottom();
      break;
    }
  }
} catch (err) {
  console.error('DeepCode webview message error:', err, event.data);
}
});
