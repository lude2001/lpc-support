# Navigation Runtime Cache Invalidation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the server-runtime event gap so document changes invalidate definition caches through the same production event path that navigation services already subscribe to.

**Architecture:** Keep `__syncTextDocument(...)` as a text-mirror helper and make `registerCapabilities` explicitly own runtime change-event emission on `didChange` only. First prove the low-level event bridge with a dedicated runtime test, then add a spawned-runtime definition regression that warms a cached include/header definition, edits the dependency, and proves the next definition request refreshes through the real server bundle path.

**Tech Stack:** TypeScript, Jest, VS Code shim runtime, LSP server bootstrap, spawned runtime integration tests, navigation definition services

---

## File Map

### Create

- `src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts`
  - low-level proof that `registerCapabilities` + runtime sync drive the expected text-document change event contract
- `docs/superpowers/plans/2026-04-19-navigation-runtime-cache-invalidation.md`
  - this implementation plan

### Modify

- `src/lsp/server/bootstrap/registerCapabilities.ts`
  - keep `DocumentStore` updates unchanged, but make `didChange` explicitly emit the runtime text-change event after sync
- `src/lsp/server/runtime/vscodeShim.ts`
  - add the narrow internal helper(s) needed to emit a runtime document-change notification against the post-sync mirror
- `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
  - add a real server-bundle regression proving definition cache refresh after dependency edits

### Verification-Only (do not modify unless implementation truly forces it)

- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
- `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`

### Keep Unchanged

- `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/language/services/navigation/InheritedSymbolRelationService.ts`
- `src/lsp/server/runtime/DocumentStore.ts`
- `src/lsp/server/runtime/ServerLanguageContextFactory.ts`

---

## Chunk 1: Runtime Change Event Bridge

All Chunk 1 work continues from:

```bash
D:\code\lpc-support\.worktrees\definition-closeout
```

### Task 1: Capture the runtime bridge baseline

**Files:**
- Modify: none

- [ ] **Step 1: Confirm the worktree is clean before implementation**

Run:

```bash
git status --short
```

Expected:
- no output

- [ ] **Step 2: Run the current low-level/runtime baseline**

Run:

```bash
npx jest --runInBand src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts
```

Expected:
- PASS
- this freezes the current runtime/bootstrap behavior before the bridge work begins

- [ ] **Step 3: Do not commit baseline-only work**

Expected:
- no commit yet

### Task 2: Add the low-level bridge test and implement explicit `didChange` event emission

**Files:**
- Create: `src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts`
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Modify: `src/lsp/server/runtime/vscodeShim.ts`

- [ ] **Step 1: Write the failing runtime bridge tests**

Create `src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts` with direct cases for:

```ts
test('didOpen syncs the runtime mirror without emitting an extra change event', async () => { ... });
test('didChange emits a runtime text-document change event after syncing the latest text/version', async () => { ... });
test('the emitted change event observes the post-sync runtime document, not stale text', async () => { ... });
```

Rules:
- drive the real `registerCapabilities(...)` open/change handlers through a fake connection
- subscribe through the runtime `workspace.onDidChangeTextDocument` surface, not a private seam
- assert on uri + latest version/text view seen by the emitted document
- keep this suite focused on the event bridge, not on definition lookup yet
- use unique document URIs per test case and dispose runtime listeners inside each test

- [ ] **Step 2: Run the new bridge suite to verify it fails**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts
```

Expected:
- FAIL because the current runtime sync path does not yet explicitly bridge `didChange` into the runtime change event

- [ ] **Step 3: Add a narrow runtime event-emission helper in `vscodeShim.ts`**

Modify `src/lsp/server/runtime/vscodeShim.ts` so that it exports the smallest internal helper needed for the bridge, for example:

```ts
export function __emitTextDocumentChanged(uri: string): void { ... }
```

Rules:
- `__syncTextDocument(...)` remains mirror-only
- emit against the already-synced runtime document currently stored in `textDocuments`
- do not add open/change semantic branching inside `__syncTextDocument(...)`
- do not redesign `workspace.onDidChangeTextDocument`

