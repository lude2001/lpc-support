# Scoped Method Resolution P2-alpha Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `::` scoped method resolution for bare parent calls and named direct-inherit qualifiers, then route the resolved targets into definition, hover, signature help, and documented-return object propagation without leaking into current-file/include lookup or ordinary function fallback.

**Architecture:** Keep `ScopedMethodResolver` as the single shared entrypoint for `::` call analysis, with inherit-only traversal enforced inside the resolver itself. Pair it with a focused `ScopedMethodReturnResolver` for documented-return propagation, then teach definition, hover, and signature-help consumers to consume a new `scopedMethod` callable-target kind instead of inventing per-consumer scope parsing.

**Tech Stack:** TypeScript, VS Code extension APIs, existing `ASTManager` / `SemanticSnapshot` / `SyntaxDocument`, `InheritanceResolver`, `FunctionDocumentationService`, Jest + ts-jest.

---

## File Map

- Create: `src/objectInference/ScopedMethodResolver.ts`
  Responsibility: Recognize supported `::` call shapes, resolve direct inherit seeds with `InheritanceResolver`, traverse only the inherit graph in declaration-order DFS, enforce qualifier uniqueness for named scope calls, and return resolved/multiple/unknown/unsupported outcomes plus method targets.
- Create: `src/objectInference/ScopedMethodReturnResolver.ts`
  Responsibility: Turn resolved scoped-method implementations into documented-return object candidates using the existing callable-doc pipeline, including blocker downgrade semantics when any implementation lacks return-object proof.
- Create: `src/objectInference/__tests__/ScopedMethodResolver.test.ts`
  Responsibility: Lock resolver semantics for bare `::method()`, named `room::method()`, inherit-only traversal, qualifier failure, and current-file/include non-interference.
- Create: `src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts`
  Responsibility: Lock documented-return propagation for `::factory()` and `room::factory()`, including multi-target merge and missing-annotation blocker behavior.
- Modify: `src/objectInference/ReturnObjectResolver.ts`
  Responsibility: Detect supported scoped call expressions and delegate them to `ScopedMethodReturnResolver` before ordinary documented-return fallback.
- Modify: `src/language/documentation/types.ts`
  Responsibility: Add `scopedMethod` as a first-class callable source kind so shared docs/renderers can describe scope-call implementations without pretending they are object receivers.
- Modify: `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
  Responsibility: Add `scopedMethod` call-kind recognition, target discovery, and doc resolution so `::` calls participate in the shared callable-doc signature-help flow.
- Modify: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
  Responsibility: Lock `::` and named scope calls into signature help, including no ordinary-function fallback when scoped lookup fails.
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
  Responsibility: Resolve `::` method targets before object-method or ordinary-function fallback, and use `ScopedMethodResolver` as the only source of scoped-definition locations.
- Modify: `src/language/services/navigation/LanguageHoverService.ts`
  Responsibility: Load docs for scoped-method targets via the shared documentation service and render them through the existing hover machinery without routing through object inference.
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`
  Responsibility: Lock direct service behavior for scoped definitions, especially no fallback leakage to current-file/include/simul/efun paths.
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`
  Responsibility: Lock host-agnostic hover seams for scoped methods and ensure injected resolver boundaries are sufficient.
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
  Responsibility: Construct and pass the production `ScopedMethodResolver` into the shipped hover, definition, and signature-help services so the feature is not test-only.
- Modify: `src/__tests__/providerIntegration.test.ts`
  Responsibility: Prove end-to-end definition and return-object propagation scenarios for `::` survive real AST/snapshot/document wiring.

**Reference files to read before coding:**
- `docs/superpowers/specs/2026-04-17-scope-method-resolution-design.md`
- `src/syntax/builders/expressionBuilders.ts`
- `src/completion/inheritanceResolver.ts`
- `src/objectInference/ReturnObjectResolver.ts`
- `src/objectInference/ObjectMethodReturnResolver.ts`
- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/language/services/navigation/LanguageHoverService.ts`

## Chunk 1: Scoped Resolver Core

### Task 1: Lock `::` Resolution Semantics with Red Tests

**Files:**
- Create: `src/objectInference/__tests__/ScopedMethodResolver.test.ts`
- Create: `src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts`

- [ ] **Step 1: Write the failing bare-scope resolver tests**

Create `src/objectInference/__tests__/ScopedMethodResolver.test.ts` with a fixture-style helper similar to the existing object-inference tests. Start with bare `::` coverage:

```ts
test('bare ::create() resolves the first direct inherit implementation, not the current file', async () => {
    writeFixture('/std/base_room.c', 'void create() {}\n');

    const document = createDocument(
        '/d/city/room.c',
        [
            'inherit "/std/base_room";',
            '',
            'void create() {',
            '    ::create();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, '::create'));

    expect(result.status).toBe('resolved');
    expect(result.targets.map((target) => target.path)).toEqual([
        fixturePath('/std/base_room.c')
    ]);
});

test('bare ::init() never falls back to a same-named current-file function', async () => {
    writeFixture('/std/base_room.c', 'void init() {}\n');

    const document = createDocument(
        '/d/city/room.c',
        [
            'inherit "/std/base_room";',
            '',
            'void init() {}',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, '::init'));

    expect(result.status).toBe('resolved');
    expect(result.targets[0].path).toBe(fixturePath('/std/base_room.c'));
});
```

- [ ] **Step 2: Add the inherit-only negative regressions from the spec review**

In the same file, lock the two critical non-leak cases:

```ts
test('bare ::query_name() ignores same-named functions from include files', async () => {
    writeFixture('/std/base_room.c', 'string query_name() { return "base"; }\n');
    writeFixture('/include/helpers.h', 'string query_name() { return "header"; }\n');

    const document = createDocument(
        '/d/city/room.c',
        [
            'inherit "/std/base_room";',
            'include "/include/helpers.h";',
            '',
            'void demo() {',
            '    ::query_name();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, '::query_name'));

    expect(result.status).toBe('resolved');
    expect(result.targets[0].path).toBe(fixturePath('/std/base_room.c'));
});

test('bare ::init() returns unknown instead of ordinary-function fallback when no inherit target implements it', async () => {
    writeFixture('/std/base_room.c', 'void reset() {}\n');

    const document = createDocument(
        '/d/city/room.c',
        [
            'inherit "/std/base_room";',
            '',
            'void init() {}',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, '::init'));

    expect(result.status).toBe('unknown');
    expect(result.targets).toEqual([]);
});
```

- [ ] **Step 3: Write the failing named-scope tests**

Still in `ScopedMethodResolver.test.ts`, add qualifier-path cases:

