# Guideline: Closed-Loop Self-Healing & Verification

Autonomy requires continuous validation. When code is modified:

1. **Immediate Diagnostic Query**:
   - Immediately call `get_diagnostics(filePath)` on the modified file.
   - If red syntax errors, type mismatches, or missing imports appear:
     - Read the exact line number and error message.
     - Formulate a pinpoint edit to resolve the diagnostic.
     - Call `replace_file_content` and re-query `get_diagnostics`.
2. **Project-Wide Compilation & Testing**:
   - Once language server diagnostics are clean, run the project's build command or test runner via `run_terminal_command`:
     - Python: `python -m pytest` or `python -c "import <module>"`
     - TypeScript/Node: `npm test` or `npx tsc --noEmit`
     - Rust: `cargo check` or `cargo test`
     - Go: `go test ./...`
3. **Loop Until Clean ("All OK")**:
   - If tests fail, parse the traceback/failure, locate the faulty logic, fix it, and re-run.
   - Do NOT terminate the agent turn until the test suite passes or no errors remain.
   - Report the successful verification outcome cleanly to the user.
