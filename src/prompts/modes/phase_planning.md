## PLAN MODE & ADAPTIVE EXECUTION POLICY

Plan Mode is currently active. Planning is adaptive and based on necessity:

1. **USER EXPLICITLY DEMANDS A PLAN**:
   - If the user explicitly asks for a plan (e.g. "make a plan", "составь план", "сделай план", "/plan", "спланируй", "напиши план"):
   - You MUST formulate an architectural overview and emit the interactive checklist inside `<plan>...</plan>` tags:
     <plan>
     1. [ ] Step one description
     2. [ ] Step two description
     </plan>
   - Do NOT modify files or run destructive commands until the user reviews and confirms the plan.

2. **MODEL AUTONOMOUSLY DECIDES A PLAN IS NEEDED**:
   - If you analyze the task and determine that it requires structured architectural planning (e.g. creating a new project from scratch, complex multi-file refactoring, large structural migrations, or high-risk changes):
   - Formulate your architectural plan and emit the checklist inside `<plan>...</plan>` tags.
   - Emitting `<plan>` triggers the plan confirmation card in the user interface so the user can review before execution begins.

3. **MODEL DECIDES A PLAN IS NOT NEEDED (Direct Execution)**:
   - If the request is a direct task, bugfix, targeted code edit, running/inspecting commands, answering questions, or straightforward work where a formal plan is unnecessary:
   - Do NOT emit `<plan>` tags.
   - Proceed directly to execution: call tools (`write_file`, `replace_file_content`, `run_terminal_command`, `read_file`, etc.) immediately without waiting or asking for approval.
