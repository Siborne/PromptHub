# Sync Spec Delta

## Added Requirements

### Requirement: Desktop Automatic Sync History

Desktop MUST record recent automatic sync attempts for the selected sync
provider so users can verify background behavior without opening developer
tools. Desktop MUST also append the same sanitized automatic sync entries to a
single local JSONL log file under `logs/auto-sync.jsonl`.

#### Scenario: Automatic sync records success

- **Given** desktop automatic sync runs for WebDAV, S3, or self-hosted sync
- **When** the run succeeds
- **Then** PromptHub records the provider, trigger reason, result status,
  timestamp, and a sanitized summary message in settings history and
  `logs/auto-sync.jsonl`.

#### Scenario: Automatic sync records failure

- **Given** desktop automatic sync runs for WebDAV, S3, or self-hosted sync
- **When** the run fails or throws
- **Then** PromptHub records a failure entry with the provider, trigger reason,
  timestamp, and a sanitized error message in settings history and
  `logs/auto-sync.jsonl`.

#### Scenario: Automatic sync is skipped

- **Given** automatic sync is configured but cannot run because the window is
  hidden, the device is offline, the provider is not selected, the config is
  incomplete, or another sync is already running
- **When** the scheduler evaluates the run
- **Then** PromptHub records a skipped entry that explains the reason without
  exposing credentials or endpoint details.

#### Scenario: User reviews automatic sync history

- **Given** automatic sync has recorded history
- **When** the user opens data sync settings
- **Then** recent entries are visible with provider, reason, status, time, and
  sanitized message.

#### Scenario: User opens the local automatic sync log

- **Given** the user opens desktop local data paths
- **When** PromptHub shows local data paths
- **Then** the automatic sync log file path is visible and can be opened from
  `logs/auto-sync.jsonl`.
