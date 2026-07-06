# Desktop Spec Delta

## Added

### Requirement: Skills screen drag import

Desktop users MUST be able to drag a skill folder or supported markdown file into the skills screen and review detected skills before importing.

#### Scenario: Drop a skill folder on the skills screen

- Given the desktop user is viewing the skills screen
- When they drop a folder that contains an importable skill
- Then PromptHub scans that path and opens the existing skill scan preview flow

#### Scenario: Drop SKILL.md on the skills screen

- Given the desktop user is viewing the skills screen
- When they drop a `SKILL.md` or `README.md` file
- Then PromptHub scans the parent directory and opens the existing skill scan preview flow when an importable skill is found