```ts
test('room::init() resolves only the uniquely matched direct inherit branch', async () => {
    writeFixture('/std/room.c', 'void init() {}\n');
    writeFixture('/std/combat.c', 'void init() {}\n');

    const document = createDocument(
        '/d/city/mixed_room.c',
        [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    room::init();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, 'room::init'));

    expect(result.status).toBe('resolved');
    expect(result.targets[0].path).toBe(fixturePath('/std/room.c'));
});

test('room::init() is unknown when the qualifier does not uniquely match a direct inherit basename', async () => {
    writeFixture('/std/room.c', 'void init() {}\n');
    writeFixture('/domains/room.c', 'void init() {}\n');

    const document = createDocument(
        '/d/city/ambiguous_room.c',
        [
            'inherit "/std/room";',
            'inherit "/domains/room";',
            '',
            'void demo() {',
            '    room::init();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, 'room::init'));

    expect(result.status).toBe('unknown');
    expect(result.targets).toEqual([]);
});

test('non-identifier left side of :: is unsupported', async () => {
    const document = createDocument(
        '/d/city/bad_scope.c',
        [
            'void demo() {',
            '    factory()::init();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, '::init'));

    expect(result.status).toBe('unsupported');
    expect(result.targets).toEqual([]);
});

test('bare ::init() returns multiple when two direct inherit branches both implement the method', async () => {
    writeFixture('/std/room.c', 'void init() {}\n');
    writeFixture('/std/combat.c', 'void init() {}\n');

    const document = createDocument(
        '/d/city/multi_scope.c',
        [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    ::init();',
            '}'
        ].join('\n')
    );

    const result = await resolver.resolveCallAt(document, positionAfter(document, '::init'));

    expect(result.status).toBe('multiple');
    expect(result.targets.map((target) => target.path)).toEqual([
        fixturePath('/std/room.c'),
        fixturePath('/std/combat.c')
    ]);
});
```

- [ ] **Step 4: Write the failing return-propagation tests**

Create `src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts` and lock both happy-path and blocker semantics:

```ts
function scopedTarget(path: string, methodName: string): ScopedMethodTarget {
    return {
        path,
        methodName,
        declarationRange: new vscode.Range(0, 0, 0, methodName.length),
        document: createDocument(path, `${methodName}();`),
        sourceLabel: path
    };
}

test('::factory() merges documented return objects from resolved scoped implementations', async () => {
    const document = createDocument('/d/city/room.c', 'object ob = ::factory();\n');
    const scopedTargets = [
        scopedTarget('/std/base_room.c', 'factory'),
        scopedTarget('/std/weapon_room.c', 'factory')
    ];

    const resolveDocumentedReturnOutcome = jest.fn()
        .mockResolvedValueOnce({
            candidates: [{ path: fixturePath('/obj/sword.c'), source: 'doc' }]
        })
        .mockResolvedValueOnce({
            candidates: [{ path: fixturePath('/obj/shield.c'), source: 'doc' }]
        });
    const resolver = new ScopedMethodReturnResolver(resolveDocumentedReturnOutcome);

    const outcome = await resolver.resolveScopedMethodReturnOutcome(document, scopedTargets);

    expect(outcome.candidates.map((candidate) => candidate.path)).toEqual([
        fixturePath('/obj/sword.c'),
        fixturePath('/obj/shield.c')
    ]);
});

test('::factory() downgrades to diagnostics when any scoped implementation lacks returnObjects', async () => {
    const document = createDocument('/d/city/room.c', 'object ob = ::factory();\n');
    const scopedTargets = [
        scopedTarget('/std/base_room.c', 'factory'),
        scopedTarget('/std/weapon_room.c', 'factory')
    ];

    const resolveDocumentedReturnOutcome = jest.fn()
        .mockResolvedValueOnce({
            candidates: [{ path: fixturePath('/obj/sword.c'), source: 'doc' }]
        })
        .mockResolvedValueOnce({
            candidates: [],
            diagnostics: [{ code: 'missing-return-annotation', methodName: 'factory' }]
        });
    const resolver = new ScopedMethodReturnResolver(resolveDocumentedReturnOutcome);

    const outcome = await resolver.resolveScopedMethodReturnOutcome(document, scopedTargets);

    expect(outcome.candidates).toEqual([]);
    expect(outcome.diagnostics).toEqual([
        { code: 'missing-return-annotation', methodName: 'factory' }
    ]);
});

test('room::factory() resolves documented return objects from the uniquely matched direct inherit branch', async () => {
    const document = createDocument('/d/city/room.c', 'object ob = room::factory();\n');
    const scopedTargets = [
        scopedTarget('/std/room.c', 'factory')
    ];

    const resolveDocumentedReturnOutcome = jest.fn().mockResolvedValue({
        candidates: [{ path: fixturePath('/obj/room_item.c'), source: 'doc' }]
    });
    const resolver = new ScopedMethodReturnResolver(resolveDocumentedReturnOutcome);

    const outcome = await resolver.resolveScopedMethodReturnOutcome(document, scopedTargets);

    expect(outcome.candidates).toEqual([
        { path: fixturePath('/obj/room_item.c'), source: 'doc' }
    ]);
});
```

- [ ] **Step 5: Run the focused red slice**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ScopedMethodResolver.test.ts src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts
```

Expected:
- `ScopedMethodResolver.test.ts` FAILS because no resolver exists yet.
- `ScopedMethodReturnResolver.test.ts` FAILS because no scoped-return resolver exists yet.

- [ ] **Step 6: Commit the red phase**

```bash
git add src/objectInference/__tests__/ScopedMethodResolver.test.ts src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts
git commit -m "test(object-inference): add scoped method red cases"
```

### Task 2: Implement `ScopedMethodResolver` with Inherit-Only Traversal

**Files:**
- Create: `src/objectInference/ScopedMethodResolver.ts`

- [ ] **Step 1: Create the resolver skeleton and exported result types**

Create `src/objectInference/ScopedMethodResolver.ts` with a focused public contract:

```ts
export interface ScopedMethodTarget {
    path: string;
    methodName: string;
    declarationRange: vscode.Range;
    document: vscode.TextDocument;
    sourceLabel: string;
}

export interface ScopedMethodResolution {
    status: 'resolved' | 'multiple' | 'unknown' | 'unsupported';
    methodName: string;
    qualifier?: string;
    targets: ScopedMethodTarget[];
}

export class ScopedMethodResolver {
    private readonly astManager = ASTManager.getInstance();
    private readonly inheritanceResolver: InheritanceResolver;

    public constructor(macroManager?: MacroManager, workspaceRoots?: string[]) {
        this.inheritanceResolver = new InheritanceResolver(macroManager, workspaceRoots);
    }

    public async resolveCallAt(document: vscode.TextDocument, position: vscode.Position): Promise<ScopedMethodResolution | undefined> {
        return undefined;
    }
}
```

- [ ] **Step 2: Implement call-shape detection for both supported scope forms**

Inside `resolveCallAt(...)`, use `SyntaxDocument` nodes and keep the check local to `CallExpression`:

```ts
const syntax = this.astManager.getSyntaxDocument(document, false) ?? this.astManager.getSyntaxDocument(document, true);
if (!syntax) {
    return undefined;
}
const callExpression = [...syntax.nodes]
    .filter((node) => node.kind === SyntaxKind.CallExpression && node.range.contains(position))
    .sort((left, right) => rangeSize(left.range) - rangeSize(right.range))[0];

