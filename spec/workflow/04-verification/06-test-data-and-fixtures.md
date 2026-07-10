# Test Data And Fixtures

## Current Sources

- Shared desktop fixture builders: `apps/desktop/tests/fixtures/`.
- Test-local temporary SQLite databases and filesystem workspaces.
- Repository-local Git fixtures created in temporary directories for clone,
  package, and branch behavior.
- Component fixtures and service mocks colocated with their owning tests when
  they model only one surface.

## Fixture Rules

- Use synthetic, deterministic, non-secret data.
- Never use a developer's real home directory, credentials, tokens, or private
  deployment URLs.
- Filesystem fixtures cover Unicode, special characters, nested paths, hidden
  files, symlinks, duplicate identities, empty packages, and large inventories
  when relevant.
- Network fixtures preserve protocol and error semantics instead of returning
  the expected answer directly.
- Persistence fixtures prove reopen/rescan/reload behavior and clean up their
  temporary resources.
- Security fixtures remain inert and must never execute imported package code.

## Promotion Rule

Promote repeated domain fixtures into an owning shared fixture module. Do not
create a generic fixture bucket for unrelated domains.
