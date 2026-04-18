# Definition Closeout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the last definition-service cleanup debt by deleting stale scoped helper code, sharing scoped identifier hit-testing between definition and hover, and locking `DefinitionResolverSupport` cache invalidation behavior with direct tests.

**Architecture:** First add a narrow shared `ScopedMethodIdentifierSupport` helper and prove its cursor-hit semantics with direct tests. Then rewire scoped definition and hover to consume that single seam, delete the stale helpers from `LanguageDefinitionService`, and finally add cache invalidation tests for `DefinitionResolverSupport` while keeping definition and hover behavior unchanged.

**Tech Stack:** TypeScript, Jest, VS Code API-compatible shims, navigation services, `ASTManager`, scoped method resolution

---

## File Map

### Create

- `src/language/services/navigation/ScopedMethodIdentifierSupport.ts`
  - shared helper for scoped method identifier hit-testing and node lookup
- `src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts`
  - direct tests for bare/qualified scoped identifier detection and range behavior
- `docs/superpowers/plans/2026-04-19-definition-closeout.md`
  - this implementation plan

### Modify

- `src/language/services/navigation/LanguageDefinitionService.ts`
  - remove stale scoped helper residue and keep coordinator-only behavior
- `src/language/services/navigation/LanguageHoverService.ts`
  - switch scoped hover hit-testing to the shared helper
- `src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts`
  - switch scoped definition hit-testing to the shared helper
