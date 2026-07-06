# Design

## Approach

- Add a data-path preview IPC that inspects target directory markers and returns summaries for current and target databases when available.
- Add an apply IPC with explicit actions: `migrate`, `switch`, and `overwrite`.
- Keep the legacy `data:migrate` channel, but make it call safe `migrate` behavior that refuses existing target data.

## Safety Rules

- `migrate` never overwrites an existing PromptHub data marker.
- `switch` only writes `data-path.json` and never copies files.
- `overwrite` creates an upgrade-style backup of the target directory before replacing target items.

