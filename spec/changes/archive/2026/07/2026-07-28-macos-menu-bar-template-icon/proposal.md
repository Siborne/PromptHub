# Proposal

## Why

PromptHub currently reuses its full-color rounded-square application icon in
the macOS menu bar. Scaling that artwork to status-item size preserves the blue
background and small interior layers, so the result reads as a faint square
rather than a native menu bar symbol.

## Scope

- Add a dedicated monochrome PromptHub menu bar symbol with 1x and Retina 2x
  representations.
- Load the asset as a macOS template image so the operating system controls its
  light, dark, selected, and accessibility appearances.
- Preserve the existing Windows and Linux tray behavior.
- Keep the existing application icon unchanged.

## Non-goals

- Replacing the Dock, DMG, installer, or in-app product icon.
- Adding a runtime icon theme selector.
- Using an SF Symbol as PromptHub's product mark.

## Risks And Rollback

- A missing packaged asset could prevent creation of the preferred macOS tray
  icon. The existing app icon remains the explicit last-resort fallback.
- Roll back by restoring the previous macOS icon loader and removing the tray
  asset resource mapping.
