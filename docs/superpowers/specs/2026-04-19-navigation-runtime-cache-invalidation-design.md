# Navigation Runtime Cache Invalidation Design

## Context

The definition closeout package finished the definition-side structural cleanup:

- `LanguageDefinitionService` is now a coordinator
- scoped identifier hit-testing is shared through `ScopedMethodIdentifierSupport`
- `DefinitionResolverSupport` has direct tests for its cache invalidation contract

That cleanup exposed a more important remaining debt: in the server runtime path, document synchronization and navigation cache invalidation are not guaranteed to be connected through the same event chain.

Today:

- LSP `didOpen` / `didChange` / `didClose` update `DocumentStore`
- those notifications also call `__syncTextDocument(...)` / `__closeTextDocument(...)`
- `DefinitionResolverSupport` invalidates include/header caches by subscribing to `host.onDidChangeTextDocument(...)`
- but the runtime text-sync path does not clearly guarantee that `workspace.onDidChangeTextDocument` is fired for those server-side sync updates

This package closes that lifecycle gap.

## Goals

- ensure server-side document sync drives the same navigation cache invalidation path that production definition services subscribe to
- keep `DefinitionResolverSupport` cache invalidation semantics unchanged
- add spawned-runtime protection for definition cache refresh after edits
- keep scope limited to runtime/lifecycle closure rather than definition matching behavior

## Non-Goals

- no changes to definition / hover / references / rename matching semantics
- no `InheritedSymbolRelationService` decomposition
- no parser / syntax / semantic architecture changes
- no large-scale `vscodeShim` rewrite
- no attempt to redesign the entire service disposal model in this package

## Approaches Considered

### 1. Minimal patch

Only make `__syncTextDocument(...)` fire the existing text-document change emitter and add one regression test.

Rejected because it fixes the most visible symptom but leaves the lifecycle contract underspecified. It would be too easy for future runtime glue to regress again.

### 2. Recommended: runtime lifecycle closure

Keep the existing architecture, but explicitly define the runtime contract:

- server-side text sync must update the runtime text mirror
- server-side text sync must also emit the change notification consumed by navigation cache invalidation
- spawned-runtime tests must prove that edited definition dependencies invalidate caches

This is the recommended scope because it closes the real gap without turning into a runtime rewrite.

### 3. Large runtime refactor

Unify `DocumentStore`, runtime text mirrors, cache invalidation, disposal, and possibly additional workspace events in one pass.

Rejected because it mixes multiple independent debts and would be too large for a focused architecture-cleanup package.

## Architecture

### 1. `registerCapabilities` remains the LSP entry point

`registerCapabilities` continues to receive:

- `didOpen`
- `didChange`
- `didClose`

and continues to update `DocumentStore`.

This package does not change that responsibility.

What changes is the contract around runtime document sync:

- calling `__syncTextDocument(...)` must not be “text mirror only”
- it must preserve the runtime text mirror **and** drive the document-change event path observed by navigation cache invalidation

### 2. `vscodeShim` owns runtime text-document events

`vscodeShim` already exposes:

- runtime `workspace.textDocuments`
- `workspace.onDidChangeTextDocument`

This package makes that event surface authoritative for server-side document-sync notifications.

Required behavior:

- syncing an already-known document version/text update must emit a change event
- opening a document may continue to populate the mirror without forcing extra change semantics beyond what current consumers need
- closing a document must keep existing close semantics, without inventing unrelated cache rules

The important boundary is:

**runtime document state and runtime document-change events must stay aligned.**

### 3. `DefinitionResolverSupport` keeps invalidation logic, not event ownership

`DefinitionResolverSupport` must continue to own only its current cache invalidation rules:

- `.h` change invalidates `headerFunctionCache`
- `.h` change invalidates dependent `includeFileCache` entries
- non-header change invalidates only that file’s include cache entry

This package does **not** move those rules elsewhere.

Instead, it ensures the production event path that `DefinitionResolverSupport` already subscribes to is actually exercised in server runtime.

### 4. Lifecycle ownership stays narrow in this package

Listener disposal and broader multi-instance lifecycle management are real follow-up concerns, but they are not solved here.

This package is limited to event closure:

- no new public `dispose()` APIs are required
- no new owner graph is introduced
- no broader service lifecycle refactor is bundled into this change

## Data Flow

### Open / change path

1. LSP `didOpen` / `didChange` arrives in `registerCapabilities`
2. `DocumentStore` receives the new full text
3. runtime text mirror is updated through `__syncTextDocument(...)`
4. runtime text-change event is emitted for the synced document
5. production navigation subscribers such as `DefinitionResolverSupport` observe the change
6. relevant definition caches are invalidated
7. next definition request rebuilds from current text/dependencies

### Close path

1. LSP `didClose` arrives in `registerCapabilities`
2. `DocumentStore` drops the document
3. runtime text mirror is updated through `__closeTextDocument(...)`
4. existing close semantics remain intact

This package does not add additional close-triggered cache semantics beyond the current design.

## Failure Semantics

- if server-side document sync updates the runtime text mirror but does not emit a change event, that is a bug in this package
- cache invalidation rules themselves must remain unchanged
- no new fallback path may bypass the existing `host.onDidChangeTextDocument(...)` subscription model
- spawned-runtime regression must use the real server bundle path, not only handler-level mocks

## Testing

### Runtime event-path tests

Add or extend low-level runtime tests so they prove:

- a synced document update results in the expected runtime change notification path
- the runtime text mirror and emitted document reference stay aligned

### Definition cache invalidation integration

Add a spawned-runtime regression that proves a real definition request refreshes after editing a dependency, for example:

- open a source file that resolves through include/header-backed definition state
- warm the definition result
- change the dependency text
- request definition again
- observe refreshed result rather than stale cache reuse

### Existing contract preservation

Keep the existing `DefinitionResolverSupport` invalidation tests green without changing their semantics:

- header invalidation
- dependent include invalidation
- non-header file invalidation

### Verification set

Implementation and execution must keep the following green:

- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`
- `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
- `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`
- `npx tsc --noEmit`
- `npm test -- --runInBand`

## Acceptance Criteria

- server-side document sync drives the runtime change notification path observed by definition cache invalidation
- `DefinitionResolverSupport` cache invalidation rules remain unchanged
- spawned runtime includes at least one regression proving edited definition dependencies invalidate caches
- no definition / hover / references / rename matching semantics change as part of this package
