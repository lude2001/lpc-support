# Navigation Capability Narrowing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow `references / rename` to LPC-safe scopes by removing workspace-wide function/type expansion, keeping rename only for locals, parameters, and file-scope globals, and preserving file-level plus provable inherit-chain navigation.

**Architecture:** Keep the existing single-file resolver as the authoritative base, then add one narrow navigation-side inherited-relation seam that only appends provable inherit-chain results. `definition / hover / signature help / scoped / object inference` stay unchanged; only `LanguageReferenceService`, `LanguageRenameService`, and their production wiring change.

**Tech Stack:** TypeScript, Jest, VS Code/LSP navigation services, parser/syntax/semantic snapshots, `InheritanceResolver`, `ScopedMethodResolver`

---

## File Structure

### Existing files to modify

- Modify: `src/language/services/navigation/LanguageReferenceService.ts`
  - Remove production dependence on workspace-wide relation expansion for function/type references.
  - Merge current-file exact references with optional inherit-chain additions only.
- Modify: `src/language/services/navigation/LanguageRenameService.ts`
  - Reject function and `struct/class` rename explicitly.
  - Keep locals/parameters current-file only.
  - Merge file-global current-file edits with optional inherit-chain edits only.
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
  - Stop wiring `WorkspaceSymbolRelationService` into reference/rename production paths.
  - Instantiate the new inherited-relation seam instead.
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`
  - Replace workspace-wide expectations with narrowed service behavior.
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts`
  - Lock LSP handler behavior for narrowed references/rename semantics.
- Modify: `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
  - Prove production wiring now constructs and injects the inherited-relation seam instead of the workspace relation path.
- Modify: `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
  - Remove the now-invalid “same-file function rename succeeds” runtime expectation and replace it with a runtime assertion that function rename is rejected.
- Modify: `README.md`
  - Update the user-facing capability matrix for references/rename.
- Modify: `CHANGELOG.md`
  - Record the navigation capability narrowing as a behavioral change.

### New files to create

- Create: `src/language/services/navigation/InheritedSymbolRelationService.ts`
  - Narrow navigation seam for:
    - file-global references/rename over provable inherit chains
    - function references over current-file + provable inherit-chain callable family
    - explicit scoped-call inclusion via existing scoped resolution semantics
- Create: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`
  - Focused red/green protection for:
    - function references limited to file + provable inherit chain
    - scoped-call inclusion (`::foo()` / `room::foo()`)
    - no workspace name expansion
    - file-global rename shadowing / branch ambiguity downgrade

### Existing files intentionally **not** changed in this task

- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/language/services/navigation/LanguageHoverService.ts`
- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- `src/objectInference/**`
- `src/language/services/navigation/WorkspaceSymbolRelationService.ts`
- `src/language/services/navigation/WorkspaceSemanticIndexService.ts`
- `src/language/services/navigation/WorkspaceReferenceCollector.ts`
- `src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts`

These workspace-wide relation components may remain in the tree for now; they simply leave the production `references / rename` path.

## Execution Notes

- Work in a dedicated worktree branch; the root workspace currently has unrelated release-file edits.
- Do not “clean up” or delete the old workspace relation subsystem in this plan.
- Do not expand parser/AST scanning beyond existing parser/syntax/semantic services.
- Reuse existing `ScopedMethodResolver` / scoped semantics for `::foo()` / `room::foo()` instead of inventing parallel rules.

## Chunk 1: Service Narrowing and Inherit-Chain Reds

### Task 1: Write service-level red tests for the narrowed contract

**Files:**
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`

- [ ] **Step 1: Add a failing reference-service test proving function references no longer accept workspace-wide expansion**

```ts
test('reference service stops trusting workspace-wide function matches when only current-file references are proven', async () => {
    const service = new AstBackedLanguageReferenceService({
        referenceResolver: /* exact current-file resolver stub returning only test.c matches */,
        workspaceRelationService: {
            collectReferences: jest.fn(async () => [
                { uri: 'file:///D:/workspace/alpha.c', range: /* unrelated */ },
                { uri: 'file:///D:/workspace/beta.c', range: /* unrelated */ }
            ])
        } // existing production seam that must stop driving function references
    } as any);

    const references = await service.provideReferences(/* function usage request */);

    expect(references).toEqual([
        expect.objectContaining({ uri: 'file:///D:/workspace/test.c' })
    ]);
});
```

- [ ] **Step 2: Add a failing reference-service test proving `struct/class definitions` stay current-file only even if old workspace relation returns extra files**

```ts
test('reference service keeps struct/class definition references current-file only', async () => {
    const service = new AstBackedLanguageReferenceService({
        referenceResolver: /* current-file type references stub */,
        workspaceRelationService: {
            collectReferences: jest.fn(async () => [
                { uri: 'file:///D:/workspace/other.c', range: /* unrelated */ }
            ])
        }
    } as any);

    const references = await service.provideReferences(/* type-definition position */);
    expect(references).toEqual([
        expect.objectContaining({ uri: 'file:///D:/workspace/test.c' })
    ]);
});
```

- [ ] **Step 3: Add a failing rename-service test proving function rename is rejected**

```ts
test('rename service rejects function rename before building edits', async () => {
    const service = new AstBackedLanguageRenameService({
        inheritedRelationService: {
            classifyRenameTarget: jest.fn(async () => ({ kind: 'unsupported' }))
        }
    } as any);

    await expect(service.prepareRename(/* function position */)).resolves.toBeUndefined();
    await expect(service.provideRenameEdits(/* function rename */)).resolves.toEqual({ changes: {} });
});
```

- [ ] **Step 4: Add a failing rename-service test proving file globals merge current-file edits with inherit-chain edits only**

```ts
test('rename service appends provable inherited file-global edits to current-file edits', async () => {
    const service = new AstBackedLanguageRenameService({
        referenceResolver: /* current-file resolver stub */,
        inheritedRelationService: {
            classifyRenameTarget: jest.fn(async () => ({ kind: 'file-global' })),
            buildInheritedRenameEdits: jest.fn(async () => ({
                'file:///D:/workspace/base.c': [/* edit */]
            }))
        }
    } as any);

    const edit = await service.provideRenameEdits(/* global rename */);
    expect(Object.keys(edit.changes)).toEqual(expect.arrayContaining([
        'file:///D:/workspace/test.c',
        'file:///D:/workspace/base.c'
    ]));
});
```

- [ ] **Step 5: Add a failing rename-service test proving downgrade keeps current-file edits for file globals**

```ts
test('rename service keeps current-file file-global edits when inherited expansion downgrades to empty', async () => {
    const service = new AstBackedLanguageRenameService({
        referenceResolver: /* current-file resolver stub returning test.c edits */,
        inheritedRelationService: {
            classifyRenameTarget: jest.fn(async () => ({ kind: 'file-global' })),
            buildInheritedRenameEdits: jest.fn(async () => ({}))
        }
    } as any);

    const edit = await service.provideRenameEdits(/* ambiguous inherited global rename */);
    expect(edit).toEqual({
        changes: {
            'file:///D:/workspace/test.c': expect.any(Array)
        }
    });
});
```

- [ ] **Step 6: Run the focused service tests and confirm they fail for the new reasons**

Run: `npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts -t "workspace-wide function matches|struct/class definition references|function rename is rejected|appends provable inherited file-global edits|keeps current-file file-global edits"`

Expected:
- new function-reference test fails because `AstBackedLanguageReferenceService` still prefers `workspaceRelationService` results over current-file-only proof
- new type-reference test fails because `struct/class definitions` still flow through the old workspace relation path
- new function rename test fails because rename still delegates to workspace relation / current-file fallback
- new file-global merge test fails because inherited relation seam does not exist yet
- new downgrade test fails because rename currently has no “append inherited edits while preserving current-file edits” path

- [ ] **Step 7: Commit the red tests**

```bash
git add src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "test(navigation): add narrowed reference rename reds"
```

### Task 2: Add focused reds for the new inherited relation seam

**Files:**
- Create: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Add a failing test for current-file + scoped/inherit-chain function references only**

```ts
test('collectInheritedReferences includes only provable inherit-family function positions', async () => {
    // fixture:
    // /base.c defines create()
    // /room.c inherits /base.c and calls ::create()
    // /other.c calls create() but is unrelated
    expect(matches).toEqual(expect.arrayContaining([
        expect.objectContaining({ uri: roomUri }),
        expect.objectContaining({ uri: baseUri })
    ]));
    expect(matches).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ uri: otherUri })
    ]));
});
```

- [ ] **Step 2: Add a failing test for `room::init()` inclusion via existing scoped semantics**

```ts
test('collectInheritedReferences reuses scoped resolution semantics for room::init()', async () => {
    expect(matches).toEqual(expect.arrayContaining([
        expect.objectContaining({ uri: childUri, range: expect.objectContaining({ start: { line: 3, character: 4 } }) })
    ]));
});
```

- [ ] **Step 3: Add a failing test for file-global shadowing downgrade**

```ts
test('buildInheritedRenameEdits stops at child shadowing and returns no cross-file edits for the shadowed branch', async () => {
    expect(editMap).toEqual({});
});
```

- [ ] **Step 4: Add a failing test for branch ambiguity downgrade**

```ts
test('buildInheritedRenameEdits returns no inherited edits when sibling inherit branches make the global binding ambiguous', async () => {
    expect(editMap).toEqual({});
});
```

- [ ] **Step 5: Add a failing test for `room::foo()` qualifier ambiguity**

```ts
test('collectInheritedReferences returns no scoped function matches when room:: qualifier is not unique', async () => {
    expect(matches).toEqual([]);
});
```

- [ ] **Step 6: Add a failing test for unresolved inherit downgrade**

```ts
test('collectInheritedReferences does not expand function references when the traversed inherit chain is unresolved', async () => {
    expect(matches).toEqual([]);
});
```

- [ ] **Step 7: Run the new seam tests and confirm they fail because the service does not exist**

Run: `npx jest --runInBand src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

Expected: FAIL with module-not-found / missing export / missing behavior assertions.

- [ ] **Step 8: Commit the red seam tests**

```bash
git add src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts
git commit -m "test(navigation): add inherited relation seam reds"
```

### Task 3: Implement the inherited relation seam

**Files:**
- Create: `src/language/services/navigation/InheritedSymbolRelationService.ts`
- Test: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Add the seam contract and narrow result types**

```ts
export type RenameTargetKind =
    | { kind: 'current-file-only' }
    | { kind: 'file-global' }
    | { kind: 'unsupported' };

export interface InheritedSymbolRelationService {
    collectInheritedReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: vscode.Range }>>;

    classifyRenameTarget(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<RenameTargetKind>;

    buildInheritedRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string
    ): Promise<Record<string, Array<{ range: vscode.Range; newText: string }>>>;
}
```

- [ ] **Step 2: Implement file-global inherit-chain expansion only**

```ts
// Outline only:
// 1. resolve visible symbol at the cursor
// 2. reject non-global / ambiguous bindings
// 3. walk only statically resolved inherit targets
// 4. include only positions whose visible binding resolves back to the same declaration owner
// 5. on shadowing / ambiguity / unresolved inherit -> return no inherited edits
```

- [ ] **Step 3: Implement function inherit-family reference collection without workspace-wide candidate files**

```ts
// Outline only:
// 1. current-file resolver stays outside this service
// 2. use semantic snapshots + InheritanceResolver to traverse the proven inherit graph
// 3. collect declaration/implementation family points in related files
// 4. use ScopedMethodResolver semantics for ::foo() / room::foo()
// 5. never consult WorkspaceSemanticIndexService / WorkspaceReferenceCollector
```

- [ ] **Step 4: Run the new seam test file until it passes**

Run: `npx jest --runInBand src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the new seam**

```bash
git add src/language/services/navigation/InheritedSymbolRelationService.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts
git commit -m "feat(navigation): add inherited relation seam"
```

## Chunk 2: Production Wiring, Runtime Regression, and Docs

### Task 4: Rewire reference and rename services onto the narrowed seam

**Files:**
- Modify: `src/language/services/navigation/LanguageReferenceService.ts`
- Modify: `src/language/services/navigation/LanguageRenameService.ts`
- Test: `src/language/services/navigation/__tests__/navigationServices.test.ts`

- [ ] **Step 1: Replace `workspaceRelationService` dependencies with `inheritedRelationService`**

```ts
private readonly dependencies: {
    referenceResolver?: LanguageSymbolReferenceAdapter;
    inheritedRelationService?: Pick<InheritedSymbolRelationService, ...>;
}
```

- [ ] **Step 2: Make reference service always compute current-file exact references first, then append inherited matches**

```ts
const currentFile = this.provideCurrentFileReferences(request);
const inherited = await inheritedRelationService?.collectInheritedReferences(...);
return dedupeLocations([...currentFile, ...inherited]);
```

- [ ] **Step 3: Make rename service reject unsupported kinds and only append inherited edits for file globals**

```ts
const target = await inheritedRelationService?.classifyRenameTarget(...);
if (target?.kind === 'unsupported') {
    return undefined; // prepareRename
}
if (target?.kind !== 'file-global') {
    return currentFileOnly;
}
const inherited = await inheritedRelationService.buildInheritedRenameEdits(...);
return mergeWorkspaceEdits(currentFileOnly, inherited);
```

- [ ] **Step 4: Run service tests until they pass**

Run: `npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the narrowed service wiring**

```bash
git add src/language/services/navigation/LanguageReferenceService.ts src/language/services/navigation/LanguageRenameService.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(navigation): narrow reference rename service wiring"
```

### Task 5: Update production construction and handler/runtime tests

**Files:**
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
- Modify: `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts`
- Modify: `src/lsp/__tests__/spawnedRuntime.integration.test.ts`

- [ ] **Step 1: Construct the inherited relation seam in production and inject it into reference/rename services**

```ts
const inheritedRelationService = new InheritedSymbolRelationService({
    macroManager,
    projectConfigService,
    scopedMethodResolver
});
const referenceService = new AstBackedLanguageReferenceService({ inheritedRelationService });
const renameService = new AstBackedLanguageRenameService({ inheritedRelationService });
```

- [ ] **Step 2: Remove production expectations that reference/rename build on `WorkspaceSymbolRelationService`**

```ts
expect(workspaceRelationCtor).not.toHaveBeenCalledForReferenceRenamePath();
expect(inheritedRelationCtor).toHaveBeenCalledTimes(1);
```

- [ ] **Step 3: Update handler tests**

```ts
test('registerReferencesHandler does not surface workspace-wide function name expansion', async () => {
    expect(references).toEqual([
        expect.objectContaining({ uri: 'file:///D:/workspace/nav.c' })
    ]);
});

test('registerReferencesHandler still returns provable inherit-chain file-global references', async () => {
    expect(references).toEqual(expect.arrayContaining([
        expect.objectContaining({ uri: 'file:///D:/workspace/base.c' }),
        expect.objectContaining({ uri: 'file:///D:/workspace/child.c' })
    ]));
});

test('registerRenameHandler returns undefined / empty edits for function rename', async () => {
    expect(prepareResult).toBeUndefined();
    expect(renameResult).toEqual({ changes: {} });
});

test('registerRenameHandler still returns multi-file edits for provable inherit-chain file-global rename', async () => {
    expect(renameResult?.changes).toEqual(expect.objectContaining({
        'file:///D:/workspace/base.c': expect.any(Array),
        'file:///D:/workspace/child.c': expect.any(Array)
    }));
});
```

- [ ] **Step 4: Replace the spawned runtime function-rename success test with a rejection test**

```ts
test('rename rejects same-file function rename at runtime', async () => {
    const prepare = await harness.connection.sendRequest(PrepareRenameRequest.type, ...);
    expect(prepare).toBeNull();
});
```

- [ ] **Step 5: Add a spawned-runtime positive test for a still-supported rename path**

```ts
test('rename still applies unsaved same-file local-variable edits from the latest in-memory text at runtime', async () => {
    const prepare = await harness.connection.sendRequest(PrepareRenameRequest.type, /* local variable position */);
    const rename = await harness.connection.sendRequest(RenameRequest.type, /* local variable rename */);

    expect(prepare).not.toBeNull();
    expect(rename?.changes?.[uriFromPath(documentPath)]).toBeDefined();
    expect(rename?.changes?.[uriFromPath(documentPath)]).not.toHaveLength(0);
});
```

- [ ] **Step 6: Run the runtime/integration verification set**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the production/runtime wiring**

```bash
git add src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
git commit -m "feat(navigation): narrow runtime references and rename behavior"
```

### Task 6: Update user-facing docs for the narrowed capability surface

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/object-inference-design.md`

- [ ] **Step 1: Update README capability bullets**

```md
- 函数 `references` 现在只提供当前文件级 + 可证明继承链级结果
- `rename` 仅支持局部变量、参数、文件级全局变量
- 函数与 `struct/class` 定义不再支持 rename
```

- [ ] **Step 2: Update CHANGELOG to record the narrowing as a behavior change**

```md
- 收窄 `references / rename` 能力边界：移除工作区级函数名字扩散，函数 rename 退出支持面，只保留文件级 + 可证明继承链级导航。
```

- [ ] **Step 3: Update `docs/object-inference-design.md` so the navigation architecture note no longer claims `WorkspaceSymbolRelationService` is the production-wide owner for `references / rename`**

```md
- 工作区级 `references / rename` 的 `0.45.0` 说明改为历史背景
- 当前主路径改写为：references/rename 已收窄到文件级 + 可证明继承链级
```

- [ ] **Step 4: Run the final verification set**

Run: `npx tsc --noEmit`

Expected: PASS

Run: `npm test -- --runInBand`

Expected: PASS

- [ ] **Step 5: Commit the docs update**

```bash
git add README.md CHANGELOG.md docs/object-inference-design.md
git commit -m "docs(navigation): document narrowed references rename scope"
```

## Final Verification Checklist

- [ ] `npx jest --runInBand src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`
- [ ] `npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts`
- [ ] `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts`
- [ ] `npx tsc --noEmit`
- [ ] `npm test -- --runInBand`

## Notes for the implementing worker

- Do not widen the seam back toward `WorkspaceSymbolRelationService`; this plan is intentionally subtractive.
- Keep current-file exact reference/rename behavior as the source of truth for locals and parameters.
- Treat unresolved inherit, shadowing ambiguity, and branch ambiguity as downgrade signals, not partial-success opportunities.
- If a test currently proves workspace-wide function rename succeeds, delete or rewrite that expectation in the same task that narrows rename behavior.
