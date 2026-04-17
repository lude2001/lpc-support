# Static Global Object Inference P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add P0 static inference for file-scope global `object` bindings so current-file globals participate in object member completion, definition, hover, and signature help without falling back incorrectly to macros.

**Architecture:** Keep `ObjectInferenceService` as the only entrypoint, add one focused `GlobalObjectBindingResolver` for file-scope globals, and insert it strictly between local tracing and macro fallback. Reuse the existing expression resolvers for initializer proof, treat visible-but-unprovable globals as `unknown` or `unsupported`, and let downstream language services benefit automatically by consuming the existing inference result.

**Tech Stack:** TypeScript, VS Code extension APIs, existing `ASTManager` / `SemanticSnapshot` / `SyntaxDocument`, Jest + ts-jest.

---

## File Map

- Create: `src/objectInference/GlobalObjectBindingResolver.ts`
  Responsibility: Resolve visible file-scope global `object` bindings from semantic/syntax data, map declarators to initializer outcomes, recurse through global aliases, and report whether a visible global binding exists.
- Modify: `src/objectInference/ObjectInferenceService.ts`
  Responsibility: Instantiate and invoke `GlobalObjectBindingResolver` after local tracing and before macro fallback, without changing the public `inferObjectAccess()` contract.
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
  Responsibility: Lock P0 behavior for basic globals, macro precedence, alias recursion, unknown/unsupported downgrade, and object-method initializers.
- Test: `src/__tests__/providerIntegration.test.ts`
  Responsibility: Prove that actual completion and definition consumers benefit from the new inference path.
- Test: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
  Responsibility: Prove that at least one non-definition consumer beyond completion can consume the new global-object inference path.

**Reference files to read before coding:**
- `src/objectInference/ReturnObjectResolver.ts`
- `src/objectInference/ObjectMethodReturnResolver.ts`
- `src/objectInference/ReceiverTraceService.ts`
- `src/symbolReferenceResolver.ts`
- `src/semantic/semanticSnapshot.ts`

## Chunk 1: Static Global Object Inference P0

### Task 1: Lock Basic Current-File Global Binding Behavior

**Files:**
- Modify: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing test for a file-scope global initialized by a builtin object source**

Add a focused test near the existing identifier-tracing coverage:

```ts
test('file-scope global object initialized by load_object resolves before macro fallback', async () => {
    const source = [
        'object COMBAT_D = load_object("/adm/daemons/combat_d");',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-load-object.c'), source);

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

- [ ] **Step 2: Write the failing test that a visible global beats a same-name macro**

Reuse the same fixture root and set `macroManager.getMacro.mockReturnValue(...)` to a conflicting object path:

```ts
test('visible file-scope global object wins over same-name macro fallback', async () => {
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/objects/shield',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'object COMBAT_D = load_object("/adm/daemons/combat_d");',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-vs-macro.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
            source: 'builtin-call'
        }
    ]);
});
```

- [ ] **Step 3: Add the local-shadowing regression test that a local binding still outranks a same-name global**

Add:

```ts
test('local object bindings still shadow file-scope globals', async () => {
    const source = [
        'object COMBAT_D = load_object("/adm/daemons/combat_d");',
        '',
        'void demo() {',
        '    object COMBAT_D = load_object("/adm/objects/sword");',
        '    COMBAT_D->query();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-shadowed-by-local.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->query'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
            source: 'builtin-call'
        }
    ]);
});
```

This case may already be green in the current baseline. Keep it in this task anyway as a precedence guard; do not force it red by weakening the expectation.

- [ ] **Step 4: Run the focused tests and confirm they fail in the current code**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "file-scope global object|same-name macro fallback|shadow file-scope globals"
```

Expected:
- The first two new global-binding tests FAIL because identifier receivers currently skip file-scope globals and drop straight to macro fallback.
- The local-shadowing regression may already PASS if the current local binding precedence is intact.

- [ ] **Step 5: Commit the test-only red phase**

```bash
git add src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "test(object-inference): add static global binding red cases"
```

### Task 2: Add `GlobalObjectBindingResolver` Skeleton and Basic Declarator Resolution

**Files:**
- Create: `src/objectInference/GlobalObjectBindingResolver.ts`
- Modify: `src/objectInference/ObjectInferenceService.ts`

