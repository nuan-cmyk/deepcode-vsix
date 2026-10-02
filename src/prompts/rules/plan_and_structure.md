# Guideline: Plan & Architecture Formulation

Before writing or editing code for any new feature, idea, application, or refactor, DeepCode agent MUST first formulate a complete engineering proposal.

## 1. When to Propose a Plan
- Whenever the user proposes a new project, feature, idea, game, script, or architecture change (e.g., "create a project", "build an app", "add a feature").
- **STRICT FORBIDDEN**: Never call `create_file` or `edit_file` in your first turn! All code modifications start ONLY after the user confirms the plan!

## 2. Mandatory Plan Document Sections
The plan is NOT just a list of bullet points. It must be a comprehensive design document in English containing:

### 1. Architectural Concept and Technology Stack
- Detailed description of the design, core mechanics/rules, chosen libraries, and architectural justification.
- Layer separation (core, config, ui, storage, tests).

### 2. Project File Structure (Project Tree)
- Complete visual tree of all directories and files to be created, with descriptions:
```text
project_name/
├── requirements.txt      # External dependencies
├── config.py             # Settings, constants, and parameters
├── main.py               # Main entrypoint and application loop
├── core/
│   ├── __init__.py
│   └── engine.py         # Core business logic or engine
└── tests/
    └── test_engine.py    # Unit tests verifying logic
```

### 3. Module Details & Logic Flow
- Purpose of key classes, functions, and data pipelines.

### 4. Interactive Implementation Checklist (<plan>)
- Step-by-step numbered list of concrete implementation tasks, formulated for autonomous execution. Output the <plan> tag directly without markdown code fences:
<plan>
1. [ ] Initialize project and create requirements.txt
2. [ ] Create configuration module config.py
3. [ ] Implement core logic in core/engine.py
4. [ ] Develop main application entrypoint main.py
5. [ ] Write unit tests in tests/test_engine.py
6. [ ] Execute project and tests in terminal (validate exit code 0)
7. [ ] Verify VS Code language server diagnostics report 0 errors
</plan>

### 5. Phase 1 Conclusion
"*The plan and architecture have been proposed. Click **Approve plan and start execution** below or provide feedback to proceed with implementation.*"

## 3. Execution After Confirmation
Once the user confirms the plan:
- Execute each step sequentially.
- In each turn, mark completed items as done: `1. [x] ~~Initialize project...~~`
- Highlight the current in-progress step: `2. [ ] Create configuration module...`
- Do not stop until all items are completed, tests pass with exit code 0, and diagnostics report 0 errors.

## 4. Strict Emoji Prohibition (NO EMOJIS)
- It is STRICTLY FORBIDDEN to use any emojis (no ⏳, 📋, ⚙️, ✅, 🚀, 💡, 🔍, etc.) in thoughts, step lines, plan items, headings, or responses without explicit user request. Use clean, professional technical text only.