const callee = callExpression?.children[0];
if (!callee) {
    return undefined;
}

if (callee.kind === SyntaxKind.Identifier && callee.metadata?.scopeQualifier === '::') {
    return this.resolveBareScopedCall(document, callee.name ?? '');
}

if (callee.kind === SyntaxKind.MemberAccessExpression && callee.metadata?.operator === '::') {
    const qualifier = callee.children[0];
    const member = callee.children[1];
    if (qualifier?.kind !== SyntaxKind.Identifier || member?.kind !== SyntaxKind.Identifier) {
        return {
            status: 'unsupported',
            methodName: member?.name ?? '',
            targets: []
        };
    }
    return this.resolveNamedScopedCall(document, callee);
}

return undefined;
```

If a `CallExpression` is scope-qualified but malformed, return `unsupported` instead of `undefined` so later consumers cannot leak into ordinary-function fallback.

- [ ] **Step 3: Implement direct-inherit seed resolution and qualifier matching**

Add helpers that only admit resolved direct inherits:

```ts
private getResolvedDirectInheritTargets(document: vscode.TextDocument): ResolvedInheritTarget[] {
    const snapshot = this.astManager.getSemanticSnapshot(document, false);
    return this.inheritanceResolver
        .resolveInheritTargets(snapshot)
        .filter((target) => target.isResolved && target.resolvedUri);
}

private matchQualifierToDirectInherit(
    qualifier: string,
    targets: ResolvedInheritTarget[]
): ResolvedInheritTarget | undefined {
    const matches = targets.filter((target) =>
        path.basename(vscode.Uri.parse(target.resolvedUri!).fsPath, '.c') === qualifier
    );

    return matches.length === 1 ? matches[0] : undefined;
}
```

If `matchQualifierToDirectInherit(...)` returns `undefined`, return:

```ts
{ status: 'unknown', qualifier, methodName, targets: [] }
```

- [ ] **Step 4: Implement inherit-only DFS and explicitly skip current-file/include leakage**

Write a private traversal that starts from a resolved inherit URI and never consults current-file/include lookup:

```ts
private async collectScopedTargets(
    rootUri: string,
    methodName: string,
    visited: Set<string>
): Promise<ScopedMethodTarget[]> {
    if (visited.has(rootUri)) {
        return [];
    }
    visited.add(rootUri);

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(rootUri));
    const snapshot = this.astManager.getSemanticSnapshot(document, false);
    const symbol = snapshot.symbolTable
        .getAllSymbols()
        .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === methodName);

    if (symbol) {
        return [{
            path: document.uri.fsPath,
            methodName,
            declarationRange: symbol.selectionRange ?? symbol.range,
            document,
            sourceLabel: document.uri.fsPath
        }];
    }

    const directInherits = this.inheritanceResolver
        .resolveInheritTargets(snapshot)
        .filter((target) => target.isResolved && target.resolvedUri);

    const nestedTargets: ScopedMethodTarget[] = [];
    for (const inheritTarget of directInherits) {
        nestedTargets.push(...await this.collectScopedTargets(inheritTarget.resolvedUri!, methodName, visited));
    }
    return nestedTargets;
}
```

Do **not** call `TargetMethodLookup.findMethod(...)` here. That interface currently allows current-file/include-first lookup, which violates the spec.

- [ ] **Step 5: Implement bare and named scoped resolution on top of the shared traversal**

Use the seed helpers:

```ts
private async resolveBareScopedCall(document: vscode.TextDocument, methodName: string): Promise<ScopedMethodResolution> {
    const targets = this.getResolvedDirectInheritTargets(document);
    const resolvedTargets: ScopedMethodTarget[] = [];

    for (const target of targets) {
        resolvedTargets.push(...await this.collectScopedTargets(target.resolvedUri!, methodName, new Set<string>()));
    }

    return normalizeScopedResolution(methodName, undefined, resolvedTargets);
}

private async resolveNamedScopedCall(document: vscode.TextDocument, callee: SyntaxNode): Promise<ScopedMethodResolution> {
    const qualifier = callee.children[0]?.name ?? '';
    const methodName = callee.children[1]?.name ?? '';
    const directTargets = this.getResolvedDirectInheritTargets(document);
    const matchedTarget = this.matchQualifierToDirectInherit(qualifier, directTargets);

    if (!matchedTarget) {
        return { status: 'unknown', qualifier, methodName, targets: [] };
    }

    const scopedTargets = await this.collectScopedTargets(matchedTarget.resolvedUri!, methodName, new Set<string>());
    return normalizeScopedResolution(methodName, qualifier, scopedTargets);
}
```

`normalizeScopedResolution(...)` should be a private helper on `ScopedMethodResolver`. It should:

- dedupe identical `path + declarationRange` targets
- map `0/1/>1` targets to `unknown/resolved/multiple`
- preserve declaration-order DFS ordering after dedupe instead of re-sorting alphabetically

- [ ] **Step 6: Run the resolver tests and make them pass**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ScopedMethodResolver.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit the resolver implementation**

```bash
git add src/objectInference/ScopedMethodResolver.ts src/objectInference/__tests__/ScopedMethodResolver.test.ts
git commit -m "feat(object-inference): add scoped method resolver"
```

### Task 3: Implement Scoped Return Propagation

**Files:**
- Create: `src/objectInference/ScopedMethodReturnResolver.ts`
- Modify: `src/objectInference/ReturnObjectResolver.ts`
- Modify: `src/objectInference/ObjectInferenceService.ts`
- Modify: `src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts`
- Modify: `src/objectInference/__tests__/ReturnObjectResolver.test.ts`

- [ ] **Step 1: Create `ScopedMethodReturnResolver` and reuse documented-return machinery**

Create `src/objectInference/ScopedMethodReturnResolver.ts`:

```ts
type ResolveDocumentedReturnOutcome = (
    document: vscode.TextDocument,
    functionName: string,
    options?: {
        contextLabel?: string;
        requireAnnotation?: boolean;
        diagnosticMethodName?: string;
    }
) => Promise<ObjectResolutionOutcome>;

export class ScopedMethodReturnResolver {
    public constructor(private readonly resolveDocumentedReturnOutcome: ResolveDocumentedReturnOutcome) {}

    public async resolveScopedMethodReturnOutcome(
        document: vscode.TextDocument,
        targets: readonly ScopedMethodTarget[]
    ): Promise<ObjectResolutionOutcome> {
        const outcomesByImplementation = new Map<string, ObjectResolutionOutcome>();
        const mergedCandidates: ObjectCandidate[] = [];
        const diagnostics: NonNullable<ObjectResolutionOutcome['diagnostics']> = [];

        for (const target of targets) {
            let outcome = outcomesByImplementation.get(target.path);
            if (!outcome) {
                outcome = await this.resolveDocumentedReturnOutcome(
                    target.document,
                    target.methodName,
                    {
                        contextLabel: '范围方法',
                        requireAnnotation: true,
                        diagnosticMethodName: target.methodName
                    }
                );
                outcomesByImplementation.set(target.path, outcome);
            }

            if (outcome.diagnostics?.length) {
                diagnostics.push(...outcome.diagnostics);
                continue;
            }

            if (outcome.candidates.length === 0) {
                return { candidates: [] };
            }

            mergedCandidates.push(...outcome.candidates);
        }

        if (diagnostics.length > 0) {
            return { candidates: [], diagnostics: this.dedupeDiagnostics(diagnostics) };
        }

        return { candidates: mergedCandidates };
    }

