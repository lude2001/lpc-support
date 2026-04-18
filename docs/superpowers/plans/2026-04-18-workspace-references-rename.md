# Workspace References / Rename Implementation Plan

> Superseded on 2026-04-18 by [2026-04-18-navigation-capability-narrowing-design.md](/D:/code/lpc-support/docs/superpowers/specs/2026-04-18-navigation-capability-narrowing-design.md) and [2026-04-18-navigation-architecture-debt-reduction-design.md](/D:/code/lpc-support/docs/superpowers/specs/2026-04-18-navigation-architecture-debt-reduction-design.md). The workspace-wide relation pipeline below is retained only as historical context and is no longer the active production direction.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-wide `references` and safe `rename` for cross-file-visible symbols in the first phase: functions, file-scope globals, and type definitions, while keeping locals/parameters current-file only and refusing unsafe rename cases.

**Architecture:** Build a shared navigation-side relation pipeline instead of teaching `references` and `rename` to invent separate cross-file logic. First add a host-backed workspace semantic indexing seam plus a minimal `fileGlobals` summary contract, then add owner resolution and precise cross-file match collection, and finally wire `LanguageReferenceService` / `LanguageRenameService` and the LSP runtime onto that shared relation service while preserving the current-file fallback path.

**Tech Stack:** TypeScript, VS Code extension APIs and host shims, `ParsedDocumentService` / `SyntaxBuilder` / `SemanticModelBuilder`, navigation services, LSP runtime handlers, Jest + ts-jest.

---

## File Map

- Modify: `src/completion/types.ts`
  Responsibility: Add the minimal `FileGlobalSummary` summary type and thread `fileGlobals` through `DocumentSemanticSnapshot` / `FileSymbolRecord` without dragging full `symbolTable` data into the workspace index layer.
- Modify: `src/semantic/semanticSnapshot.ts`
  Responsibility: Expose `fileGlobals` on `SemanticSnapshot` and preserve it when converting to `DocumentSemanticSnapshot`.
- Modify: `src/semantic/SemanticModelBuilder.ts`
  Responsibility: Emit `fileGlobals` only for file-scope variables, keeping locals/parameters out of the new summary contract.
- Modify: `src/__tests__/semanticModelBuilder.test.ts`
  Responsibility: Lock the `fileGlobals` summary shape, prove locals/parameters do not leak into it, and prove the `toDocumentSemanticSnapshot(...)` / `DocumentSemanticSnapshotService` conversion seam preserves the new summary.
- Modify: `src/completion/projectSymbolIndex.ts`
  Responsibility: Carry `fileGlobals` inside file records so navigation-side indexing can reuse its summary storage pattern without pretending the completion-owned instance is the workspace truth source.
- Modify: `src/__tests__/projectSymbolIndex.test.ts`
  Responsibility: Prove file records preserve `fileGlobals` and inherited symbol queries do not regress.
- Create: `src/language/services/navigation/workspaceSymbolTypes.ts`
  Responsibility: Hold shared owner/result types for the navigation-side workspace relation pipeline so resolver / collector / relation service do not define subtly different shapes.
- Create: `src/language/services/navigation/WorkspaceSemanticIndexService.ts`
  Responsibility: Discover workspace files through a host seam, materialize `SemanticSnapshot`/summary data for unopened files, prefer open-document content over disk content, isolate workspace roots, and expose a read-only workspace index view to navigation services.
- Create: `src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts`
  Responsibility: Lock file discovery, open-document precedence, multi-root isolation, and “do not depend on completion prewarm” behavior.
- Create: `src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts`
  Responsibility: Resolve the cursor target into either a unique workspace-visible owner, `current-file-only`, or `ambiguous/unsupported`, including the canonical “implementation over prototype” callable rule.
- Create: `src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts`
  Responsibility: Lock owner resolution for functions, file globals, types, locals/parameters fallback, same-file prototype/implementation families, and cross-file `.h/.c` ambiguity.
- Create: `src/language/services/navigation/WorkspaceReferenceCollector.ts`
  Responsibility: Collect candidate references from the workspace index and re-confirm owner identity file-by-file so same-name/different-owner symbols never leak into the final result.
- Create: `src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts`
  Responsibility: Enumerate candidate positions inside one file for a named owner without degrading into ad-hoc text scanning, giving the collector a concrete token-/syntax-backed input set to re-confirm.
- Create: `src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts`
  Responsibility: Lock candidate enumeration anchoring, owner filtering, declaration exclusion, open-doc precedence, same-file prototype family handling, and conservative degradation when index data is incomplete.
- Create: `src/language/services/navigation/WorkspaceSymbolRelationService.ts`
  Responsibility: Orchestrate owner resolution, workspace candidate collection, current-file fallback, and safe rename edit construction behind one shared service used by both references and rename.
- Create: `src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts`
  Responsibility: Lock multi-URI references, safe multi-file rename edits, `prepareRename` rejection semantics, and current-file fallback behavior.