- `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
  - keep cache invalidation semantics unchanged
- `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts`
  - preserve scoped-definition handled-empty behavior and helper integration
- `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`
  - keep coordinator short-circuit behavior intact after dead helper removal
- `src/language/services/navigation/__tests__/navigationServices.test.ts`
  - preserve scoped hover behavior while moving hit-testing to the shared seam
- `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`
  - add direct cache invalidation coverage

### Keep Unchanged

- `src/language/services/navigation/InheritedSymbolRelationService.ts`
- `src/ast/astManager.ts`
- `src/completion/documentSemanticSnapshotService.ts`
- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- `src/lsp/server/runtime/**`

---

## Chunk 1: Shared Scoped Identifier Seam

### Task 1: Create an isolated worktree and capture the current closeout baseline

**Files:**
- Modify: none

- [ ] **Step 1: Create a dedicated worktree**

Run:

```bash
git worktree add .worktrees/definition-closeout -b codex/definition-closeout
```

Expected:
- worktree created at `D:\code\lpc-support\.worktrees\definition-closeout`
- branch `codex/definition-closeout` checked out there

- [ ] **Step 2: Confirm the worktree is clean**

Run:

```bash
git -C D:\code\lpc-support\.worktrees\definition-closeout status --short
```

Expected:
- no output

- [ ] **Step 3: Capture the current scoped definition/hover baseline**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected:
- PASS
- this is the frozen behavior baseline for the shared scoped helper migration

- [ ] **Step 4: Do not commit baseline-only work**

Expected:
- no commit yet

- [ ] **Step 5: Switch all subsequent Chunk 1 work into the worktree root**

Run all remaining commands in Chunk 1 from:

```bash
D:\code\lpc-support\.worktrees\definition-closeout
```

Expected:
- no subsequent edits or test runs in Chunk 1 happen from the main workspace root

### Task 2: Add failing shared-helper tests and implement `ScopedMethodIdentifierSupport`

**Files:**
- Create: `src/language/services/navigation/ScopedMethodIdentifierSupport.ts`
- Create: `src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts` with direct cases for:

```ts
test('finds the identifier node for bare ::create()', () => { ... });
test('finds the identifier node for qualified room::init()', () => { ... });
test('prefers the smallest containing scoped call when ranges nest', () => { ... });
test('returns undefined on qualifier and argument positions instead of the method identifier', () => { ... });
test('isOnScopedMethodIdentifier matches only the resolved method name', () => { ... });
test('returns undefined when no syntax document is available', () => { ... });
```

Rules:
- use real `ASTManager` + syntax documents
- do not mock the scoped helper internals
- keep the tests about cursor-hit semantics only, not definition lookup
- allow one narrowly scoped `ASTManager` seam only for the `no syntax document` case, if a real-input setup cannot reliably force that path

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts
```

Expected:
- FAIL because the helper file does not exist yet

- [ ] **Step 3: Implement `ScopedMethodIdentifierSupport.ts`**

Create `src/language/services/navigation/ScopedMethodIdentifierSupport.ts` with a small class or narrow utility surface equivalent to:

```ts
export class ScopedMethodIdentifierSupport {
    public findScopedMethodIdentifierAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): SyntaxNode | undefined { ... }

    public isOnScopedMethodIdentifier(
        document: vscode.TextDocument,
        position: vscode.Position,
        methodName: string
    ): boolean { ... }
}
```

Implementation rules:
- consume `ASTManager`
- support both bare `::method()` and qualified `room::method()`
- preserve current smallest-containing-range ordering semantics
- do not depend on `ScopedMethodResolver`
- do not load docs or resolve targets

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts
```

Expected:
- PASS

### Task 3: Rewire scoped definition to the shared helper and delete stale service helpers

**Files:**
- Modify: `src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts`
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Modify: `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts`
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

- [ ] **Step 1: Add a failing definition regression if needed**

If no existing assertion already locks it, add or tighten a regression in:

- `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts`
- or `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

The regression must explicitly preserve:

```ts
test('returns an empty handled result for scoped unknown or unsupported method-identifier positions', async () => { ... });
```

Rules:
- only add the test if current coverage does not already freeze the intended behavior
- do not weaken existing assertions

- [ ] **Step 2: Run the targeted definition tests to verify the new assertion fails when appropriate**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
```

Expected:
- FAIL if a new regression was added
- otherwise PASS and proceed because the behavior is already frozen by existing tests

- [ ] **Step 3: Rewire `ScopedMethodDefinitionResolver.ts` to use the shared helper**

Modify `src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts` so that:
- it no longer implements its own scoped identifier search helpers
- it consumes `ScopedMethodIdentifierSupport`
- it preserves current behavior:
  - resolved or multiple + identifier hit => target locations
  - unknown / unsupported + identifier hit => handled empty result
  - non-identifier positions => `undefined`

- [ ] **Step 4: Remove stale scoped helpers from `LanguageDefinitionService.ts`**

Delete the residual methods:

- `isOnScopedMethodIdentifier`
- `findScopedMethodIdentifierAtPosition`
- `getScopedMethodIdentifier`
- `getRangeSize`

Rules:
- keep `AstBackedLanguageDefinitionService` as coordinator only
- do not change the resolver short-circuit order
- do not move new logic back into the service

- [ ] **Step 5: Run definition-focused regressions**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/__tests__/providerIntegration.test.ts
```

Expected:
- PASS
- treat `src/__tests__/providerIntegration.test.ts` as verification-only unless the refactor truly forces a fixture update

- [ ] **Step 6: Commit the shared helper and definition cleanup**

Run:

```bash
git add src/language/services/navigation/ScopedMethodIdentifierSupport.ts src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "refactor(navigation): share scoped identifier detection"
```

---

## Chunk 2: Hover Reuse and Cache Safety Net

All Chunk 2 commands and edits continue from:

```bash
D:\code\lpc-support\.worktrees\definition-closeout
```

### Task 4: Rewire scoped hover to the shared helper

**Files:**
- Modify: `src/language/services/navigation/LanguageHoverService.ts`
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`

- [ ] **Step 1: Add a failing scoped hover regression if needed**

If existing coverage does not already lock it, add or tighten a regression in `src/language/services/navigation/__tests__/navigationServices.test.ts` for:

```ts
test('scoped hover stays empty for unknown or unsupported method-identifier positions', async () => { ... });
```

Also make sure qualifier and argument positions remain covered.

- [ ] **Step 2: Run the hover regression to verify it fails when appropriate**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected:
- FAIL if the new regression exposes a real gap
- otherwise PASS and proceed because the behavior was already preserved

- [ ] **Step 3: Rewire `LanguageHoverService.ts` to consume the shared helper**

Modify `src/language/services/navigation/LanguageHoverService.ts` so that:
- scoped hover hit-testing no longer duplicates identifier search helpers
- it uses `ScopedMethodIdentifierSupport`
- it preserves current behavior:
  - resolved or multiple + identifier hit => render scoped docs
  - unknown / unsupported + identifier hit => no hover
  - qualifier / argument / non-identifier positions => no scoped hover

- [ ] **Step 4: Run hover and navigation regressions**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
```

Expected:
- PASS

### Task 5: Add direct cache invalidation tests for `DefinitionResolverSupport`

**Files:**
- Modify: `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`
- Modify: `src/language/services/navigation/definition/DefinitionResolverSupport.ts` only if testability gaps force a tiny non-behavioral seam

- [ ] **Step 1: Write failing cache invalidation tests**

Extend `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts` with direct tests for:

```ts
test('header document changes invalidate headerFunctionCache', async () => { ... });
test('header document changes invalidate include cache entries that reference that header', async () => { ... });
test('non-header document changes invalidate only that file include cache entry', async () => { ... });
```

Rules:
- capture the `onDidChangeTextDocument` listener from the fake host and drive it directly
- warm the caches through public support APIs before firing the change event
- do not assert on private fields directly if public behavior can prove invalidation

- [ ] **Step 2: Run the support test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts
```

Expected:
- FAIL if the new tests expose a real gap or missing seam
- otherwise PASS if they correctly prove the existing invalidation contract

- [ ] **Step 3: Add the smallest non-behavioral seam only if the tests need one**

If direct public-API testing is insufficient, allow only a tiny seam such as:
- injecting a deterministic fake host
- exposing no new production behavior

Do **not**:
- change cache semantics
- add debug-only APIs
- move resolver branching into `DefinitionResolverSupport`

- [ ] **Step 4: Run the support test to verify it passes**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit hover reuse and cache tests**

Run:

```bash
git add src/language/services/navigation/LanguageHoverService.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts
git commit -m "test(navigation): lock definition closeout contracts"
```

If a tiny non-behavioral seam was required in `DefinitionResolverSupport.ts`, stage it explicitly before running the commit.

### Task 6: Final verification and closeout

**Files:**
- Modify: none unless verification reveals a defect

Run all Task 6 commands from:

```bash
D:\code\lpc-support\.worktrees\definition-closeout
```

- [ ] **Step 1: Run TypeScript verification**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 2: Run the closeout verification set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
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

- [ ] **Step 4: Commit final verification-only adjustments if any were needed**

Run:

```bash
git add src/language/services/navigation src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "test(navigation): preserve definition and hover closeout behavior"
```

Only do this step if verification required final test-only edits after Task 4 or Task 5.
Do not stage production files here unless final verification exposed a real defect that had to be fixed.

---

## Notes For Execution

- Keep `AstBackedLanguageDefinitionService` public API stable.
- Do not reintroduce scoped helper logic into `LanguageDefinitionService`.
- Do not let `ScopedMethodIdentifierSupport` grow into a resolver or doc-loader.
- Preserve the current handled-empty definition behavior for scoped method-identifier positions that resolve to `unknown` or `unsupported`.
- Preserve the current non-rendering hover behavior for scoped method-identifier positions that resolve to `unknown` or `unsupported`.
- Do not touch `InheritedSymbolRelationService`, `ASTManager`, `DocumentSemanticSnapshotService`, `SignatureHelp`, or runtime shim code in this plan.
