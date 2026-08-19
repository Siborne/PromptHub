# 0.5.9 Replacement Release Tasks

- [x] `T-REPUB-003` Synchronize changelog, release record, and generated website
      release metadata (`FR-REPUB-003`, `DES-REPUB-003`, `TEST-REPUB-003`).
- [x] `T-REPUB-001` Run the full release harness and replace annotated `v0.5.9`
      only after it passes (`FR-REPUB-001`, `NFR-REPUB-001`, `DES-REPUB-001`,
      `TEST-REPUB-001`). The full local gate passed; remote publication state
      remains under `T-REPUB-002`.
- [x] `T-REPUB-002` Push `main`, publish through both tag workflows, and verify all
      remote artifacts (`FR-REPUB-002`, `DES-REPUB-002`, `TEST-REPUB-002`).
      Desktop and Self-Hosted Web tag workflows succeeded at the final `v0.5.9`
      commit. GitHub stable/Latest metadata, representative platform/update assets,
      and `ghcr.io/legeling/prompthub-web:0.5.9` were verified on 2026-08-19.
