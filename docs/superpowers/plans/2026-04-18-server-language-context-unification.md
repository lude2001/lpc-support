# Server Language Context Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify server-side path/root/document/context construction behind shared `serverPathUtils` and `ServerLanguageContextFactory` so navigation-family handlers, completion, and diagnostics stop maintaining parallel shim logic.

**Architecture:** First extract the shared path/root helpers that navigation, completion, and diagnostics currently duplicate. Then introduce a single `ServerLanguageContextFactory` that owns `DocumentStore + WorkspaceSession -> LanguageCapabilityContext` conversion, migrate all current `createNavigationCapabilityContext(...)` consumers to it, and finally move completion plus diagnostics onto the same shared foundation without changing product behavior.

**Tech Stack:** TypeScript, Jest, VS Code API-compatible shims, LSP server handlers, `DocumentStore`, `WorkspaceSession`

---

## File Map

### Create

- `src/lsp/server/runtime/serverPathUtils.ts`
  - shared server-side URI/path/workspace-root helpers
- `src/lsp/server/runtime/ServerLanguageContextFactory.ts`
  - shared builder for full `LanguageCapabilityContext` and diagnostics-light request context
- `src/lsp/server/runtime/__tests__/serverPathUtils.test.ts`
  - unit protection for URI normalization and workspace-root selection
- `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`
  - unit protection for the shared document shim contract
- `docs/superpowers/plans/2026-04-18-server-language-context-unification.md`
  - this implementation plan

### Modify

- `src/lsp/server/bootstrap/registerCapabilities.ts`
  - construct and distribute one shared `ServerLanguageContextFactory`
- `src/lsp/server/handlers/navigation/registerDefinitionHandler.ts`
- `src/lsp/server/handlers/navigation/registerHoverHandler.ts`
- `src/lsp/server/handlers/navigation/registerReferencesHandler.ts`
- `src/lsp/server/handlers/navigation/registerRenameHandler.ts`
- `src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts`
  - switch navigation-family handlers to `contextFactory.createCapabilityContext(...)`
- `src/lsp/server/handlers/codeActions/registerCodeActionHandler.ts`
- `src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts`
- `src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts`
- `src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts`
  - switch all current `createNavigationCapabilityContext(...)` consumers to the shared factory
- `src/lsp/server/handlers/completion/registerCompletionHandler.ts`
  - remove its private duplicated builder and use the shared factory
- `src/lsp/server/runtime/DiagnosticsSession.ts`
  - stop duplicating path/root logic and use shared helper/factory light outlet
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
  - keep navigation-family handler behavior locked while wiring changes
- `src/lsp/server/__tests__/completionHandler.test.ts`
  - protect completion request/resolve behavior under the new shared builder
- `src/lsp/server/__tests__/diagnosticsHandlers.test.ts`
  - protect diagnostics request creation and workspace-root behavior under shared helper/factory
- `src/lsp/server/__tests__/signatureHelpHandlers.test.ts`
- `src/lsp/server/__tests__/structureHandlers.test.ts`
  - keep non-navigation consumers of the shared context green

### Delete

- `src/lsp/server/handlers/navigation/navigationHandlerContext.ts`
  - remove the old dedicated navigation-only context builder after all consumers migrate

### Keep Unchanged

- `src/lsp/server/runtime/vscodeShim.ts`
- `src/lsp/server/runtime/DocumentStore.ts`
- `src/lsp/server/runtime/WorkspaceSession.ts`
- `src/lsp/server/handlers/formatting/registerFormattingHandlers.ts`
- `src/language/services/**`
- `src/ast/astManager.ts`
- `src/language/services/navigation/LanguageDefinitionService.ts`

---

## Chunk 1: Shared Path/Root Helpers

### Task 1: Create an isolated worktree and inventory the duplicated helper surface

**Files:**
- Modify: none

- [ ] **Step 1: Create a dedicated worktree**

Run:

```bash
git worktree add .worktrees/server-language-context-unification -b codex/server-language-context-unification
```

Expected:
- worktree created at `D:\code\lpc-support\.worktrees\server-language-context-unification`
- branch `codex/server-language-context-unification` checked out there

- [ ] **Step 2: Confirm the worktree is clean**

Run:

```bash
git -C D:\code\lpc-support\.worktrees\server-language-context-unification status --short
```

Expected:
- no output

- [ ] **Step 3: Inventory all duplicated helper definitions**

Run:

```bash
rg -n "fromFileUri|normalizeComparablePath|isPathPrefix|resolveWorkspaceRoot" src/lsp/server
```

Expected:
- hits in:
  - `src/lsp/server/handlers/navigation/navigationHandlerContext.ts`
  - `src/lsp/server/handlers/completion/registerCompletionHandler.ts`
  - `src/lsp/server/runtime/DiagnosticsSession.ts`

- [ ] **Step 4: Do not commit inventory-only work**

Expected:
- no commit yet

### Task 2: Add failing tests for shared server path/root helpers

**Files:**
- Create: `src/lsp/server/runtime/__tests__/serverPathUtils.test.ts`
- Test: `src/lsp/server/runtime/__tests__/serverPathUtils.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/lsp/server/runtime/__tests__/serverPathUtils.test.ts` with cases like:

```ts
import { describe, expect, test } from '@jest/globals';
import {
    fromFileUri,
    normalizeComparablePath,
    resolveWorkspaceRootFromRoots
} from '../serverPathUtils';

describe('serverPathUtils', () => {
    test('fromFileUri normalizes file uris into platform file paths', () => {
        expect(fromFileUri('file:///D:/workspace/test.c')).toBe('D:/workspace/test.c');
        expect(fromFileUri('untitled:test')).toBe('untitled:test');
    });

    test('normalizeComparablePath lowercases Windows drive paths and trims trailing separators', () => {
        expect(normalizeComparablePath('D:\\Workspace\\src\\')).toBe('d:/workspace/src');
        expect(normalizeComparablePath('/workspace/src/')).toBe('/workspace/src');
    });

    test('resolveWorkspaceRootFromRoots prefers the deepest matching workspace root', () => {
        expect(resolveWorkspaceRootFromRoots(
            'file:///D:/workspace/sub/file.c',
            ['D:/workspace', 'D:/workspace/sub']
        )).toBe('D:/workspace/sub');
    });

    test('resolveWorkspaceRootFromRoots falls back to the first root when no document uri is available', () => {
        expect(resolveWorkspaceRootFromRoots(undefined, ['D:/a', 'D:/b'])).toBe('D:/a');
    });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npx jest --runInBand src/lsp/server/runtime/__tests__/serverPathUtils.test.ts
```

Expected:
- FAIL because `serverPathUtils.ts` does not exist yet

- [ ] **Step 3: Implement `serverPathUtils.ts`**

Create `src/lsp/server/runtime/serverPathUtils.ts` with the shared helpers:

```ts
export function fromFileUri(uri: string): string { ... }
export function normalizeComparablePath(path: string): string { ... }
export function isPathPrefix(root: string, candidate: string): boolean { ... }
export function resolveWorkspaceRootFromRoots(documentUri: string | undefined, roots: string[]): string { ... }
```

Implementation requirements:
- preserve the current `fromFileUri(...)` Windows decode behavior
- preserve longest-prefix root selection
- preserve Windows drive lowercase normalization

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npx jest --runInBand src/lsp/server/runtime/__tests__/serverPathUtils.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Migrate the three duplicate helper call-sites to `serverPathUtils`**

Modify:
- `src/lsp/server/handlers/navigation/navigationHandlerContext.ts`
- `src/lsp/server/handlers/completion/registerCompletionHandler.ts`
- `src/lsp/server/runtime/DiagnosticsSession.ts`

Rules:
- replace local `fromFileUri / normalizeComparablePath / isPathPrefix` copies with imports
- keep each file's current document/context builder intact for now
- do not introduce the full factory yet

- [ ] **Step 6: Run targeted tests for the helper migration**

Run:

