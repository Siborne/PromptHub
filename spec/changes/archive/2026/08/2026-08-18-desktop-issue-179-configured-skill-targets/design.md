# Design

## Overview

The fix separates two concepts:

- `detected`: a platform root is present on disk.
- `deployable`: a platform can be shown as a Skill distribution target because it is detected or explicitly configured by the user.

The main process already owns platform resolution. It will tag built-in platforms that have user override metadata as configured. Custom Agent platforms already carry `isCustom: true`.

The renderer will use a new shared visibility helper for distribution surfaces:

```text
deployable = detected OR platform.isCustom OR platform.isConfigured
visible = deployable AND NOT disabled
```

## Affected Areas

- Data model: no persistence schema changes; add optional platform metadata to the shared `SkillPlatform` type.
- IPC / API: no channel changes; `skill:getSupportedPlatforms` keeps the same shape with an additional optional field.
- Filesystem / sync: no filesystem layout changes; installers already create missing directories.
- UI / UX: configured targets are visible in batch distribution, detail install, Agent views, Skill list badges, and sidebar counts.

## Tradeoffs

- Keeping detection unchanged preserves existing install checks and avoids treating every built-in platform as available.
- Marking configured built-ins in the main process avoids duplicating settings interpretation across renderer components.
- The renderer helper remains pure and reusable, so future target surfaces can share one rule.
