# Infistar Sponsor Promotion Delta

## Added Requirements

### `FR-INFISTAR-001`: Visible current sponsor entry

PromptHub's sponsor sections MUST identify Infistar.ai as a current sponsor and
model-service support partner and MUST provide the supplied affiliate
registration URL. In each README locale, the campaign block MUST appear after
the contents and before the download section so the offer is visible without
displacing the project introduction or primary download action.

### `FR-INFISTAR-002`: Commercial disclosure (superseded)

Superseded by `FR-INFISTAR-004`. The sponsor-approved creative MUST NOT receive
additional disclosure, qualification, or rewritten marketing text.

### `FR-INFISTAR-003`: No unconfirmed benefit promise (superseded)

Superseded by `FR-INFISTAR-004`. The maintainer explicitly approved the supplied
benefit line as part of the campaign copy and requires it to remain unchanged.

### `FR-INFISTAR-004`: Sponsor creative fidelity

Every public sponsor surface MUST use the supplied 1456 × 180 PNG without image
editing and MUST reproduce the supplied Chinese campaign title and five body
lines without rewriting or translation, except that the campaign title MUST use
the international-domain brand `infistar.cc` in place of `Infistar.ai`. The
only other content transformation is to link the banner and the existing
`专属推广链接` phrase to
`https://infistar.cc/register?aff=RX9CVLVQ&ref_source=link`.

Each surface MUST place the complete campaign inside one row of a single-column
partner table. The table currently contains only the Infistar entry and MUST
allow future partners to be added as additional rows without restructuring the
surrounding document.

## Scenarios

### `AC-INFISTAR-001`: Reader follows the partner offer

Given a reader on any supported README locale, the sponsor campaign exposes the
same banner, approved copy, and registration URL before the download section.

### `AC-INFISTAR-002`: Public copy remains exact

When the campaign is rendered from any public sponsor surface, no translated
table, affiliate disclosure, qualification, or other PromptHub-authored copy is
inserted into the sponsor-provided material.

### `AC-INFISTAR-003`: Partner inventory expands

Given the current one-partner inventory, the table renders one Infistar row.
When another partner is accepted, its campaign can be appended as another row
under the existing partner-table header.
