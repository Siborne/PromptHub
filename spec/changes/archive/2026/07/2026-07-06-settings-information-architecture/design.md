# Design

## Summary

Use clearer top-level menu names for desktop settings:

- `常规设置` -> `应用设置`
- `AI 模型` -> `模型服务`
- `数据设置` -> `数据与同步`

Move language and notifications into `GeneralSettings` as additional sections while keeping the `Agent管理` label untouched.

For web runtime, keep a dedicated `language` menu item to avoid removing the only direct locale entry point.

Add an optional second-level settings column in `SettingsPage` for dense settings areas. The column is rendered between the top-level settings sidebar and the content scroll container, reuses the same sidebar item sizing/typography as the top-level settings menu, and is only shown for sections that define secondary navigation. `DataSettings` receives the active subsection as input and only renders the corresponding content panel.

## Affected Modules

- `apps/desktop/src/renderer/components/settings/SettingsPage.tsx`
- `apps/desktop/src/renderer/components/settings/GeneralSettings.tsx`
- `apps/desktop/src/renderer/components/settings/LanguageSettings.tsx`
- `apps/desktop/src/renderer/components/settings/DataSettings.tsx`
- locale files under `apps/desktop/src/renderer/i18n/locales/`

## Tradeoffs

- Desktop becomes simpler with fewer top-level categories.
- Web keeps a slightly different structure for practicality.
- Keeping the second-level column in `SettingsPage` avoids coupling subsection navigation to individual content pages and prevents it from scrolling with the right-side content.
