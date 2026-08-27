# Infistar Sponsor Promotion Proposal

## Why

PromptHub has accepted sponsorship and model-service support from Infistar.ai.
The public sponsor surfaces originally listed only individual donations and did
not provide the sponsor-approved campaign for an active commercial partner.

## Scope

- Add the Infistar.ai campaign block to the root and six localized README
  sponsor sections.
- Add the same current-partner entry to the Chinese and English website backer
  pages and the public sponsor record.
- Preserve the sponsor-supplied banner and Chinese campaign copy without
  rewriting, translating, or appending extra notices.
- Add the maintainer-supplied `infistar.cc` registration URL only to the banner
  and the existing `专属推广链接` phrase.

## Non-Goals

- Rewriting or translating the sponsor-supplied creative.
- Adding Infistar.ai as a built-in provider preset or changing application code.
- Recording private sponsorship amount, contract term, or contact details.

## Risk And Rollback

The main risk is accidental drift from the sponsor-approved image or text. The
banner is stored byte-for-byte and the same campaign block is reused across
public sponsor surfaces. The change is documentation-only and can be rolled
back by removing the campaign block and copied image assets.
