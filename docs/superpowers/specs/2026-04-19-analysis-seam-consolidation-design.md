# Analysis Seam Consolidation Design

## Goal

After analysis ownership normalization and `ASTManager` slimming, the remaining architectural debt is the set of per-service ambient analysis seams:

- `configureDiagnosticsAnalysisService(...)`
- `configureSymbolReferenceAnalysisService(...)`
- `configureTargetMethodLookupAnalysisService(...)`
- `configureSimulatedEfunScannerAnalysisService(...)`
- `configureEfunHoverAnalysisService(...)`
- `configureScopedMethodIdentifierAnalysisService(...)`

These seams were useful migration scaffolding, but they now duplicate infrastructure ownership. The next package consolidates them so analysis flows only through explicit composition roots or registry-provided dependencies, without each subsystem maintaining its own global mini-runtime.

## In Scope

- Diagnostics stack composition
- Symbol reference adapter / current-file references / current-file rename
- `TargetMethodLookup`
- `SimulatedEfunScanner`
- `EfunLanguageHoverService`
- `EfunDocsManager`
- `EfunHoverProvider`
- `UnifiedLanguageHoverService`
- Remaining scoped helper seam where it still acts as runtime configuration infrastructure
- Extension/runtime composition roots and registry wiring needed to feed these services explicitly
- Mechanical guards that prevent reintroduction of per-service ambient analysis seams

## Out of Scope

- New language features
- Parser/syntax/semantic behavior changes
- Reopening workspace-wide rename/references
- Reworking formatter/runtime process model
- Large-scale `WorkspaceSession` redesign

## Current Problems

### 1. Analysis infrastructure is still fragmented

The codebase now has a single analysis owner, but not a single analysis-distribution mechanism. Several low-risk services still own their own module-level `configure*AnalysisService(...)` state and fallback logic.

### 2. Production composition is split between explicit injection and ambient configuration

High-coupled consumers now receive `analysisService` explicitly, but low-risk services still mix:

- constructor injection
- factory parameters
- per-service global configuration

That means the repo has no single rule for how analysis dependencies are obtained.

### 3. Registry/module boundaries are no longer the sole infrastructure source

`coreModule.ts` and `createProductionLanguageServices.ts` still configure multiple independent analysis seams instead of distributing one shared dependency through explicit consumers.

## Design Principles

1. `DocumentSemanticSnapshotService` remains the single analysis owner.
2. Composition roots distribute analysis explicitly.
3. Service-local global analysis state is transitional debt and should be removed.
4. New code must not add another `configure*AnalysisService(...)` seam.
5. Runtime behavior must stay unchanged.

## Recommended Approach

Use explicit injection plus a shared registry/service seam, not a new generic service locator.

### Why this approach

- Keeps ownership in the composition roots
- Matches the direction already taken by Chunk 3
- Avoids replacing many small global seams with one large global seam
- Keeps dependencies visible in constructors/factories

### Hard constraint

- Extension side may reuse the existing `ServiceRegistry`.
- Server side remains direct factory wiring from `createProductionLanguageServices.ts`.
- This package must not introduce a new shared runtime registry, service locator, or generalized infrastructure container.

## Target Architecture

### Composition roots

The only production places allowed to materialize the analysis owner remain:

- `src/modules/coreModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/ast/astManager.ts` as compatibility facade backing

### Distribution rule

Services receive one of:

- `analysisService` directly
- a narrower `Pick<DocumentAnalysisService, ...>`
- a service/factory constructed from an explicit analysis-backed dependency

They do **not** read analysis from module-level global configuration.

## Component Changes

### Diagnostics

- `createDiagnosticsStack(...)` should require explicit analysis input.
- `diagnosticsModule.ts` should obtain analysis through registry/composition and pass it directly.
- Remove `configureDiagnosticsAnalysisService(...)`.

### Symbol references / current-file rename

- `resolveSymbolReferences(...)` should no longer rely on ambient configured analysis by default in production paths.
- `LanguageSymbolReferenceAdapter`, `LanguageReferenceService`, and `LanguageRenameService` should all be wired from explicit parse-capable analysis input.
- Remove `configureSymbolReferenceAnalysisService(...)` from production paths.

### Target method lookup

- `TargetMethodLookup` should require explicit semantic analysis input from callers.
- Callers such as hover/object inference/signature help/runtime tests should pass it directly.
- Remove `configureTargetMethodLookupAnalysisService(...)`.

### Simulated efun scanning

- `SimulatedEfunScanner` should accept analysis explicitly.
- `EfunDocsManager` becomes the explicit place where the scanner is composed.
- Remove `configureSimulatedEfunScannerAnalysisService(...)`.

### Efun hover

- `EfunLanguageHoverService` should accept explicit syntax-capable analysis input.
- `UnifiedLanguageHoverService` and `EfunHoverProvider` should no longer instantiate it through ambient runtime configuration.
- Remove `configureEfunHoverAnalysisService(...)`.

### Scoped helper seam

- `ScopedMethodIdentifierSupport` should stop serving as a runtime configuration owner for production infrastructure.
- Keep it as a narrow scoped-identifier utility; if configuration remains for isolated helper tests, that must be test-only and not part of production composition.

## Registry / Module Changes

The extension-side service registry should expose analysis explicitly so downstream modules can obtain it without recreating side-channel configuration.

Recommended addition:

- Register a `DocumentAnalysisService` (or equivalent service key) in `coreModule.ts`

Then:

- `diagnosticsModule.ts`
- any extension-side efun/navigation composition

can request the same shared analysis dependency from the registry instead of depending on global configure functions.

## Mechanical Guards

Add or extend repo guards so production code fails fast if any of these patterns reappear:

- `configureDiagnosticsAnalysisService(`
- `configureSymbolReferenceAnalysisService(`
- `configureTargetMethodLookupAnalysisService(`
- `configureSimulatedEfunScannerAnalysisService(`
- `configureEfunHoverAnalysisService(`
- `configureScopedMethodIdentifierAnalysisService(`
- production `require*AnalysisService()` fallbacks

There should be no production compatibility seams left after this package. If a test-only seam remains for isolated helper tests, that seam must be scoped to tests and must not appear in production guards.

Also guard that newly explicit services receive analysis through constructor/factory signatures rather than ambient configuration.

## Migration Sequence

1. Add/confirm registry or composition-root analysis distribution seam.
2. Convert diagnostics stack to explicit analysis input.
3. Convert symbol reference / rename current-file path.
4. Convert target method lookup.
5. Convert simulated efun scanner and efun docs manager.
6. Convert efun hover and remaining hover/provider paths.
7. Convert the remaining scoped helper configuration seam out of production wiring.
8. Remove now-dead configure helpers and tests that only exist to maintain them.
9. Add/expand guards.

## Testing

At minimum:

- diagnostics module / stack tests
- symbol reference / rename tests
- efun docs / efun hover tests
- navigation handler/runtime tests
- provider integration tests
- full `npm test -- --runInBand`
- `npx tsc --noEmit`

## Success Criteria

This package is complete when:

1. Production code no longer depends on per-service `configure*AnalysisService(...)` seams for diagnostics, symbol references, target lookup, simulated efun scanning, efun hover, or scoped helper routing.
2. Analysis is distributed explicitly from composition roots / registry.
3. No new runtime registry or service locator replaces the removed seams.
4. Runtime behavior is unchanged.
5. Full typecheck and full test suite pass.
