# DeepCode (VS Code Extension)

> Autonomous AI Coding Agent for DeepSeek with Claude Code UX, Surgical Editing, and Closed-Loop Self-Healing Diagnostics.

---

## Features

- **Claude Code UX Alignment**:
  - Dark minimalist aesthetic matching Claude Code.
  - Floating rounded composer bar with active glow.
  - Hotkeys: `Ctrl+Esc` to focus agent, `Shift+Tab` to toggle Auto mode.
  - Collapsible reasoning blocks (`Thinking Process`) with native DeepSeek R1 `<think>` support.
  - Interactive tool execution pills with real-time indicators and expandable diffs.
  - Prominent `Continue` action when responses or multi-step operations need to resume.
- **Zero-Friction Configuration**:
  - Requires only your DeepSeek API key or token (`sk-...`).
  - Stored securely in VS Code `SecretStorage`.
  - Configurable server endpoint (OpenAI-compatible `/v1`).
- **Workspace Auto-Sync & Project Management**:
  - Automatically binds to the active VS Code workspace folder as the agent root.
  - Isolated multi-project session history.
  - Fast session switching via quick pick (`foldername:chatname`).
- **Surgical Editing and Autonomous Verification**:
  - Precision code replacements preserving surrounding code style.
  - Automatic diagnostics verification via VS Code language server.
  - Autonomous self-healing loop fixing errors until zero diagnostics remain.
- **Configurable Operational Modes**:
  - Helper mode (read-write file operations).
  - Local mode (read-write and workspace-scoped terminal commands).
  - Plan Mode with interactive phase approval.

---

## Installation

### From VSIX Package

Install via the VS Code Command Palette:
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Select `Extensions: Install from VSIX...`.
3. Choose `deepcode-1.24.6.vsix`.

Alternatively, install via command line:
```bash
code --install-extension deepcode-1.24.6.vsix
```

---

## Development and Building

To build the extension from source:

```bash
npm install
npm run compile
npx @vscode/vsce package --no-git-tag-version
```
