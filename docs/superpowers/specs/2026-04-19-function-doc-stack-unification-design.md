# Function Doc Stack Unification Design

## Goal

Make the function-document feature use one shared discovery/materialization pipeline instead of maintaining separate logic in `FunctionDocPanel` and `FileFunctionDocTracker`.

## Problem

The current function-doc stack is split across three places:

- `src/efun/EfunDocsManager.ts`
- `src/efun/FileFunctionDocTracker.ts`
- `src/functionDocPanel.ts`

The panel still performs its own:

- inherit parsing
- include parsing
- file path resolution
- document opening
- recursive inherited traversal

That duplicates responsibilities already close to `FileFunctionDocTracker`, and it keeps document traversal logic outside the shared documentation stack.

## Scope

### In scope

- unify function-doc discovery/materialization through `FileFunctionDocTracker`
- make `EfunDocsManager` the façade used by the panel for doc graph access
- make `FunctionDocPanel` a presenter/coordinator instead of a file graph walker
- adopt shared document/path support in tracker-owned traversal

### Out of scope

- command registration behavior changes
- UI layout/template redesign
- macroManager / FolderScanner / error-tree document opening
- broader efun hover/completion behavior changes
- user-triggered editor navigation opens inside the panel

## Recommended design

### 1. `FileFunctionDocTracker` becomes the single owner of function-doc graph traversal

Tracker should own:

- current-file callable doc materialization
- inherited file traversal
- include file traversal
- document opening for those traversal paths
- cache and freshness behavior

It should use shared document/path infrastructure instead of raw `vscode.workspace.openTextDocument(...)`.

### 2. `EfunDocsManager` becomes the façade for panel data access

`EfunDocsManager` already owns the tracker. The panel should not create a second discovery path around it.

Add façade methods as needed so panel code can ask for:

- current-file function docs
- inherited/include-backed function groups
- refreshed per-document lookup state

without reaching around the tracker.

### 3. `FunctionDocPanel` becomes presentation-only

`FunctionDocPanel` should keep:

- webview lifecycle
- selection state
- HTML/view-model rendering
- goto definition / generate Javadoc commands

It should stop owning:

- inherit parsing
- include parsing
- recursive inherited file processing
- file resolution heuristics
- document-open traversal for function discovery

### 4. No behavior expansion

This package must not:

- add new doc sources
- change how hover/completion resolve efun docs
- change the panel UI contract
- change command ids

It is a unification/ownership cleanup only.

## Testing

At minimum:

- keep `src/efun/__tests__/FileFunctionDocTracker.test.ts` green
- keep `src/__tests__/functionDocPanel.test.ts` green
- keep relevant `src/__tests__/efunDocs.test.ts` regressions green
- add ownership guards or focused tests proving the panel no longer performs its own include/inherit traversal path

## Acceptance criteria

- `FunctionDocPanel` no longer walks include/inherit graphs itself
- tracker/facade own function-doc traversal
- shared document/path support is used for tracker traversal
- `npx tsc --noEmit` passes
- `npm test -- --runInBand` passes
