# Inherited Symbol Relation Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `InheritedSymbolRelationService` into a thin façade plus focused function/file-global relation units without changing references or rename behavior.

**Architecture:** First extract function-relation logic into a dedicated service while preserving the existing façade API and references behavior. Then extract file-global binding/reference logic into a second service, add direct `classifyRenameTarget(...)` coverage, and finally shrink the façade into a coordinator that only dispatches between the two relation services and assembles rename edits.

**Tech Stack:** TypeScript, Jest, VS Code API-compatible shims, navigation services, `ASTManager`, `InheritanceResolver`, `ScopedMethodResolver`, `symbolReferenceResolver`

---

## File Map

### Create

- `src/language/services/navigation/InheritedFunctionRelationService.ts`
  - owns function family discovery plus scoped-function reference collection across provable inherit chains
- `src/language/services/navigation/InheritedFileGlobalRelationService.ts`
  - owns file-global binding resolution, inherited file-global reference collection, and file-global rename expansion inputs
- `src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts`
  - direct unit coverage for function-family and scoped reference behavior
- `src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts`
  - direct unit coverage for file-global binding and inherited file-global reference behavior
- `docs/superpowers/plans/2026-04-19-inherited-symbol-relation-decomposition.md`
  - this implementation plan

### Modify

- `src/language/services/navigation/InheritedSymbolRelationService.ts`
  - shrink into façade / coordinator and keep public API stable
- `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`
  - preserve façade behavior and add direct `classifyRenameTarget(...)` coverage
- `src/language/services/navigation/__tests__/navigationServices.test.ts`
  - keep references / rename consumer semantics stable if any seam wiring changes
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
  - keep production wiring assertions stable if constructor injection shape changes

### Keep Unchanged

- `src/language/services/navigation/LanguageReferenceService.ts`
- `src/language/services/navigation/LanguageRenameService.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/objectInference/**`
- `src/lsp/server/runtime/vscodeShim.ts`

---

## Chunk 1: Extract Function Relation Logic

### Task 1: Add direct failing tests for function-family and scoped reference behavior

**Files:**
- Create: `src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts`
- Modify: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Write failing tests for the extracted function relation boundary**

Create `src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts` with focused cases that mirror existing façade behavior:

```ts
test('collects provable inherit-family function references from visible symbols', async () => {
    // current file + inherited implementation + scoped ::call
});

test('ignores scoped calls when room:: qualifier is not unique', async () => {
    // scoped resolver returns multiple => no scoped matches
});

test('returns unresolved when direct inherit seeds are not fully resolved', async () => {
    // unresolved inherit chain => no family expansion
});
```

Rules:
- do not re-test rename here
- keep tests host-agnostic and use the same text-document helpers already used in `InheritedSymbolRelationService.test.ts`