```bash
npx jest --runInBand src/lsp/server/runtime/__tests__/serverPathUtils.test.ts src/lsp/server/__tests__/completionHandler.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the shared helper extraction**

Run:

```bash
git add src/lsp/server/runtime/serverPathUtils.ts src/lsp/server/runtime/__tests__/serverPathUtils.test.ts src/lsp/server/handlers/navigation/navigationHandlerContext.ts src/lsp/server/handlers/completion/registerCompletionHandler.ts src/lsp/server/runtime/DiagnosticsSession.ts src/lsp/server/__tests__/completionHandler.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "refactor(lsp): extract shared server path utils"
```

---

## Chunk 2: Shared Language Context Factory For Navigation-Family Handlers

### Task 3: Add failing tests for a shared `ServerLanguageContextFactory`

**Files:**
- Create: `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`
- Test: `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts`

- [ ] **Step 1: Write the failing factory tests**

Create `src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts` with cases like:

```ts
import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DocumentStore } from '../DocumentStore';
import { WorkspaceSession } from '../WorkspaceSession';
import { ServerLanguageContextFactory } from '../ServerLanguageContextFactory';

describe('ServerLanguageContextFactory', () => {
    test('creates a navigation-compatible capability context from DocumentStore text', () => {
        const store = new DocumentStore();
        store.open('file:///D:/workspace/test.c', 7, 'int main() {\n    local_\n}');

        const session = new WorkspaceSession({ workspaceRoots: ['D:/work', 'D:/workspace'] });
        const factory = new ServerLanguageContextFactory(store, session);
        const context = factory.createCapabilityContext('file:///D:/workspace/test.c');

        expect(context.workspace.workspaceRoot).toBe('D:/workspace');
        expect(context.document.getText()).toContain('local_');
        expect(context.document.getWordRangeAtPosition({ line: 1, character: 6 })).toEqual(
            new vscode.Range(1, 4, 1, 10)
        );
        expect(context.document.positionAt(17)).toEqual(expect.objectContaining({ line: 1, character: 4 }));
    });

    test('creates a diagnostics-light context from the same shared roots', () => {
        const store = new DocumentStore();
        store.open('file:///D:/workspace/check.c', 1, 'BAD_OBJECT->query_name();');

        const session = new WorkspaceSession({ workspaceRoots: ['D:/workspace'] });
        const factory = new ServerLanguageContextFactory(store, session);
        const diagnosticsContext = factory.createDiagnosticsRequestContext('file:///D:/workspace/check.c');

        expect(diagnosticsContext.workspaceRoot).toBe('D:/workspace');
        expect(diagnosticsContext.document.getText()).toBe('BAD_OBJECT->query_name();');
    });
});
```

- [ ] **Step 2: Run the factory test to verify it fails**

Run:

```bash
npx jest --runInBand src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts
```

Expected:
- FAIL because `ServerLanguageContextFactory.ts` does not exist yet

- [ ] **Step 3: Implement `ServerLanguageContextFactory.ts`**

Create `src/lsp/server/runtime/ServerLanguageContextFactory.ts` with:

```ts
export class ServerLanguageContextFactory {
    public constructor(
        private readonly documentStore: DocumentStore,
        private readonly workspaceSession: WorkspaceSession
    ) {}

    public createCapabilityContext(documentUri?: string): LanguageCapabilityContext { ... }

    public createDiagnosticsRequestContext(documentUri: string): {
        document: LanguageDocument;
        workspaceRoot: string;
    } { ... }
}
```

Implementation requirements:
- use `serverPathUtils` for all URI/root logic
- keep `vscode.Position / Range`-compatible behavior for the full document shim
- source all text from `DocumentStore`
- keep diagnostics on a lighter document surface

- [ ] **Step 4: Run the factory test to verify it passes**

Run:

```bash
npx jest --runInBand src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts
```

Expected:
- PASS

### Task 4: Migrate all current `createNavigationCapabilityContext(...)` consumers to the shared factory

**Files:**
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Modify: `src/lsp/server/handlers/navigation/registerDefinitionHandler.ts`
- Modify: `src/lsp/server/handlers/navigation/registerHoverHandler.ts`
- Modify: `src/lsp/server/handlers/navigation/registerReferencesHandler.ts`
- Modify: `src/lsp/server/handlers/navigation/registerRenameHandler.ts`
- Modify: `src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts`
- Modify: `src/lsp/server/handlers/codeActions/registerCodeActionHandler.ts`
- Modify: `src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts`
- Modify: `src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts`
- Modify: `src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts`
- Delete: `src/lsp/server/handlers/navigation/navigationHandlerContext.ts`
- Test: `src/lsp/server/__tests__/navigationHandlers.test.ts`
- Test: `src/lsp/server/__tests__/signatureHelpHandlers.test.ts`
- Test: `src/lsp/server/__tests__/structureHandlers.test.ts`

- [ ] **Step 1: Add one handler-level red test that proves `registerCapabilities` wires a shared factory**

Extend `src/lsp/server/__tests__/navigationHandlers.test.ts` with a focused test that:
- mocks `ServerLanguageContextFactory`
- verifies `registerCapabilities(...)` constructs it once
- verifies navigation/codeAction/structure/signatureHelp handlers receive the same factory dependency

If mocking the class directly proves too brittle, instead add a narrower assertion that one constructed factory instance is reused for multiple handler registrations.

- [ ] **Step 2: Run the targeted handler test to verify it fails**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts -t "shared factory|registerCapabilities"
```

