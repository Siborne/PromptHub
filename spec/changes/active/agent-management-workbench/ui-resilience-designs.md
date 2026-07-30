# Agent Workspace UI Resilience Designs

## `DES-AGENT-057`: Bounded Agent And Provider Lists

### Scope

The existing Agent workspace remains the only UI and state owner. This batch
does not add another Agent collection, Provider store, capability projection or
navigation layer.

The two currently unbounded master lists use the repository's existing
`@tanstack/react-virtual` dependency:

- the enabled built-in/custom Agent sidebar;
- the Provider Profile master list for the selected Agent.

Sessions already use server-side pagination and bounded transcript expansion.
Asset tabs continue to use their owning domains and are not copied into an
Agent-local cache.

### Rendering And Complexity

- Filtering remains one `O(n)` pass over the Agent collection.
- Virtualizer configuration is `O(1)` per render apart from the visible range.
- Production DOM size is bounded to the viewport plus six overscan rows.
- Total-size metadata is `O(1)` from fixed row estimates; no second copy of the
  Agent or Profile objects is created.
- Fifty platforms and one hundred Provider Profiles therefore keep DOM work
  proportional to the visible range rather than the complete collection.
- No process, port, file, network request, retry loop or background worker is
  introduced.

### Responsive And Text Boundary

- Long Agent names and roots remain available through accessible names while
  visual labels truncate inside `min-w-0` containers.
- The launch action uses a stable localized visible command instead of
  repeating an unbounded Agent name; its accessible label retains the exact
  Agent identity.
- Header actions may wrap without changing their stable control dimensions.
- The Provider master column uses responsive constrained widths and never
  forces the detail region below its minimum content boundary.

### Accessibility And Fallback

- Native buttons remain the selection targets; virtualization does not replace
  their accessible names, `aria-current` state or keyboard activation.
- The list and navigation landmarks remain present.
- Empty and loading states do not initialize a virtualizer-backed row surface.
- Test environments may render all virtual items because JSDOM has no layout;
  production uses the real virtualizer. Dedicated tests assert the configured
  item count, stable key, fixed estimate and overscan contract in addition to
  black-box search and selection behavior.

### Failure And Rollback

The change is renderer-only and durable data remains untouched. A rendering
failure cannot mutate Agent or Provider state. Rollback consists of restoring
the former direct list mapping; no migration or recovery step is required.

## `DES-AGENT-058`: Bounded Agent Asset Pages

### Scope

Agent asset tabs keep querying the Skill, MCP, Rules and Plugin owners. The
Agent renderer only bounds the already-derived view:

- Skill cards use 60-item pages so the existing responsive two-column card
  grid and variable-height content remain intact.
- MCP, Rules and Plugin inventories use 100-item pages.
- Search and filter operations apply to the complete owning-domain result
  before slicing the current page.

No asset rows, page index or filter result is persisted.

### Complexity And Capacity

- Existing owning-domain aggregation and filtering remain `O(n)` for at most
  the bounded inventory returned to the renderer.
- Page derivation is `O(pageSize)` and allocates at most 60 Skill rows or 100
  compact rows per rendered view.
- DOM cardinality remains bounded when the source contains 1,000 assets.
- Changing Agent, domain, search text, Skill filter or source identity resets
  the page to the first result; shrinking results clamps the page instead of
  producing a false empty state.

### Interaction And Accessibility

The pager uses the existing seven-locale `common.previous` and `common.next`
commands, native buttons, disabled boundary states and a numeric
`start-end / total` status. Users can reach every result without an infinite
scroll or hidden automatic fetch.

### Failure And Rollback

Pagination is renderer-only. Owning-domain refresh, installation, import,
uninstall and detail actions continue to receive the original asset object.
Rollback removes the bounded slice without any storage migration.

## `DES-AGENT-060`: Roving Tab Focus Recovery

When an Agent change makes the active detail tab unavailable, selection returns
to Overview. If keyboard focus was already inside the tab list, focus follows
that selection to Overview; focus elsewhere in the workspace is never stolen.
The fixed nine-tab lookup is `O(1)` and introduces no durable state, IPC,
filesystem or network behavior.

The recovery is covered at the shared shell boundary, including the failure
case where a disabled Sessions tab previously retained focus after selecting an
Agent without session support. Rollback removes the focus synchronization only;
tab selection and persisted data are unaffected.
