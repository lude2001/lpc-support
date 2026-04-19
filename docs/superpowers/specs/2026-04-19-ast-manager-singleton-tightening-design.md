# ASTManager Singleton Tightening Design

Date: 2026-04-19

## Goal

Remove the remaining production-side analysis singleton fallback hidden inside `src/ast/astManager.ts` so `ASTManager` no longer silently constructs itself from `DocumentSemanticSnapshotService.getInstance()`.

## Why This Matters

Even after the analysis-owner cleanup, `ASTManager` still contains one global bypass:

- its constructor defaults to `DocumentSemanticSnapshotService.getInstance()`
- `ASTManager.getInstance()` can therefore create a working global analysis owner without explicit composition

That means the codebase is still not fully true to the rule:

- one explicit analysis owner
- no hidden singleton fallback path

## Non-Goals

- no ASTManager removal
- no parser/syntax/semantic product behavior changes
- no ASTManager API redesign beyond singleton configuration tightening
- no diagnostics/formatter/navigation behavior changes

## Proposed Design

### Singleton shape

Keep `ASTManager` as a singleton facade, but remove implicit construction from `DocumentSemanticSnapshotService.getInstance()`.

Introduce explicit singleton lifecycle:

- `ASTManager.configureSingleton(snapshotService)`
- `ASTManager.getInstance()`
- `ASTManager.resetSingletonForTests()` or equivalent explicit test-only reset seam

### Production rule

Only approved composition roots may configure the singleton:

- `src/modules/coreModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`

No other production file should create or configure the singleton.

### Test rule

Tests that need `ASTManager` must configure it explicitly through the test seam rather than depending on constructor fallback.

## Acceptance Criteria

- `ASTManager` constructor no longer defaults to `DocumentSemanticSnapshotService.getInstance()`
- production singleton creation is explicit
- tests are updated to configure/reset the singleton explicitly
- ownership guard is updated so new singleton fallback paths cannot reappear
