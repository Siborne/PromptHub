# Codex Dream Skin Runtime Snapshot

- Upstream: `https://github.com/Fei-Away/Codex-Dream-Skin`
- Version: `1.2.0`
- Commit: `3af1d6d62f3a0388cc640d2f497ac3100998938e`
- License: MIT, see `LICENSE`

PromptHub vendors only the software runtime, the upstream abstract portal demo
artwork, and the required license/notice files. Celebrity, character, sponsor,
and other rights-unclear presets are intentionally excluded.

Local changes:

1. The Windows bootstrap theme uses the abstract portal artwork instead of the
   upstream celebrity preset.
2. The macOS bootstrap metadata removes sponsor copy and uses the same neutral
   Dream Portal artwork bundled in PromptHub.
3. The Windows theme-store initializer does not seed the excluded celebrity
   preset.
4. PromptHub stages selected themes before invoking the upstream start and
   verified restore entry points.
5. Mutable runtime state uses a PromptHub-owned directory. The macOS launchd
   labels are namespaced to PromptHub so they cannot replace a standalone Dream
   Skin installation.

The sibling checkout under `Programs/public/Codex-Dream-Skin` is an audit and
update source only. Runtime code must always come from this pinned snapshot.