- Modify: `src/language/services/navigation/LanguageReferenceService.ts`
  Responsibility: Delegate to the workspace relation service first for workspace-visible symbols while preserving the existing single-file adapter path for locals/parameters and other current-file-only cases.
- Modify: `src/language/services/navigation/LanguageRenameService.ts`
  Responsibility: Mirror the same delegation strategy and preserve the existing `prepareRename(): undefined` contract for unsafe/unsupported workspace rename cases.
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`
  Responsibility: Prove host-agnostic service seams still work after the new relation service wiring, including multi-URI references and multi-file workspace edits.
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
  Responsibility: Instantiate the new navigation-side workspace indexing/relation services and wire them into reference/rename service constructors using the existing host seam pattern.
- Modify: `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
  Responsibility: Lock production wiring so the new services are constructed and forwarded through the navigation surface.
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts`
  Responsibility: Prove LSP handlers preserve multi-URI reference results, multi-file rename edits, and `prepareRename === undefined` rejection semantics on the real handler seam.

**Reference files to read before coding:**
- `docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md`
- `src/semantic/SemanticModelBuilder.ts`
- `src/semantic/semanticSnapshot.ts`
- `src/completion/types.ts`
- `src/completion/projectSymbolIndex.ts`
- `src/language/services/navigation/LanguageReferenceService.ts`
- `src/language/services/navigation/LanguageRenameService.ts`
- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/lsp/server/__tests__/navigationHandlers.test.ts`

## Chunk 1: Workspace Snapshot and Index Foundation

### Task 1: Add Red Tests for `fileGlobals` and Workspace Semantic Indexing

**Files:**
- Modify: `src/__tests__/semanticModelBuilder.test.ts`
- Modify: `src/__tests__/projectSymbolIndex.test.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts`

- [ ] **Step 1: Add a failing semantic-model test for file-scope global summaries**

Extend `src/__tests__/semanticModelBuilder.test.ts` with a case that proves only file-scope globals are emitted:

```ts
test('builds fileGlobals only for file-scope variables', () => {
    const snapshot = buildSemanticSnapshot([
        'int global_hp;',
        'private object COMBAT_D;',
        '',
        'void demo(int local_arg) {',
        '    int local_hp;',
        '}'
    ].join('\n'));

    expect(snapshot.fileGlobals).toEqual([
        expect.objectContaining({
            name: 'global_hp',
            dataType: 'int',
            sourceUri: snapshot.uri,
            range: expect.any(vscode.Range)
        }),
        expect.objectContaining({
            name: 'COMBAT_D',
            dataType: 'object',
            sourceUri: snapshot.uri,
            range: expect.any(vscode.Range),
            selectionRange: expect.any(vscode.Range)
        })
    ]);
});
```

- [ ] **Step 2: Add a failing conversion-seam test for `DocumentSemanticSnapshotService`**

In the same `src/__tests__/semanticModelBuilder.test.ts` file, extend the existing snapshot-service coverage so the new summary must survive `toDocumentSemanticSnapshot(...)`:

```ts
test('DocumentSemanticSnapshotService preserves fileGlobals in the document snapshot view', () => {
    const document = createDocument([
        'object COMBAT_D;',
        'void demo() {}'
    ].join('\n'));

    const snapshot = DocumentSemanticSnapshotService.getInstance().getSnapshot(document, false);

    expect(snapshot.fileGlobals).toEqual([
        expect.objectContaining({
            name: 'COMBAT_D',
            dataType: 'object',
            sourceUri: document.uri.toString()
        })
    ]);
});
```

- [ ] **Step 3: Add a failing file-record test for `ProjectSymbolIndex` summary carriage**

Extend `src/__tests__/projectSymbolIndex.test.ts` with a case that proves file records preserve the new minimal summary instead of requiring `symbolTable`:

```ts
test('stores fileGlobals summaries on file records', () => {
    const snapshot = createSnapshot('/virtual/room.c');
    snapshot.fileGlobals = [{
        name: 'COMBAT_D',
        dataType: 'object',
        sourceUri: snapshot.uri,
        range: new vscode.Range(0, 0, 0, 8)
    }];

    const index = new ProjectSymbolIndex(new InheritanceResolver(undefined, ['/']));
    index.updateFromSnapshot(snapshot);

    expect(index.getRecord(snapshot.uri)?.fileGlobals.map((item) => item.name)).toEqual(['COMBAT_D']);
    expect(index.getAllRecords()[0].fileGlobals.map((item) => item.name)).toEqual(['COMBAT_D']);
});
```

- [ ] **Step 4: Create failing tests for `WorkspaceSemanticIndexService`**

Create `src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts` with red cases that cover all three phase-1 query classes:

