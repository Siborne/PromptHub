# Mobile App Shell Design

## Overview

The mobile app is a new Expo React Native application in `apps/mobile`. It uses Expo Router for file-based routing, React Native primitives for UI, and small feature modules for prompts, skills, stores, and settings.

The initial shell is intentionally thin: it creates the navigation and module boundaries that later persistence, import, and sync work can attach to. Durable behavior remains behind repository interfaces so the app can move from demo data to SQLite without changing screen contracts.

## Affected Areas

- Data model:
  - No schema change in this scaffold.
  - Mobile repositories expose prompt and skill summary records derived from shared types.
  - Skill repository explicitly keeps `contentPath` and `packagePath` fields separate from metadata.
- IPC / API:
  - No desktop IPC changes.
  - No preload exposure changes.
- Filesystem / sync:
  - No durable filesystem writes in this scaffold.
  - `src/platform` is reserved for Android/iOS file, share, and permission adapters.
- UI / UX:
  - New mobile-native tab shell.
  - First tabs are Prompts, Skills, Store, and Settings.
  - Empty/preview states are localized and use the same visual language.

## Tradeoffs

- Expo Router is chosen over a custom React Navigation setup to reduce boilerplate and keep screens discoverable by path.
- The first scaffold uses React Native `StyleSheet` instead of Tailwind/NativeWind to avoid introducing a styling pipeline before the design system stabilizes.
- SQLite is deferred so the current change stays a framework scaffold rather than mixing storage migration decisions into the app shell.