Expected:
- FAIL because handlers still build contexts through `navigationHandlerContext.ts`

- [ ] **Step 3: Update `registerCapabilities.ts` to construct one shared factory**

Implementation outline:

```ts
const contextFactory = new ServerLanguageContextFactory(documentStore, workspaceSession);
```

Then pass `contextFactory` into every handler that currently depends on `createNavigationCapabilityContext(...)`.

- [ ] **Step 4: Update each navigation-family handler to consume `contextFactory.createCapabilityContext(...)`**

Replace direct calls like:

```ts
createNavigationCapabilityContext(uri, documentStore, workspaceSession)
```

with:

```ts
contextFactory.createCapabilityContext(uri)
```

- [ ] **Step 5: Delete `navigationHandlerContext.ts` after the last consumer is migrated**

Run:

```bash
git rm src/lsp/server/handlers/navigation/navigationHandlerContext.ts
```

- [ ] **Step 6: Run the navigation/structure/signature-help regression set**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts src/lsp/server/__tests__/structureHandlers.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the navigation-family migration**

Run:

```bash
git add src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/runtime/ServerLanguageContextFactory.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts src/lsp/server/handlers/navigation/registerDefinitionHandler.ts src/lsp/server/handlers/navigation/registerHoverHandler.ts src/lsp/server/handlers/navigation/registerReferencesHandler.ts src/lsp/server/handlers/navigation/registerRenameHandler.ts src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts src/lsp/server/handlers/codeActions/registerCodeActionHandler.ts src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts src/lsp/server/__tests__/structureHandlers.test.ts src/lsp/server/handlers/navigation/navigationHandlerContext.ts
git commit -m "refactor(lsp): unify handler language contexts"
```

---

## Chunk 3: Completion And Diagnostics Migration

### Task 5: Move completion onto the shared factory

**Files:**
- Modify: `src/lsp/server/handlers/completion/registerCompletionHandler.ts`
- Test: `src/lsp/server/__tests__/completionHandler.test.ts`

- [ ] **Step 1: Add a focused completion red test proving the shared factory is used**

Extend `src/lsp/server/__tests__/completionHandler.test.ts` with one targeted case that:
- mocks or spies on `ServerLanguageContextFactory`
- verifies both completion request and completion resolve use `contextFactory.createCapabilityContext(...)`

- [ ] **Step 2: Run the targeted completion test to verify it fails**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/completionHandler.test.ts -t "shared factory|completion resolve"
```

Expected:
- FAIL because completion still uses its private `createCapabilityContext(...)`

- [ ] **Step 3: Replace completion’s private builder with the shared factory**

In `registerCompletionHandler.ts`:
- remove local `createCapabilityContext(...)`
- remove local `resolveWorkspaceRoot(...)`
- remove local `fromFileUri / normalizeComparablePath / isPathPrefix`
- depend on a passed-in `contextFactory`

- [ ] **Step 4: Run the full completion handler test file**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/completionHandler.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the completion migration**

Run:

```bash
git add src/lsp/server/handlers/completion/registerCompletionHandler.ts src/lsp/server/__tests__/completionHandler.test.ts
git commit -m "refactor(lsp): reuse shared completion context factory"
```

### Task 6: Move diagnostics onto shared helper/light factory output

**Files:**
- Modify: `src/lsp/server/runtime/DiagnosticsSession.ts`
- Test: `src/lsp/server/__tests__/diagnosticsHandlers.test.ts`

- [ ] **Step 1: Add a diagnostics red test for shared root resolution**

Extend `src/lsp/server/__tests__/diagnosticsHandlers.test.ts` with a case that proves diagnostics request creation uses the shared root logic for nested workspace roots or missing document-uri edge cases.

Prefer a case like:

```ts
test('DiagnosticsSession uses the shared workspace-root selection for nested roots', async () => {
    // roots: D:/workspace and D:/workspace/sub
    // document: file:///D:/workspace/sub/check.c
    // expect diagnostics collector context.workspace.workspaceRoot === 'D:/workspace/sub'
});
```

- [ ] **Step 2: Run the targeted diagnostics test to verify it fails**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/diagnosticsHandlers.test.ts -t "shared workspace-root selection|nested roots"
```

