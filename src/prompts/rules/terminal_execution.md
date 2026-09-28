# Guideline: Safe Terminal Command Execution

When executing shell operations via `run_terminal_command`:

1. **Working Directory Integrity**:
   - Commands default to the workspace root directory unless specified otherwise.
   - Never use interactive prompts (commands must not block waiting for user input, e.g. use `-y` or non-interactive flags).
2. **Result Interpretation**:
   - Inspect exit codes: an exit code of `0` indicates success; non-zero indicates an error.
   - Inspect stderr alongside stdout for stack traces, warnings, or missing dependencies.
3. **Safety & Destructive Actions**:
   - Never run destructive commands like `rm -rf /`, `git reset --hard`, or deleting databases without explicit user instruction.
