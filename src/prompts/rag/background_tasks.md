# Guideline: Background Tasks & Terminal Execution (RAG)

When running commands that take considerable time (builds, packaging, tests, servers), the agent leverages background process tracking.

## 1. Running Commands
Use `<tool_call name="run_command"><command>...</command></tool_call>` for all shell tasks.

## 2. Real-time Status Display
- The UI renders active running commands as:
  `1 task running: <command>` with a pulsing indicator.
- A manual termination button `[ ⏹ Завершить ]` is provided to the user.
- If a command hangs or enters an infinite loop, the user or agent can abort the task.

## 3. Post-execution Feedback
- Once completed, the card transitions to:
  `🟢 Выполнено (код 0)` or `🔴 Ошибка (код X)`.
- Full stdout and stderr are inspected in the autonomous cycle to determine the next step.