- [ ] **Step 2: Run the new function-relation tests to verify they fail**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts
```

Expected:
- FAIL because `InheritedFunctionRelationService` does not exist yet

- [ ] **Step 3: Preserve façade-level function reference coverage**

Keep the existing function-reference cases in `InheritedSymbolRelationService.test.ts`, but trim them to façade behavior only:
- façade dispatches through the extracted function relation service
- returned matches remain unchanged

Do not remove existing assertions about:
- provable inherit-family references
- scoped qualifier ambiguity
- unresolved inherit contraction
- four-slash Windows URI canonicalization

- [ ] **Step 4: Do not commit test-only red state**

Expected:
- no commit yet

### Task 2: Implement `InheritedFunctionRelationService` and rewire façade references

**Files:**
- Create: `src/language/services/navigation/InheritedFunctionRelationService.ts`
- Modify: `src/language/services/navigation/InheritedSymbolRelationService.ts`
- Test: `src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts`
- Test: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Implement the minimal `InheritedFunctionRelationService`**

Create `src/language/services/navigation/InheritedFunctionRelationService.ts` and move in the function-side logic:

```ts
export class InheritedFunctionRelationService {
    public async collectFunctionReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<InheritedReferenceMatch[]> { ... }
}
```

Move or adapt these methods into the new class:
- `resolveFunctionFamilyFromVisibleSymbol(...)`
- `resolveFunctionFamilyFromScopedCall(...)`
- `collectInheritedFunctionFamilyDocuments(...)`
- `collectFunctionFamilyMatches(...)`
- `collectLocalFunctionMatches(...)`
- `collectScopedFunctionMatches(...)`
- `findGlobalFunctionSymbol(...)`
- `collectCallExpressions(...)`
- `getScopedMethodRange(...)`

Keep as local/file helpers rather than inventing a new shared support class:
- `getWordAtPosition(...)`
- `pushUniqueMatch(...)`
- `toVsCodePosition(...)`
- `normalizeWorkspaceUri(...)`

- [ ] **Step 2: Rewire `InheritedSymbolRelationService` to delegate function references**

Modify `InheritedSymbolRelationService.ts` so that:
- constructor creates one `InheritedFunctionRelationService`
- `collectInheritedReferences(...)` first asks the function relation service
- if function relation returns matches, façade returns them
- façade still owns the public dispatch order

Rules:
- do not touch file-global behavior yet
- do not change the public constructor signature

- [ ] **Step 3: Run the function-focused regression set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Commit the function relation extraction**

Run:

```bash
git add src/language/services/navigation/InheritedFunctionRelationService.ts src/language/services/navigation/InheritedSymbolRelationService.ts src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts
git commit -m "refactor(navigation): extract inherited function relation service"
```

---

## Chunk 2: Extract File-Global Relation Logic

### Task 3: Add direct failing tests for file-global binding resolution and rename-target classification

**Files:**
- Create: `src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts`
- Modify: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Write failing tests for file-global relation logic**

Create `src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts` with focused cases like:

```ts
test('resolves a visible inherited file-global binding across a single provable branch', async () => {
    // returns resolved binding + pathDocuments
});

test('marks sibling branches with the same file-global as ambiguous', async () => {
    // sibling definitions => ambiguous
});

test('does not expand file-global references when inherit traversal is unresolved', async () => {
    // unresolved inherit => unresolved/empty
});

test('returns none when no local or inherited file-global binding can be proven', async () => {
    // same-name token with no provable binding => none
});

test('collects only matches that still resolve to the same binding owner', async () => {
    // second-pass binding verification filters same-name impostors
});
```

- [ ] **Step 2: Add direct `classifyRenameTarget(...)` coverage to the façade tests**

Extend `InheritedSymbolRelationService.test.ts` with direct assertions for:

```ts
test('classifyRenameTarget returns current-file-only for local variables and parameters', async () => { ... });
test('classifyRenameTarget returns unsupported for functions and struct/class symbols', async () => { ... });
test('classifyRenameTarget returns file-global for current-file global variables', async () => { ... });
test('classifyRenameTarget returns file-global for provable inherited globals', async () => { ... });
test('collectInheritedReferences falls through to file-global matches when function/scoped paths miss', async () => { ... });
test('buildInheritedRenameEdits returns inherited edits for a proved file-global success path', async () => { ... });
```

Rules:
- these tests should exercise the real façade method, not only consumer-level rename service behavior
- keep current `buildInheritedRenameEdits(...)` ambiguity regression in place alongside the new success-path assertion

- [ ] **Step 3: Run the file-global test set to verify red state**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts
```

Expected:
- FAIL because `InheritedFileGlobalRelationService` does not exist yet

- [ ] **Step 4: Do not commit the red state**

Expected:
- no commit yet

### Task 4: Implement `InheritedFileGlobalRelationService` and keep façade rename semantics frozen

**Files:**
- Create: `src/language/services/navigation/InheritedFileGlobalRelationService.ts`
- Modify: `src/language/services/navigation/InheritedSymbolRelationService.ts`
- Test: `src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts`
- Test: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Implement the minimal file-global relation service**

Create `src/language/services/navigation/InheritedFileGlobalRelationService.ts` with a focused API, for example:

```ts
export class InheritedFileGlobalRelationService {
    public async resolveVisibleBinding(...): Promise<FileGlobalBindingResolution> { ... }
    public async collectReferences(...): Promise<InheritedReferenceMatch[]> { ... }
}
```

