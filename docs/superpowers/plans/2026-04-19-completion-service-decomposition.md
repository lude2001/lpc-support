# Completion Service Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `QueryBackedLanguageCompletionService` into focused collaborators while preserving all current completion behavior.

**Architecture:** Keep `CompletionQueryEngine`, `ProjectSymbolIndex`, and `ScopedMethodCompletionSupport` as existing building blocks. Introduce one collaborator for inherited index/document loading, one for candidate resolution, and one for item presentation/resolve, then reduce `QueryBackedLanguageCompletionService` to a coordinator that wires them together.

**Tech Stack:** TypeScript, Jest, VS Code API shims, existing completion/query/index infrastructure

---

## File Map

### New files

- `src/language/services/completion/CompletionInheritedIndexService.ts`
  - Owns inherited index refresh, recursive inherit indexing, and readonly document loading for completion.
- `src/language/services/completion/CompletionCandidateResolver.ts`
  - Owns inherited fallback expansion, member candidate resolution, and candidate merge behavior.
- `src/language/services/completion/CompletionItemPresentationService.ts`
  - Owns completion item creation, sort metadata, snippets, and resolve-time documentation materialization.
- `src/language/services/completion/__tests__/CompletionInheritedIndexService.test.ts`
  - Protects inherited index refresh and readonly document loading behavior.
- `src/language/services/completion/__tests__/CompletionCandidateResolver.test.ts`
  - Protects fallback candidate expansion, member resolution, and merge semantics.
- `src/language/services/completion/__tests__/CompletionItemPresentationService.test.ts`
  - Protects item creation, documentation attachment, and resolve behavior.

### Modified files

- `src/language/services/completion/LanguageCompletionService.ts`
  - Reduced to request orchestration, collaborator wiring, and cache/reporting coordination.
- `src/language/services/completion/__tests__/LanguageCompletionService.test.ts`
  - Migrate away from spying on service-private presentation helpers.
- `src/__tests__/providerIntegration.test.ts`
  - Keep user-visible completion behavior fixed during the refactor.
- `src/lsp/server/__tests__/completionHandler.test.ts`
  - Keep handler wiring stable while the completion service internals change.
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
  - Only if constructor signatures need to pass new collaborators explicitly.
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
  - Add guard expectations so `LanguageCompletionService` no longer owns readonly document/index helper machinery directly.

---

## Chunk 1: Extract inherited index and readonly document loading

### Task 1: Add failing unit tests for inherited index ownership

**Files:**
- Create: `src/language/services/completion/__tests__/CompletionInheritedIndexService.test.ts`
- Reference: `src/language/services/completion/LanguageCompletionService.ts`

- [ ] **Step 1: Write failing tests for inherited index refresh and readonly document loading**

Cover at least:
- `refreshInheritedIndex(...)` updates `ProjectSymbolIndex` from the current document snapshot
- recursive inherit indexing uses already-open documents before disk fallback
- missing inherited files do not throw and simply stop expansion

- [ ] **Step 2: Run the focused test file to confirm failure**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/CompletionInheritedIndexService.test.ts
```

Expected: FAIL because `CompletionInheritedIndexService` does not exist yet.

- [ ] **Step 3: Implement `CompletionInheritedIndexService`**

Create:
- `src/language/services/completion/CompletionInheritedIndexService.ts`

Move these responsibilities out of `LanguageCompletionService`:
- `warmInheritedIndex(...)`
- `refreshInheritedIndex(...)`
- `indexMissingInheritedSnapshots(...)`
- `loadSnapshotFromUri(...)`
- `getOpenDocument(...)`
- `normalizeFilePath(...)`
- `createReadonlyDocumentFromUri(...)`
- `createReadonlyDocument(...)`
- `getDocumentForUri(...)`
- `getBestAvailableIndexSnapshot(...)`
- `getIndexSnapshot(...)`

Constructor should explicitly take:
- `analysisService`
- `projectSymbolIndex`
- `inheritanceReporter`

Do not introduce new global infrastructure.

- [ ] **Step 4: Run the focused unit tests**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/CompletionInheritedIndexService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/completion/CompletionInheritedIndexService.ts src/language/services/completion/__tests__/CompletionInheritedIndexService.test.ts
git commit -m "refactor(completion): extract inherited index service"
```

