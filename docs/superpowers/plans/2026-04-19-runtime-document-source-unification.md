# Runtime Document Source Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `DocumentStore` the single mutable source for synchronized LSP text while preserving current runtime behavior.

**Architecture:** Keep `vscodeShim` as the VS Code compatibility facade, but stop letting it own a second mutable synchronized-document store. Split synchronized-document projection from readonly disk-opened documents, and reuse shared path/URI helpers where possible.

**Tech Stack:** TypeScript, Jest, LSP runtime shims, server bootstrap/document lifecycle wiring

---

## File Map

### New files

- None required if the unification fits inside existing runtime files.
- Optional small runtime helper only if a runtime-specific projection helper is genuinely needed and cannot live in `serverPathUtils.ts`.

### Modified files

- `src/lsp/server/runtime/vscodeShim.ts`
  - Remove the second mutable synchronized-document store and turn synced docs into a projection/view.
- `src/lsp/server/runtime/DocumentStore.ts`
  - Only if needed for iteration/projection support; keep it as the single mutable owner.
- `src/lsp/server/bootstrap/registerCapabilities.ts`
  - Keep lifecycle wiring stable while updating sync semantics.
- `src/lsp/server/runtime/serverPathUtils.ts`
  - Reuse shared path helpers instead of keeping duplicates in `vscodeShim.ts`.
- `src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts`
  - Lock runtime bridge behavior against the new projection model.
- `src/lsp/server/__tests__/DocumentStore.test.ts`
  - Add any needed projection/iteration support tests.
- `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`
  - Ensure projected text remains visible through runtime contexts.
- `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
  - Keep spawned runtime behavior stable after the unification.

## Chunk 1: Lock the runtime projection behavior with failing tests

### Task 1: Add failing tests for synchronized document projection

**Files:**
- Modify: `src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts`
- Modify: `src/lsp/server/__tests__/DocumentStore.test.ts` (only if extra store surface is needed)

- [ ] **Step 1: Write failing tests for the new source-of-truth rule**

Cover at least:
- synchronized docs visible through `workspace.textDocuments` are sourced from `DocumentStore`
- `didChange` refreshes the projected text/version without maintaining a second mutable copy
- synced docs disappear from `workspace.textDocuments` after `didClose`
- readonly disk-opened docs still remain available independently

- [ ] **Step 2: Run the focused runtime bridge tests to confirm failure**

Run:
```bash
npx jest --runInBand src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/__tests__/DocumentStore.test.ts
```

Expected: FAIL because the runtime still keeps a duplicated synchronized-document map.

- [ ] **Step 3: Commit the red tests if useful for checkpointing**

```bash
git add src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/__tests__/DocumentStore.test.ts
git commit -m "test(runtime): lock document source unification"
```

## Chunk 2: Unify synchronized-document ownership

### Task 2: Make `DocumentStore` the single mutable owner for synced text

**Files:**
- Modify: `src/lsp/server/runtime/vscodeShim.ts`
- Modify: `src/lsp/server/runtime/DocumentStore.ts` (only if minimal read-side support is needed)
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`

- [ ] **Step 1: Refactor `vscodeShim` so synced docs are a projection, not a second store**

Do all of the following:
- separate synchronized documents from readonly disk-opened documents
- stop storing synchronized text in an independent mutable `textDocuments` map
- keep `workspace.textDocuments` returning the union projection of synced + readonly docs

- [ ] **Step 2: Reuse shared path helpers**

Remove duplicated runtime copies of:
- `fromFileUri(...)`
- longest-prefix workspace-root matching logic

Reuse `serverPathUtils.ts` where possible.

- [ ] **Step 3: Keep lifecycle wiring behavior-stable**

`registerCapabilities.ts` should still:
- update `DocumentStore`
- refresh synced runtime projection
- emit runtime change events on `didChange`
- clear synced projection on `didClose`

- [ ] **Step 4: Run focused runtime bridge regressions**

Run:
```bash
npx jest --runInBand src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lsp/server/runtime/vscodeShim.ts src/lsp/server/runtime/DocumentStore.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/runtime/serverPathUtils.ts src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts
git commit -m "refactor(runtime): unify synchronized document ownership"
```

## Chunk 3: Validate runtime and spawned-server behavior

### Task 3: Re-run handler/runtime regressions

**Files:**
- Modify tests only if assertions need to reflect projection wording rather than duplicated map semantics

- [ ] **Step 1: Run handler/runtime regression pack**

Run:
```bash
npx jest --runInBand src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
```

Expected: PASS

- [ ] **Step 2: Run typecheck and full repository verification**

Run:
```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS

- [ ] **Step 3: Commit any final guard/test stabilization if needed**

```bash
git add src/lsp/server/__tests__/documentSyncRuntimeBridge.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
git commit -m "test(runtime): verify unified document source behavior"
```
