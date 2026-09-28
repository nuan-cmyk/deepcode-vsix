# Guideline: Plan & Architecture Formulation (RAG)

Before writing or editing code for any new feature, idea, application, or refactor, DeepSeek Agent MUST first formulate a complete engineering proposal.

## 1. When to Propose a Plan
- Whenever the user proposes a new project, feature, idea, game, script, or architecture change (e.g. «напиши игру», «создай проект», «добавь фичу»).
- **STRICT FORBIDDEN**: Never call `create_file` or `edit_file` in your first turn! All code writing starts ONLY after the user confirms the plan!

## 2. Mandatory Plan Document Sections
The plan is NOT just a list of bullet points. It must be a comprehensive design document in Russian containing:

### 1. Архитектурная концепция и стек технологий
- Детальное описание идеи, правила/механики, выбранные библиотеки и обоснование.
- Архитектурное разделение слоев (core, config, ui, storage, tests).

### 2. Строение файлов проекта (Project Tree)
- Полное визуальное дерево всех создаваемых каталогов и файлов с пояснениями:
```text
project_name/
├── requirements.txt      # Внешние зависимости
├── config.py             # Настройки, константы и параметры
├── main.py               # Главная точка входа и цикл приложения
├── core/
│   ├── __init__.py
│   └── engine.py         # Основная бизнес-логика или движок
└── tests/
    └── test_engine.py    # Автотесты для проверки логики
```

### 3. Детализация модулей и логики
- Назначение ключевых классов, функций и потоков данных.

### 4. Интерактивный чек-лист реализации (<plan>)
- Пошаговый нумерованный список конкретных задач реализации, составленный ИИ для автономного выполнения:
```xml
<plan>
1. [ ] Инициализировать проект и создать requirements.txt
2. [ ] Создать модуль конфигурации config.py
3. [ ] Реализовать основной модуль core/engine.py
4. [ ] Разработать точку входа main.py
5. [ ] Написать тесты tests/test_engine.py
6. [ ] Запустить проект и тесты в терминале (проверка запуска)
7. [ ] Проверить отсутствие ошибок диагностики VS Code (0 ошибок)
</plan>
```

### 5. Завершение первой фазы
«*План и архитектура спроектированы. Нажмите кнопку **"Подтвердить план и начать выполнение"** ниже или внесите свои пожелания, чтобы начать реализацию.*»

## 3. Execution After Confirmation
Once the user confirms the plan:
- Execute each step sequentially.
- In each turn, mark completed items as done: `1. [x] ~~Инициализировать проект...~~`
- Highlight the current in-progress step: `⏳ 2. [ ] Создать модуль конфигурации...`
- Do not stop until all items are completed, tests pass with exit code 0, and diagnostics report 0 errors.