### Task 2: Wire `LanguageCompletionService` to the inherited index collaborator

**Files:**
- Modify: `src/language/services/completion/LanguageCompletionService.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Test: `src/lsp/server/__tests__/completionHandler.test.ts`

- [ ] **Step 1: Update `LanguageCompletionService` to consume `CompletionInheritedIndexService`**

Keep public behavior unchanged.

`LanguageCompletionService` should stop owning inherited index recursion and readonly document helpers directly.

- [ ] **Step 2: Add/adjust regression coverage**

Update existing tests so they still prove:
- inherited completion fallback works
- handler-backed completion still resolves against live document context
- provider integration remains unchanged

- [ ] **Step 3: Run focused regressions**

Run:
```bash
npx jest --runInBand src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/completionHandler.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/language/services/completion/LanguageCompletionService.ts src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/completionHandler.test.ts
git commit -m "refactor(completion): delegate inherited index management"
```

## Chunk 2: Extract candidate resolution

### Task 3: Add failing unit tests for candidate resolution

**Files:**
- Create: `src/language/services/completion/__tests__/CompletionCandidateResolver.test.ts`
- Reference: `src/language/services/completion/LanguageCompletionService.ts`

- [ ] **Step 1: Write failing tests for candidate resolution**

Cover at least:
- inherited fallback candidates append without duplicating existing labels
- object-member candidates rank shared implementations ahead of specific duplicates
- scoped completion path returns only scoped candidates and bypasses object inference merge
- member path merges object-member candidates with fallback candidates only when appropriate

- [ ] **Step 2: Run test to verify failure**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/CompletionCandidateResolver.test.ts
```

Expected: FAIL because `CompletionCandidateResolver` does not exist yet.

- [ ] **Step 3: Implement `CompletionCandidateResolver`**

Create:
- `src/language/services/completion/CompletionCandidateResolver.ts`

Move these methods from `LanguageCompletionService`:
- `resolveCompletionCandidates(...)`
- `appendInheritedFallbackCandidates(...)`
- `buildObjectMemberCandidates(...)`
- `collectObjectFunctions(...)`
- `mergeCandidatesByLabel(...)`

Constructor should explicitly take:
- `projectSymbolIndex`
- `objectInferenceService`
- `scopedMethodDiscoveryService`
- `completionInheritedIndexService`

- [ ] **Step 4: Run the focused unit tests**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/CompletionCandidateResolver.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/completion/CompletionCandidateResolver.ts src/language/services/completion/__tests__/CompletionCandidateResolver.test.ts
git commit -m "refactor(completion): extract candidate resolver"
```

### Task 4: Rewire `LanguageCompletionService` to use the candidate resolver

**Files:**
- Modify: `src/language/services/completion/LanguageCompletionService.ts`
- Test: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Replace inlined candidate logic with collaborator calls**

Keep:
- request tracing
- queryEngine invocation
- cancellation handling

Remove direct ownership of candidate merge and object-member expansion.

- [ ] **Step 2: Re-run provider integration regressions**

Run:
```bash
npx jest --runInBand src/__tests__/providerIntegration.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/language/services/completion/LanguageCompletionService.ts src/__tests__/providerIntegration.test.ts
git commit -m "refactor(completion): delegate candidate expansion"
```

## Chunk 3: Extract item presentation and resolve

### Task 5: Add failing tests for item presentation

**Files:**
- Create: `src/language/services/completion/__tests__/CompletionItemPresentationService.test.ts`
- Modify: `src/language/services/completion/__tests__/LanguageCompletionService.test.ts`

- [ ] **Step 1: Write failing tests for presentation behavior**

Cover at least:
- completion item creation keeps kind/detail/sort/data shape stable
- resolve attaches efun docs
- resolve attaches macro docs
- resolve delegates scoped docs through `ScopedMethodCompletionSupport`
- structured docs still materialize from `ProjectSymbolIndex`

Also update `LanguageCompletionService.test.ts` so it stops spying on service-private `applyStructuredDocumentation(...)`.
It should instead validate:
- externally visible resolved documentation
- or direct collaborator behavior

- [ ] **Step 2: Run the targeted tests to confirm failure**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/CompletionItemPresentationService.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts
```