    private dedupeDiagnostics(
        diagnostics: NonNullable<ObjectResolutionOutcome['diagnostics']>
    ): NonNullable<ObjectResolutionOutcome['diagnostics']> {
        const deduped = new Map<string, typeof diagnostics[number]>();
        for (const diagnostic of diagnostics) {
            deduped.set(`${diagnostic.code}:${diagnostic.methodName}`, diagnostic);
        }

        return [...deduped.values()];
    }
}
```

This callback-based seam is required to avoid a construction cycle between `ReturnObjectResolver` and `ScopedMethodReturnResolver`.
Keep the diagnostic dedupe local to `ScopedMethodReturnResolver`; do not widen this task into a shared utility extraction unless implementation proves it necessary.

- [ ] **Step 2: Teach `ReturnObjectResolver` to detect supported scoped call expressions**

In `src/objectInference/ReturnObjectResolver.ts`, add a dependency on `ScopedMethodResolver`, add an explicit attachment seam for `ScopedMethodReturnResolver`, and branch before ordinary documented-return fallback:

```ts
public attachScopedMethodReturnResolver(resolver: ScopedMethodReturnResolver): void {
    this.scopedMethodReturnResolver = resolver;
}

const scopedResolution = await this.scopedMethodResolver.resolveCallAt(document, expression.range.start);
if (scopedResolution) {
    if (scopedResolution.status === 'unsupported') {
        return { candidates: [], reason: 'unsupported-expression' };
    }

    if (scopedResolution.status === 'unknown') {
        return { candidates: [] };
    }

    return this.scopedMethodReturnResolver.resolveScopedMethodReturnOutcome(
        document,
        scopedResolution.targets
    );
}

const callee = expression.children[0];
if (callee?.kind !== SyntaxKind.Identifier || !callee.name) {
    return { candidates: [] };
}

```

Keep this branch limited to supported call-expression shapes; do not route ordinary functions or `->` receivers through it. The scoped-call detection must happen **before** the current identifier-only early return so `MemberAccessExpression(::)` calls are reachable.

- [ ] **Step 3: Wire the production `ReturnObjectResolver` construction in `ObjectInferenceService`**

Update the constructor in `src/objectInference/ObjectInferenceService.ts` so the main inference flow can actually reach the new branch:

```ts
const scopedMethodResolver = new ScopedMethodResolver(macroManager);
this.returnObjectResolver = new ReturnObjectResolver(
    macroManager,
    playerObjectPathOrProjectConfig,
    undefined,
    scopedMethodResolver
);
const scopedMethodReturnResolver = new ScopedMethodReturnResolver(
    (document, functionName, options) => this.returnObjectResolver.resolveDocumentedReturnOutcome(document, functionName, options)
);
this.returnObjectResolver.attachScopedMethodReturnResolver(scopedMethodReturnResolver);
```

This explicit top-level wiring is required; do not hide the relationship by constructing `ScopedMethodReturnResolver` inside `ReturnObjectResolver`.

Keep the resolver instance local to object inference in this task; consumer services can add their own constructor seams in Chunk 2.

- [ ] **Step 4: Add one integration-style test at the `ReturnObjectResolver` seam**

Extend `src/objectInference/__tests__/ReturnObjectResolver.test.ts` with:

```ts
function findFirstCallExpression(document: vscode.TextDocument): SyntaxNode {
    const syntax = ASTManager.getInstance().getSyntaxDocument(document, false)
        ?? ASTManager.getInstance().getSyntaxDocument(document, true);
    const call = [...syntax!.nodes].find((node) => node.kind === SyntaxKind.CallExpression);
    if (!call) {
        throw new Error('call expression not found');
    }
    return call;
}

test('ReturnObjectResolver delegates ::factory() to scoped return resolution before ordinary function docs', async () => {
    const document = createTextDocument('D:/code/lpc/room.c', 'object ob = ::factory();');
    const documentationService = new FunctionDocumentationService();
    const scopedMethodResolver = {
        resolveCallAt: jest.fn().mockResolvedValue({
            status: 'resolved',
            methodName: 'factory',
            targets: [{
                path: 'D:/code/lpc/std/base_room.c',
                methodName: 'factory',
                declarationRange: new vscode.Range(0, 0, 0, 7),
                document: createTextDocument('D:/code/lpc/std/base_room.c', 'object factory() { return 0; }'),
                sourceLabel: 'D:/code/lpc/std/base_room.c'
            }]
        })
    };

    const resolver = new ReturnObjectResolver(undefined, undefined, documentationService, scopedMethodResolver as any);
    const scopedMethodReturnResolver = {
        resolveScopedMethodReturnOutcome: jest.fn().mockResolvedValue({
            candidates: [{ path: 'D:/code/lpc/obj/sword.c', source: 'doc' }]
        })
    };
    resolver.attachScopedMethodReturnResolver(scopedMethodReturnResolver as any);
    const outcome = await resolver.resolveExpressionOutcome(document, findFirstCallExpression(document));

    expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalled();
    expect(scopedMethodReturnResolver.resolveScopedMethodReturnOutcome).toHaveBeenCalled();
    expect(outcome.candidates).toEqual([{ path: 'D:/code/lpc/obj/sword.c', source: 'doc' }]);
});

test('ReturnObjectResolver delegates room::factory() to scoped return resolution before ordinary function docs', async () => {
    const document = createTextDocument('D:/code/lpc/room.c', 'object ob = room::factory();');
    const documentationService = new FunctionDocumentationService();
    const scopedMethodResolver = {
        resolveCallAt: jest.fn().mockResolvedValue({
            status: 'resolved',
            methodName: 'factory',
            qualifier: 'room',
            targets: [{
                path: 'D:/code/lpc/std/room.c',
                methodName: 'factory',
                declarationRange: new vscode.Range(0, 0, 0, 7),
                document: createTextDocument('D:/code/lpc/std/room.c', 'object factory() { return 0; }'),
                sourceLabel: 'D:/code/lpc/std/room.c'
            }]
        })
    };

    const resolver = new ReturnObjectResolver(undefined, undefined, documentationService, scopedMethodResolver as any);
    const scopedMethodReturnResolver = {
        resolveScopedMethodReturnOutcome: jest.fn().mockResolvedValue({
            candidates: [{ path: 'D:/code/lpc/obj/room_item.c', source: 'doc' }]
        })
    };
    resolver.attachScopedMethodReturnResolver(scopedMethodReturnResolver as any);
    const outcome = await resolver.resolveExpressionOutcome(document, findFirstCallExpression(document));

    expect(scopedMethodResolver.resolveCallAt).toHaveBeenCalled();
    expect(scopedMethodReturnResolver.resolveScopedMethodReturnOutcome).toHaveBeenCalled();
    expect(outcome.candidates).toEqual([{ path: 'D:/code/lpc/obj/room_item.c', source: 'doc' }]);
});
```

- [ ] **Step 5: Run the scoped-return test slice**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts -t "scoped|::factory"
```

