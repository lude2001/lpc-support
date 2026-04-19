# Code Action Service Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `LanguageCodeActionService` to a coordinator by extracting dedicated builders for unused-variable and variable-position quick fixes plus one narrow shared document/range support owner.

**Architecture:** Keep the public code-action service surface stable. Move quick-fix construction and text/range helpers into dedicated collaborators, then lock the shape with ownership guards.

**Tech Stack:** TypeScript, Jest, VS Code-style language contracts

---

## File Map

### New files

- `src/language/services/codeActions/CodeActionDocumentSupport.ts`
- `src/language/services/codeActions/UnusedVariableCodeActionBuilder.ts`
- `src/language/services/codeActions/VariablePositionCodeActionBuilder.ts`
- `src/language/services/codeActions/__tests__/CodeActionDocumentSupport.test.ts`
- `src/language/services/codeActions/__tests__/UnusedVariableCodeActionBuilder.test.ts`
- `src/language/services/codeActions/__tests__/VariablePositionCodeActionBuilder.test.ts`

### Modified files

- `src/language/services/codeActions/LanguageCodeActionService.ts`
- `src/language/services/codeActions/__tests__/LanguageCodeActionService.test.ts`
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Chunk 1: Extract shared support and unused-variable builder

### Task 1: Add failing support tests

- [ ] Write focused tests for:
  - line range helpers
  - indentation lookup
  - snake/camel conversion
  - block/function-start discovery helpers
- [ ] Run:

```bash
npx jest --runInBand src/language/services/codeActions/__tests__/CodeActionDocumentSupport.test.ts
```

Expected: FAIL because the support file does not exist yet.

- [ ] Create `CodeActionDocumentSupport.ts`
- [ ] Re-run the support tests

### Task 2: Add failing tests for unused-variable actions

- [ ] Write focused tests for:
  - remove variable
  - comment variable
  - make global
  - snake/camel rename command actions
- [ ] Run:

```bash
npx jest --runInBand src/language/services/codeActions/__tests__/UnusedVariableCodeActionBuilder.test.ts
```

Expected: FAIL because the builder file does not exist yet.

- [ ] Create `UnusedVariableCodeActionBuilder.ts`
- [ ] Re-run the focused builder tests
- [ ] Commit:

```bash
git add src/language/services/codeActions/CodeActionDocumentSupport.ts src/language/services/codeActions/UnusedVariableCodeActionBuilder.ts src/language/services/codeActions/__tests__/CodeActionDocumentSupport.test.ts src/language/services/codeActions/__tests__/UnusedVariableCodeActionBuilder.test.ts
git commit -m "refactor(code-actions): extract unused-variable builders"
```

## Chunk 2: Extract variable-position builder

### Task 3: Add failing tests for variable-position actions

- [ ] Write focused tests for:
  - move declaration to block start
  - move declaration to function start
- [ ] Run:

```bash
npx jest --runInBand src/language/services/codeActions/__tests__/VariablePositionCodeActionBuilder.test.ts
```

Expected: FAIL because the builder file does not exist yet.

- [ ] Create `VariablePositionCodeActionBuilder.ts`
- [ ] Re-run the focused builder tests
- [ ] Commit:

```bash
git add src/language/services/codeActions/VariablePositionCodeActionBuilder.ts src/language/services/codeActions/__tests__/VariablePositionCodeActionBuilder.test.ts
git commit -m "refactor(code-actions): extract variable-position builder"
```

## Chunk 3: Reduce service to coordinator and add guard

### Task 4: Rewire `LanguageCodeActionService`

- [ ] Update `LanguageCodeActionService.ts`
  - keep only request filtering, diagnostic iteration, and builder delegation
- [ ] Update `LanguageCodeActionService.test.ts`
  - keep user-visible behavior stable
- [ ] Update `documentAnalysisOwnershipGuard.test.ts`
  - fail if the service regains inline action builders or shared helper ownership
- [ ] Run focused regression:

```bash
npx jest --runInBand src/language/services/codeActions/__tests__/CodeActionDocumentSupport.test.ts src/language/services/codeActions/__tests__/UnusedVariableCodeActionBuilder.test.ts src/language/services/codeActions/__tests__/VariablePositionCodeActionBuilder.test.ts src/language/services/codeActions/__tests__/LanguageCodeActionService.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
```

Expected: PASS

- [ ] Run full verification:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS

- [ ] Commit:

```bash
git add src/language/services/codeActions/LanguageCodeActionService.ts src/language/services/codeActions/__tests__/LanguageCodeActionService.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "refactor(code-actions): reduce service to coordinator"
```

## Completion Criteria

- `LanguageCodeActionService.ts` is a thin coordinator
- quick-fix families have explicit owners
- shared document/range helpers have one owner
- current code-action behavior remains unchanged
- ownership guard prevents the monolith from regrowing