```ts
test('indexes unopened workspace files through host findFiles/openTextDocument', async () => {
    const host = createHost({
        files: ['file:///D:/workspace/a.c', 'file:///D:/workspace/b.c'],
        texts: {
            'file:///D:/workspace/a.c': 'int query_id() { return 1; }',
            'file:///D:/workspace/b.c': 'int demo() { return query_id(); }'
        }
    });

    const service = new WorkspaceSemanticIndexService({ host });
    const view = await service.getIndexView('D:/workspace');

    expect(view.getFunctionCandidateFiles('query_id')).toContain('file:///D:/workspace/a.c');
});

test('prefers open document text over disk text for the active workspace file', async () => {
    const host = createHost({
        files: ['file:///D:/workspace/room.c'],
        texts: { 'file:///D:/workspace/room.c': 'int old_name() { return 1; }' },
        openDocuments: [{ uri: 'file:///D:/workspace/room.c', text: 'int new_name() { return 1; }', version: 7 }]
    });

    const service = new WorkspaceSemanticIndexService({ host });
    const view = await service.getIndexView('D:/workspace');

    expect(view.getFunctionCandidateFiles('new_name')).toContain('file:///D:/workspace/room.c');
    expect(view.getFunctionCandidateFiles('old_name')).toEqual([]);
});

test('does not mix candidate files across workspace roots', async () => {
    const host = createHost({
        files: ['file:///D:/alpha/query.c', 'file:///D:/beta/query.c'],
        texts: {
            'file:///D:/alpha/query.c': 'int query_id() { return 1; }',
            'file:///D:/beta/query.c': 'int query_id() { return 2; }'
        }
    });

    const service = new WorkspaceSemanticIndexService({ host });
    const alphaView = await service.getIndexView('D:/alpha');

    expect(alphaView.getFunctionCandidateFiles('query_id')).toEqual(['file:///D:/alpha/query.c']);
});

test('exposes candidate files for fileGlobals through the workspace index view', async () => {
    const host = createHost({
        files: ['file:///D:/workspace/room.c'],
        texts: {
            'file:///D:/workspace/room.c': 'object COMBAT_D; void demo() { COMBAT_D = 0; }'
        }
    });

    const service = new WorkspaceSemanticIndexService({ host });
    const view = await service.getIndexView('D:/workspace');

    expect(view.getFileGlobalCandidateFiles('COMBAT_D')).toEqual(['file:///D:/workspace/room.c']);
});

test('exposes candidate files for type definitions through the workspace index view', async () => {
    const host = createHost({
        files: ['file:///D:/workspace/types.c'],
        texts: {
            'file:///D:/workspace/types.c': 'class Payload { int hp; }'
        }
    });

    const service = new WorkspaceSemanticIndexService({ host });
    const view = await service.getIndexView('D:/workspace');

    expect(view.getTypeCandidateFiles('Payload')).toEqual(['file:///D:/workspace/types.c']);
});
```

- [ ] **Step 5: Run the foundation red slice**

Run:

```bash
npx jest --runInBand src/__tests__/semanticModelBuilder.test.ts src/__tests__/projectSymbolIndex.test.ts src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts
```

Expected:
- `semanticModelBuilder.test.ts` FAILS because `fileGlobals` does not exist yet.
- the `DocumentSemanticSnapshotService` conversion assertion FAILS until `toDocumentSemanticSnapshot(...)` is updated.
- `projectSymbolIndex.test.ts` FAILS because file records do not carry `fileGlobals`.
- `WorkspaceSemanticIndexService.test.ts` FAILS because the service does not exist yet and the index view does not expose function/global/type queries.

- [ ] **Step 6: Commit the red foundation tests**

```bash
git add src/__tests__/semanticModelBuilder.test.ts src/__tests__/projectSymbolIndex.test.ts src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts
git commit -m "test(navigation): add workspace index foundation red cases"
```

### Task 2: Implement `fileGlobals` and the Host-Backed Workspace Semantic Index

**Files:**
- Modify: `src/completion/types.ts`
- Modify: `src/semantic/semanticSnapshot.ts`
- Modify: `src/semantic/SemanticModelBuilder.ts`
- Modify: `src/__tests__/semanticModelBuilder.test.ts`
- Modify: `src/completion/projectSymbolIndex.ts`
- Modify: `src/__tests__/projectSymbolIndex.test.ts`
- Create: `src/language/services/navigation/workspaceSymbolTypes.ts`
- Create: `src/language/services/navigation/WorkspaceSemanticIndexService.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts`

- [ ] **Step 1: Add the minimal `FileGlobalSummary` contract**

Update `src/completion/types.ts` with the smallest useful summary shape:

```ts
export interface FileGlobalSummary {
    name: string;
    dataType: string;
    sourceUri: string;
    range: vscode.Range;
    selectionRange?: vscode.Range;
}
```

Thread `fileGlobals: FileGlobalSummary[]` through:

- `DocumentSemanticSnapshot`
- `FileSymbolRecord`
- any other summary record touched by the index layer

Keep the contract deliberately narrow; do **not** add `symbolTable`, raw `Symbol`, or initializer syntax here.

- [ ] **Step 2: Emit `fileGlobals` from `SemanticModelBuilder` and preserve them in document snapshots**

Modify `src/semantic/semanticSnapshot.ts` and `src/semantic/SemanticModelBuilder.ts` so snapshots expose the new summary:

