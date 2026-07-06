# Desktop Spec Delta

## Modified

### Requirement FR-001: Local source skill refresh

Skills imported from local folder sources MUST refresh from the latest on-disk `SKILL.md` when the user updates or reimports them.

#### Scenario: Update local source skill after editing SKILL.md

- Given a skill was imported from a local source folder
- And the user edits that folder's `SKILL.md`
- When the user requests an update from the local source detail view
- Then PromptHub reads the latest on-disk `SKILL.md` and creates an updated skill version instead of failing or reusing stale content

#### Scenario: Remove and reimport local source skill

- Given a local source entry remains connected after a prior import is removed
- When the user reimports that source skill
- Then PromptHub reads the latest on-disk `SKILL.md` rather than stale cached content

#### Scenario: Import from source detail sidebar

- Given the user opens a local scanned skill detail/sidebar view
- When they click `Import to My Skills`
- Then PromptHub imports that scanned skill into the library using the same scanned-skill import flow as the source list

### Requirement FR-002: Linked local My Skills import

When importing scanned local Skills into My Skills, PromptHub MUST offer both copy and link import modes. Copy mode remains the default and creates a managed PromptHub package snapshot. Link mode keeps the original local Skill directory as the My Skills source of truth.

#### Scenario: Import local Skill as copied snapshot

- Given a scanned local Skill points to `/external/skills/writer`
- When the user imports it with copy mode
- Then PromptHub copies the full package into its managed Skills directory
- And the imported My Skills record uses the managed package path as `local_repo_path`
- And later edits in `/external/skills/writer/SKILL.md` do not automatically change the My Skills package

#### Scenario: Import local Skill as linked source

- Given a scanned local Skill points to `/external/skills/writer`
- When the user imports it with link mode
- Then PromptHub creates a My Skills database record without copying the package into managed Skills storage
- And the imported My Skills record keeps `/external/skills/writer` as `local_repo_path`
- And file listing, file reading, file editing, and sync-from-repo operations use `/external/skills/writer`

#### Scenario: Linked source edits stay visible

- Given a My Skills record was imported with link mode
- When the user edits the original source folder's `SKILL.md` outside PromptHub
- And they refresh or sync the My Skills package from repo
- Then PromptHub reads the latest on-disk `SKILL.md`
- And updates the My Skills metadata and directory fingerprint from the linked source directory

#### Scenario: PromptHub edits linked source

- Given a My Skills record was imported with link mode
- When the user edits `SKILL.md` or package files in PromptHub
- Then PromptHub writes those changes to the linked source directory
- And updates the My Skills metadata and directory fingerprint from that linked source directory

#### Scenario: Delete linked My Skills record preserves source

- Given a My Skills record was imported with link mode from `/external/skills/writer`
- When the user deletes the My Skills record
- Then PromptHub removes the database record and PromptHub-owned distribution links
- And PromptHub does not delete `/external/skills/writer`

#### Scenario: Linked source folder is missing

- Given a My Skills record points to a linked external source directory
- And that directory no longer exists
- When PromptHub resolves package files for that Skill
- Then PromptHub does not silently materialize a new managed copy over the linked source choice
- And the operation reports that the local repo cannot be resolved

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-001` | `DES-001` | `TEST-001`, `TEST-005` | `T-001`, `T-002`, `T-003`, `T-004`, `T-005` |
| `FR-002` | `DES-002`, `DES-003`, `DES-004` | `TEST-002`, `TEST-003`, `TEST-004`, `TEST-005` | `T-006`, `T-007`, `T-008`, `T-009`, `T-010`, `T-011`, `T-012`, `T-013` |