- [ ] **Step 1: Create the resolver shell with a private visible-binding result type**

Create `src/objectInference/GlobalObjectBindingResolver.ts` with a focused internal shape:

```ts
interface GlobalBindingResolution {
    hasVisibleBinding: boolean;
    outcome: ObjectResolutionOutcome;
}

export class GlobalObjectBindingResolver {
    private readonly astManager = ASTManager.getInstance();

    constructor(
        private readonly returnObjectResolver: ReturnObjectResolver,
        private readonly objectMethodReturnResolver: ObjectMethodReturnResolver
    ) {}

    public async resolveIdentifierOutcome(
        document: vscode.TextDocument,
        identifierName: string,
        position: vscode.Position
    ): Promise<GlobalBindingResolution> {
        return this.resolveIdentifierOutcomeInternal(
            document,
            identifierName,
            position,
            new Set<string>()
        );
    }

    private async resolveIdentifierOutcomeInternal(
        document: vscode.TextDocument,
        identifierName: string,
        position: vscode.Position,
        visited: Set<string>
    ): Promise<GlobalBindingResolution> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        return { hasVisibleBinding: false, outcome: { candidates: [] } };
    }
}
```

- [ ] **Step 2: Implement visible global-symbol lookup from shared semantic state**

Inside `resolveIdentifierOutcome(...)`, use the existing shared helpers instead of custom scanning:

```ts
const visibleSymbol = resolveVisibleSymbol(snapshot.symbolTable, identifierName, position);
if (!visibleSymbol || visibleSymbol.type !== SymbolType.VARIABLE || visibleSymbol.scope.name !== 'global') {
    return { hasVisibleBinding: false, outcome: { candidates: [] } };
}

if (!isObjectTypedSymbol(visibleSymbol)) {
    return { hasVisibleBinding: false, outcome: { candidates: [] } };
}
```

Implement `isObjectTypedSymbol(...)` conservatively so only declared `object` variables enter this path.

- [ ] **Step 3: Implement declarator lookup by symbol range and name**

Still in `GlobalObjectBindingResolver.ts`, locate the matching `VariableDeclarator` from `snapshot.syntax.nodes`:

```ts
const declarator = [...snapshot.syntax.nodes]
    .filter((node) => node.kind === SyntaxKind.VariableDeclarator && node.name === identifierName)
    .find((node) =>
        node.range.contains(visibleSymbol.selectionRange?.start ?? visibleSymbol.range.start)
        || (visibleSymbol.selectionRange && node.range.intersection(visibleSymbol.selectionRange))
    );
```

If no declarator is found, return:

```ts
return {
    hasVisibleBinding: true,
    outcome: { candidates: [] }
};
```

That preserves “visible binding exists” while keeping the result conservatively `unknown`.

- [ ] **Step 4: Wire the resolver into `ObjectInferenceService` before macro fallback**

In `src/objectInference/ObjectInferenceService.ts`, instantiate the resolver next to the existing ones:

```ts
private readonly globalObjectBindingResolver: GlobalObjectBindingResolver;
```

Then change the identifier branch to:

```ts
const tracedResult = await this.traceService.traceIdentifier(document, syntax, receiverNode);
if (tracedResult && (tracedResult.candidates.length > 0 || tracedResult.hasVisibleBinding)) {
    return tracedResult;
}

const globalOutcome = await this.globalObjectBindingResolver.resolveIdentifierOutcome(
    document,
    receiver.expression,
    receiverNode.range.start
);
if (globalOutcome.hasVisibleBinding) {
    return globalOutcome.outcome;
}

return {
    candidates: await this.resolvePathCandidate(document, receiver.expression, 'macro')
};
```