Move or adapt these methods into the new class:
- `resolveVisibleFileGlobalBinding(...)`
- `resolveBranchGlobalOwner(...)`
- `collectFileGlobalMatches(...)`
- `findFileGlobalSymbol(...)`
- `rangesEqual(...)`

Keep the existing state machine semantics unchanged:
- `resolved`
- `ambiguous`
- `unresolved`
- `none`

- [ ] **Step 2: Rewire façade references and rename around the new service**

Modify `InheritedSymbolRelationService.ts` so that:
- `collectInheritedReferences(...)` falls through to file-global relation only after the function-relation path misses
- `classifyRenameTarget(...)` uses the extracted file-global relation service for inherited global fallback
- `buildInheritedRenameEdits(...)` asks the extracted file-global relation service for binding + matches, then assembles edits in façade

Rules:
- do not create a separate rename builder class in this iteration
- façade keeps edit assembly so the public behavior stays easy to audit

- [ ] **Step 3: Run the file-global regression set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Commit the file-global extraction**

Run:

```bash
git add src/language/services/navigation/InheritedFileGlobalRelationService.ts src/language/services/navigation/InheritedSymbolRelationService.ts src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(navigation): extract inherited file-global relation service"
```

---

## Chunk 3: Shrink the Façade and Re-verify Production Wiring

### Task 5: Remove migrated private logic from the façade and keep constructor seams stable

**Files:**
- Modify: `src/language/services/navigation/InheritedSymbolRelationService.ts`
- Modify: `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`

- [ ] **Step 1: Delete dead private methods from the façade**

After the two extracted services are in place, reduce `InheritedSymbolRelationService.ts` so it keeps only:
- public constructor
- `collectInheritedReferences(...)`
- `classifyRenameTarget(...)`
- `buildInheritedRenameEdits(...)`
- the thinnest possible local helper layer (`getWordAtPosition`, `pushUniqueMatch`, `toVsCodePosition`) if still needed

Everything else migrated in previous chunks should be removed from the façade file.

- [ ] **Step 2: Keep production wiring tests stable**

Run or update `createProductionLanguageServices.test.ts` only if constructor injection shape changes internally. The public runtime seam must remain:

```ts
const inheritedRelationService = new InheritedSymbolRelationService(...)
const referenceService = new AstBackedLanguageReferenceService({ inheritedRelationService })
const renameService = new AstBackedLanguageRenameService({ inheritedRelationService })
```

No change is expected in the consumer wiring contract.

- [ ] **Step 3: Run the façade and runtime wiring regression set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Commit the façade closeout**

Run:

```bash
git add src/language/services/navigation/InheritedSymbolRelationService.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(navigation): thin inherited symbol relation facade"
```

### Task 6: Run full verification before handoff

**Files:**
- Modify: none unless verification reveals issues

- [ ] **Step 1: Run the focused navigation/runtime verification set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run type-check**

Run:

```bash
npx tsc --noEmit
```

Expected:
- exit code 0

- [ ] **Step 3: Run the full suite**

Run:

```bash
npm test -- --runInBand
```

Expected:
- PASS

- [ ] **Step 4: Commit only if verification required follow-up fixes**

Run only if additional verification fixes were needed:

```bash
git add <relevant-files>
git commit -m "test(navigation): finalize inherited relation decomposition"
```

---

## Chunk Review Checklist

For each chunk above, run the writing-plans review loop before execution handoff:

- `## Chunk 1`
  - review for extraction order and resolver boundary correctness
- `## Chunk 2`
  - review for file-global state-machine preservation and rename safety
- `## Chunk 3`
  - review for façade thinness, unchanged consumer seam, and verification completeness

Reviewers should explicitly reject:
- re-introducing a wide support/generic graph layer
- splitting into more than the planned two business relation services unless a real code fact forces it
- any relaxation of current references / rename semantics

---

Plan complete and saved to `docs/superpowers/plans/2026-04-19-inherited-symbol-relation-decomposition.md`. Ready to execute?