- [ ] **Step 4: Make `registerCapabilities.ts` explicitly emit on `didChange` only**

Modify `src/lsp/server/bootstrap/registerCapabilities.ts` so that:
- `didOpen` still updates `DocumentStore` + runtime text mirror and does **not** emit a change event
- `didChange` updates `DocumentStore`, syncs the runtime mirror, and then explicitly emits the runtime change event
- `didClose` keeps current close behavior unchanged

Rules:
- keep diagnostics refresh behavior unchanged
- do not change handler registration or capability advertisement
- do not move event ownership into navigation services

- [ ] **Step 5: Run the runtime bridge and runtime/bootstrap verification set**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit the runtime bridge**

Run:

```bash
git add src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/runtime/vscodeShim.ts
git commit -m "fix(lsp): bridge didChange into runtime document events"
```

---

## Chunk 2: Spawned Definition Cache Refresh

All Chunk 2 work continues from:

```bash
D:\code\lpc-support\.worktrees\definition-closeout
```

### Task 3: Add a spawned-runtime regression proving definition cache refresh after dependency edits

**Files:**
- Modify: `src/lsp/__tests__/spawnedRuntime.integration.test.ts`

- [ ] **Step 1: Write the failing spawned-runtime regression**

Extend `src/lsp/__tests__/spawnedRuntime.integration.test.ts` with a real server-bundle scenario like:

```ts
test('definition refreshes after editing an included header dependency', async () => {
    // create workspace with source + header
    // open source + header documents
    // warm definition once from source call site
    // change header text so the declaration range/line moves
    // request definition again from the same source call site
    // expect the updated location, not the stale cached one
});
```

Rules:
- use a source/header pattern that exercises `DefinitionResolverSupport` include/header caches
- open the dependency document before sending `didChange`
- assert the first warmed definition result before editing the dependency
- prove refreshed location using a line/range change, not only changed text on disk
- keep the test in spawned runtime, not handler-only mocks

- [ ] **Step 2: Run the spawned-runtime suite to verify it fails if the bridge gap is still real**

Run:

```bash
npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- FAIL if the new regression exposes a remaining runtime invalidation gap
- otherwise PASS if Chunk 1 already fully closed the event path

- [ ] **Step 3: Make only the minimal follow-up adjustments required by the spawned regression**

If the spawned regression still fails after Chunk 1, only make the smallest fix needed in the already-touched runtime bridge files:

- `src/lsp/server/bootstrap/registerCapabilities.ts`
- `src/lsp/server/runtime/vscodeShim.ts`

Rules:
- do not change definition-matching semantics
- do not modify `DefinitionResolverSupport` invalidation rules
- do not widen this package into disposal/lifecycle redesign

- [ ] **Step 4: Re-run the spawned-runtime regression**

Run:

```bash
npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- PASS

### Task 4: Final verification and closeout

**Files:**
- Modify: none unless verification reveals a real defect

- [ ] **Step 1: Run TypeScript verification**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 2: Run the package verification set**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Run the full project suite**

Run:

```bash
npm test -- --runInBand
```

Expected:
- PASS

- [ ] **Step 4: Commit any final verification-only adjustments if needed**

Run:

```bash
git add src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/runtime/vscodeShim.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
git commit -m "test(lsp): lock runtime definition cache invalidation"
```

Only do this step if final verification required additional test-only edits after Task 3 or Task 4.
Do not stage unrelated production files here unless verification exposed a real defect that had to be fixed.

---

## Notes For Execution

- Keep `__syncTextDocument(...)` mirror-only; do not let it absorb open/change semantic branching.
- `registerCapabilities` owns the distinction between open and change semantics in this package.
- `didOpen` should not emit a runtime change event as part of this package.
- `didChange` must emit a runtime change event after the runtime text mirror has already been updated.
- Do not change `DefinitionResolverSupport` cache invalidation rules in this package.
- Do not pull listener disposal / owner lifecycle redesign into this implementation.
- Do not touch definition / hover / references / rename matching semantics.