Expected: PASS

- [ ] **Step 6: Commit scoped-return support**

```bash
git add src/objectInference/ScopedMethodReturnResolver.ts src/objectInference/ReturnObjectResolver.ts src/objectInference/ObjectInferenceService.ts src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts
git commit -m "feat(object-inference): add scoped method return propagation"
```

- [ ] **Step 7: Run a wiring sanity check for the core object-inference flow**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ScopedMethodResolver.test.ts src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts src/objectInference/__tests__/ObjectInferenceService.test.ts -t "scoped|::|factory"
npx tsc --noEmit
```

Expected:
- The focused resolver/object-inference slice PASSes
- `npx tsc --noEmit` exits `0`

## Chunk 2: Callable Consumers

### Task 4: Add `scopedMethod` to Signature Help

**Files:**
- Modify: `src/language/documentation/types.ts`
- Modify: `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- Modify: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`

- [ ] **Step 1: Extend callable source kinds and target kinds**

In `src/language/documentation/types.ts`, add:

```ts
export type CallableSourceKind =
    | 'local'
    | 'inherit'
    | 'include'
    | 'simulEfun'
    | 'efun'
    | 'objectMethod'
    | 'scopedMethod';
```

Then in `LanguageSignatureHelpService.ts`, widen the call/target unions:

```ts
callKind: 'function' | 'objectMethod' | 'scopedMethod';
kind: 'local' | 'inherit' | 'include' | 'simulEfun' | 'efun' | 'objectMethod' | 'scopedMethod';
```

Also extend the constructor dependency bag so production wiring and tests stay typed:

```ts
interface LanguageSignatureHelpDependencies {
    scopedMethodResolver?: ScopedMethodResolver;
    // existing fields...
}
```

- [ ] **Step 2: Teach `getCalleeInfo(...)` to recognize both scope-call shapes**

Replace the current `->`-only decision with explicit `::` handling:

```ts
if (callee.kind === SyntaxKind.Identifier && callee.name) {
    return {
        name: callee.name,
        callKind: callee.metadata?.scopeQualifier === '::' ? 'scopedMethod' : 'function'
    };
}

if (callee.kind === SyntaxKind.MemberAccessExpression && callee.children.length >= 2) {
    const operator = callee.metadata?.operator;
    const member = callee.children[1];
    if (member?.kind !== SyntaxKind.Identifier || !member.name) {
        return undefined;
    }
    return {
        name: member.name,
        callKind: operator === '->' ? 'objectMethod' : operator === '::' ? 'scopedMethod' : 'function'
    };
}
```

- [ ] **Step 3: Add scoped target discovery and no-fallback behavior**

Inject `ScopedMethodResolver` into `DefaultCallableTargetDiscoveryService` and add:

```ts
export interface CallableTargetDiscoveryService {
    discoverScopedMethodTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]>;
    // existing methods...
}

public async discoverScopedMethodTargets(request: CallableDiscoveryRequest): Promise<ResolvedCallableTarget[]> {
    if (request.callKind !== 'scopedMethod' || !this.scopedMethodResolver) {
        return [];
    }

    const resolution = await this.scopedMethodResolver.resolveCallAt(
        request.document,
        request.calleeLookupPosition ?? request.callExpressionRange.start
    );
    if (!resolution || resolution.status === 'unknown' || resolution.status === 'unsupported') {
        return [];
    }

    return resolution.targets.map((target) => ({
        kind: 'scopedMethod',
        name: request.calleeName,
        targetKey: buildDeclarationKey(target.document.uri.toString(), fromVsCodeRange(target.declarationRange)),
        documentUri: target.document.uri.toString(),
        declarationKey: buildDeclarationKey(target.document.uri.toString(), fromVsCodeRange(target.declarationRange)),
        sourceLabel: 'scoped-method',
        priority: 4
    }));
}
```

Also update the discovery service constructor and stored field explicitly:

```ts
class DefaultCallableTargetDiscoveryService implements CallableTargetDiscoveryService {
    public constructor(
        private readonly efunDocsManager?: EfunDocsManager,
        private readonly objectInferenceService?: ObjectInferenceService,
        private readonly targetMethodLookup?: TargetMethodLookup,
        private readonly scopedMethodResolver?: ScopedMethodResolver
    ) {}
}
```

Mirror that constructor shape in any direct test construction of `DefaultCallableTargetDiscoveryService`; do not leave the new dependency implicit.

Update `collectTargets(...)` to include `discoverScopedMethodTargets(...)` ahead of efun discovery. Also add explicit short-circuit guards to the ordinary discovery paths:

```ts
if (request.callKind === 'scopedMethod') {
    return [];
}
```

Apply that guard at the top of:

- `discoverLocalOrInheritedTargets(...)`
- `discoverIncludeTargets(...)`
- `discoverObjectMethodTargets(...)`
- `discoverEfunTargets(...)`

This is required to preserve the spec’s no-fallback contract for scoped calls.

Also explicitly thread the outer dependency into the inner discovery service construction:

```ts
this.discoveryService = dependencies.discoveryService
    ?? new DefaultCallableTargetDiscoveryService(
        dependencies.efunDocsManager,
        dependencies.objectInferenceService,
        dependencies.targetMethodLookup,
        dependencies.scopedMethodResolver
    );
```

Do not stop at adding the field to `LanguageSignatureHelpDependencies`; the nested `DefaultCallableTargetDiscoveryService` constructor must receive it too.

- [ ] **Step 4: Add signature-help regressions**

Extend `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts` with:

```ts
function createDiscoveryService(
    overrides: Partial<CallableTargetDiscoveryService> = {}
): CallableTargetDiscoveryService {
    return {
        discoverLocalOrInheritedTargets: jest.fn(async () => []),
        discoverIncludeTargets: jest.fn(async () => []),
        discoverObjectMethodTargets: jest.fn(async () => []),
        discoverScopedMethodTargets: jest.fn(async () => []),
        discoverEfunTargets: jest.fn(async () => []),
        ...overrides
    };
}

