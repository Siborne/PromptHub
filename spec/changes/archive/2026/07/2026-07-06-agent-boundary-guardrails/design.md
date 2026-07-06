# Design

## Overview

The guardrail design has two layers:

1. Root agent contract in `AGENTS.md`, because every agent should read it first.
2. Stable internal rules under `spec/rules/`, so the same expectations are not trapped only in the root instruction file.

The contract is written as decision gates:

- Before coding, locate the authoritative boundary.
- Before changing existing behavior, identify the current owner, data source, and tests.
- Before adding new behavior, define data/API/storage impact and verification.
- Before database or filesystem changes, document migration, compatibility, rollback, and recovery.

## Affected Areas

- Data model: no runtime schema change.
- IPC / API: no runtime IPC/API change.
- Filesystem / sync: no runtime storage change.
- UI / UX: no runtime UI change.
- Agent workflow:
  - Root `AGENTS.md` now reflects monorepo boundaries.
  - Project-local `spec-init` skill now honors `spec/` as the authoritative topology when the repo defines it.
  - Stable rules describe memoryless-agent boundary enforcement.

## Tradeoffs

- The root file stays somewhat long because it must be self-contained for agents that only read `AGENTS.md`.
- Detailed domain behavior still belongs in `spec/knowledge/*`; `AGENTS.md` points to those files rather than duplicating all domain specs.
