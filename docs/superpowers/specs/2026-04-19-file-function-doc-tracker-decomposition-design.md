# File Function Doc Tracker Decomposition Design

## Goal

Decompose `src/efun/FileFunctionDocTracker.ts` into explicit owners while preserving current efun/function-doc behavior.

## Problem

`FileFunctionDocTracker` currently mixes:

- document-level cache ownership
- current-document async update coordination
- inherit/include traversal
- workspace root selection
- `CallableDoc -> EfunDoc` compatibility materialization
- public lookup/facade methods for panel, efun docs, hover, and signature help consumers

That makes it the main remaining mixed-responsibility service inside the function-doc stack.

## Scope

### In scope

- internal decomposition of `FileFunctionDocTracker`
- new helper/service units under `src/efun/`
- tests that lock current file-doc lookup semantics

### Out of scope

- changing `EfunDocsManager` public behavior
- changing `FunctionDocPanel` behavior
- changing `FunctionDocumentationService` parsing semantics
- changing include/inherit resolution product behavior

## Recommended design

Keep `FileFunctionDocTracker` as a thin facade/cache owner with the existing public API.

Move its internal responsibilities into smaller owners:

1. `FunctionDocLookupBuilder`
   - builds `FunctionDocLookup`
   - owns current/inherited/include traversal
   - always uses `WorkspaceDocumentPathSupport` for workspace root and document loading
   - becomes the single traversal truth source for:
   - `getFunctionDocLookup(...)`
   - `getDocFromInheritedForDocument(...)`
   - `getDocFromIncludes(...)`
2. `FunctionDocCompatMaterializer`
   - converts `DocumentCallableDocs` / `CallableDoc` into compat `EfunDoc` maps and source groups
3. `FileFunctionDocTracker`
   - keeps document cache
   - keeps current-document async update coordination
   - delegates lookup construction and compat materialization

## Rules

- No behavior expansion
- No new direct `vscode.workspace.openTextDocument(...)` usage
- No new ad-hoc workspace root selection logic
- `FileFunctionDocTracker` must stop owning `resolveWorkspaceRoot(...)`
- `FileFunctionDocTracker` must stop owning include/inherit traversal directly
- `getDocFromIncludes(...)` and `getDocFromInheritedForDocument(...)` must read from the same extracted lookup artifact as `getFunctionDocLookup(...)`
- `FunctionDocPanel` and `EfunDocsManager` continue to use the same public tracker/facade methods

## Tests

- keep current `FileFunctionDocTracker`, `functionDocPanel`, `efunDocs`, and command/runtime regressions green
- add focused tests only where they lock the new ownership boundary
- add ownership guards so tracker no longer contains:
- workspace-root resolution helpers
- include/inherit traversal helpers
- compat materialization helpers
- preserve `forceFresh` and cache/update semantics across all public lookup APIs

## Acceptance criteria

- `FileFunctionDocTracker` becomes a facade/cache owner
- traversal and compat materialization have explicit owners
- workspace root resolution comes only from shared document-path infrastructure
- `npx tsc --noEmit` passes
- `npm test -- --runInBand` passes
