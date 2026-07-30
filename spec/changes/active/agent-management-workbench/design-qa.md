# Design QA

## Visual Sources

- Structural reference: `assets/agent-workbench-overview.png`
- Current Electron captures:
  - `apps/desktop/test-results/agent-workspace-E2E-Agent--c89bc--one-capability-aware-shell/agent-workspace-overview.png`
  - `apps/desktop/test-results/agent-workspace-E2E-Agent--c89bc--one-capability-aware-shell/agent-workspace-skills.png`
  - `apps/desktop/test-results/agent-workspace-E2E-Agent--c89bc--one-capability-aware-shell/agent-workspace.png`
  - `apps/desktop/test-results/agent-workspace-E2E-Agent--c89bc--one-capability-aware-shell/agent-workspace-narrow.png`

## Acceptance Review

- Pane hierarchy matches the approved direction: application rail, complete Agent list, and selected Agent detail remain visually distinct.
- The generic `Assets` tab is absent. Skills, MCP, Rules, and Plugins are direct top-level tabs with stable placement.
- Header, tab strip, page canvas, summary band, path table, and inventory panels use separate opaque surfaces instead of stacked translucent gray layers.
- Overview summaries use restrained green, blue, cyan, and violet accents while preserving the existing PromptHub theme tokens.
- Skills and MCP pages use domain-specific accents, direct headings, counts, resolved paths, scoped refresh actions, and real empty/list states.
- The Agent Rules tab reuses the established Rules editor surface rather than
  adding a second inventory or styling system. Selection remains scoped to the
  active Agent while draft, save, history, conflict and AI actions retain their
  existing interaction hierarchy.
- The Rules editor now gives the draft canvas the full content width. AI
  rewriting and version snapshots are compact header actions backed by focused
  dialogs, and card/background tokens replace the previous broad muted-gray
  auxiliary column.
- The Agent detail header derives its height from the identity and actions;
  tabs follow immediately instead of sitting below an empty fixed-height band.
- The Rules draft and snapshot diff are direct workspace surfaces rather than
  rounded cards inset inside another content surface. Their compact metadata
  divider remains visible without exposing decorative edges around the editor.
- The draft is now a Markdown-aware CodeMirror surface rather than a plain
  textarea. The enlarged AI dialog presents provider and chat-model selectors
  above a resizable instruction field without exposing credentials.
- Version history opens with the newest non-current snapshot selected and
  keeps the snapshot list, complete line diff and restore action visible in one
  bounded dialog. Its 1,000-pixel maximum width and 280-pixel snapshot rail
  keep the comparison focused instead of spanning the full workspace. The main
  editor and its actions remain unchanged behind it.
- Live macOS verification confirms Open Location reveals and selects the exact
  rule file in Finder; it no longer silently opens an imprecise path.
- Wide and narrow captures show no blank canvas, overlap, unreadable button text, or inaccessible active tab. Narrow tabs remain horizontally scrollable.
- The reference is dark-theme artwork while the automated capture uses the persisted light theme. The comparison therefore treats layout, contrast hierarchy, density, interaction state, and semantic color placement as normative rather than literal theme colors.

## Remaining Polish

- Provider, Config Files, Sessions, and Usage intentionally remain disabled until their adapters are implemented.
- A future narrow-layout batch may replace the persistent Agent list with list-to-detail navigation; the current layout remains usable and non-overlapping at the covered viewport.

final result: passed
