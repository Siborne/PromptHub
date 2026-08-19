# Desktop Delta

## Requirements

- Desktop app must support a global left rail that can host more than Prompt and Skill.
- Prompt and Skill must become first-class modules inside the new global shell instead of being the only top-level mode switch.
- Desktop app must support a Rules module in the new global shell.
- Skill Projects must remain inside the Skill module as a second-level section.
- The shell must be extensible to future modules such as Agent and MCP.
- The Rules module must allow editing a known set of global rule files and project rule files.
- The Rules module sidebar must separate global rules from project rules.
- The Rules module must support manually adding project directories that expose a canonical rule file.
- Desktop settings should model agent/tool integration around managed custom agent entries rather than around extra skill-only scan paths.
- Each custom agent entry should include at least a user-defined name and a root directory.
- Each custom agent entry should allow overriding protocol-relative paths for key local assets such as skills, rules, agents, commands, and config files.
- When a custom agent is configured, PromptHub should derive and preview known asset locations under that root, including skills, rules, commands, agents, and config files when the platform contract defines them.
- Custom agents should participate in the same enable/disable and display-order controls that users already use for built-in agent platforms.
- Built-in agent presets should be able to model region-specific variants when they map to different stable root directories, such as `Trae` vs `Trae CN`.
- When a built-in platform is split into a new explicit preset, PromptHub must migrate matching saved root overrides / disabled states / display order entries so users do not end up with duplicate platforms pointing at the same directory.
- Built-in agent presets should be able to onboard additional root-directory-based agent ecosystems such as `Cline` without forcing users to recreate them as custom agents first.

## Scenarios

- User launches PromptHub and sees a left rail with global module icons.
- User switches from Prompt to Skill without losing module-specific sidebars.
- User switches to Rules and can inspect/edit a global or project rule file.
- User can add a project directory and immediately see its canonical rule file under project rules.
- User opens Skill and still sees `Projects` as a second-level section.
- Future modules can be added without redesigning the top-level shell again.
- User opens `Agent管理`, creates a custom agent with a name and root directory, and PromptHub supports basic add/edit/delete flows while showing the derived local asset surfaces.
- User edits a custom agent and can override protocol-relative paths so PromptHub stops assuming every custom agent follows the built-in defaults.
- User adds a custom agent and immediately sees it in the platform visibility / display-order list, where it can be enabled, disabled, and reordered with built-in platforms.
- User upgrades from a build that only exposed `Trae` and had manually overridden its root to `~/.trae-cn`; PromptHub should automatically move that state onto the new `Trae CN` built-in preset.
- User opens `Agent管理` or Skills platform selection and sees `Cline` as a built-in platform with its own default root and derived asset preview.
