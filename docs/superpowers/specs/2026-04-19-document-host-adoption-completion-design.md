# Document Host Adoption Completion Design

## Goal

Finish the migration to shared document/path infrastructure for core language and object-inference services, so production code no longer opens workspace documents through ad hoc `vscode.workspace.openTextDocument(...)` calls when a shared host seam already exists.

## Problem

The repository already has a shared document/path owner in `src/language/shared/WorkspaceDocumentPathSupport.ts`, but several core production paths still bypass it:

- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/language/services/completion/ScopedMethodCompletionSupport.ts`
- `src/objectInference/GlobalObjectBindingResolver.ts`
- `src/objectInference/InheritedGlobalObjectBindingResolver.ts`
- `src/objectInference/scopedInheritanceTraversal.ts`

This leaves the architecture in a mixed state:

- some services consume a shared host seam
- other services still inline their own document-open path

That is exactly the kind of infrastructure drift we are trying to eliminate.

## Scope

### In scope

- shared-host adoption for the files listed above
- extending the shared host seam only as much as needed to eliminate duplicated default host logic
- wiring object-inference scoped/global traversal to the shared host instead of direct `vscode.workspace.openTextDocument(...)`
- tests and ownership guards that lock the new shared-host usage into place

### Out of scope

- `functionDocPanel.ts`
- `FileFunctionDocTracker.ts`
- `FolderScanner.ts`
- `macroManager.ts`
- `commandModule.ts`
- broader efun/UI cleanup

Those files still matter, but they belong to later debt packages. This package stays focused on core language/object-inference production paths.

## Recommended approach

Use the existing shared infrastructure as the single owner. Do **not** create a second “better” document-access abstraction.

Concretely:

1. Expand the shared host seam in `WorkspaceDocumentPathSupport.ts` only where current core services need it.
2. Replace inline default host/document-loader logic in definition/completion/object-inference code with that shared seam.
3. Keep public service behavior unchanged.

## Design

### 1. Shared host seam remains the truth source

`WorkspaceDocumentPathSupport.ts` already owns:

- `openTextDocument`
- `fileExists`
- workspace-folder lookup
- include/inherit/project path resolution

This package keeps that file as the single owner for default document access. If additional host fields are required by current core services, they should be added there rather than redefined inline elsewhere.

### 2. `LanguageDefinitionService` stops carrying its own default host object

`AstBackedLanguageDefinitionService` currently still defines an inline `defaultDefinitionHost`.

That default host should be replaced by the shared host exported from the language/shared layer. The service may still keep its richer `LanguageDefinitionHost` interface, but the default implementation must come from shared infrastructure instead of being rebuilt locally.

### 3. `ScopedMethodCompletionSupport` uses the shared document host

`ScopedMethodCompletionSupport` currently synthesizes its own default loader around `vscode.workspace.openTextDocument(...)`.

That loader should be replaced with the shared host’s `openTextDocument` behavior so scoped completion docs stop maintaining their own document-opening path.

### 4. Object-inference global/scoped traversal uses injected shared host

The following object-inference components must stop opening documents directly:

- `GlobalObjectBindingResolver`
- `InheritedGlobalObjectBindingResolver`
- `scopedInheritanceTraversal`

They should accept a shared host/document loader dependency and default to the shared host seam. `ObjectInferenceService`, `ScopedMethodResolver`, and `ScopedMethodDiscoveryService` should thread that dependency through without changing user-visible inference semantics.

### 5. No behavior expansion

This package is not allowed to:

- change which files are considered visible
- alter object inference results
- expand definition/completion scope
- reintroduce workspace-wide relation logic

It is strictly an ownership cleanup.

## Failure semantics

- Any failure to open a document must preserve current conservative behavior.
- Replacing direct document opens with the shared host may not turn ignored failures into thrown errors.
- If a call site currently swallows open failures and continues, it must keep doing so.

## Tests

At minimum:

1. update ownership guards so the targeted files no longer contain direct `vscode.workspace.openTextDocument(...)`
2. keep existing definition/completion/object-inference regressions green
3. add focused tests where needed to prove shared-host adoption did not change failure semantics

## Acceptance criteria

- no direct `vscode.workspace.openTextDocument(...)` remains in the in-scope core files
- shared-host adoption is the only default document-open path for those services
- `npx tsc --noEmit` passes
- `npm test -- --runInBand` passes