test('signature help resolves bare ::create() through scoped method targets', async () => {
    const scopedMethodResolver = {
        resolveCallAt: jest.fn().mockResolvedValue({
            status: 'resolved',
            methodName: 'create',
            targets: [{
                path: '/std/base_room.c',
                methodName: 'create',
                declarationRange: new vscode.Range(2, 0, 2, 20),
                document: createTextDocument('/std/base_room.c', 'void create(int mode) {}'),
                sourceLabel: '/std/base_room.c'
            }]
        })
    };

    const service = new LanguageSignatureHelpService({
        scopedMethodResolver: scopedMethodResolver as any,
        discoveryService: createDiscoveryService(),
        docResolver: {
            resolveFromTarget: jest.fn(async (target) => (
                target.kind === 'scopedMethod'
                    ? createCallableDoc('create', 'scopedMethod', target.declarationKey!, [{
                        label: 'void create(int mode)',
                        parameters: [{ name: 'mode', type: 'int' }],
                        isVariadic: false
                    }])
                    : undefined
            ))
        } as any
    } as any);

    const help = await service.provideSignatureHelp(makeRequest('::create(1);', '1'));

    expect(help?.signatures[0].label).toBe('void create(int mode)');
});

test('signature help does not fall back to ordinary function docs when room::init() qualifier is unknown', async () => {
    const scopedMethodResolver = {
        resolveCallAt: jest.fn().mockResolvedValue({
            status: 'unknown',
            methodName: 'init',
            qualifier: 'room',
            targets: []
        })
    };

    const service = new LanguageSignatureHelpService({
        scopedMethodResolver: scopedMethodResolver as any,
        discoveryService: createDiscoveryService(),
        efunDocsManager: { getStandardCallableDoc: jest.fn(() => createCallableDoc('init', 'efun', 'efun:init', [])) } as any
    } as any);

    const help = await service.provideSignatureHelp(makeRequest('room::init();', 'init'));

    expect(help).toBeUndefined();
});

test('signature help resolves room::init() through the uniquely matched named scope path', async () => {
    const scopedMethodResolver = {
        resolveCallAt: jest.fn().mockResolvedValue({
            status: 'resolved',
            qualifier: 'room',
            methodName: 'init',
            targets: [{
                path: '/std/room.c',
                methodName: 'init',
                declarationRange: new vscode.Range(1, 0, 1, 12),
                document: createTextDocument('/std/room.c', 'void init(string arg) {}'),
                sourceLabel: '/std/room.c'
            }]
        })
    };

    const service = new LanguageSignatureHelpService({
        scopedMethodResolver: scopedMethodResolver as any,
        discoveryService: createDiscoveryService(),
        docResolver: {
            resolveFromTarget: jest.fn(async (target) => (
                target.kind === 'scopedMethod'
                    ? createCallableDoc('init', 'scopedMethod', target.declarationKey!, [{
                        label: 'void init(string arg)',
                        parameters: [{ name: 'arg', type: 'string' }],
                        isVariadic: false
                    }])
                    : undefined
            ))
        } as any
    } as any);

    const help = await service.provideSignatureHelp(makeRequest('room::init("x");', '"x"'));

    expect(help?.signatures[0].label).toBe('void init(string arg)');
});
```

- [ ] **Step 5: Run the signature-help slice**

Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts -t "scoped method|::create|room::init"
```

Expected: PASS

- [ ] **Step 6: Commit signature-help support**

```bash
git add src/language/documentation/types.ts src/language/services/signatureHelp/LanguageSignatureHelpService.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts
git commit -m "feat(language): add scoped method signature help"
```

### Task 5: Wire Definition, Hover, and End-to-End Propagation

**Files:**
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Modify: `src/language/services/navigation/LanguageHoverService.ts`
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`
- Modify: `src/language/services/navigation/__tests__/navigationServices.test.ts`
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Add `ScopedMethodResolver` to definition service before ordinary fallback**

Inject the resolver via constructor dependency and branch near the top of `provideDefinition(...)`:

```ts
interface LanguageDefinitionDependencies {
    scopedMethodResolver?: ScopedMethodResolver;
    // existing fields...
}

private readonly scopedMethodResolver?: ScopedMethodResolver;

const scopedResolution = this.scopedMethodResolver
    ? await this.scopedMethodResolver.resolveCallAt(document, position)
    : undefined;
if (scopedResolution) {
    if (scopedResolution.status === 'unknown' || scopedResolution.status === 'unsupported') {
        return [];
    }

    return this.toLanguageLocations(scopedResolution.targets.map((target) => new vscode.Location(
        target.document.uri,
        target.declarationRange.start
    )));
}
```

Add the corresponding constructor/dependency assignment in the service body:

```ts
const dependencies = this.resolveDependencies(hostOrDependencies);
this.host = dependencies.host;
this.semanticAdapter = dependencies.semanticAdapter;
this.scopedMethodResolver = dependencies.scopedMethodResolver;
```

Expand the dependency normalization itself so the field is carried end-to-end:

```ts
private resolveDependencies(
    hostOrDependencies: LanguageDefinitionHost | LanguageDefinitionDependencies
): {
    host: LanguageDefinitionHost;
    semanticAdapter?: DefinitionSemanticAdapter;
    scopedMethodResolver?: ScopedMethodResolver;
} {
    if ('onDidChangeTextDocument' in hostOrDependencies) {
        return {
            host: hostOrDependencies
        };
    }

    return {
        host: hostOrDependencies.host ?? defaultDefinitionHost,
        semanticAdapter: hostOrDependencies.semanticAdapter,
        scopedMethodResolver: hostOrDependencies.scopedMethodResolver
    };
}
```

Do not continue into `findFunctionDefinition(...)` once a supported `::` shape has been recognized.

- [ ] **Step 2: Add scoped hover resolution without routing through object inference**

In `LanguageHoverService.ts`, add a second injected seam:

```ts
interface HoverServiceDependencies {
    scopedMethodResolver?: ScopedMethodResolver;
    // existing fields...
}

private readonly scopedMethodResolver?: ScopedMethodResolver;
```

Then wire the field during construction:

```ts
this.scopedMethodResolver = dependencies?.scopedMethodResolver;
```

Then, before `objectAccessProvider.inferObjectAccess(...)`, attempt scoped resolution and load docs directly from resolved method documents:

```ts
const scopedResolution = this.scopedMethodResolver
    ? await this.scopedMethodResolver.resolveCallAt(
        ensureVsCodeBackedDocument(document),
        toVsCodePosition(request.position)
    )
    : undefined;
if (scopedResolution && (scopedResolution.status === 'resolved' || scopedResolution.status === 'multiple')) {
    const docs = scopedResolution.targets
        .map((target) => {
            const declarationKey = `${target.document.uri.toString()}#${target.declarationRange.start.line}:${target.declarationRange.start.character}-${target.declarationRange.end.line}:${target.declarationRange.end.character}`;
            return this.documentationService.getDocForDeclaration(target.document, declarationKey);
        })
        .filter(Boolean);
    if (docs.length > 0) {
        return this.createMarkdownHover(
            docs
                .map((doc) => this.renderer.renderHover(doc as CallableDoc))
                .join('\n\n---\n\n')
        );
    }
    return undefined;
}

