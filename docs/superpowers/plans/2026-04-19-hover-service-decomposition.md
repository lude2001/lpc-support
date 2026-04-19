# Hover Service Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `ObjectInferenceLanguageHoverService` into focused collaborators while preserving all current hover behavior.

**Architecture:** Keep `UnifiedLanguageHoverService` and `EfunLanguageHoverService` stable. Extract one collaborator for scoped hover resolution, one for object-method hover resolution, and one narrow support helper for documentation text-document normalization, then reduce `ObjectInferenceLanguageHoverService` to a coordinator.

**Tech Stack:** TypeScript, Jest, VS Code API shims, callable documentation services, object inference, scoped method resolution

---

## File Map

### New files

- `src/language/services/navigation/hover/ScopedMethodHoverResolver.ts`
  - Owns scoped identifier gating, scoped target doc loading, and scoped hover rendering.
- `src/language/services/navigation/hover/ObjectMethodHoverResolver.ts`
  - Owns object-inference hover resolution, method-doc aggregation, and multi-candidate rendering.
- `src/language/services/navigation/hover/HoverDocumentationSupport.ts`
  - Owns synthetic documentation document shims and related helper functions.
- `src/language/services/navigation/__tests__/ScopedMethodHoverResolver.test.ts`
  - Protects scoped hover gating and scoped doc rendering.
- `src/language/services/navigation/__tests__/ObjectMethodHoverResolver.test.ts`
  - Protects object-method hover resolution and merged hover rendering.
- `src/language/services/navigation/__tests__/HoverDocumentationSupport.test.ts`
  - Protects synthetic document shim behavior.

### Modified files

- `src/language/services/navigation/LanguageHoverService.ts`
  - Reduced to coordinator plus lightweight adapters.
- `src/language/services/navigation/__tests__/navigationServices.test.ts`
  - Keep user-visible hover behavior fixed during the refactor.
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
  - Keep handler wiring stable.
- `src/__tests__/providerIntegration.test.ts`
  - Preserve integration-visible hover behavior if needed.
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
  - Add checks proving hover coordinator no longer owns heavy scoped/object/doc-shim helpers directly.

## Chunk 1: Extract hover documentation support and scoped hover resolver

### Task 1: Add failing tests for documentation support

**Files:**
- Create: `src/language/services/navigation/__tests__/HoverDocumentationSupport.test.ts`
- Reference: `src/language/services/navigation/LanguageHoverService.ts`

- [ ] **Step 1: Write failing tests for documentation support**

Cover at least:
- complete resolved documents pass through without synthetic shim rebuilding
- partial resolved documents get a stable synthetic `TextDocument`
- synthetic URIs stay deterministic for the same content

- [ ] **Step 2: Run the focused test file to confirm failure**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/HoverDocumentationSupport.test.ts
```

Expected: FAIL because `HoverDocumentationSupport` does not exist yet.

- [ ] **Step 3: Implement `HoverDocumentationSupport`**

Create:
- `src/language/services/navigation/hover/HoverDocumentationSupport.ts`

Move these responsibilities out of `LanguageHoverService.ts`:
- `toDocumentationTextDocument(...)`
- `isCompleteTextDocument(...)`
- `createCompletedTextDocumentShim(...)`
- `createSyntheticDocumentHash(...)`
- `createSyntheticDocumentationUri(...)`

Do not add new cross-navigation utility buckets.

- [ ] **Step 4: Run the focused support tests**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/HoverDocumentationSupport.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/navigation/hover/HoverDocumentationSupport.ts src/language/services/navigation/__tests__/HoverDocumentationSupport.test.ts
git commit -m "refactor(hover): extract documentation support"
```

### Task 2: Add failing tests for scoped hover ownership

