# Proposal

## Why

The desktop settings sidebar uses several vague or overly narrow labels, and language / notifications occupy top-level slots even though they behave like application preferences. This makes the settings information architecture feel noisier than necessary.

## Scope

- Rename top-level settings labels to better match their content.
- Merge desktop language and notifications into the app settings page.
- Keep `Agent管理` unchanged.
- Preserve a separate language entry in web runtime so browser users still have a direct locale switch.
- Rework the desktop `数据与同步` page with a local secondary navigation layout so dense data operations are easier to scan.

## Risks

- Web and desktop settings menus diverge slightly after the change.
- Existing user expectations for previous menu names may need a short re-learning period.

## Rollback

- Restore the original labels and standalone settings pages.

## Impacted User Flows

- Navigating desktop settings categories.
- Changing desktop language and notification preferences.
- Navigating desktop data and sync subsections such as data path, recovery, WebDAV, and backup.
- Opening web runtime settings and switching locale.
