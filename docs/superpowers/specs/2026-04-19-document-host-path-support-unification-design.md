# Document Host and Path Support Unification Design

Date: 2026-04-19

## Goal

Unify the duplicated `openTextDocument` host seam and workspace/include/inherit path-resolution helpers that are currently split across:

- `src/targetMethodLookup.ts`
- `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
- `src/language/services/navigation/InheritedFunctionRelationService.ts`
- `src/language/services/navigation/InheritedFileGlobalRelationService.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`

The result should leave one shared owner for:

- default document host behavior
- safe document opening
- workspace-root file resolution
- include/inherit file resolution
- project-config-backed include/simul_efun path resolution

while preserving all current product behavior.

## Non-Goals

- no changes to definition/hover/signature-help/reference product semantics
- no changes to object inference or scoped method resolution semantics
- no runtime `vscodeShim` rewrite
- no new navigation mega-framework
- no attempt to rewrite completion readonly document loading in this package

## Current Problem

The codebase still has multiple copies of the same infrastructure logic:

1. `TargetMethodLookup` owns:
   - workspace file resolution
   - include file resolution
   - inherit file resolution
   - `tryOpenTextDocument(...)`
   - extension/default include-directory rules

2. `DefinitionResolverSupport` owns a richer copy of the same path/opening machinery.

3. `InheritedFunctionRelationService` and `InheritedFileGlobalRelationService` each define their own default `host.openTextDocument(...)` lambda.

4. `createProductionLanguageServices.ts` still hand-builds another `openTextDocument` host object for inherited relation wiring.

So even after the service-level cleanups, the infrastructure underneath them still forks.

## Approaches Considered

### 1. Only extract a shared `defaultHost`

Pros:

- smallest code diff

Cons:

- leaves the real duplication untouched
- `TargetMethodLookup` would still carry its own path-resolution stack
- does not solve the actual infrastructure split

### 2. Extract a shared path/document support owner

Create one shared support owner for:

- host-backed document opening
- workspace root lookup
- workspace-relative file resolution
- include/inherit resolution
- project-config-backed include/simul_efun helpers

Pros:

- removes the true duplication
- lets `TargetMethodLookup` and `DefinitionResolverSupport` share one base
- makes relation services consume one default host seam instead of each owning a lambda

Cons:

- slightly larger refactor than only extracting `defaultHost`
- requires careful test coverage to avoid path behavior drift

### 3. Fold everything into `DefinitionResolverSupport`

Pros:

- no new support file

Cons:

- pulls non-definition responsibilities into a definition-specific owner
- makes `TargetMethodLookup` depend on navigation-specific support
- would be another disguised god-object move

## Recommended Approach

Approach 2.

This package should create a shared infrastructure owner, not hide everything inside a definition-specific helper.

## Proposed Design

### Shared owner

Introduce a new shared support module:

- `src/language/shared/WorkspaceDocumentPathSupport.ts`

It should own:

- `defaultTextDocumentHost`
- `tryOpenTextDocument(...)`
- `fileExists(...)`
- `getWorkspaceRoot(...)`
- `resolveWorkspaceFilePath(...)`
- `resolveInheritedFilePath(...)`
- `resolveIncludeFilePath(...)`
- `resolveExistingIncludeFiles(...)`
- `resolveProjectPath(...)`
- `getPrimaryIncludeDirectory(...)`
- `getConfiguredSimulatedEfunFile(...)`
- `resolveExistingCodePath(...)`

This module should depend only on:

- `vscode`
- `path`
- `LpcProjectConfigService`
- `MacroManager`

It must not depend on navigation-specific resolver types.

### Definition layer after extraction

`DefinitionResolverSupport` should keep:

- request-state helpers
- location conversions
- include/header caches
- semantic snapshot helpers
- symbol-location helpers

It should delegate path/document operations to `WorkspaceDocumentPathSupport`.

### `TargetMethodLookup` after extraction

`TargetMethodLookup` should stop owning:

- `tryOpenTextDocument(...)`
- `resolveIncludeFilePaths(...)`
- `getIncludeDirectories(...)`
- `resolveInheritedFilePath(...)`
- `resolveWorkspaceFilePath(...)`
- extension helper methods

It should consume `WorkspaceDocumentPathSupport` instead.

### Relation services after extraction

`InheritedFunctionRelationService` and `InheritedFileGlobalRelationService` should stop defining inline `defaultHost` objects and use the shared default host owner.

### Runtime wiring after extraction

`createProductionLanguageServices.ts` should stop inlining:

- `{ openTextDocument: async (...) => vscode.workspace.openTextDocument(...) }`

and use the shared default host owner.

## File Boundaries

### New files

- `src/language/shared/WorkspaceDocumentPathSupport.ts`
- `src/language/shared/__tests__/WorkspaceDocumentPathSupport.test.ts`

### Modified files

- `src/targetMethodLookup.ts`
- `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
- `src/language/services/navigation/InheritedFunctionRelationService.ts`
- `src/language/services/navigation/InheritedFileGlobalRelationService.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Failure Semantics

Behavior must remain equivalent.

- failed document open still returns `undefined`
- missing workspace root still preserves current `undefined` / fallback behavior
- unresolved macros still preserve current unresolved behavior
- include resolution keeps current project-config-first semantics
- inherit resolution keeps current macro + `.c` extension semantics

This package must not widen lookup behavior or invent new fallbacks.

## Testing Strategy

### New focused tests

`WorkspaceDocumentPathSupport.test.ts` should cover:

- default host document open path
- safe open failure to `undefined`
- workspace-relative path resolution
- macro-backed inherit resolution
- system include resolution with configured include directories
- `resolveExistingCodePath(...)`
- configured simulated efun path resolution

### Existing regression packs

- `DefinitionResolverSupport.test.ts`
- `InheritedFunctionRelationService.test.ts`
- `InheritedFileGlobalRelationService.test.ts`
- `createProductionLanguageServices.test.ts`
- provider/navigation integration tests if needed

### Ownership guard

Add guards proving:

- `TargetMethodLookup.ts` no longer owns inline path/open helper stack
- relation services no longer define inline `defaultHost`
- `createProductionLanguageServices.ts` no longer hand-builds the inherited relation host lambda

## Acceptance Criteria

- one shared owner exists for host/path support
- `TargetMethodLookup` no longer reimplements path/open infrastructure
- relation services and runtime wiring reuse the shared default host seam
- definition behavior and target method lookup behavior remain unchanged
- ownership guard prevents the infrastructure split from regrowing
