# Agent Management Provider Credential Designs

This file is a supporting design record within
`spec/changes/active/agent-management-workbench/`. It does not create a
parallel change, credential store, or source of truth. The architecture and
traceability table remain in `design.md`; detailed Provider credential
orchestration lives here to keep the main design document below the project
size limit.

## `DES-AGENT-044`: Provider Secret Replacement Compensation

The Provider Profile service remains the orchestration owner for the
SQLite/secure-store boundary; no second credential database or CC Switch
runtime dependency is introduced. Before replacement it retains the exact
prior profile, model mappings, secret reference and secret value in
main-process memory only.

The forward sequence is:

1. write the replacement secret under the stable
   `agent-provider:<profileId>` reference;
2. atomically update Profile metadata and mappings in SQLite;
3. remove a distinct legacy secret reference;
4. return only the public Profile and `secretState`.

If step 2 fails, only secret state is restored because SQLite is unchanged. If
step 3 fails after SQLite changed, compensation first rewrites the prior
Profile and mappings using the updated optimistic timestamp. Only after that
database compensation succeeds may PromptHub clear the replacement reference
and restore the prior secret. If database compensation fails, the replacement
secret is intentionally retained because SQLite still points at it; clearing it
would convert a recoverable orphaned legacy secret into an unusable active
Profile.

The operation performs a constant number of bounded SQLite and secure-store
operations. Time and memory are `O(m + s)`, where `m` is the bounded mapping
count and `s` is the bounded secret size; no scan, network request, or
unbounded retry is added. The approach reuses CC Switch's proven
write/compensate/verify workflow shape while remaining an independent
PromptHub implementation with stricter secret separation.

## `DES-AGENT-051`: Public Endpoint Credential Boundary

Provider Profile endpoints cross SQLite, IPC, renderer and portable export
surfaces, so they are public metadata rather than a secret channel. One shared
validator accepts trimmed HTTP(S) URLs up to 2,048 characters and rejects URL
userinfo, fragments, control characters, malformed URLs and other schemes.
The database applies it on create, update and row projection; the Profile form
uses the same function before invoking IPC.

Validation is `O(n)` time and bounded `O(n)` parser memory for endpoint length
`n <= 2,048`. It adds no network request, DNS resolution, retry, background
process or new credential store. Rows written by older builds are not
automatically rewritten: an unsafe row fails closed with a stable error until
a separately approved backup-backed migration defines whether credentials are
discarded, moved to secure storage or left for manual repair.

This boundary follows the CC Switch Provider workflow lesson that endpoint and
credential inputs are distinct fields. No CC Switch source file, runtime
dependency, database schema, UI component or asset is reused in this batch.

## Credential Editor Interaction Detail

This detail refines `DES-AGENT-020` without changing the Provider Profile
contract or creating a credential library beside the existing Profile owner.
CC Switch v3.18.0's API-key editor is used as interaction evidence only.

For a saved Profile, the form presents three explicit, mutually exclusive
actions: keep the current credential, replace it, or remove it. Replace is the
only action that accepts a new value, and an empty replacement is rejected
before IPC. A create form keeps the credential optional because some supported
profiles use environment, OAuth, ADC or platform-native ownership.

The visibility control can reveal only the unsaved value typed during the
current renderer session. Existing secret material is never read from the main
process, rendered as a placeholder value, copied, exported or logged. Closing
or successfully saving the dialog discards the renderer draft.

This remains a constant-size UI decision. It adds no secret read IPC, database
row, network request, cache, retry or background process. The persisted action
continues to use the existing `preserve | replace | clear` request contract and
the main-process `safeStorage` compensation workflow.

## `DES-AGENT-052`: Provider Public JSON Persistence Boundary

Provider Profile config, model mapping parameters and audit snapshots share
one public-JSON validator before SQLite writes and after SQLite reads. The
validator accepts only bounded JSON-compatible plain records and rejects
sensitive key families, including API keys, tokens, credentials, passwords,
private keys, authorization/cookie headers and secure-store references.
Provider baseline recovery reuses the same validator instead of maintaining a
weaker second sensitive-key list.

Write validation occurs before the insert or update, so rejection leaves no
partial row. Read validation makes older or externally modified unsafe rows
fail closed with `AGENT_PROVIDER_PUBLIC_CONFIG_INVALID`; the stable error never
contains the rejected value. PromptHub does not silently rewrite those rows or
move a discovered value into secure storage without a separately approved,
backup-backed credential migration.

Validation is `O(n)` time and `O(d)` traversal state for at most 10,000 nodes,
depth 16, keys of 256 characters and strings of 100,000 characters. The batch
adds no schema, network I/O, process, retry, cache or second credential store.
