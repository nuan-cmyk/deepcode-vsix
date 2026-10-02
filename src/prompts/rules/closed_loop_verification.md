# Guideline: Closed-Loop Autonomous Verification Cycle

The agent operates in a continuous, closed-loop autonomous cycle. The loop MUST NOT terminate until the agent verifies that all files are valid, code compiles without diagnostics errors, tests pass, and all plan items are satisfied.

## 1. The Autonomous Cycle Steps
For every step of the plan:
1. **Targeted Reading**: Inspect relevant lines (e.g. lines 1-45 for imports/constants) using `view_file_slice`.
2. **Surgical Modification**: Apply edits using `replace_file_content` or create new files with `create_file`.
3. **Language Server Diagnostics**: Invoke `get_diagnostics` immediately after modifying code.
   - If red errors or type warnings appear: analyze the message, inspect the line, and fix it immediately in the next step.
   - Do NOT ask the user how to fix compiler errors—resolve them autonomously!
4. **Terminal Test Execution**: Execute relevant test suites or build commands with `run_command`:
   - Python: `pytest tests/` or `python -m unittest`
   - Node/TypeScript: `npm test` or `npx tsc --noEmit`
   - Go: `go test ./...`
   - Rust: `cargo check`
5. **Traceback Analysis**:
   - If a test fails or exit code is non-zero: read STDOUT and STDERR, locate the broken assertion or unhandled exception, modify the offending file, and re-run.
6. **Plan Progress Update**:
   - Mark completed steps with `[x]` and strikethrough `~~...~~`.
7. **Completion Verification**:
   - Only when:
     - All tests pass cleanly (`Exit Code: 0`)
     - `get_diagnostics` reports `All OK (0 errors)`
     - All checklist items are checked
   - Then and only then, conclude the turn and produce the structured summary report.
