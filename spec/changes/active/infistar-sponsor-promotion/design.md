# Infistar Sponsor Promotion Design

## Placement

The current partner appears after the contents and before the download section
in each README locale. This moves the affiliate entry above the long product
and release content while keeping the project identity and navigation first. A
three-column Markdown table keeps the partner, service fit, and registration
action scannable without adding a new marketing page. The existing sponsor
section remains the home of personal donation methods and does not repeat the
partner table.

The public sponsor record and the website backer pages carry the same disclosure
boundary. The website remains Chinese/English because those are its existing
backer-page locales; the repository README set remains aligned across all seven
supported documentation languages.

## Copy Boundary

- Partner identity: Infistar.ai / 无限星河.
- PromptHub relationship: sponsor and model-service support partner.
- Service fit: OpenAI-compatible access to mainstream model families for prompt,
  Skill, generation, refinement, and comparison workflows.
- Action: affiliate registration link supplied by the maintainer.
- Disclosure: PromptHub may receive promotional benefit; third-party models,
  pricing, credits, availability, and terms are controlled by Infistar.ai.

The maintainer-provided `$5 credit / first-deposit offer` placeholder is not a
confirmed commercial term and is intentionally omitted.

## Complexity And Resources

This is static documentation with `O(1)` page size growth, no runtime memory,
I/O, database, or network cost. Verification checks locale/link parity and the
website documentation build.
