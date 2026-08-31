# APIMart README Design

## `DES-APIMART-001`: Reuse the partner table

Add one Markdown row immediately before Infistar in `README.md` and
`docs/README.{en,zh-TW,ja,de,es,fr}.md`. Preserve the existing table heading,
navigation, Infistar campaign, and remaining document contents. Use the supplied
English copy and translations of the same campaign for the other languages.

## `DES-APIMART-002`: Two shared, unmodified banner assets

Store the Chinese image at `docs/imgs/sponsors/apimart-banner.png` and English
image at `docs/imgs/sponsors/apimart-banner-en.png`. Root and localized documents
use relative paths appropriate to their directories. Each row wraps the image
in the same registration URL used by its text link. The maintainer-selected
detailed 3840 × 2160 posters replace the simplified images at these same paths;
no Markdown or referral URL changes are needed. The earlier simplified images
remain recoverable from commit `dee61e74`.

The change adds a constant number of static rows and two shared assets
(approximately 8.8 MiB total after the detailed-poster revision). It adds no application processing, service,
dependency, migration, or background resource. Website synchronization is
intentionally outside this README-only request.

## `TEST-APIMART-001`: Document structure and preservation

Parse all seven documents with the installed remark/GFM parser. Assert one
partner table with a header and two one-cell data rows, APIMart first and
Infistar second. Removing the APIMart row must reproduce the pre-change README,
allowing only Markdown table padding differences. Check Markdown formatting and
the scoped Git diff for whitespace errors.

## `TEST-APIMART-002`: Asset and link integrity

Assert each APIMart row contains one image and exactly two links to the supplied
registration URL. Resolve each image path and verify the expected language
asset. Compare both stored images with the supplied PNG files byte for byte.

No application tests, provider calls, website build, or GUI automation are
needed for this static README change. Render-tree parsing is not a browser
visual acceptance test or verification of sponsor service claims.
