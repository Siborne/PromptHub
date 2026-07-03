# Delta for Desktop Warning And Store Error UI

## MODIFIED Requirements

### Requirement: Preview Update Channel Messaging

The desktop About settings page MUST keep preview-update risk acknowledgement clear without disrupting the visual rhythm of the settings card layout.

#### Scenario

- GIVEN the user has already enabled preview updates
- WHEN they view the About settings page
- THEN the page shows a lightweight inline preview-channel note
- AND the strongest risk/backup warning remains in the blocking confirmation step before opt-in

### Requirement: Remote Store Rate-Limit Guidance

Desktop remote-store error states MUST only present actionable guidance that exists in the product.

#### Scenario

- GIVEN the remote Skill Store load fails because GitHub API rate limiting was reached
- WHEN the error is shown to the user
- THEN the UI recommends retrying later or switching networks
- AND it does not direct the user to a nonexistent GitHub token setting

### Requirement: Empty Custom Store Guidance

Desktop custom store states MUST distinguish a successfully loaded empty registry from a failed load or ordinary search miss.

#### Scenario

- GIVEN the user selects a custom marketplace JSON store
- AND the registry request succeeds with a valid document containing zero skills
- WHEN the Skill Store renders the selected source
- THEN the count may show `Loaded 0`
- AND the empty state explains that the source loaded successfully but the registry contains 0 skills
- AND it asks the user to check the `skills` array or nested registries and refresh the source

### Requirement: Marketplace JSON Source Validation

Desktop MUST validate Marketplace JSON custom sources before adding or saving them.

#### Scenario: Valid Registry

- GIVEN the user enters an HTTPS Marketplace JSON URL
- WHEN the URL returns valid JSON with at least one top-level `skills` entry
- OR the URL returns valid JSON with at least one nested registry reference under `marketplaces`, `sources`, or `registries`
- THEN desktop allows the custom source to be added or saved

#### Scenario: Empty Registry

- GIVEN the user enters an HTTPS Marketplace JSON URL
- WHEN the URL returns valid JSON with zero `skills` and no nested registry references
- THEN desktop rejects the add/save action
- AND it explains that the Marketplace JSON contains no skills or nested registries

### Requirement: CLI Install Package Manager Guard

Desktop CLI settings MUST NOT run one-click installation when no supported package manager is available through the desktop process PATH.

#### Scenario

- GIVEN desktop Settings reports that neither `pnpm` nor `npm` was detected on PATH
- WHEN the user views the CLI settings actions
- THEN the one-click install buttons are disabled
- AND the page explains that the user must install `pnpm` or `npm` and refresh status first
- AND desktop does not invoke `cli:install`
