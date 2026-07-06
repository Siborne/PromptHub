# Proposal

## Why

Issue #136 asks for two related but distinct improvements in desktop prompt tags:

1. prompt tags should be manageable from the tag area itself
2. tag click behavior should support a configurable single-select or multi-select mode

The current desktop app already supports prompt tag rename/delete in lower layers, and already ships a `TagManagerModal`, but the capability is not fully surfaced in the prompt tag UX. There is also no user preference controlling whether clicking a tag replaces the current filter or toggles membership in a multi-select filter set.

## Scope

- expose prompt tag management from the sidebar tag section gear button
- extend the desktop prompt tag manager to support adding tags, not only rename/delete
- add a General Settings preference for prompt tag click mode: single or multi
- route prompt tag click interactions through that preference in both expanded and collapsed tag UIs

## Risks

- prompt tags are currently derived from prompt records, not stored as an independent normalized tag table, so adding tags needs a durable catalog mechanism or equivalent persistence path
- renaming/deleting tags must keep the prompt list and active tag filters in sync

## User Flows

- open the prompt tags section and click the gear button to manage tags
- add a new tag from the manager before any prompt uses it
- rename or delete an existing tag and see prompt data refresh
- switch tag click behavior in General Settings between single and multi
- click tags in the sidebar and observe replacement vs toggle behavior based on the preference