**Files:**
- Create: `src/language/services/navigation/__tests__/ScopedMethodHoverResolver.test.ts`
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`

- [ ] **Step 1: Write failing tests for scoped hover behavior**

Cover at least:
- bare `::create()` hover returns callable docs only when hovering the identifier
- named `room::init()` hover respects qualifier resolution and identifier gating
- `unknown` / `unsupported` scoped resolutions return `undefined`

- [ ] **Step 2: Run the focused tests to confirm failure**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected: FAIL because `ScopedMethodHoverResolver` does not exist yet.

- [ ] **Step 3: Implement `ScopedMethodHoverResolver`**

Create:
- `src/language/services/navigation/hover/ScopedMethodHoverResolver.ts`

Move these responsibilities out of `ObjectInferenceLanguageHoverService`:
- scoped resolver invocation
- `isOnScopedMethodIdentifier(...)` gating
- `loadScopedMethodDoc(...)`
- scoped merged hover rendering

Depend on:
- `ScopedMethodResolver`
- `FunctionDocumentationService`
- `CallableDocRenderer`
- analysis service for scoped identifier hit-testing

- [ ] **Step 4: Run the focused scoped hover tests**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/navigation/hover/ScopedMethodHoverResolver.ts src/language/services/navigation/__tests__/ScopedMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(hover): extract scoped hover resolver"
```

## Chunk 2: Extract object-method hover resolver

### Task 3: Add failing tests for object-method hover ownership

**Files:**
- Create: `src/language/services/navigation/__tests__/ObjectMethodHoverResolver.test.ts`
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`

- [ ] **Step 1: Write failing tests for object-method hover resolution**

Cover at least:
- single implementation hover renders callable docs
- multiple candidates that converge on one implementation render merged docs with related paths
- multiple unresolved candidates fall back to the current summary hover text
- hovering outside the member name returns `undefined`

- [ ] **Step 2: Run the focused tests to confirm failure**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/ObjectMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected: FAIL because `ObjectMethodHoverResolver` does not exist yet.

- [ ] **Step 3: Implement `ObjectMethodHoverResolver`**

Create:
- `src/language/services/navigation/hover/ObjectMethodHoverResolver.ts`

Move these responsibilities out of `ObjectInferenceLanguageHoverService`:
- member-name gating
- `loadMethodDocsFromCandidates(...)`
- `renderMethodHover(...)`
- `renderResolvedCandidatesHover(...)`
- `renderMultipleCandidatesHover(...)`

Use `HoverDocumentationSupport` for documentation text-document materialization.

- [ ] **Step 4: Run the focused object-method hover tests**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/ObjectMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/navigation/hover/ObjectMethodHoverResolver.ts src/language/services/navigation/__tests__/ObjectMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(hover): extract object method resolver"
```

## Chunk 3: Reduce hover service to coordinator and verify architecture

### Task 4: Rewire `ObjectInferenceLanguageHoverService` to delegate fully

**Files:**
- Modify: `src/language/services/navigation/LanguageHoverService.ts`
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Replace inlined scoped/object hover logic with collaborator calls**

After this step, `ObjectInferenceLanguageHoverService` should own only:
- document adaptation
- short-circuit order
- collaborator invocation
- final result return

- [ ] **Step 2: Re-run hover integration regressions**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/__tests__/providerIntegration.test.ts
```

Expected: PASS

- [ ] **Step 3: Update architectural guard**

Modify:
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

Add checks proving `LanguageHoverService.ts` no longer contains:
- scoped doc loading helpers
- object-method doc aggregation helpers
- synthetic documentation document shim helpers

- [ ] **Step 4: Run guard and typecheck**

Run:
```bash
npx jest --runInBand src/__tests__/documentAnalysisOwnershipGuard.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/language/services/navigation/LanguageHoverService.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "refactor(hover): reduce hover service to coordinator"
```

## Chunk 4: Final verification and closeout

### Task 5: Run hover-focused regression pack and full verification

**Files:**
- Test-only verification

- [ ] **Step 1: Run the hover regression pack**

Run:
```bash
npx jest --runInBand src/language/services/navigation/__tests__/HoverDocumentationSupport.test.ts src/language/services/navigation/__tests__/ScopedMethodHoverResolver.test.ts src/language/services/navigation/__tests__/ObjectMethodHoverResolver.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
```

Expected: PASS

- [ ] **Step 2: Run full repository verification**

Run:
```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS

- [ ] **Step 3: Commit any final guard/test adjustments if needed**

```bash
git add src/language/services/navigation/__tests__/navigationServices.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "test(hover): lock decomposed hover architecture"
```