```ts
return {
    // existing fields...
    fileGlobals: this.symbolTable
        .getGlobalScope()
        .symbolsArray()
        .filter((symbol) => symbol.type === SymbolType.VARIABLE)
        .map((symbol) => ({
            name: symbol.name,
            dataType: symbol.dataType ?? 'mixed',
            sourceUri: syntaxDocument.uri,
            range: symbol.range,
            selectionRange: symbol.selectionRange
        })),
    symbolTable: this.symbolTable,
    createdAt: Date.now()
};
```

Use the actual project helpers/APIs instead of inventing `symbolsArray()` if the global scope exposes a different iteration surface. The key constraints are:

- only file-scope variables
- keep locals/parameters out
- preserve existing function/type behavior unchanged
- ensure `toDocumentSemanticSnapshot(...)` carries `fileGlobals` through unchanged so `DocumentSemanticSnapshotService` does not silently drop them

- [ ] **Step 3: Carry `fileGlobals` inside `ProjectSymbolIndex` records**

Update `src/completion/projectSymbolIndex.ts` so records store and clone the new summary:

```ts
this.records.set(snapshot.uri, {
    uri: snapshot.uri,
    version: snapshot.version,
    exportedFunctions: snapshot.exportedFunctions.map(cloneFunction),
    typeDefinitions: snapshot.typeDefinitions.map(cloneType),
    fileGlobals: snapshot.fileGlobals.map(globalItem => ({ ...globalItem })),
    inheritStatements: /* existing clone */,
    includeStatements: /* existing clone */,
    macroReferences: /* existing clone */,
    updatedAt: snapshot.createdAt
});
```

Do not turn `ProjectSymbolIndex` into the workspace truth source here; just keep its storage contract aligned with the new summary.

- [ ] **Step 4: Implement the `WorkspaceSemanticIndexService` host seam**

Create `src/language/services/navigation/WorkspaceSemanticIndexService.ts` with a host seam modeled after the existing definition-service host:

```ts
export interface WorkspaceSemanticIndexHost {
    findFiles(pattern: vscode.RelativePattern): Promise<readonly vscode.Uri[]>;
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
}

export class WorkspaceSemanticIndexService {
    public async getIndexView(workspaceRoot: string): Promise<WorkspaceSymbolIndexView> {
        // discover files for one workspace root
        // build or load semantic snapshots for those files
        // cache per-workspace/per-version snapshot state
    }
}
```

Implementation rules for this step:

- reuse the existing parse/syntax/semantic pipeline
- isolate candidate files by workspace root
- do not depend on completion-side prewarming

- [ ] **Step 5: Implement open-document precedence and read-only candidate loading**

Extend the same service so index construction prefers open documents and only falls back to disk for unopened files:

```ts
const document = this.findOpenDocument(uri) ?? await this.host.openTextDocument(vscode.Uri.parse(uri));
const snapshot = this.snapshotService.getSnapshot(document, false);
```

Lock the behavior to the red tests from Task 1:

- open document text wins over disk text
- unopened files are still indexed through `openTextDocument`
- multi-root candidates stay isolated

- [ ] **Step 6: Implement the read-only index view API for functions, fileGlobals, and types**

Finish `WorkspaceSemanticIndexService` by exposing a view that can answer all three phase-1 candidate queries:

```ts
view.getFunctionCandidateFiles(name);
view.getFileGlobalCandidateFiles(name);
view.getTypeCandidateFiles(name);
```

Back these lookups with the summaries already present on snapshots / file records; do not read `symbolTable` out of band here.

- [ ] **Step 7: Re-run the foundation slice and make it green**

Run:

```bash
npx jest --runInBand src/__tests__/semanticModelBuilder.test.ts src/__tests__/projectSymbolIndex.test.ts src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts
```

Expected:
- 0 failures

- [ ] **Step 8: Commit the foundation implementation**

```bash
git add src/completion/types.ts src/semantic/semanticSnapshot.ts src/semantic/SemanticModelBuilder.ts src/__tests__/semanticModelBuilder.test.ts src/completion/projectSymbolIndex.ts src/__tests__/projectSymbolIndex.test.ts src/language/services/navigation/workspaceSymbolTypes.ts src/language/services/navigation/WorkspaceSemanticIndexService.ts src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts
git commit -m "feat(navigation): add workspace semantic index foundation"
```

## Chunk 2: Owner Resolution and Precise Cross-File Matching

### Task 3: Add Red Tests for Owner Resolution, Collection, and Relation Semantics

**Files:**
- Create: `src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts`

- [ ] **Step 1: Create red owner-resolver tests**

Create `src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts` covering the phase-1 symbol kinds and prototype rules:

```ts
test('returns workspace-visible owner for a uniquely declared function', async () => {
    const result = await resolver.resolveOwner(document, positionOn('query_id'));
    expect(result.kind).toBe('workspace-visible');
    expect(result.owner.key).toBe('function:file:///D:/workspace/room.c:...');
});

test('treats locals and parameters as current-file only', async () => {
    const localResult = await resolver.resolveOwner(document, positionOn('local_hp'));
    expect(localResult.kind).toBe('current-file-only');
});

test('returns workspace-visible owner for a uniquely declared file global', async () => {
    const result = await resolver.resolveOwner(document, positionOn('COMBAT_D'));
    expect(result.kind).toBe('workspace-visible');
    expect(result.owner.kind).toBe('global');
});

test('returns workspace-visible owner for a uniquely declared type definition', async () => {
    const result = await resolver.resolveOwner(document, positionOn('Payload'));
    expect(result.kind).toBe('workspace-visible');
    expect(result.owner.kind).toBe('type');
});

test('uses the implementation as canonical owner when a same-file prototype exists', async () => {
    const result = await resolver.resolveOwner(document, positionOnPrototype('execute_command'));
    expect(result.kind).toBe('workspace-visible');
    expect(result.owner.kind).toBe('function');
    expect(result.owner.canonicalDeclarationLine).toBe(9);
});

test('returns ambiguous for cross-file prototype/implementation pairs that cannot be proven equivalent', async () => {
    const result = await resolver.resolveOwner(headerDocument, positionOn('execute_command'));
    expect(result.kind).toBe('ambiguous');
});
```

- [ ] **Step 2: Create red collector tests**

Create `src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts` with cases for precise cross-file confirmation:

```ts
test('collects references only from files whose confirmed owner matches the target owner', async () => {
    const matches = await collector.collect(owner, candidateFiles, { includeDeclaration: false });
    expect(matches.map((item) => item.uri)).toEqual([
        'file:///D:/workspace/room.c',
        'file:///D:/workspace/cmds/look.c'
    ]);
});

test('filters same-name but different-owner functions', async () => {
    const matches = await collector.collect(owner, [
        'file:///D:/workspace/room.c',
        'file:///D:/workspace/other/query.c'
    ], { includeDeclaration: true });
    expect(matches.map((item) => item.uri)).toEqual(['file:///D:/workspace/room.c']);
});

test('filters same-name different-owner candidates within the same file after re-confirmation', async () => {
    const matches = await collector.collect(owner, ['file:///D:/workspace/mixed.c'], { includeDeclaration: true });
    expect(matches.every((item) => item.uri === 'file:///D:/workspace/mixed.c')).toBe(true);
    expect(matches).toHaveLength(2);
});

test('same-file prototype and implementation stay in one callable family for references', async () => {
    const matches = await collector.collect(owner, ['file:///D:/workspace/prototype.c'], { includeDeclaration: true });
    expect(matches).toEqual(expect.arrayContaining([
        expect.objectContaining({ uri: 'file:///D:/workspace/prototype.c' }),
        expect.objectContaining({ uri: 'file:///D:/workspace/prototype.c' })
    ]));
});

test('prefers the open document snapshot over disk content when confirming owners', async () => {
    const matches = await collector.collect(owner, ['file:///D:/workspace/room.c'], { includeDeclaration: true });
    expect(matches[0].range.start.line).toBe(0);
});
```

- [ ] **Step 3: Create red relation-service tests**

Create `src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts` for the orchestration rules:

```ts
test('returns workspace references for workspace-visible owners and current-file fallback otherwise', async () => {
    const refs = await service.collectReferences(document, positionOn('query_id'), { includeDeclaration: false });
    expect(refs).toHaveLength(2);
});

test('returns the current-file fallback sentinel for locals and parameters', async () => {
    const result = await service.collectReferences(document, positionOn('local_hp'), { includeDeclaration: true });
    expect(result).toBe(CURRENT_FILE_FALLBACK);
});

test('prepareRename stays undefined when owner resolution is ambiguous', async () => {
    const prepared = await service.prepareRename(document, positionOn('execute_command'));
    expect(prepared).toBeUndefined();
});

test('buildRenameEdit returns multi-uri edits only when every match reconfirms the same owner', async () => {
    const edit = await service.buildRenameEdit(document, positionOn('query_id'), 'query_name');
    expect(Object.keys(edit.changes)).toEqual([
        'file:///D:/workspace/room.c',
        'file:///D:/workspace/cmds/look.c'
    ]);
});

test('same-file prototype and implementation are renamed as one callable family', async () => {
    const edit = await service.buildRenameEdit(document, positionOn('execute_command'), 'perform_command');
    expect(edit.changes['file:///D:/workspace/prototype.c']).toEqual(expect.arrayContaining([
        expect.objectContaining({ newText: 'perform_command' }),
        expect.objectContaining({ newText: 'perform_command' })
    ]));
});
```

- [ ] **Step 4: Run the owner/collector red slice**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts
```

Expected:
- all three files FAIL because the resolver / collector / relation services do not exist yet.

- [ ] **Step 5: Commit the red owner/collector tests**

```bash
git add src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts
git commit -m "test(navigation): add workspace relation red cases"
```

### Task 4: Implement Owner Resolution, Collector Filtering, and Shared Relation Orchestration

**Files:**
- Create: `src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts`
- Create: `src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts`
- Create: `src/language/services/navigation/WorkspaceReferenceCollector.ts`
- Create: `src/language/services/navigation/WorkspaceSymbolRelationService.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts`
- Create: `src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts`

- [ ] **Step 1: Implement `WorkspaceSymbolOwnerResolver`**

Create `src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts` around a small shared result vocabulary:

```ts
export type WorkspaceOwnerResolution =
    | { kind: 'workspace-visible'; owner: WorkspaceSymbolOwner }
    | { kind: 'current-file-only' }
    | { kind: 'ambiguous'; reason: string }
    | { kind: 'unsupported'; reason: string };
```

Implementation rules:

- functions, file globals, and types may produce `workspace-visible`
- locals/parameters immediately return `current-file-only`
- same-file prototype + implementation collapses to the implementation owner
- same-file prototype + implementation still describe one callable family for later references/rename collection
- `.h/.c` prototype/implementation pairs remain ambiguous unless the code can already prove they are the same family through existing source data
- do not invent new textual heuristics to join owners

- [ ] **Step 2: Implement `WorkspaceReferenceCandidateEnumerator` so collector input is explicit**

Create `src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts` with one clear job: given a file plus a phase-1 owner kind/name, return candidate positions that are worth re-confirming.

Suggested surface:

```ts
export class WorkspaceReferenceCandidateEnumerator {
    public enumerate(
        document: vscode.TextDocument,
        owner: WorkspaceSymbolOwner
    ): Array<{ range: vscode.Range; symbolName: string }>;
}
```

Hard constraints:

- use token-/syntax-backed identifier traversal or existing symbol-aware helpers
- do not emit candidates from raw substring/regex scans alone
- for same-file prototype/implementation families, include both declaration sites plus callable usages

- [ ] **Step 3: Implement `WorkspaceReferenceCollector` with owner reconfirmation**

Create `src/language/services/navigation/WorkspaceReferenceCollector.ts` so collection works in two phases:

1. use `WorkspaceSymbolIndexView` to narrow candidate files
2. use `WorkspaceReferenceCandidateEnumerator` to enumerate candidate positions inside each file
3. re-run owner confirmation at each candidate position
4. keep only exact-owner matches

Suggested skeleton:

```ts
export class WorkspaceReferenceCollector {
    public async collect(
        owner: WorkspaceSymbolOwner,
        candidateFiles: string[],
        options: { includeDeclaration: boolean }
    ): Promise<LanguageLocation[]> {
        // enumerate candidate positions
        // resolve owner at each position
        // keep only exact-owner matches
    }
}
```

Do not use plain grep output as final matches; every candidate must re-confirm owner identity before it survives.

- [ ] **Step 4: Implement `WorkspaceSymbolRelationService` and lock current-file fallback as a first-class contract**

Create `src/language/services/navigation/WorkspaceSymbolRelationService.ts` to orchestrate:

```ts
export const CURRENT_FILE_FALLBACK = Symbol('current-file-fallback');

export class WorkspaceSymbolRelationService {
    public async collectReferences(...) { /* owner resolve -> workspace or fallback */ }
    public async prepareRename(...) { /* owner resolve -> undefined when unsafe */ }
    public async buildRenameEdit(...) { /* owner resolve + collector -> multi-uri edit */ }
}
```

Required semantics:

- workspace-visible owner -> workspace collection path
- current-file-only -> return the explicit `CURRENT_FILE_FALLBACK` sentinel so callers preserve existing single-file adapter behavior
- ambiguous / unsupported -> references degrade conservatively, rename rejects
- rename succeeds only when every candidate reconfirms the same owner
- same-file prototype + implementation families must be collected/renamed together once canonical owner resolution succeeds

- [ ] **Step 5: Re-run the owner/collector slice and make it green**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts
```

Expected:
- 0 failures

- [ ] **Step 6: Commit the shared relation implementation**

```bash
git add src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts src/language/services/navigation/WorkspaceReferenceCollector.ts src/language/services/navigation/WorkspaceSymbolRelationService.ts src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts
git commit -m "feat(navigation): add workspace symbol relation service"
```

## Chunk 3: Navigation Service and LSP Wiring

### Task 5: Add Red Integration Tests for Navigation Services and LSP Handlers

**Files:**
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`
- Modify: `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts`

- [ ] **Step 1: Extend `navigationServices.test.ts` with red service-level workspace cases**

Add host-agnostic tests that exercise the real service seam with injected workspace relation dependencies:

```ts
test('reference service returns multi-uri results from the workspace relation service', async () => {
    const service = new AstBackedLanguageReferenceService({
        workspaceRelationService: {
            collectReferences: jest.fn().mockResolvedValue([
                { uri: 'file:///D:/workspace/a.c', range: rangeA },
                { uri: 'file:///D:/workspace/b.c', range: rangeB }
            ])
        }
    } as any);

    const result = await service.provideReferences({ context: createContext(document), position, includeDeclaration: false });
    expect(result.map((item) => item.uri)).toEqual(['file:///D:/workspace/a.c', 'file:///D:/workspace/b.c']);
});

test('reference service preserves current-file references when the relation service returns CURRENT_FILE_FALLBACK', async () => {
    const service = new AstBackedLanguageReferenceService({
        workspaceRelationService: {
            collectReferences: jest.fn().mockResolvedValue(CURRENT_FILE_FALLBACK)
        },
        referenceResolver: {
            resolveReferences: jest.fn().mockReturnValue({
                wordRange: rangeA,
                matches: [{ range: rangeA, isDeclaration: false }]
            })
        }
    } as any);

    const result = await service.provideReferences({ context: createContext(document), position, includeDeclaration: false });
    expect(result).toEqual([{ uri: 'file:///D:/workspace/test.c', range: rangeA }]);
});

test('rename service keeps prepareRename undefined when the workspace relation service refuses rename', async () => {
    const service = new AstBackedLanguageRenameService({
        workspaceRelationService: {
            prepareRename: jest.fn().mockResolvedValue(undefined),
            buildRenameEdit: jest.fn()
        }
    } as any);

    await expect(service.prepareRename({ context: createContext(document), position })).resolves.toBeUndefined();
});

test('rename service preserves current-file fallback when the relation service returns CURRENT_FILE_FALLBACK', async () => {
    const service = new AstBackedLanguageRenameService({
        workspaceRelationService: {
            prepareRename: jest.fn().mockResolvedValue(CURRENT_FILE_FALLBACK),
            buildRenameEdit: jest.fn().mockResolvedValue(CURRENT_FILE_FALLBACK)
        },
        referenceResolver: {
            resolveReferences: jest.fn().mockReturnValue({
                wordRange: rangeA,
                matches: [
                    { range: rangeA, isDeclaration: true },
                    { range: rangeB, isDeclaration: false }
                ]
            })
        }
    } as any);

    await expect(service.prepareRename({ context: createContext(document), position })).resolves.toEqual({
        range: rangeA,
        placeholder: 'round'
    });

    await expect(service.provideRenameEdits({ context: createContext(document), position, newName: 'turn' })).resolves.toEqual({
        changes: {
            'file:///D:/workspace/test.c': [
                { range: rangeA, newText: 'turn' },
                { range: rangeB, newText: 'turn' }
            ]
        }
    });
});

test('rename service does not fall back to single-file edits when workspace rename is unsafe', async () => {
    const service = new AstBackedLanguageRenameService({
        workspaceRelationService: {
            prepareRename: jest.fn().mockResolvedValue(undefined),
            buildRenameEdit: jest.fn().mockResolvedValue({ changes: {} })
        },
        referenceResolver: {
            resolveReferences: jest.fn().mockReturnValue({
                wordRange: rangeA,
                matches: [{ range: rangeA, isDeclaration: true }]
            })
        }
    } as any);

    await expect(service.provideRenameEdits({ context: createContext(document), position, newName: 'turn' })).resolves.toEqual({
        changes: {}
    });
});
```

- [ ] **Step 2: Add red production-wiring tests**

Extend `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts` so production service construction proves the new relation/index services are instantiated and fed into references/rename:

```ts
expect(WorkspaceSemanticIndexService).toHaveBeenCalled();
expect(WorkspaceSymbolRelationService).toHaveBeenCalled();
expect(AstBackedLanguageReferenceService).toHaveBeenCalledWith(
    expect.objectContaining({ workspaceRelationService: expect.any(Object) })
);
expect(AstBackedLanguageRenameService).toHaveBeenCalledWith(
    expect.objectContaining({ workspaceRelationService: expect.any(Object) })
);
expect(WorkspaceSemanticIndexService).toHaveBeenCalledWith(expect.objectContaining({
    host: expect.objectContaining({
        findFiles: expect.any(Function),
        openTextDocument: expect.any(Function),
        getWorkspaceFolders: expect.any(Function)
    })
}));
```

- [ ] **Step 3: Add red LSP handler tests for multi-URI refs and rejection semantics**

Extend `src/lsp/server/__tests__/navigationHandlers.test.ts` with cases like:

```ts
test('registerReferencesHandler returns multi-file LSP locations unchanged', async () => {
    navigationService.provideReferences.mockResolvedValue([
        { uri: 'file:///D:/workspace/a.c', range: rangeA },
        { uri: 'file:///D:/workspace/b.c', range: rangeB }
    ]);
    // assert onReferences result preserves both URIs
});

test('registerRenameHandler preserves undefined prepareRename rejections', async () => {
    navigationService.prepareRename.mockResolvedValue(undefined);
    // assert handler returns undefined
});

test('registerRenameHandler returns empty workspace edits when unsafe rename is rejected downstream', async () => {
    navigationService.provideRenameEdits.mockResolvedValue({ changes: {} });
    // assert the handler preserves the empty changes object
});

