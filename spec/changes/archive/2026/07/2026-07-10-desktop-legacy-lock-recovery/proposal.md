# Desktop Legacy Lock Recovery

## Purpose

Fix the first Desktop startup after the database-concurrency change when an
ownerless `.lock` directory was left by a pre-lease PromptHub process.

## Scope

- Let the single-instance Desktop host recover an unregistered legacy lock.
- Keep CLI and shared database callers conservative by default.
- Preserve registered live clients and unknown lease entries.

## Risk And Rollback

Recovery is opt-in because deleting an unregistered lock is unsafe for a CLI
that may run beside an older Desktop. Desktop opts in only after Electron has
won its single-instance gate. Rollback removes the Desktop opt-in while keeping
the conservative shared default.
