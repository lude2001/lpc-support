# Extension Document Action Unification Plan

## Files

- `src/macroManager.ts`
- `src/functionDocPanel.ts`
- `src/modules/commandModule.ts`
- `src/diagnostics/FolderScanner.ts`
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Steps

- [ ] Replace direct `vscode.workspace.openTextDocument(...)` usage with `defaultTextDocumentHost.openTextDocument(...)`
- [ ] Keep UI behavior unchanged
- [ ] Update ownership guard so only the shared owner and example file retain direct workspace document opens
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm test -- --runInBand`

Expected: PASS
