# Document Host and Path Support Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one shared owner for document-host and workspace/include/inherit path-resolution infrastructure, then migrate `TargetMethodLookup`, `DefinitionResolverSupport`, relation services, and runtime wiring to it without changing product behavior.

**Architecture:** Extract a shared `WorkspaceDocumentPathSupport`, keep `DefinitionResolverSupport` focused on definition-specific orchestration/caches, remove duplicated `defaultHost` lambdas, and add ownership guards so path/open infrastructure cannot fork again.

**Tech Stack:** TypeScript, Jest, VS Code API shims, project config service, macro resolution

---

## File Map

### New files

- `src/language/shared/WorkspaceDocumentPathSupport.ts`
- `src/language/shared/__tests__/WorkspaceDocumentPathSupport.test.ts`

### Modified files

- `src/targetMethodLookup.ts`
- `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
- `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`
- `src/language/services/navigation/InheritedFunctionRelationService.ts`
- `src/language/services/navigation/InheritedFileGlobalRelationService.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Chunk 1: Extract the shared path/document support owner

### Task 1: Add failing support tests

- [ ] Write `WorkspaceDocumentPathSupport.test.ts` covering:
  - safe document open success/failure
  - workspace file resolution
  - macro-backed inherit resolution
  - project-config-backed include resolution
  - simulated efun path resolution
  - `resolveExistingCodePath(...)`
- [ ] Run:

```bash
npx jest --runInBand src/language/shared/__tests__/WorkspaceDocumentPathSupport.test.ts
```

Expected: FAIL because the support file does not exist yet.

- [ ] Create `src/language/shared/WorkspaceDocumentPathSupport.ts`
  - add shared default host
  - add shared path/document helper methods
  - keep dependencies narrow
- [ ] Re-run the support tests
- [ ] Commit:

```bash
git add src/language/shared/WorkspaceDocumentPathSupport.ts src/language/shared/__tests__/WorkspaceDocumentPathSupport.test.ts
git commit -m "refactor(shared): extract document path support"
```

## Chunk 2: Migrate definition and target-method lookup

### Task 2: Move `DefinitionResolverSupport` onto the shared owner

- [ ] Update `DefinitionResolverSupport.ts`
  - delegate path/open/project helpers to `WorkspaceDocumentPathSupport`
  - keep definition-specific caches and location/request helpers local
- [ ] Update `DefinitionResolverSupport.test.ts`
  - keep cache invalidation behavior stable
- [ ] Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts
```

Expected: PASS

### Task 3: Move `TargetMethodLookup` onto the shared owner

- [ ] Update `src/targetMethodLookup.ts`
  - remove duplicated path/open helper methods
  - consume `WorkspaceDocumentPathSupport`
- [ ] Run targeted regression:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/__tests__/providerIntegration.test.ts
```

Expected: PASS

- [ ] Commit:

```bash
git add src/targetMethodLookup.ts src/language/services/navigation/definition/DefinitionResolverSupport.ts src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "refactor(shared): unify target lookup path support"
```

## Chunk 3: Remove duplicated host lambdas and add guards

### Task 4: Migrate relation services and runtime wiring

- [ ] Update:
  - `InheritedFunctionRelationService.ts`
  - `InheritedFileGlobalRelationService.ts`
  - `createProductionLanguageServices.ts`
  to use the shared default host owner
- [ ] Update runtime and relation tests:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts
```

Expected: PASS

### Task 5: Add ownership guard coverage and run full verification

- [ ] Update `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
  - fail if `TargetMethodLookup` regains inline path/open helper ownership
  - fail if relation services/runtime wiring regain inline `defaultHost` lambdas
- [ ] Run focused guard pack:

```bash
npx jest --runInBand src/__tests__/documentAnalysisOwnershipGuard.test.ts src/language/shared/__tests__/WorkspaceDocumentPathSupport.test.ts src/language/services/navigation/__tests__/InheritedFunctionRelationService.test.ts src/language/services/navigation/__tests__/InheritedFileGlobalRelationService.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts
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
git add src/language/shared/WorkspaceDocumentPathSupport.ts src/language/shared/__tests__/WorkspaceDocumentPathSupport.test.ts src/targetMethodLookup.ts src/language/services/navigation/definition/DefinitionResolverSupport.ts src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts src/language/services/navigation/InheritedFunctionRelationService.ts src/language/services/navigation/InheritedFileGlobalRelationService.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "refactor(shared): unify document host seams"
```

## Completion Criteria

- one shared owner exists for document-host and path helpers
- `TargetMethodLookup` no longer duplicates path/open logic
- definition support delegates infrastructure helpers instead of owning them
- relation services and runtime wiring use the shared default host owner
- ownership guard prevents host/path infrastructure from forking again
