# @laserx/application

Application commands, use cases, history orchestration, import-preview-commit workflows, save/export orchestration, and service interfaces. Depends on domain packages and adapters; never on React components.

M03 owns the authoritative editor session projection: selection, local
clipboard, fresh-ID policy, 100-entry bounded history, transaction grouping,
undo/redo, and routing from validated editor actions to pure domain commands.
These ephemeral states are not serialized into `.laserx`.
