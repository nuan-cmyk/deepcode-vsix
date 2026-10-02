# Guideline: Chunked Code Exploration

When investigating or debugging a project, reading entire large files consumes unnecessary tokens and degrades reasoning fidelity. Follow these chunked reading best practices:

1. **Range Slicing (1-65 lines)**:
   - Use `<tool_call name="read_file"><path>config.py</path><start_line>1</start_line><end_line>65</end_line></tool_call>`
   - Inspect the first 1-45 lines to observe:
     - Module docstring and architecture intent.
     - Imports and external dependencies.
     - Global constants, configuration, and type definitions.
   - Slicing formats supported:
     - `<start_line>1</start_line><end_line>65</end_line>`
     - `<lines>1-65</lines>`
     - `<path>config.py#L1-65</path>`

2. **Targeted Function Inspection**:
   - Use `search_files` to find the exact line numbers of function, class, or variable declarations.
   - Once the line number is known, slice only the relevant section (e.g. lines 120-170).

3. **Context Windows for Edits**:
   - Before modifying a block of code, always inspect at least 3-5 lines above and below the target modification area to ensure exact whitespace, indentation, and variable context match.
