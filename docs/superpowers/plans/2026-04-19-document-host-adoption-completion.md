# Document Host Adoption Completion Plan

> Goal: finish shared document-host adoption across core language and object-inference services without changing behavior.

## Files

### Shared infrastructure

- `src/language/shared/WorkspaceDocumentPathSupport.ts`

### Core production adopters

- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/language/services/completion/ScopedMethodCompletionSupport.ts`
- `src/objectInference/GlobalObjectBindingResolver.ts`
- `src/objectInference/InheritedGlobalObjectBindingResolver.ts`
- `src/objectInference/scopedInheritanceTraversal.ts`
- `src/objectInference/ObjectInferenceService.ts`
- `src/objectInference/ScopedMethodResolver.ts`
- `src/objectInference/ScopedMethodDiscoveryService.ts`

### Tests / guards

- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
- targeted completion / definition / object-inference tests as needed

## Chunk 1: Shared host seam

- [ ] Extend `WorkspaceDocumentPathSupport.ts` only as needed so it can serve the remaining in-scope core consumers
- [ ] Keep it as the single default document-open owner

## Chunk 2: Core adopters

- [ ] Remove inline default host logic from `LanguageDefinitionService`
- [ ] Replace `ScopedMethodCompletionSupport`’s default loader with the shared host
- [ ] Thread shared host/document-loader usage into global-binding and scoped-inheritance traversal
- [ ] Ensure object-inference callers pass or default to the shared host without changing inference semantics

## Chunk 3: Guards and verification

- [ ] Update ownership guard(s) so the in-scope files no longer allow direct `vscode.workspace.openTextDocument(...)`
- [ ] Run focused regressions around definition / scoped completion / object inference
- [ ] Run:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS
