# Guideline: Final Completion Summary Report

When all plan items are verified, tests pass, and diagnostics report 0 errors, DeepCode agent outputs a professional, concise summary in English.

## Standard Report Template

```markdown
### Summary of Changes and Verification:

1. **[Feature / Module Name]**:
   - Description of changes in `path/to/file.ext`.
   - What was added, refactored, or fixed.

2. **[Terminal Commands and Testing]**:
   - Commands executed: `python todo.py add "..."`, `pytest tests/`.
   - Result: All tests passed successfully (exit code 0).

3. **[Verification and Diagnostics]**:
   - Checked syntax and types via language server (`get_diagnostics`).
   - Clean report (0 errors, 0 warnings).

The code is verified and ready for use.
```

Always follow this exact structure when concluding an autonomous development task.
