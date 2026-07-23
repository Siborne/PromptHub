# Prompt Image Preview Gallery Design

## `DES-PIP-001`: Shared Lightbox Gallery Contract

`ImagePreviewModal` remains the single Desktop large-image surface. Its existing
`imageSrc` stays the opening image, while an optional ordered `imageSources` list defines
the gallery context. If `imageSrc` is absent from that list, the modal deliberately falls
back to a one-image context so temporary AI output is not mixed with saved Prompt media.

The modal owns only ephemeral active-image state. Prompt data remains owned by the
selected `Prompt.images` array; no image order or selection is persisted. Both Prompt
detail surfaces pass that same array, avoiding a second gallery state model.

Navigation is bounded rather than circular:

- both arrow buttons remain positioned consistently when multiple images exist;
- the unavailable boundary action is disabled;
- a compact `current / total` indicator confirms position;
- `ArrowLeft`, `ArrowRight`, and `Escape` share the modal's existing window listener;
- changing the active source resets only that image's load-error state.

## `DES-PIP-002`: Accessibility And Layout

Controls use Lucide chevrons, localized `aria-label` and `title` text, visible focus rings,
and at least 44px hit targets. The indicator is announced politely without describing
keyboard instructions in visible product copy. Single-image previews omit all gallery
chrome.

The root overlay retains the existing dark neutral backdrop in both app themes. Side
controls are viewport-anchored, so portrait, landscape and failed images cannot move the
buttons. The image stays inside bounded viewport dimensions and never overlaps the close
button or counter.

The top-level `ImagePreviewModal` composition may remain slightly above the preferred
50-line function guideline because the portal's close, navigation, media and backdrop
order is clearer as one accessibility tree; normalization, keyboard handling, scroll
locking, buttons and media rendering are split into focused helpers.

Gallery normalization is `O(n)` over the provided Prompt image array, normally a small
bounded media list. Previous/next changes are `O(1)`. No prefetch is introduced, avoiding
unexpected network or memory use for large images.

## Conflicts And Compatibility

- No persistence, IPC, preload, sync or shared-type contract changes.
- Existing single-image callers remain valid because `imageSources` is optional.
- Existing backdrop and Escape close behavior remains unchanged.
- No material conflict exists with the image-generation workbench: its generated outputs
  remain a separate gallery and are not injected into Prompt media previews.

## Analyze

- `FR-PIP-001 -> DES-PIP-001 -> TEST-PIP-001 -> T-PIP-001`: complete.
- `NFR-PIP-001 -> DES-PIP-002 -> TEST-PIP-002 -> T-PIP-002`: complete.
- No `[待确认]`, source-of-truth conflict, migration, or blocking design decision remains.