Expected: FAIL because the presentation service does not exist yet.

- [ ] **Step 3: Implement `CompletionItemPresentationService`**

Create:
- `src/language/services/completion/CompletionItemPresentationService.ts`

Move these methods from `LanguageCompletionService`:
- `createCompletionItem(...)`
- `resolveCompletionItem(...)`
- `mapCompletionKind(...)`
- `getSortPrefix(...)`
- `getCandidateSortBucket(...)`
- `applyEfunDocumentation(...)`
- `applyMacroDocumentation(...)`
- `applyStructuredDocumentation(...)`
- `applyKeywordDocumentation(...)`
- `buildFunctionSnippet(...)`
- `findMemberDefinition(...)`

Keep `ScopedMethodCompletionSupport` as a dependency, not as logic to inline.

- [ ] **Step 4: Run the focused presentation tests**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/CompletionItemPresentationService.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/completion/CompletionItemPresentationService.ts src/language/services/completion/__tests__/CompletionItemPresentationService.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts
git commit -m "refactor(completion): extract item presentation service"
```

### Task 6: Reduce `LanguageCompletionService` to a coordinator

**Files:**
- Modify: `src/language/services/completion/LanguageCompletionService.ts`
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts` (only if constructor wiring changes)
- Test: `src/lsp/server/__tests__/completionHandler.test.ts`
- Test: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Keep only orchestration in `QueryBackedLanguageCompletionService`**

After this step it should own:
- request setup
- queryEngine call
- collaborator invocation
- cache/reporter lifecycle methods

It should no longer own readonly document loading, candidate expansion, or documentation materialization directly.

- [ ] **Step 2: Update production wiring only as needed**

Do not add new runtime registries or singleton bridges.

- [ ] **Step 3: Run focused regressions**

Run:
```bash
npx jest --runInBand src/lsp/server/__tests__/completionHandler.test.ts src/__tests__/providerIntegration.test.ts
```

Expected: PASS

- [ ] **Step 4: Update architectural guard**

Modify:
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

Add checks proving `LanguageCompletionService` no longer contains:
- readonly document creation helpers
- inherited index recursion helpers
- direct structured documentation materialization helpers

- [ ] **Step 5: Run guard and typecheck**

Run:
```bash
npx jest --runInBand src/__tests__/documentAnalysisOwnershipGuard.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/language/services/completion/LanguageCompletionService.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/__tests__/completionHandler.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "refactor(completion): reduce completion service to coordinator"
```

## Chunk 4: Final verification and closeout

### Task 7: Run completion-focused regression pack

**Files:**
- Test-only verification

- [ ] **Step 1: Run the completion and integration regression pack**

Run:
```bash
npx jest --runInBand src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/language/services/completion/__tests__/CompletionInheritedIndexService.test.ts src/language/services/completion/__tests__/CompletionCandidateResolver.test.ts src/language/services/completion/__tests__/CompletionItemPresentationService.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/completionHandler.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
```

Expected: PASS

- [ ] **Step 2: Run full repository verification**

Run:
```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS

- [ ] **Step 3: Commit final test or guard adjustments if needed**

```bash
git add src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "test(completion): lock decomposed completion architecture"
```

Plan complete and saved to `docs/superpowers/plans/2026-04-19-completion-service-decomposition.md`. Ready to execute?