Expected:
- FAIL or require new implementation path because diagnostics still owns its local helper copy

- [ ] **Step 3: Update `DiagnosticsSession.ts` to use the shared helper/factory**

Implementation requirements:
- remove local `fromFileUri / normalizeComparablePath / isPathPrefix`
- use `serverPathUtils` for root selection
- optionally instantiate `ServerLanguageContextFactory` once and consume `createDiagnosticsRequestContext(...)`
- keep diagnostics request shape unchanged for `LanguageDiagnosticsService`

- [ ] **Step 4: Run the diagnostics handler test file**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/diagnosticsHandlers.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the diagnostics migration**

Run:

```bash
git add src/lsp/server/runtime/DiagnosticsSession.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts
git commit -m "refactor(lsp): share diagnostics context helpers"
```

### Task 7: Final verification and cleanup

**Files:**
- Modify: none
- Test: repo verification

- [ ] **Step 1: Run type-check**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 2: Run the core LSP handler regression set**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/completionHandler.test.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts src/lsp/server/__tests__/structureHandlers.test.ts src/lsp/server/runtime/__tests__/serverPathUtils.test.ts src/lsp/server/runtime/__tests__/ServerLanguageContextFactory.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Run spawned runtime integration**

Run:

```bash
npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Run the full serial test suite**

Run:

```bash
npm test -- --runInBand
```

Expected:
- PASS

- [ ] **Step 5: Verify duplicate helpers are gone**

Run:

```bash
rg -n "function fromFileUri|function normalizeComparablePath|function isPathPrefix|createNavigationCapabilityContext" src/lsp/server
```

Expected:
- no remaining duplicate helper definitions
- `createNavigationCapabilityContext` no longer exists

- [ ] **Step 6: Summarize execution notes**

Record:
- which files introduced `serverPathUtils` and `ServerLanguageContextFactory`
- which handlers now consume the shared factory
- whether diagnostics uses the helper-only path or the factory light outlet
- exact verification commands and results

---

## Local Chunk Review Notes

### Chunk 1 checklist

- `serverPathUtils.ts` is the only server-side home for file-uri/path/root helper logic
- navigation/completion/diagnostics no longer each define their own helper copies

### Chunk 2 checklist

- one shared `ServerLanguageContextFactory` exists
- all current `createNavigationCapabilityContext(...)` consumers now use the shared factory
- `navigationHandlerContext.ts` is removed

### Chunk 3 checklist

- completion no longer owns a private context builder
- diagnostics no longer owns private root/path helper copies
- full LSP handler and spawned-runtime verification remain green

---

## Acceptance Criteria

- `src/lsp/server/handlers/navigation/navigationHandlerContext.ts` is gone
- `serverPathUtils.ts` is the single server-side source of `fromFileUri / normalizeComparablePath / isPathPrefix / resolveWorkspaceRootFromRoots`
- `ServerLanguageContextFactory.ts` is the shared source of full handler `LanguageCapabilityContext`
- all current navigation-family/context consumers use the shared factory
- completion uses the shared factory instead of its private builder
- diagnostics uses the shared path/root logic and, if implemented, the factory’s light outlet
- `registerFormattingHandlers.ts` remains unchanged in behavior and out of scope
- `npx tsc --noEmit`, targeted LSP handler tests, spawned runtime integration, and `npm test -- --runInBand` all pass
