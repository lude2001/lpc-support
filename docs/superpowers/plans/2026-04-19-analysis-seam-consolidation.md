# Analysis Seam Consolidation Plan

## Goal

Remove the remaining per-service `configure*AnalysisService(...)` seams and replace them with explicit analysis distribution from the existing composition roots.

## Scope

### In scope

- `createDiagnosticsStack(...)` and diagnostics module wiring
- `LanguageSymbolReferenceAdapter`, current-file references, current-file rename
- `TargetMethodLookup`
- `SimulatedEfunScanner`
- `EfunDocsManager`
- `EfunLanguageHoverService`
- `EfunHoverProvider`
- `UnifiedLanguageHoverService`
- remaining scoped helper runtime configuration seam
- production guards and targeted tests

### Out of scope

- new language features
- parser/syntax/semantic behavior changes
- workspace-wide rename/reference expansion
- runtime process model changes

## Chunk 1: Registry-backed extension analysis distribution

### Goals

- Register `DocumentAnalysisService` in the existing `ServiceRegistry`
- Remove extension-side reliance on `configureDiagnosticsAnalysisService(...)`
- Keep server side unchanged for this chunk

### Tasks

1. Add a service key for analysis ownership in `src/core/ServiceKeys.ts`
2. Register `DocumentSemanticSnapshotService.getInstance()` under that key in `coreModule.ts`
3. Update `diagnosticsModule.ts` to fetch the analysis service from the registry and pass it explicitly to `createDiagnosticsStack(...)`
4. Remove production use of `configureDiagnosticsAnalysisService(...)`
5. Tighten diagnostics tests and registry tests

### Verification

- `npx jest --runInBand src/core/__tests__/coreModule.test.ts src/modules/__tests__/diagnosticsModule.test.ts src/diagnostics/__tests__/createDiagnosticsStack.test.ts`
- `npx tsc --noEmit`

## Chunk 2: Current-file symbol and lookup seam removal

### Goals

- Remove production dependence on `configureSymbolReferenceAnalysisService(...)`
- Remove production dependence on `configureTargetMethodLookupAnalysisService(...)`

### Tasks

1. Require explicit parse-capable analysis in `LanguageSymbolReferenceAdapter` production wiring
2. Update `LanguageReferenceService` / `LanguageRenameService` production construction to pass analysis explicitly
3. Update `TargetMethodLookup` production construction paths to pass semantic analysis explicitly
4. Remove production fallback/configure use from:
   - `symbolReferenceResolver.ts`
   - direct navigation/runtime call sites
   - `ObjectInferenceLanguageHoverService` fallback construction if needed
5. Update navigation handler and navigation service tests
6. Add/extend guards against production `configureSymbolReferenceAnalysisService(` and `configureTargetMethodLookupAnalysisService(`

### Verification

- `npx jest --runInBand src/__tests__/symbolReferenceResolver.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `npx tsc --noEmit`

## Chunk 3: Efun seam consolidation

### Goals

- Remove production dependence on `configureSimulatedEfunScannerAnalysisService(...)`
- Remove production dependence on `configureEfunHoverAnalysisService(...)`

### Tasks

1. Make `SimulatedEfunScanner` explicit-analysis only in production paths
2. Thread analysis through `EfunDocsManager` construction
3. Make `EfunLanguageHoverService` explicit-analysis only in production paths
4. Update:
   - `EfunHoverProvider`
   - `UnifiedLanguageHoverService`
   - `createProductionLanguageServices.ts`
   - extension-side efun composition paths
5. Remove production fallback/configure use for efun scanner/hover
6. Update efun docs / efun hover / signature help tests

### Verification

- `npx jest --runInBand src/__tests__/efunDocs.test.ts src/efun/__tests__/EfunHoverProvider.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
- `npx tsc --noEmit`

## Chunk 4: Scoped helper seam cleanup and guard tightening

### Goals

- Remove production dependence on `configureScopedMethodIdentifierAnalysisService(...)`
- Keep scoped helper utilities available without owning runtime infrastructure

### Tasks

1. Audit all production `ScopedMethodIdentifierSupport` call sites
2. Ensure production call sites pass explicit analysis service into scoped helper utilities
3. Remove any remaining production fallback/configuration path tied to `configureScopedMethodIdentifierAnalysisService(...)`
4. Keep any helper-only test seam, if necessary, isolated to tests
5. Tighten repo guards so production cannot reintroduce the seam

### Verification

- `npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodIdentifierSupport.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts`
- `npx tsc --noEmit`

## Final Verification

- `npx tsc --noEmit`
- `npm test -- --runInBand`

## Completion Criteria

This package is complete when:

1. Production code no longer depends on the remaining `configure*AnalysisService(...)` seams.
2. Extension side uses the existing registry for analysis distribution where appropriate.
3. Server side stays on direct factory wiring.
4. No new runtime registry or service locator is introduced.
5. Full typecheck and full test suite pass.
