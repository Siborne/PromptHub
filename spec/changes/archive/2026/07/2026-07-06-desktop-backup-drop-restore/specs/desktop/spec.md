# Desktop Spec Delta

## Added

### Requirement: Backup settings drag target

`Settings > Data > Backup` MUST expose a visible drag-and-drop target for restore files.

#### Scenario: Drop backup in backup settings

- Given the user is on `Settings > Data > Backup`
- When the user drops a supported backup file on the restore target
- Then PromptHub opens the backup import preview flow for that file