if (scopedResolution) {
    return undefined;
}
```

This keeps `::` out of the object-inference receiver path.

- [ ] **Step 3: Wire the shipped language-service assembly**

Update `src/lsp/server/runtime/createProductionLanguageServices.ts` to construct one production resolver and pass it into every consumer path added in this chunk:

```ts
const scopedMethodResolver = new ScopedMethodResolver(macroManager, [process.cwd()]);

const objectHoverService = new ObjectInferenceLanguageHoverService(
    objectInferenceService,
    macroManager,
    targetMethodLookup,
    projectConfigService,
    { scopedMethodResolver }
);

const definitionService = new AstBackedLanguageDefinitionService(
    macroManager,
    efunDocsManager,
    objectInferenceService,
    targetMethodLookup,
    projectConfigService,
    { scopedMethodResolver }
);

const signatureHelpService = new LanguageSignatureHelpService({
    efunDocsManager,
    objectInferenceService,
    targetMethodLookup,
    scopedMethodResolver
});
```

This wiring step is required; without it the feature remains test-only and never reaches the shipped LSP runtime.

- [ ] **Step 4: Add a runtime-factory regression for production wiring**

Extend `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts` with a constructor-wiring assertion:

```ts
test('createProductionLanguageServices passes scopedMethodResolver into shipped hover, definition, and signature-help services', () => {
    const scopedMethodResolver = { kind: 'scoped-method-resolver' };

    jest.isolateModules(() => {
        jest.doMock('../../../../objectInference/ScopedMethodResolver', () => ({
            ScopedMethodResolver: jest.fn(() => scopedMethodResolver)
        }));

        const hoverCtor = jest.fn(() => ({ provideHover: jest.fn() }));
        const definitionCtor = jest.fn(() => ({ provideDefinition: jest.fn() }));
        const signatureHelpCtor = jest.fn(() => ({ provideSignatureHelp: jest.fn() }));

        jest.doMock('../../../../language/services/navigation/LanguageHoverService', () => ({
            ObjectInferenceLanguageHoverService: hoverCtor
        }));
        jest.doMock('../../../../language/services/navigation/LanguageDefinitionService', () => ({
            AstBackedLanguageDefinitionService: definitionCtor
        }));
        jest.doMock('../../../../language/services/signatureHelp/LanguageSignatureHelpService', () => ({
            LanguageSignatureHelpService: signatureHelpCtor
        }));

        const { createProductionLanguageServices } = require('../createProductionLanguageServices');
        createProductionLanguageServices();

        expect(hoverCtor).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({
            scopedMethodResolver
        }));
        expect(definitionCtor).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({
            scopedMethodResolver
        }));
        expect(signatureHelpCtor).toHaveBeenCalledWith(expect.objectContaining({
            scopedMethodResolver
        }));
    });
});
```

- [ ] **Step 5: Add direct service regressions**

In `LanguageDefinitionService.test.ts`, add:

```ts
test('definition service resolves bare ::create() before ordinary function fallback', async () => {
    const document = createDocument('D:/workspace/room.c', '::create();');
    const host = {
        onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        openTextDocument: jest.fn(),
        findFiles: jest.fn(),
        getWorkspaceFolder: jest.fn(),
        getWorkspaceFolders: jest.fn(),
        fileExists: jest.fn().mockReturnValue(false)
    };
    const semanticAdapter = {
        getIncludeStatements: jest.fn().mockReturnValue([]),
        getInheritStatements: jest.fn().mockReturnValue([]),
        getExportedFunctionNames: jest.fn().mockReturnValue([]),
        findFunctionLocation: jest.fn().mockReturnValue(undefined),
        resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
    };
    const scopedMethodResolver = {
        resolveCallAt: jest.fn().mockResolvedValue({
            status: 'resolved',
            methodName: 'create',
            targets: [{
                path: 'D:/workspace/std/base_room.c',
                methodName: 'create',
                declarationRange: new vscode.Range(0, 0, 0, 12),
                document: createTextDocument('D:/workspace/std/base_room.c', 'void create() {}'),
                sourceLabel: 'D:/workspace/std/base_room.c'
            }]
        })
    };

    const service = new AstBackedLanguageDefinitionService(
        {} as any,
        { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
        { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
        undefined,
        undefined,
        { scopedMethodResolver: scopedMethodResolver as any, host, semanticAdapter } as any
    );

    const definition = await service.provideDefinition({
        context: {
            document: document as any,
            workspace: { workspaceRoot: 'D:/workspace' },
            mode: 'lsp'
        },
        position: { line: 0, character: 3 }
    });

    expect(definition[0].uri).toBe(vscode.Uri.file('D:/workspace/std/base_room.c').toString());
});

test('definition service resolves room::init() to the uniquely matched direct inherit branch', async () => {
    const document = createDocument('D:/workspace/room.c', 'room::init();');
    const host = {
        onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        openTextDocument: jest.fn(),
        findFiles: jest.fn(),
        getWorkspaceFolder: jest.fn(),
        getWorkspaceFolders: jest.fn(),
        fileExists: jest.fn().mockReturnValue(false)
    };
    const semanticAdapter = {
        getIncludeStatements: jest.fn().mockReturnValue([]),
        getInheritStatements: jest.fn().mockReturnValue([]),
        getExportedFunctionNames: jest.fn().mockReturnValue([]),
        findFunctionLocation: jest.fn().mockReturnValue(undefined),
        resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
    };
    const service = new AstBackedLanguageDefinitionService(
        {} as any,
        { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
        { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
        undefined,
        undefined,
        {
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:/workspace/std/room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(0, 0, 0, 10),
                        document: createTextDocument('D:/workspace/std/room.c', 'void init() {}'),
                        sourceLabel: 'D:/workspace/std/room.c'
                    }]
                })
            },
            host,
            semanticAdapter
        } as any
    );

    const definition = await service.provideDefinition({
        context: {
            document: document as any,
            workspace: { workspaceRoot: 'D:/workspace' },
            mode: 'lsp'
        },
        position: { line: 0, character: 7 }
    });

    expect(definition[0].uri).toBe(vscode.Uri.file('D:/workspace/std/room.c').toString());
});

