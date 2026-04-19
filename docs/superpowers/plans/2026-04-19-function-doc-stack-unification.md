# Function Doc Stack Unification Plan

> Goal: make the function-doc panel consume one shared tracker/facade path instead of maintaining its own traversal logic.

## Files

### Core

- `src/efun/EfunDocsManager.ts`
- `src/efun/FileFunctionDocTracker.ts`
- `src/functionDocPanel.ts`
- `src/modules/commandModule.ts`

### Shared support

- `src/language/shared/WorkspaceDocumentPathSupport.ts`

### Tests

- `src/efun/__tests__/FileFunctionDocTracker.test.ts`
- `src/__tests__/functionDocPanel.test.ts`
- relevant `src/__tests__/efunDocs.test.ts`

## Chunk 1: Tracker ownership

- [ ] Move include/inherit traversal ownership fully into `FileFunctionDocTracker`
- [ ] Adopt shared document/path support for tracker-owned file opening
- [ ] Expose the minimum grouped lookup surface needed by the panel

## Chunk 2: Façade + panel cleanup

- [ ] Extend `EfunDocsManager` with tracker-backed accessors needed by the panel
- [ ] Remove include/inherit traversal logic from `FunctionDocPanel`
- [ ] Update command wiring if the panel should consume `EfunDocsManager` instead of `MacroManager`

## Chunk 3: Verification

- [ ] Update focused tests and guards so the panel no longer owns graph traversal
- [ ] Run:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS
