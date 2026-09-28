# Guideline: Final Completion Summary Report (RAG)

When all plan items are verified, tests pass, and diagnostics are 0 errors, DeepSeek Agent outputs a professional, concise summary in Russian.

## Standard Report Template

```markdown
### Что было сделано и исправлено:

1. **[Название этапа / функциональности]**:
   - Описание конкретного изменения в файле `path/to/file.ext`.
   - Что было добавлено или исправлено.

2. **[Выполнение терминальных команд и тестов]**:
   - Запущены команды: `python todo.py add "..."`, `pytest tests/`.
   - Результат: Все тесты пройдены успешно (код 0).

3. **[Верификация и диагностика]**:
   - Проверены синтаксис и типы VS Code language server (`get_diagnostics`).
   - Ошибок нет (0 errors, 0 warnings).

Код готов к использованию. 🚀
```

Always follow this exact structure when concluding an autonomous development task.
