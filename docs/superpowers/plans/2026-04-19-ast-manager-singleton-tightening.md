# ASTManager Singleton Tightening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `ASTManager`'s implicit analysis singleton fallback and force explicit singleton configuration in production and tests.

**Architecture:** Keep `ASTManager` as a facade, but stop letting it silently instantiate itself from `DocumentSemanticSnapshotService.getInstance()`. Replace that hidden path with explicit bootstrap configuration and a deliberate test seam.

---

## File Map

### Modified files

- `src/ast/astManager.ts`
- `src/modules/coreModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/__tests__/astManager.test.ts`
- other tests that call `ASTManager.getInstance()` without setup
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Chunk 1: Tighten singleton lifecycle

- [ ] Remove implicit constructor default from `ASTManager`
- [ ] Add explicit singleton configuration/reset API
- [ ] Update core module and production runtime bootstrap to configure the singleton

## Chunk 2: Update tests

- [ ] Update ASTManager-focused tests to configure/reset the singleton explicitly
- [ ] Update any broader tests that still depend on lazy singleton construction

## Chunk 3: Guard and verify

- [ ] Extend ownership guard so only approved bootstrap files configure the singleton
- [ ] Run focused ASTManager + integration regressions
- [ ] Run:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS
