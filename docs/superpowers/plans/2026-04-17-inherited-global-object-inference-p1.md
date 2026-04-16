# Inherited Static Global Object Inference P1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend static global object inference from current-file globals to inherited file-scope globals so inherited daemon/object handles participate in object-method completion, definition, hover, and signature help without regressing precedence or macro fallback behavior.

**Architecture:** Keep `ObjectInferenceService` as the only public inference entrypoint, preserve `GlobalObjectBindingResolver` as the single-file static binding solver, and add one focused `InheritedGlobalObjectBindingResolver` for DFS traversal over resolved inherit targets. Reuse `InheritanceResolver` as the only inherit-path source, route inherited lookup into recursive alias-tracing paths, and keep current-file/inherited precedence deterministic by using file-scope binding checks instead of access-position visibility for globals.

**Tech Stack:** TypeScript, VS Code extension APIs, existing `ASTManager` / `SemanticSnapshot` / `SyntaxDocument`, `InheritanceResolver`, Jest + ts-jest.

---

## File Map

- Create: `src/objectInference/InheritedGlobalObjectBindingResolver.ts`
  Responsibility: Traverse resolved inherit targets in declaration-order DFS, open parent documents, guard cycles, and ask the single-file resolver whether each ancestor defines a same-name static global object binding.
- Modify: `src/objectInference/GlobalObjectBindingResolver.ts`
  Responsibility: Expose a reusable snapshot/symbol-based single-file binding API, switch global precedence checks to file-scope semantics, add URI-aware alias cycle keys, and accept inherited-lookup callbacks for identifier aliases and global method receivers.
- Modify: `src/objectInference/ObjectInferenceService.ts`
  Responsibility: Instantiate the inherited resolver and enforce the full identifier priority chain `local > current-file global > inherited global > macro`.
- Modify: `src/objectInference/ReceiverTraceService.ts`
  Responsibility: Route recursive identifier source resolution through the same current-file + inherited-global chain used by the top-level identifier receiver path.
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
  Responsibility: Lock inherited global resolution, DFS ordering, shadowing, non-object blockers, alias tracing through inherited globals, and macro-fallback suppression.
- Test: `src/__tests__/providerIntegration.test.ts`
  Responsibility: Prove definition/completion consumers benefit from inherited global object inference.
- Test: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
  Responsibility: Prove at least one callable-doc consumer beyond completion/definition benefits from inherited global object inference.

**Reference files to read before coding:**
- `src/objectInference/GlobalObjectBindingResolver.ts`
- `src/objectInference/ReceiverTraceService.ts`
- `src/objectInference/ObjectInferenceService.ts`
- `src/completion/inheritanceResolver.ts`
- `src/targetMethodLookup.ts`
- `src/symbolReferenceResolver.ts`
- `docs/superpowers/specs/2026-04-17-inherited-global-object-inference-design.md`

## Chunk 1: Inherited Static Global Binding Core

### Task 1: Lock P1 Precedence and Traversal Semantics with Red Tests

**Files:**
- Modify: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing direct-inherit resolution test**

Add a focused case proving that a child file can use a parent’s file-scope global `object`:

```ts
test('direct inherit file-scope global object resolves in child receivers', async () => {
    const parentFile = path.join(fixtureRoot, 'std', 'room.c');
    fs.mkdirSync(path.dirname(parentFile), { recursive: true });
    fs.writeFileSync(
        parentFile,
        [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");'
        ].join('\n')
    );

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'room.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'resolved',
        candidates: [
            {
                path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
                source: 'builtin-call'
            }
        ]
    });
});
```

- [ ] **Step 2: Write the failing DFS traversal tests**

Lock both the transitive lookup and the sibling-order semantics:

```ts
test('multi-level inherited global object bindings resolve through declaration-order DFS', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'object COMBAT_D = load_object("/adm/daemons/combat_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'inherit "/std/base_room";\n');

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'forest', 'room.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
            source: 'builtin-call'
        }
    ]);
});

test('direct inherit declaration order wins for same-name inherited globals', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'left_room.c'), 'object COMBAT_D = load_object("/adm/daemons/left_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'right_room.c'), 'object COMBAT_D = load_object("/adm/daemons/right_d");\n');

    const source = [
        'inherit "/std/left_room";',
        'inherit "/std/right_room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'forest', 'inherit-order-room.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'left_d.c'),
            source: 'builtin-call'
        }
    ]);
});

test('declaration-order DFS prefers the first direct inherit branch over later direct siblings', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'deep_parent.c'), 'object COMBAT_D = load_object("/adm/daemons/deep_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'left_room.c'), 'inherit "/std/deep_parent";\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'right_room.c'), 'object COMBAT_D = load_object("/adm/daemons/right_d");\n');

    const source = [
        'inherit "/std/left_room";',
        'inherit "/std/right_room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'forest', 'inherit-dfs-vs-bfs.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'deep_d.c'),
            source: 'builtin-call'
        }
    ]);
});
```

- [ ] **Step 3: Write the failing shadowing tests for current-file globals beating inherited globals**

Add object-shadowing, after-use blocking, and the non-object-blocker cases:

```ts
test('current-file global object still wins over inherited same-name global object', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/parent_d");\n');

    const source = [
        'inherit "/std/room";',
        '',
        'object COMBAT_D = load_object("/adm/daemons/local_d");',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-object.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'local_d.c'),
            source: 'builtin-call'
        }
    ]);
});

test('current-file file-scope global declared after use still blocks inherited globals and macros', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/parent_d");\n');
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/macro_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}',
        '',
        'object COMBAT_D = load_object("/adm/daemons/local_d");'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-after-use.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'local_d.c'),
            source: 'builtin-call'
        }
    ]);
});

test('current-file non-object global blocks inherited same-name object and macro fallback', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/parent_d");\n');
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/macro_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'inherit "/std/room";',
        '',
        'int COMBAT_D = 1;',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-non-object.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});

test('current-file non-object global declared after use still blocks inherited globals and macros', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/parent_d");\n');
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/macro_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}',
        '',
        'int COMBAT_D = 1;'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'shadow-non-object-after-use.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});
```

- [ ] **Step 4: Write the failing inherited-blocker and alias-tracing tests**

Add a closer-parent blocker and an alias-tracing-through-inherited-global case:

```ts
test('closer inherited non-object global blocks farther inherited object bindings and macros', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'object COMBAT_D = load_object("/adm/daemons/far_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'inherit "/std/base_room";\nint COMBAT_D = 1;\n');
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/macro_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'closer-parent-blocks.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});

test('local aliases trace through inherited file-scope global object bindings', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/combat_d");\n');

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    object ob = COMBAT_D;',
        '    ob->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'local-alias-through-inherit.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'ob->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
            source: 'builtin-call'
        }
    ]);
});
```

- [ ] **Step 5: Run the focused red slice**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "direct inherit file-scope global|multi-level inherited global|declaration-order DFS prefers|direct inherit declaration order wins|current-file global object still wins|declared after use still blocks inherited|current-file non-object global blocks|shadow-non-object-after-use|closer inherited non-object global blocks|local aliases trace through inherited"
```

Expected:
- The new inherited-global tests FAIL because no inherited binding path exists yet.
- Existing current-file precedence tests remain unaffected.

- [ ] **Step 6: Commit the red tests**

```bash
git add src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "test(object-inference): add inherited global binding red cases"
```

### Task 2: Refactor `GlobalObjectBindingResolver` into a Reusable Single-File Solver

**Files:**
- Modify: `src/objectInference/GlobalObjectBindingResolver.ts`

- [ ] **Step 1: Add a reusable single-file binding API that is not tied to the current access position**

Refactor the resolver to expose a lower-level API for “this document/snapshot/global-scope binding”:

```ts
export interface GlobalBindingResolveContext {
    document: vscode.TextDocument;
    snapshot: SemanticSnapshot;
    identifierName: string;
    visited: Set<string>;
    // No access-position argument here: file-scope binding precedence is not position-sensitive.
    resolveInheritedIdentifier?: (
        document: vscode.TextDocument,
        identifierName: string,
        visited: Set<string>
    ) => Promise<GlobalBindingResolution | undefined>;
}

public async resolveFileScopeBinding(
    document: vscode.TextDocument,
    identifierName: string,
    options?: { resolveInheritedIdentifier?: ... }
): Promise<GlobalBindingResolution | undefined> {
    const snapshot = this.astManager.getSemanticSnapshot(document, false);
    return this.resolveNamedBindingInSnapshot({
        document,
        snapshot,
        identifierName,
        visited: new Set(),
        resolveInheritedIdentifier: options?.resolveInheritedIdentifier
    });
}
```

The new low-level method should be the single-file truth for both current-file and parent-file global resolution.
Do not let `resolveNamedBindingInSnapshot(...)` accept or depend on an access position. The only position-aware lookup that remains in this subsystem should be local-variable / parameter tracing.

- [ ] **Step 2: Split “global-scope same-name binding exists” from `resolveVisibleSymbol(...)`**

Add a helper that checks the file’s global scope by name, not the access position:

```ts
private findGlobalScopeSymbol(snapshot: SemanticSnapshot, identifierName: string): Symbol | undefined {
    return snapshot.symbolTable.getGlobalScope().symbols.get(identifierName);
}
```

Use this helper for current-file/inherited-file precedence decisions. Keep `resolveVisibleSymbol(...)` only where position-sensitive local visibility is still required elsewhere.

- [ ] **Step 3: Upgrade alias cycle keys to include the document URI**

Replace the current single-file visit key with a URI-aware form:

```ts
private getVisitKey(document: vscode.TextDocument, symbol: Symbol, identifierName: string): string {
    return `${document.uri.toString()}:${identifierName}:${symbol.range.start.line}:${symbol.range.start.character}:${symbol.range.end.line}:${symbol.range.end.character}`;
}
```

All recursive identifier/global-alias paths inside this file should use the new key.

- [ ] **Step 4: Add inherited-identifier fallback hooks only where single-file lookup truly bottoms out**

When a current-file global initializer contains:

- an identifier alias
- or a `receiver->method()` initializer whose receiver is an identifier

and the current file has no same-name global binding, call the injected inherited-identifier callback instead of falling through to macro resolution immediately:

```ts
if (!aliasSymbol && context.resolveInheritedIdentifier) {
    return context.resolveInheritedIdentifier(document, unwrappedInitializer.name, visited);
}
```

Do not let this callback bypass a same-file non-object/global blocker.

- [ ] **Step 5: Run a narrow focused slice**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "current-file global object still wins|current-file non-object global blocks|closer inherited non-object global blocks"
```

Expected:
- Some tests may still fail until the inherited resolver exists.
- No current-file precedence test should regress.

- [ ] **Step 6: Commit the reusable single-file resolver refactor**

```bash
git add src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "refactor(object-inference): prepare single-file global binding reuse"
```

### Task 3: Implement `InheritedGlobalObjectBindingResolver` with `InheritanceResolver` DFS

**Files:**
- Create: `src/objectInference/InheritedGlobalObjectBindingResolver.ts`
- Modify: `src/objectInference/GlobalObjectBindingResolver.ts`

- [ ] **Step 1: Create the inherited resolver shell**

Add a focused resolver that depends on:

- `GlobalObjectBindingResolver`
- `InheritanceResolver`

Skeleton:

```ts
export class InheritedGlobalObjectBindingResolver {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: InheritanceResolver;

    constructor(
        macroManager: MacroManager | undefined,
        private readonly globalBindingResolver: GlobalObjectBindingResolver
    ) {
        this.inheritanceResolver = new InheritanceResolver(macroManager);
    }

    public async resolveInheritedBinding(
        document: vscode.TextDocument,
        identifierName: string,
        visitedUris: Set<string> = new Set([document.uri.toString()]),
        visitedBindings: Set<string> = new Set()
    ): Promise<GlobalBindingResolution | undefined> {
        return undefined;
    }
}
```

- [ ] **Step 2: Implement declaration-order DFS over resolved inherit targets**

Inside `resolveInheritedBinding(...)`:

1. get the current snapshot
2. call `this.inheritanceResolver.resolveInheritTargets(snapshot)`
3. iterate in returned order
4. for each resolved target:
   - open the parent document
   - skip if already in `visitedUris`
   - first ask `globalBindingResolver.resolveNamedBindingInSnapshot(...)`
   - if no same-name parent binding exists, recurse into that parent’s own inherits

Keep the search deterministic:

```ts
for (const target of resolvedTargets) {
    if (!target.resolvedUri || visitedUris.has(target.resolvedUri)) {
        continue;
    }
    // check parent file first, then recurse down this branch
}
```

- [ ] **Step 3: Ensure parent-file global checks use the parent file’s own global scope**

Do not pass the child access position into parent-file binding lookup. Instead, always resolve parent bindings through the new snapshot/global-scope single-file API:

```ts
const parentSnapshot = this.astManager.getSemanticSnapshot(parentDocument, false);
const parentBinding = await this.globalBindingResolver.resolveNamedBindingInSnapshot({
    document: parentDocument,
    snapshot: parentSnapshot,
    identifierName,
    visited: visitedBindings,
    resolveInheritedIdentifier: (doc, name, nestedVisited) =>
        this.resolveInheritedBinding(doc, name, new Set([...visitedUris, doc.uri.toString()]), nestedVisited)
});
```

- [ ] **Step 4: Preserve blocker semantics when a parent binding exists but is non-object / unknown / unsupported**

If the parent file defines the same-name global and the single-file resolver returns:

- `hasVisibleBinding: true` with empty candidates
- `reason`
- `diagnostics`

then stop and return that conservative result. Do not keep traversing siblings or recurse farther down that branch.

- [ ] **Step 5: Run the inherited-core red slice**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "direct inherit file-scope global|multi-level inherited global|closer inherited non-object global blocks"
```

Expected:
- Still may fail until top-level wiring happens.
- Parent traversal logic should now be in place.

- [ ] **Step 6: Commit the inherited resolver**

```bash
git add src/objectInference/InheritedGlobalObjectBindingResolver.ts src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "feat(object-inference): add inherited global binding resolver"
```

### Task 4: Wire the Full Priority Chain into Top-Level and Recursive Identifier Paths

**Files:**
- Modify: `src/objectInference/ObjectInferenceService.ts`
- Modify: `src/objectInference/ReceiverTraceService.ts`
- Modify: `src/objectInference/GlobalObjectBindingResolver.ts`

- [ ] **Step 1: Instantiate the inherited resolver in `ObjectInferenceService`**

Add:

```ts
private readonly inheritedGlobalBindingResolver: InheritedGlobalObjectBindingResolver;
```

Initialize it after the single-file resolver:

```ts
this.inheritedGlobalBindingResolver = new InheritedGlobalObjectBindingResolver(
    macroManager,
    this.globalBindingResolver
);
```

- [ ] **Step 2: Wire the top-level identifier receiver branch to the full chain**

Change the identifier branch to:

```ts
const tracedResult = await this.traceService.traceIdentifier(document, syntax, receiverNode);
if (tracedResult && (tracedResult.candidates.length > 0 || tracedResult.hasVisibleBinding)) {
    return tracedResult;
}

const currentFileBinding = await this.globalBindingResolver.resolveFileScopeBinding(
    document,
    receiver.expression,
    {
        resolveInheritedIdentifier: (doc, name, visited) =>
            this.inheritedGlobalBindingResolver.resolveInheritedBinding(doc, name, new Set([doc.uri.toString()]), visited)
    }
);
if (currentFileBinding && currentFileBinding.hasVisibleBinding) {
    return currentFileBinding;
}

const inheritedBinding = await this.inheritedGlobalBindingResolver.resolveInheritedBinding(
    document,
    receiver.expression
);
if (inheritedBinding?.hasVisibleBinding) {
    return inheritedBinding;
}

return {
    candidates: await this.resolvePathCandidate(document, receiver.expression, 'macro')
};
```

- [ ] **Step 3: Route `ReceiverTraceService.resolveIdentifierSourceOutcome(...)` through the same chain**

Update the recursive identifier source path so local alias tracing uses:

1. local trace
2. current-file global binding
3. inherited global binding
4. macro/doc fallback

Do not stop at current-file-only globals anymore. The child-file alias case must now pass:

```lpc
inherit "/std/room";
void demo() {
    object ob = COMBAT_D;
    ob->start();
}
```

- [ ] **Step 4: Add focused red tests for inherited alias and inherited global initializer chains**

Add the missing high-risk regressions for inherited aliasing, inherited global initializer receivers, cross-file cycles, and inherited blockers:

```ts
test('current-file global initializer aliases inherited global object bindings', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/combat_d");\n');

    const source = [
        'inherit "/std/room";',
        '',
        'object ACTIVE_D = COMBAT_D;',
        '',
        'void demo() {',
        '    ACTIVE_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'global-aliases-inherit.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'ACTIVE_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
            source: 'builtin-call'
        }
    ]);
});

test('inherited global alias chains recurse across parent files', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'object ROOT_D = load_object("/adm/daemons/combat_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'inherit "/std/base_room";\nobject COMBAT_D = ROOT_D;\n');

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-alias-chain.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
            source: 'builtin-call'
        }
    ]);
});

test('current-file global object method initializer resolves inherited global receiver bindings', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object FACTORY = load_object("/adm/objects/factory");\n');

    const source = [
        'inherit "/std/room";',
        '',
        'object PRODUCT = FACTORY->create();',
        '',
        'void demo() {',
        '    PRODUCT->query_name();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-method-initializer.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'PRODUCT->query_name'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
            source: 'doc'
        }
    ]);
});

test('cross-file inherited global alias cycles degrade to unknown', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'inherit "/std/room";\nobject ROOT_D = COMBAT_D;\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'inherit "/std/base_room";\nobject COMBAT_D = ROOT_D;\n');

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-cycle.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});

test('inherited globals with unsupported initializers block macro fallback', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'mixed *arr;\nobject COMBAT_D = arr[0];\n');
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/macro_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-unsupported-blocker.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unsupported',
        reason: 'unsupported-expression',
        candidates: []
    });
});

test('inherited globals without initializers block macro fallback', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D;\n');
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/macro_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-no-initializer-blocker.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});
```

- [ ] **Step 5: Run the complete object-inference focused suite**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "inherit|declared after use still blocks inherited|declaration-order DFS prefers|direct inherit declaration order wins|current-file global object still wins|non-object global blocks|aliases inherited|method initializer resolves inherited|cross-file inherited global alias cycles|unsupported initializers block macro fallback|without initializers block macro fallback"
```

Expected: PASS.

- [ ] **Step 6: Commit the top-level and recursive-chain wiring**

```bash
git add src/objectInference/ObjectInferenceService.ts src/objectInference/ReceiverTraceService.ts src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "feat(object-inference): wire inherited globals into identifier tracing"
```

## Chunk 2: Consumer Proof and Verification

### Task 5: Prove Consumers Benefit from Inherited Global Object Inference

**Files:**
- Modify: `src/__tests__/providerIntegration.test.ts`
- Modify: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`

- [ ] **Step 1: Write the failing definition integration test for an inherited global object receiver**

Add a real integration case:

```ts
test('definition resolves inherited file-scope global object receivers to target methods', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/combat_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'void start() {}\n');

    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'd', 'city', 'inherit-definition.c'), source);

    const definition = await provideDefinition(
        service,
        document,
        positionAtSubstring(document, source, 'start();'),
        fixtureRoot
    );

    expect(definition).toHaveLength(1);
    expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'));
});
```

- [ ] **Step 2: Write the completion integration test for an inherited global receiver**

Add:

```ts
test('completion includes object methods for inherited file-scope global object receivers', async () => {
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'object COMBAT_D = load_object("/adm/daemons/combat_d");\n');
    fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'void start() {}\nvoid stop() {}\n');

    const document = createDocument(
        path.join(fixtureRoot, 'd', 'city', 'inherit-completion.c'),
        [
            'inherit "/std/room";',
            '',
            'void demo() {',
            '    COMBAT_D->',
            '}'
        ].join('\n')
    );

    const result = await completionService.provideCompletion({
        context: createLanguageContext(document, fixtureRoot),
        position: { line: 3, character: '    COMBAT_D->'.length },
        triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: '>'
    });

    expect(result.items.map((item) => item.label)).toEqual(expect.arrayContaining(['start', 'stop']));
});
```

- [ ] **Step 3: Write the signature-help regression for inherited globals**

Add a narrow inherited-global signature-help case:

```ts
test('uses inherited file-scope global object inference for object-method signature help', async () => {
    const source = [
        'inherit "/std/room";',
        '',
        'void demo() {',
        '    COMBAT_D->query_name(1, 2);',
        '}'
    ].join('\n');
    const document = createDocument('D:/workspace/inherited-global-signature.c', source);

    const result = await service.provideSignatureHelp({
        context: createLanguageContext(document),
        position: { line: 3, character: 24 }
    });

    expect(result?.signatures[0].label).toBe('string query_name(int mode, int flags)');
});
```

- [ ] **Step 4: Run the consumer regression slice**

Run:

```bash
npx jest --runInBand src/__tests__/providerIntegration.test.ts -t "inherited file-scope global object"
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts -t "inherited file-scope global object inference"
```

Expected:
- If core wiring is complete, these may pass immediately.
- If one consumer path still misses inherited globals, make the smallest production fix before moving on.

- [ ] **Step 5: Commit the consumer regressions**

```bash
git add src/__tests__/providerIntegration.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts
git commit -m "test(object-inference): cover inherited global consumers"
```

### Task 6: Run Focused Verification and Final Cleanup

**Files:**
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Test: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`

- [ ] **Step 1: Run the full focused regression suite**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Inspect the working tree for unintended churn**

Run:

```bash
git status --short
```

Expected:
- Only the intended object-inference and test files remain modified.
- Do not touch unrelated local files already dirty in the main workspace.

- [ ] **Step 4: If verification required follow-up edits, commit the verified end state; otherwise leave the branch as-is**

```bash
git add src/objectInference/InheritedGlobalObjectBindingResolver.ts src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/ObjectInferenceService.ts src/objectInference/ReceiverTraceService.ts src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts
git commit -m "feat(object-inference): infer inherited static global objects"
```

If the branch is already fully verified with no additional edits after prior commits, do not create an empty commit just to satisfy this step.

## Self-Review

- Scope check: this plan stays within inherited static globals only; it does not include runtime global assignments, new builtin sources, or include-file global visibility.
- Architecture check: current-file resolution remains a focused single-file solver, inherit traversal is isolated, and `ObjectInferenceService` stays the only public entrypoint.
- Priority check: the plan locks the same ordering in top-level identifier resolution and recursive alias-tracing paths.
- TDD check: each new semantic rule is introduced with failing tests first, then minimal implementation, then focused verification, then a commit.
- Risk check: inherit-path semantics are explicitly tied to `InheritanceResolver`, not `TargetMethodLookup`.
