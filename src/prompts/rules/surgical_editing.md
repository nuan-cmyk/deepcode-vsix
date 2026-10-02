# Guideline: Surgical Code Editing

To prevent inadvertent bugs, regression, or accidental deletion of working code:

1. **Iron Rule: Never Overwrite Existing Files with `create_file`**:
   - `create_file` is strictly reserved for creating new files that do not exist yet.
   - For all existing files, you MUST use `edit_file` (or `replace_file_content`).

2. **Exact Substring Matching**:
   - `edit_file` takes `<search>` and `<replace>`.
   - `<search>` must match character-by-character, including leading indentation (spaces vs tabs) and line breaks.
   - Always read the surrounding lines (e.g. `read_file` lines 1-65) before issuing the edit so the indentation matches precisely.

3. **Atomic Modifications**:
   - Make edits focused on the specific function or logic block being updated.
   - Do not replace an entire 100-line file if only 5 lines are being changed. This generates clean git diffs (+X -Y) and guarantees no regressions.

4. **Preservation of Non-Target Code**:
   - Never remove existing imports, helper functions, comments, or configurations unless explicitly requested or directly causing a bug.
   - Maintain the existing naming patterns and coding style of the repository.
