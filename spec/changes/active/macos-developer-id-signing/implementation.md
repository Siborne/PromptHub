# Implementation

## Shipped

- Replaced static `apps/desktop/electron-builder.json` with `apps/desktop/electron-builder.config.cjs` so release macOS builds can enable signing/notarization while local ad-hoc builds remain unsigned by default.
- Enabled macOS Hardened Runtime and electron-builder notarization when `PROMPTHUB_MAC_RELEASE_SIGN=true`.
- Added macOS app and inherited entitlements under `apps/desktop/resources/`.
- Scoped Developer ID certificate export to macOS CI jobs by mapping `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` to electron-builder's `CSC_*` variables only inside the macOS build step.
- Added an early macOS CI secret check for signing credentials plus either App Store Connect API key or Apple ID app-specific password notarization credentials.
- Updated desktop build scripts and release workflow invocations to pass the explicit electron-builder config file.
- Added macOS release verification with `codesign`, `xcrun stapler validate`, and `spctl`.
- Updated generated release notes and README files to describe notarized macOS artifacts as the normal install path while keeping `0.5.9` early preview / older unsigned build recovery instructions.

## Verification

- `node -e 'const cfg=require("./apps/desktop/electron-builder.config.cjs"); console.log(cfg.mac.hardenedRuntime, cfg.mac.identity)'`
- `PROMPTHUB_MAC_RELEASE_SIGN=true node -e 'const cfg=require("./apps/desktop/electron-builder.config.cjs"); console.log(cfg.mac.hardenedRuntime, cfg.mac.notarize)'`
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml"); puts "ok"'`
- `git diff --check -- .github/workflows/release.yml apps/desktop/electron-builder.config.cjs apps/desktop/resources/entitlements.mac.plist apps/desktop/resources/entitlements.mac.inherit.plist apps/desktop/package.json apps/desktop/tsconfig.node.json apps/desktop/tests/unit/main/windows-installer-config.test.ts AGENTS.md README.md docs/README.*.md spec/changes/active/macos-developer-id-signing spec/releases/release-rules.md`
- `pnpm --filter @prompthub/desktop test -- tests/unit/main/windows-installer-config.test.ts --run`
- `pnpm typecheck`

## Synced Docs

- Updated `spec/releases/release-rules.md` with the stable macOS Developer ID signing gate.
- Kept maintainer-only certificate and secret handling out of public README files.
- Updated `AGENTS.md` with a durable rule that forbids agent inner monologue, reasoning drafts, and process narration in UI copy, public docs, and persistent internal records.

## Follow-ups

- Add the required GitHub repository secrets before triggering the next macOS release build.
- Confirm the first signed CI artifact passes Apple notarization with the real Developer ID certificate.
- Treat the Developer ID `.p12` as a reusable Apple Developer Team credential; do not store it in the repository or app-specific public docs.
