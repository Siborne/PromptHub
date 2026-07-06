# Design

## Approach

Add a new `agents` Skill store view parallel to `projects`:

- Sidebar: new "Agent Skills" item under My Skills / Project Skills.
- SkillManager: render `SkillAgentsView` for `storeView === "agents"`.
- Main process: expose two Agent-targeted IPC calls:
  - `skill:scanPlatformSkills(platformId)` returns the platform metadata, skills directory, and scanned Skills with `installMode`.
  - `skill:uninstallPlatformSkill(platformId, skillName)` removes that Skill from the selected Agent/platform directory.
- Renderer: `SkillAgentsView` keeps scan state locally because Agent scan results are filesystem snapshots, similar in shape to project scan state but not persisted.

## Data Contract

Agent scan result:

- `platform`: supported platform metadata.
- `skillsDir`: resolved absolute skills directory.
- `scannedSkills`: `ScannedSkill` plus `installMode: "copy" | "symlink"`.

The scan must include copied folders and directory symlinks. It must parse full package directories through the existing `scanLocalPreview` path so Skill metadata is consistent with project scanning.

## UI Contract

The Agent Skills view uses a two-step layout, not a persistent side detail pane:

- Browse mode shows an Agent/platform list and the selected Agent's scanned Skill cards.
- Agent/platform list panes must be height-constrained (`min-h-0` + internal overflow) so long Agent inventories scroll inside the view instead of being clipped by the app shell.
- Refresh actions must visibly animate while Agent/platform discovery or Skill scanning is running.
- Scan refresh in browse mode must not auto-open the first Skill.
- Clicking a Skill card opens the shared full-width `SkillFullDetailPage` surface with preview/source/files tabs and a back action, so Agent detail reuses the same Skill header, markdown preview, source view, files view, and transition style as My Skills and Project Skills.
- The Agent/platform list uses the shared `PlatformIcon` assets so known Agents show real product icons.

Built-in platform metadata is shared with Settings, MCP, and main-process scan/install code:

- WorkBuddy uses `workbuddy` with root `~/.workbuddy`, `skills/`, and documented MCP config `mcp.json`.
- CodeBuddy keeps the existing `codebuddy` id, but its asset model now includes `skills/`, `CODEBUDDY.md`, `.mcp.json`, `settings.json`, `agents/`, and `commands/`.
- QClaw uses `qclaw` with PromptHub's compatibility root `~/.qclaw`, `skills/`, and OpenClaw-compatible `workspace/SOUL.md`; no MCP path is exposed until an official local config path is confirmed.

Each card shows:

- name, description, path.
- `Symlink` or `Copy` badge.
- optional `In My Skills` badge if the scanned path/name maps to a managed Skill.

The detail surface provides actions: open folder, open in My Skills when managed, uninstall from this Agent.

## Verification

- Component regression: Agent Skills entry opens the Agent view and lists supported Agents.
- Component regression: selected Agent scan renders copy/symlink badges and can uninstall a scanned Skill.
- Component regression: scan results render without a persistent detail pane, and clicking a Skill opens the full-width detail view.
- Component regression: importing My Skills into an Agent calls the existing full-package install APIs in copy/symlink modes and refreshes the scan.
- Main-process regression: platform scan rejects unknown platform ids and marks symlink/copy modes from real filesystem entries.
