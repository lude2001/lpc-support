# Extension Document Action Unification Design

## Goal

Remove the remaining direct `vscode.workspace.openTextDocument(...)` calls from production extension/UI entrypoints, so shared document opening is fully centralized.

## Scope

### In scope

- `src/macroManager.ts`
- `src/functionDocPanel.ts`
- `src/modules/commandModule.ts`
- `src/diagnostics/FolderScanner.ts`

### Out of scope

- `src/language/shared/WorkspaceDocumentPathSupport.ts` itself
- `src/utils/pathResolver.example.ts`

## Design

- Reuse `defaultTextDocumentHost.openTextDocument(...)` instead of direct `vscode.workspace.openTextDocument(...)`
- Do not change user-visible behavior
- Add a guard that production direct-open call sites are reduced to the shared owner and example file only
