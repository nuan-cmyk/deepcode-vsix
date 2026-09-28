# DeepCode Pro (VS Code Extension)

> Autonomous AI Coding Agent for DeepSeek with Claude Code / Cursor UX, Surgical Editing, and Closed-Loop Self-Healing Diagnostics.

---

## ✨ Features

- **Claude Code & Cursor UX Alignment**:
  - Dark minimalist aesthetic matching Claude Code.
  - Floating rounded composer bar with active glow.
  - Hotkeys: `Ctrl+Esc` to focus agent, `Shift+Tab` to toggle Auto mode.
  - Collapsible reasoning blocks (`💭 Thinking Process`) with native DeepSeek R1 `<think>` support.
  - Interactive tool execution pills with real-time running/done indicators and expandable diffs.
  - Prominent **`Continue`** button when responses or multi-step operations need to resume.
- **Zero-Friction Onboarding**:
  - Requires only your DeepSeek API key or DeepAuth token (`sk-...`).
  - Stored securely in VS Code `SecretStorage`.
  - Configurable server endpoint (`http://localhost:8000/v1` or custom domain).
- **RAG & English Guidance System**:
  - System prompts and rules are authored in English for maximum reasoning precision.
  - Dynamic markdown rule loading:
    - `chunked_reading.md`: Inspecting line ranges (e.g. 1-45) to minimize token consumption.
    - `surgical_editing.md`: Pinpoint string replacements preserving existing code.
    - `self_healing.md`: Post-edit verification loop until zero errors.
    - `terminal_execution.md`: Safe command execution.
- **Autonomous Closed-Loop Self-Healing**:
  - After modifying files, automatically runs VS Code language server diagnostics (`vscode.languages.getDiagnostics`).
  - If syntax or type errors are detected, the agent analyzes the line error and autonomously applies fixes in a loop until clean (**"Все ОК"**).
- **Multi-Chat Session Management**:
  - Persistent conversation histories with distinct UUIDs.
  - Inline title renaming, history drawer (`🕒`), and instant new session creation (`+`).

---

## 🚀 Quick Start / Installation

### 1. Install Extension in VS Code
You can install the pre-built `.vsix` package directly:

#### Via Command Line:
```bash
code --install-extension deepseek-code-agent-0.1.0.vsix
```

---

## 🛠️ Development & Building

To rebuild the extension from source:

```bash
npm install
npm run compile
npx @vscode/vsce package --no-dependencies
```
