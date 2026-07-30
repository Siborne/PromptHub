# Desktop UI Delta Spec

## ADDED Requirements

### `FR-TRAY-001` Native macOS Menu Bar Appearance

The desktop application MUST use a dedicated PromptHub template image for its
macOS menu bar item instead of shrinking the full application icon.

#### `SC-TRAY-001` Standard-density display

- Given PromptHub runs on macOS at standard display density
- When the tray is created
- Then it loads a transparent 16x16 monochrome PromptHub layers symbol
- And marks the image as a template image.

#### `SC-TRAY-002` Retina display

- Given PromptHub runs on a Retina macOS display
- When the tray is created
- Then macOS can resolve the matching 32x32 `@2x` representation without a
  runtime resize.

#### `SC-TRAY-003` Packaged application

- Given PromptHub is installed from a packaged artifact
- When the tray is created
- Then both density representations are available outside the application
  archive under the configured resources directory.

#### `SC-TRAY-004` Missing preferred asset

- Given the dedicated template asset cannot be loaded
- When the tray is created
- Then the main process records the load failure and uses the existing
  application icon as a last-resort fallback.

## Verification

- `TEST-TRAY-001`: Path resolution for development and packaged applications.
- `TEST-TRAY-002`: Template-image marking and no runtime raster resizing.
- `TEST-TRAY-003`: PNG dimensions and Electron Builder resource mapping.
- `TEST-TRAY-004`: Explicit missing-asset error and fallback boundary.

## Traceability

| Requirement   | Design                         | Verification                            | Task                              |
| ------------- | ------------------------------ | --------------------------------------- | --------------------------------- |
| `FR-TRAY-001` | `DES-TRAY-001`, `DES-TRAY-002` | `TEST-TRAY-001` through `TEST-TRAY-004` | `T-TRAY-001` through `T-TRAY-006` |