test('definition service returns no result for room::init() qualifier ambiguity instead of falling back', async () => {
    const document = createDocument('D:/workspace/room.c', 'room::init();');
    const host = {
        onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        openTextDocument: jest.fn(),
        findFiles: jest.fn(),
        getWorkspaceFolder: jest.fn(),
        getWorkspaceFolders: jest.fn(),
        fileExists: jest.fn().mockReturnValue(false)
    };
    const semanticAdapter = {
        getIncludeStatements: jest.fn().mockReturnValue([]),
        getInheritStatements: jest.fn().mockReturnValue([]),
        getExportedFunctionNames: jest.fn().mockReturnValue([]),
        findFunctionLocation: jest.fn().mockReturnValue(undefined),
        resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
    };
    const service = new AstBackedLanguageDefinitionService(
        {} as any,
        { getSimulatedDoc: jest.fn().mockReturnValue({ name: 'init' }) } as any,
        { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
        undefined,
        undefined,
        { scopedMethodResolver: { resolveCallAt: jest.fn().mockResolvedValue({ status: 'unknown', methodName: 'init', qualifier: 'room', targets: [] }) }, host, semanticAdapter } as any
    );

    const definition = await service.provideDefinition({
        context: {
            document: document as any,
            workspace: { workspaceRoot: 'D:/workspace' },
            mode: 'lsp'
        },
        position: { line: 0, character: 7 }
    });

    expect(definition).toEqual([]);
});
```

In `navigationServices.test.ts`, add a host-agnostic hover seam case:

```ts
test('hover service can render scoped method docs through injected scoped boundaries', async () => {
    const document = createDocument('::create();');
    const targetDocument = {
        uri: vscode.Uri.file('/std/base_room.c'),
        fileName: '/std/base_room.c',
        version: 1,
        getText: () => '/**\n * @brief 父类创建。\n */\nvoid create() {}'
    } as unknown as vscode.TextDocument;
    const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
        {} as any,
        undefined,
        undefined,
        undefined,
        {
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    methodName: 'create',
                    targets: [{
                        path: '/std/base_room.c',
                        methodName: 'create',
                        declarationRange: new vscode.Range(0, 0, 0, 12),
                        document: targetDocument,
                        sourceLabel: '/std/base_room.c'
                    }]
                })
            },
            objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) }
        } as any
    );

    const hover = await service.provideHover({ context: createContext(document), position: { line: 0, character: 3 } });

    expect(hover?.contents[0].value).toContain('父类创建');
    expect(hover?.contents[0].value).toContain('void create()');
});

test('hover service can render room::init() docs from the uniquely matched named scope branch', async () => {
    const document = createDocument('room::init();');
    const targetDocument = {
        uri: vscode.Uri.file('/std/room.c'),
        fileName: '/std/room.c',
        version: 1,
        getText: () => '/**\n * @brief 房间初始化。\n */\nvoid init() {}'
    } as unknown as vscode.TextDocument;
    const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
        {} as any,
        undefined,
        undefined,
        undefined,
        {
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: '/std/room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(0, 0, 0, 10),
                        document: targetDocument,
                        sourceLabel: '/std/room.c'
                    }]
                })
            } as any,
            objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) }
        } as any
    );

    const hover = await service.provideHover({ context: createContext(document), position: { line: 0, character: 7 } });

    expect(hover?.contents[0].value).toContain('房间初始化');
    expect(hover?.contents[0].value).toContain('void init()');
});
```

- [ ] **Step 6: Add end-to-end provider regressions**

Extend `src/__tests__/providerIntegration.test.ts` with two real-workspace cases:

```ts
test('definition resolves bare ::create() to the inherited implementation in a real workspace', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'void create() {}\n');

    const source = [
        'inherit "/std/base_room";',
        '',
        'void create() {',
        '    ::create();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room.c'), source);
    const service = new AstBackedLanguageDefinitionService(
        macroManager as any,
        efunDocsManager as any,
        undefined,
        undefined,
        undefined,
        {
            scopedMethodResolver: new ScopedMethodResolver(macroManager as any, [fixtureRoot])
        } as any
    );

    const definition = await provideDefinition(service, document, positionAtSubstring(document, source, 'create();'), fixtureRoot);

    expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'std', 'base_room.c'));
});

test('documented return propagation from ::factory() feeds downstream object-method definition', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, 'obj'), { recursive: true });
    fs.writeFileSync(
        path.join(fixtureRoot, 'std', 'base_room.c'),
        [
            '/**',
            ' * @lpc-return-objects {"/obj/sword"}',
            ' */',
            'object factory() {',
            '    return 0;',
            '}'
        ].join('\n')
    );
    fs.writeFileSync(path.join(fixtureRoot, 'obj', 'sword.c'), 'string query_name() { return "sword"; }\n');

    const source = [
        'inherit "/std/base_room";',
        '',
        'void demo() {',
        '    object ob = ::factory();',
        '    ob->query_name();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room.c'), source);
    const service = new AstBackedLanguageDefinitionService(
        macroManager as any,
        efunDocsManager as any,
        new ObjectInferenceService(macroManager as any) as any,
        undefined,
        undefined,
        {
            scopedMethodResolver: new ScopedMethodResolver(macroManager as any, [fixtureRoot])
        } as any
    );

    const definition = await provideDefinition(service, document, positionAtSubstring(document, source, 'query_name();'), fixtureRoot);

    expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'obj', 'sword.c'));
});

test('documented return propagation from room::factory() feeds downstream object-method definition', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, 'obj'), { recursive: true });
    fs.writeFileSync(
        path.join(fixtureRoot, 'std', 'room.c'),
        [
            '/**',
            ' * @lpc-return-objects {"/obj/room_item"}',
            ' */',
            'object factory() {',
            '    return 0;',
            '}'
        ].join('\n')
    );
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'combat.c'), 'object factory() { return 0; }\n');
    fs.writeFileSync(path.join(fixtureRoot, 'obj', 'room_item.c'), 'string query_name() { return "room-item"; }\n');

    const source = [
        'inherit "/std/room";',
        'inherit "/std/combat";',
        '',
        'void demo() {',
        '    object ob = room::factory();',
        '    ob->query_name();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'named-room.c'), source);
    const service = new AstBackedLanguageDefinitionService(
        macroManager as any,
        efunDocsManager as any,
        new ObjectInferenceService(macroManager as any) as any,
        undefined,
        undefined,
        {
            scopedMethodResolver: new ScopedMethodResolver(macroManager as any, [fixtureRoot])
        } as any
    );

    const definition = await provideDefinition(service, document, positionAtSubstring(document, source, 'query_name();'), fixtureRoot);

    expect(normalizeLocationUri(definition[0].uri)).toBe(path.join(fixtureRoot, 'obj', 'room_item.c'));
});
```

The second and third tests are the critical end-to-end guards that prove both bare and named-scope return propagation reach downstream object-method inference.

- [ ] **Step 7: Run the consumer verification slice**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts -t "::|room::|scoped|factory|production"
```

Expected: PASS

- [ ] **Step 8: Run the final regression bundle and typecheck**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ScopedMethodResolver.test.ts src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts
npx tsc --noEmit
```

Expected:
- All listed Jest suites PASS
- `npx tsc --noEmit` exits `0`

- [ ] **Step 9: Commit the consumer wiring**

```bash
git add src/language/documentation/types.ts src/language/services/signatureHelp/LanguageSignatureHelpService.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/LanguageHoverService.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "feat(language): wire scoped method resolution"
```

## Notes for Execution

- Keep the inherit-only constraint inside `ScopedMethodResolver` itself. Do not rely on consumers to remember to skip current-file/include lookup.
- Do not route `::` through `TargetMethodLookup.findMethod(...)` as-is. Its current-file/include-first behavior is explicitly out of scope for this feature.
- Preserve `unknown` for qualifier ambiguity. Only use `unsupported` for structurally unsupported `::` shapes.
- Do not widen this plan into `call_other`, runtime globals, or dynamic inherit support.
```
