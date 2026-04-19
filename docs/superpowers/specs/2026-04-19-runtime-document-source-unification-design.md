# Runtime Document Source Unification Design

Date: 2026-04-19

## Goal

Unify the server runtime document model so LSP-synchronized text has a single mutable source of truth, while keeping current handler/runtime behavior unchanged.

This package targets the remaining infrastructure debt centered on:

- `src/lsp/server/runtime/DocumentStore.ts`
- `src/lsp/server/runtime/vscodeShim.ts`
- `src/lsp/server/bootstrap/registerCapabilities.ts`

The current architecture still maintains two runtime document stores:

1. `DocumentStore` for protocol text synchronization
2. `vscodeShim`'s internal `textDocuments` map for runtime workspace projection

That duplication is now the clearest remaining infrastructure split after the completion and hover cleanup.

## Non-Goals

- no rewrite of the entire `vscodeShim`
- no change to public handler APIs
- no change to `ServerLanguageContextFactory` product behavior
- no change to navigation/completion/diagnostics feature semantics
- no attempt to replace `workspace.openTextDocument(...)` disk-backed behavior beyond the synchronized-document path

## Current Problem

`DocumentStore` already holds the authoritative LSP text pushed through:

- `didOpen`
- `didChange`
- `didClose`

But `vscodeShim.ts` still maintains its own mutable `textDocuments` map and its own sync methods:

- `__syncTextDocument(...)`
- `__emitTextDocumentChange(...)`
- `__closeTextDocument(...)`

This creates three architectural problems:

1. duplicated document state
2. duplicated URI/path normalization logic
3. a fragile event bridge where synchronized text is copied into a second store instead of projected from one store

## Approaches Considered

### 1. Keep both stores and tighten synchronization

Pros:

- smallest code diff
- minimal runtime risk

Cons:

- preserves the core debt
- still leaves two mutable truths
- future regressions stay easy

### 2. Make `DocumentStore` the single mutable source and let `vscodeShim` project from it

Pros:

- fixes the real architectural split
- keeps current external runtime surface mostly stable
- does not require deleting `vscodeShim`

Cons:

- requires careful runtime wiring changes
- some tests need to move from “map mutation” expectations to “projection” expectations

### 3. Remove `vscodeShim` document behavior entirely and force all consumers onto `DocumentStore`

Pros:

- conceptually pure

Cons:

- too disruptive
- would force broad runtime API changes
- high regression risk

## Recommended Approach

Approach 2.

Keep `vscodeShim` as the runtime-facing VS Code compatibility layer, but stop letting it own a second mutable synchronized-document map.

`DocumentStore` becomes the only mutable source for synchronized text.

`vscodeShim.workspace.textDocuments` becomes a projection over:

- synchronized documents from `DocumentStore`
- disk-opened readonly documents cached by `workspace.openTextDocument(...)`

## Proposed Design

### Single-source rule

For documents opened/changed through LSP notifications:

- `DocumentStore` is the only mutable truth
- `vscodeShim` must not maintain an independent copy of that text

### Runtime split inside `vscodeShim`

Separate two concepts that are currently mixed in one map:

1. `syncedDocuments`
   - projected from `DocumentStore`
   - not independently mutated by `vscodeShim`
2. `openedReadonlyDocuments`
   - disk-opened documents loaded through `workspace.openTextDocument(...)`
   - still owned by `vscodeShim`

`workspace.textDocuments` should return the union projection of these two sets.

### Registration flow changes

`registerCapabilities.ts` should continue to:

- write protocol text into `DocumentStore`
- emit runtime change notifications

But synchronized document lifecycle should now be:

- `didOpen`:
  - store in `DocumentStore`
  - register/update synchronized runtime projection
  - do not copy into a second mutable text map
- `didChange`:
  - update `DocumentStore`
  - refresh synchronized runtime projection
  - emit runtime change event
- `didClose`:
  - remove from `DocumentStore`
  - remove synchronized runtime projection

### `vscodeShim` API boundary after cleanup

Keep these runtime seams:

- `workspace.textDocuments`
- `workspace.openTextDocument(...)`
- `__emitTextDocumentChange(...)`

But narrow the mutable sync helpers:

- `__syncTextDocument(...)`
  - should no longer create a fully independent document store
  - should only refresh the synchronized projection/view
- `__closeTextDocument(...)`
  - should only unregister the synchronized projection/view

### Path and URI normalization cleanup

`vscodeShim.ts` should stop carrying private copies of:

- `fromFileUri(...)`
- longest-prefix workspace root matching helpers

Those should reuse existing shared helpers where possible:

- `src/lsp/server/runtime/serverPathUtils.ts`

If runtime-specific normalization is still needed, it should be extracted into a small runtime helper instead of left embedded in `vscodeShim.ts`.

## Expected Result

After this package:

- synchronized LSP documents have one mutable owner
- `vscodeShim` still serves as compatibility facade, but no longer as a second sync store
- runtime document change tests become more truthful
- path/root normalization duplication is reduced

## Testing Strategy

### Existing tests that must stay green

- `src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts`
- `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
- `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `src/lsp/server/__tests__/DocumentStore.test.ts`

### New or adjusted focused tests

Add or update focused coverage for:

- synchronized documents reflected through `workspace.textDocuments` without a second mutable copy
- `didChange` projection refresh seeing the latest `DocumentStore` text
- `workspace.openTextDocument(...)` still serving readonly disk docs correctly
- synced documents overriding stale disk state when both refer to the same URI
- `serverPathUtils` reuse replacing duplicated runtime path helpers where appropriate

## Acceptance Criteria

- no second mutable synchronized-document map remains inside `vscodeShim`
- `DocumentStore` is the single mutable owner for protocol-synced documents
- runtime text change notifications still work
- `workspace.textDocuments` still exposes currently synchronized docs
- disk-opened readonly docs still work
- all existing runtime integration tests remain green

## Follow-Up

If this package lands cleanly, the next likely runtime/infrastructure debt to evaluate is:

- whether `vscodeShim` itself can be further split into smaller focused runtime modules

That is explicitly out of scope here.