- [ ] **Step 5: Re-run the focused tests and verify they now pass**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "file-scope global object|same-name macro fallback"
```

Expected: PASS.

- [ ] **Step 6: Commit the basic resolver wiring**

```bash
git add src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/ObjectInferenceService.ts
git commit -m "feat(object-inference): resolve static current-file global objects"
```

### Task 3: Implement Alias Recursion and Visible-Binding Downgrade Rules

**Files:**
- Modify: `src/objectInference/GlobalObjectBindingResolver.ts`
- Modify: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing test for a global alias to another global object**

Add:

```ts
test('file-scope global aliases recurse through other static global object bindings', async () => {
    const source = [
        'object BASE_D = load_object("/adm/daemons/combat_d");',
        'object ALIAS_D = BASE_D;',
        '',
        'void demo() {',
        '    ALIAS_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-alias.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'ALIAS_D->start'));

    expect(result?.inference?.candidates).toEqual([
        {
            path: path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'),
            source: 'builtin-call'
        }
    ]);
});
```

- [ ] **Step 2: Write the failing test for an alias cycle downgrading to `unknown`**

Add:

```ts
test('cyclic file-scope global aliases degrade to unknown', async () => {
    const source = [
        'object A = B;',
        'object B = A;',
        '',
        'void demo() {',
        '    A->query();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-alias-cycle.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'A->query'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});
```

- [ ] **Step 3: Write the failing tests for `unknown` / `unsupported` globals not falling back to macros**

Add both cases:

```ts
test('visible file-scope global without initializer stays unknown instead of falling back to macro', async () => {
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/combat_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'object COMBAT_D;',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-no-initializer.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: []
    });
});

test('visible file-scope global with unsupported initializer stays unsupported instead of falling back to macro', async () => {
    macroManager.getMacro.mockReturnValue({
        name: 'COMBAT_D',
        value: '/adm/daemons/combat_d',
        file: path.join(fixtureRoot, 'include', 'daemons.h'),
        line: 1
    });

    const source = [
        'mixed *arr;',
        'object COMBAT_D = arr[0];',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-unsupported-initializer.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'COMBAT_D->start'));

    expect(result?.inference).toEqual({
        status: 'unsupported',
        reason: 'unsupported-expression',
        candidates: []
    });
});
```

- [ ] **Step 4: Run the focused downgrade and alias tests to confirm failure**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "global aliases recurse|aliases degrade to unknown|stays unknown instead of falling back|stays unsupported instead of falling back"
```

Expected: FAIL because alias recursion and visible-binding downgrade rules are not implemented yet.

- [ ] **Step 5: Implement recursive global identifier resolution with cycle protection**

Inside `GlobalObjectBindingResolver.ts`, add an internal recursive helper:

```ts
private async resolveIdentifierOutcomeInternal(
    document: vscode.TextDocument,
    identifierName: string,
    position: vscode.Position,
    visited: Set<string>
): Promise<GlobalBindingResolution> {
    const visitKey = `${document.uri.toString()}:${identifierName}`;
    if (visited.has(visitKey)) {
        return {
            hasVisibleBinding: true,
            outcome: { candidates: [] }
        };
    }

    visited.add(visitKey);
    const snapshot = this.astManager.getSemanticSnapshot(document, false);
    const visibleSymbol = resolveVisibleSymbol(snapshot.symbolTable, identifierName, position);
    if (!visibleSymbol || visibleSymbol.type !== SymbolType.VARIABLE || visibleSymbol.scope.name !== 'global') {
        return { hasVisibleBinding: false, outcome: { candidates: [] } };
    }

    return this.resolveVisibleGlobalSymbol(document, snapshot, visibleSymbol, position, visited);
}
```

When the initializer is an identifier:

```ts
if (initializer.kind === SyntaxKind.Identifier && initializer.name) {
    return this.resolveIdentifierOutcomeInternal(document, initializer.name, initializer.range.start, visited);
}
```

For no initializer, return `hasVisibleBinding: true` with empty candidates. For unsupported initializer outcomes, preserve the `reason` from `ReturnObjectResolver` and keep `hasVisibleBinding: true`.

- [ ] **Step 6: Re-run the focused tests and verify they pass**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "global aliases recurse|aliases degrade to unknown|stays unknown instead of falling back|stays unsupported instead of falling back"
```

Expected: PASS.

- [ ] **Step 7: Commit the alias and downgrade behavior**

```bash
git add src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "fix(object-inference): keep visible globals ahead of macro fallback"
```

### Task 4: Support Documented-Return and Object-Method Initializers

**Files:**
- Modify: `src/objectInference/GlobalObjectBindingResolver.ts`
- Modify: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing test for a global initialized by a documented-return function call**

Add:

```ts
test('file-scope global documented-return initializer reuses ReturnObjectResolver', async () => {
    const source = [
        'object PRODUCT = create_reward();',
        '',
        'void demo() {',
        '    PRODUCT->query_name();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-documented-return-initializer.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'PRODUCT->query_name'));

    expect(result?.inference).toEqual({
        status: 'resolved',
        candidates: [
            {
                path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                source: 'doc'
            }
        ]
    });
});
```

- [ ] **Step 2: Write the failing test for a global initialized by an object method call**

Add:

```ts
test('file-scope global object method initializer reuses object method return propagation', async () => {
    const source = [
        'object FACTORY = load_object("/adm/objects/factory");',
        'object PRODUCT = FACTORY->create();',
        '',
        'void demo() {',
        '    PRODUCT->query_name();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'global-object-method-initializer.c'), source);

    const result = await service.inferObjectAccess(document, positionAfter(source, 'PRODUCT->query_name'));

    expect(result?.inference).toEqual({
        status: 'resolved',
        candidates: [
            {
                path: path.join(fixtureRoot, 'adm', 'objects', 'sword.c'),
                source: 'doc'
            }
        ]
    });
});
```

- [ ] **Step 3: Run the focused tests and confirm failure**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "documented-return initializer|global object method initializer"
```

Expected: FAIL because the new resolver does not yet route generic initializers through `ReturnObjectResolver` or branch member-call initializers into `ObjectMethodReturnResolver`.

- [ ] **Step 4: Route ordinary initializers through `ReturnObjectResolver` before adding the method-call branch**

Inside `GlobalObjectBindingResolver.ts`, after alias handling and before the final unsupported fallback, explicitly route ordinary initializer expressions through the existing expression resolver:

```ts
const ordinaryOutcome = await this.returnObjectResolver.resolveExpressionOutcome(document, initializer);
if (ordinaryOutcome.candidates.length > 0 || ordinaryOutcome.reason || ordinaryOutcome.diagnostics?.length) {
    return {
        hasVisibleBinding: true,
        outcome: ordinaryOutcome
    };
}
```

That path is what covers string paths, macro paths, builtin calls, and documented-return global function initializers.

- [ ] **Step 5: Detect member-call initializers first, then hand them to `ObjectMethodReturnResolver`**

Inside `GlobalObjectBindingResolver.ts`, branch before any generic expression fallback so `receiver->method()` never gets swallowed by the ordinary initializer path:

```ts
if (
    initializer.kind === SyntaxKind.CallExpression
    && initializer.children[0]?.kind === SyntaxKind.MemberAccessExpression
    && initializer.children[0].metadata?.operator === '->'
    && initializer.children[0].children[1]?.kind === SyntaxKind.Identifier
    && initializer.children[0].children[1].name
) {
    const receiverExpr = initializer.children[0].children[0];
    const receiverOutcome = await this.resolveInitializerReceiverOutcome(document, receiverExpr, visited);
    if (receiverOutcome.candidates.length === 0 || receiverOutcome.reason || receiverOutcome.diagnostics?.length) {
        return {
            hasVisibleBinding: true,
            outcome: receiverOutcome
        };
    }

    return {
        hasVisibleBinding: true,
        outcome: await this.objectMethodReturnResolver.resolveMethodReturnOutcome(
            document,
            receiverOutcome.candidates,
            initializer.children[0].children[1].name
        )
    };
}
```

Keep the receiver-resolution helper small: it only needs enough logic to prove the receiver candidates for global initializer method calls.

- [ ] **Step 6: Re-run the focused tests and verify they pass**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "documented-return initializer|global object method initializer"
```

Expected: PASS.

- [ ] **Step 7: Commit documented-return and object-method initializer support**

```bash
git add src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "feat(object-inference): support static global initializer propagation"
```

### Task 5: Prove Completion and Definition Consume the New Inference Path

**Files:**
- Modify: `src/__tests__/providerIntegration.test.ts`
- Modify: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`

- [ ] **Step 1: Write the failing definition integration test for a global object receiver**

Add a real integration case that uses the actual object inference path rather than a stub:

```ts
test('definition resolves methods from file-scope global objects through object inference', async () => {
    const objectFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
    fs.mkdirSync(path.dirname(objectFile), { recursive: true });
    fs.writeFileSync(objectFile, 'void start() {}\n');

    const source = [
        'object COMBAT_D = load_object("/adm/daemons/combat_d");',
        '',
        'void demo() {',
        '    COMBAT_D->start();',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'global-definition.c'), source);
    const service = new AstBackedLanguageDefinitionService(macroManager as any, efunDocsManager as any);

    const definition = await provideDefinition(
        service,
        document,
        positionAtSubstring(document, source, 'start();'),
        fixtureRoot
    );

    expect(definition).toHaveLength(1);
    expect(normalizeLocationUri(definition[0].uri)).toBe(objectFile);
});
```

- [ ] **Step 2: Write the completion integration test for a global object receiver**

Add:

```ts
test('completion includes object methods for file-scope global object receivers', async () => {
    const daemonFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
    fs.mkdirSync(path.dirname(daemonFile), { recursive: true });
    fs.writeFileSync(daemonFile, 'void start() {}\nvoid stop() {}\n');

    const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);
    const document = createDocument(
        path.join(fixtureRoot, 'global-completion.c'),
        [
            'object COMBAT_D = load_object("/adm/daemons/combat_d");',
            '',
            'void demo() {',
            '    COMBAT_D->',
            '}'
        ].join('\n')
    );

    const result = await service.provideCompletion({
        context: createLanguageContext(document, fixtureRoot),
        position: { line: 3, character: '    COMBAT_D->'.length },
        triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: '>'
    });

    expect(result.items.map((item) => item.label)).toEqual(expect.arrayContaining(['start', 'stop']));
});
```

- [ ] **Step 3: Write the signature-help regression for a global object receiver**

Add a narrow test in `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts` that uses a real `ObjectInferenceService` with a global object receiver and stubs only the target lookup/doc materialization:

```ts
test('uses static file-scope global object inference for object-method signature help', async () => {
    const source = [
        'object COMBAT_D = load_object("/adm/daemons/combat_d");',
        '',
        'void demo() {',
        '    COMBAT_D->query_name(1, 2);',
        '}'
    ].join('\n');
    const document = createDocument('D:/workspace/global-signature.c', source);

    const result = await service.provideSignatureHelp({
        context: createLanguageContext(document),
        position: { line: 3, character: 21 }
    });

    expect(result?.signatures[0].label).toBe('string query_name(int mode, int flags)');
});
```

- [ ] **Step 4: Run the focused consumer regression tests and record whether they are red or already green**

Run:

```bash
npx jest --runInBand src/__tests__/providerIntegration.test.ts -t "file-scope global object"
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts -t "file-scope global object inference"
```

Expected:
- If the current implementation still misses a consumer path, one or more of these tests FAIL and the task must include the minimal production fix.
- If Tasks 2-4 already made the behavior reachable, these new tests may PASS immediately and should be kept as regression coverage.

- [ ] **Step 5: If any consumer test was red, make the minimal fix and then verify all consumer cases pass**

Run:

```bash
npx jest --runInBand src/__tests__/providerIntegration.test.ts -t "file-scope global object"
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts -t "file-scope global object inference"
```

Expected: PASS.

- [ ] **Step 6: Commit the consumer-level regression coverage**

```bash
git add src/__tests__/providerIntegration.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts
git commit -m "test(object-inference): cover static global consumers"
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

Expected: Only the intended object-inference and test files remain modified.

- [ ] **Step 4: If verification required additional fixes, commit the verified end state; otherwise leave the branch as-is**

```bash
git add src/objectInference/GlobalObjectBindingResolver.ts src/objectInference/ObjectInferenceService.ts src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts
git commit -m "feat(object-inference): infer static current-file global objects"
```

If all verification passes without further edits, do not create an empty commit just to satisfy this step.

## Self-Review

- Scope check: this plan stays strictly within P0 and does not include inherited globals, runtime global assignments, or new builtin sources.
- Architecture check: the new file has one responsibility, and the existing entrypoint remains `ObjectInferenceService`.
- TDD check: every behavior change starts with a failing test, then minimal implementation, then focused verification, then a commit.
- Placeholder scan: no `TODO`, `TBD`, or “same as above” shortcuts remain.