test('registerRenameHandler returns multi-file workspace edits', async () => {
    navigationService.provideRenameEdits.mockResolvedValue({
        changes: {
            'file:///D:/workspace/a.c': [{ range: rangeA, newText: 'query_name' }],
            'file:///D:/workspace/b.c': [{ range: rangeB, newText: 'query_name' }]
        }
    });
    // assert the LSP workspace edit shape contains both files
});
```

- [ ] **Step 4: Run the integration red slice**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
```

Expected:
- tests FAIL because services are not yet wired through the workspace relation pipeline.

- [ ] **Step 5: Commit the red integration tests**

```bash
git add src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "test(navigation): add workspace references rename integration reds"
```

### Task 6: Wire References/Rename and Production Runtime onto the Shared Relation Service

**Files:**
- Modify: `src/language/services/navigation/LanguageReferenceService.ts`
- Modify: `src/language/services/navigation/LanguageRenameService.ts`
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
- Modify: `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts`

- [ ] **Step 1: Teach `LanguageReferenceService` to delegate to workspace relation logic first**

Update `src/language/services/navigation/LanguageReferenceService.ts` so it keeps the current adapter path for single-file-only symbols but uses the shared relation service for workspace-visible owners:

```ts
public async provideReferences(request: LanguageReferenceRequest): Promise<LanguageLocation[]> {
    const workspaceReferences = await this.workspaceRelationService?.collectReferences(
        request.context.document,
        request.position,
        { includeDeclaration: request.includeDeclaration }
    );
    if (workspaceReferences && workspaceReferences !== CURRENT_FILE_FALLBACK) {
        return workspaceReferences;
    }

    const references = this.getReferenceResolver().resolveReferences(request.context.document, request.position);
    // existing current-file fallback
}
```

The relation service should return the explicit `CURRENT_FILE_FALLBACK` sentinel when the symbol stays current-file-only so the existing adapter path continues to work unchanged. Reserve `undefined` for “no relation service injected” or similar internal absence cases, not for semantic fallback.

- [ ] **Step 2: Mirror the same pattern in `LanguageRenameService`**

Update `src/language/services/navigation/LanguageRenameService.ts` so:

- `prepareRename(...)` asks the relation service first
- `undefined` stays the rejection contract
- `provideRenameEdits(...)` uses workspace edits when the relation service can prove safety
- `provideRenameEdits(...)` only falls back to the single-file adapter path when the relation service returns the explicit `CURRENT_FILE_FALLBACK`
- `provideRenameEdits(...)` must **not** fall back to single-file edits when the relation service signals unsafe workspace rename by returning empty changes / rejection

Suggested flow:

```ts
const prepared = await this.workspaceRelationService?.prepareRename(...);
if (prepared !== CURRENT_FILE_FALLBACK) {
    return prepared;
}
// existing single-file fallback
```

Use an explicit internal sentinel or result shape for “current-file fallback” so `undefined` keeps its public meaning of “rename rejected”.

- [ ] **Step 3: Wire the new services into production runtime**

Modify `src/lsp/server/runtime/createProductionLanguageServices.ts` to instantiate:

- `WorkspaceSemanticIndexService`
- `WorkspaceSymbolOwnerResolver`
- `WorkspaceReferenceCollector`
- `WorkspaceSymbolRelationService`

Reuse the existing host seam pattern from `LanguageDefinitionService`:

```ts
const navigationHost = {
    findFiles: async (pattern) => vscode.workspace.findFiles(pattern),
    openTextDocument: async (target) => typeof target === 'string'
        ? vscode.workspace.openTextDocument(target)
        : vscode.workspace.openTextDocument(target),
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders
};

const workspaceSemanticIndexService = new WorkspaceSemanticIndexService({ host: navigationHost });
const workspaceSymbolRelationService = new WorkspaceSymbolRelationService({
    workspaceSemanticIndexService,
    ownerResolver,
    referenceCollector
});

const referenceService = new AstBackedLanguageReferenceService({
    workspaceRelationService: workspaceSymbolRelationService
});
const renameService = new AstBackedLanguageRenameService({
    workspaceRelationService: workspaceSymbolRelationService
});
```

The host passed into `WorkspaceSemanticIndexService` should concretely reuse the existing navigation runtime capabilities:

- `findFiles`
- `openTextDocument`
- `getWorkspaceFolders`

- [ ] **Step 4: Re-run the integration slice and then full verification**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
npx tsc --noEmit
npx jest --runInBand src/__tests__/semanticModelBuilder.test.ts src/__tests__/projectSymbolIndex.test.ts src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
```

Expected:
- all targeted tests pass
- `tsc` exits 0

If the targeted slices are green, run the full suite before claiming completion:

```bash
npm test -- --runInBand
```

Expected:
- 0 failing suites

- [ ] **Step 5: Commit the final wiring**

```bash
git add src/language/services/navigation/LanguageReferenceService.ts src/language/services/navigation/LanguageRenameService.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "feat(navigation): add workspace references and rename"
```
