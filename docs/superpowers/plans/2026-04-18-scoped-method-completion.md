# Scoped Method Completion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add completion support for bare `::method` and named `room::method` calls, using the existing scoped-method semantics and failure rules without leaking into `->` object-member completion or ordinary function fallback.

**Architecture:** Extend completion context analysis with a dedicated `scoped-member` kind, then add a focused scoped-method discovery boundary that enumerates visible scoped-call methods without changing `ScopedMethodResolver`'s “concrete call only” contract. Keep `QueryBackedLanguageCompletionService` as the orchestrator, but move scoped candidate building and declaration-based doc resolution into a small completion-specific helper so the already-large service file does not become a heavier contraption.

**Tech Stack:** TypeScript, VS Code extension APIs, `ASTManager` / `SemanticSnapshot`, `InheritanceResolver`, `FunctionDocumentationService`, existing scoped-method infrastructure, Jest + ts-jest.

---

## File Map

- Modify: `src/completion/types.ts`
  Responsibility: Add `scoped-member` to `CompletionContextKind`, `scoped-method` to `CompletionCandidateSourceType`, and scoped declaration metadata needed for declaration-based completion-item resolve.
- Modify: `src/completion/completionContextAnalyzer.ts`
  Responsibility: Detect `::namePrefix` and `qualifier::namePrefix` as a dedicated completion context, while refusing to trigger on qualifier or argument positions.
- Modify: `src/__tests__/completionContextAnalyzer.test.ts`
  Responsibility: Lock the new scoped context detection and prove ordinary `->` member detection does not regress.
- Create: `src/objectInference/ScopedMethodDiscoveryService.ts`
  Responsibility: Enumerate scoped-method completion candidates for the current cursor position, reusing the same inherit-only, qualifier-uniqueness, and unresolved-inherit downgrade rules as existing scoped-method resolution without pretending to resolve a concrete method call.
- Create: `src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts`
  Responsibility: Lock bare `::` discovery, named-scope discovery, ambiguity downgrade, unresolved-inherit downgrade, unsupported shapes, and “no current-file/include leakage” behavior.
- Create: `src/language/services/completion/ScopedMethodCompletionSupport.ts`
  Responsibility: Translate scoped discovery results into `CompletionCandidate[]`, build declaration keys for scoped targets, load target documents from `sourceUri`, and resolve scoped completion item documentation through `FunctionDocumentationService` instead of falling back to ordinary structured docs.
- Create: `src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts`
  Responsibility: Lock scoped candidate ranking, declaration-key metadata, declaration-based documentation rendering, and “no fallback to ordinary structured resolve” behavior.
- Create: `src/language/services/completion/__tests__/LanguageCompletionService.test.ts`
  Responsibility: Lock the service-level `resolveCompletionItem(...)` branch for `sourceType: 'scoped-method'`, including declaration-based doc lookup and explicit non-use of the legacy structured-doc path.
- Modify: `src/language/services/completion/LanguageCompletionService.ts`
  Responsibility: Branch on `scoped-member`, delegate candidate collection and item resolution to `ScopedMethodCompletionSupport`, and keep `member` (`->`) behavior unchanged.
- Modify: `src/__tests__/providerIntegration.test.ts`
  Responsibility: Prove end-to-end scoped completion behavior through the real completion service, including bare `::`, unique `room::`, and conservative empty results when scoped discovery is ambiguous or incomplete.

**Reference files to read before coding:**
- `docs/superpowers/specs/2026-04-17-scoped-method-completion-design.md`
- `src/completion/completionContextAnalyzer.ts`
- `src/completion/types.ts`
- `src/language/services/completion/LanguageCompletionService.ts`
- `src/objectInference/ScopedMethodResolver.ts`
- `src/language/documentation/FunctionDocumentationService.ts`
- `src/__tests__/providerIntegration.test.ts`

## Chunk 1: Context and Scoped Discovery

### Task 1: Lock Scoped Completion Context and Discovery with Red Tests

**Files:**
- Modify: `src/__tests__/completionContextAnalyzer.test.ts`
- Create: `src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts`

- [ ] **Step 1: Add failing scoped-context tests to `completionContextAnalyzer.test.ts`**

Extend `src/__tests__/completionContextAnalyzer.test.ts` with cases that prove completion treats scoped calls as a dedicated context:

```ts
test('classifies bare and named scoped prefixes as scoped-member contexts', () => {
    const document = createDocument([
        '::cr',
        'room::in',
        'room::init(arg);'
    ].join('\n'));

    const bareScoped = analyzer.analyze(document, new vscode.Position(0, '::cr'.length));
    expect(bareScoped.kind).toBe('scoped-member');
    expect(bareScoped.currentWord).toBe('cr');
    expect(bareScoped.receiverExpression).toBe('::');

    const namedScoped = analyzer.analyze(document, new vscode.Position(1, 'room::in'.length));
    expect(namedScoped.kind).toBe('scoped-member');
    expect(namedScoped.currentWord).toBe('in');
    expect(namedScoped.receiverExpression).toBe('room::');
});

test('does not classify qualifier or argument positions as scoped-member', () => {
    const document = createDocument('room::init(arg);');

    const onQualifier = analyzer.analyze(document, new vscode.Position(0, 'room'.length));
    expect(onQualifier.kind).toBe('identifier');

    const onArgument = analyzer.analyze(document, new vscode.Position(0, 'room::init(arg'.length));
    expect(onArgument.kind).toBe('identifier');
});
```

- [ ] **Step 2: Create failing discovery tests for bare `::` lookup**

Create `src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts` with fixture helpers mirroring the existing object-inference tests. Start with bare-scope coverage:

```ts
test('discovers visible methods for bare :: prefixes from direct inherit targets only', async () => {
    writeFixture('/std/base_room.c', [
        'void create() {}',
        'void reset() {}'
    ].join('\n'));

    const document = createDocument(
        fixturePath('/d/city/room.c'),
        [
            'inherit "/std/base_room";',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n')
    );

    const result = await service.discoverAt(document, positionAfter('::cr'));

    expect(result.status).toBe('resolved');
    expect(result.methods.map((method) => method.name)).toEqual(['create']);
});

test('bare :: prefixes never leak current-file or include functions into scoped completion', async () => {
    writeFixture('/std/base_room.c', 'void create() {}\n');
    writeFixture('/include/helpers.h', 'void create_helper() {}\n');

    const document = createDocument(
        fixturePath('/d/city/no_leak.c'),
        [
            'inherit "/std/base_room";',
            'include "/include/helpers.h";',
            '',
            'void create_local() {}',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n')
    );

    const result = await service.discoverAt(document, positionAfter('::cr'));

    expect(result.methods.map((method) => method.name)).toEqual(['create']);
});
```

- [ ] **Step 3: Add failing named-scope and conservative-downgrade tests**

In the same discovery test file, add the risk cases from the spec:

```ts
test('discovers methods only from the uniquely matched named direct inherit branch', async () => {
    writeFixture('/std/room.c', 'void init() {}\nvoid create() {}\n');
    writeFixture('/std/combat.c', 'void init() {}\nvoid engage() {}\n');

    const document = createDocument(
        fixturePath('/d/city/mixed_room.c'),
        [
            'inherit "/std/room";',
            'inherit "/std/combat";',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n')
    );

    const result = await service.discoverAt(document, positionAfter('room::in'));

    expect(result.status).toBe('resolved');
    expect(result.methods.map((method) => method.name)).toEqual(['init']);
});

test('named scoped discovery returns unknown when the qualifier is ambiguous', async () => {
    writeFixture('/std/room.c', 'void init() {}\n');
    writeFixture('/domains/room.c', 'void init() {}\n');

    const document = createDocument(
        fixturePath('/d/city/ambiguous.c'),
        [
            'inherit "/std/room";',
            'inherit "/domains/room";',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n')
    );

    const result = await service.discoverAt(document, positionAfter('room::in'));

    expect(result.status).toBe('unknown');
    expect(result.methods).toEqual([]);
});

test('named scoped discovery returns unknown when any direct inherit remains unresolved', async () => {
    writeFixture('/std/room.c', 'void init() {}\n');

    const document = createDocument(
        fixturePath('/d/city/unresolved.c'),
        [
            'inherit "/std/room";',
            'inherit ROOM_BASE;',
            '',
            'void demo() {',
            '    room::in',
            '}'
        ].join('\n')
    );

    const result = await service.discoverAt(document, positionAfter('room::in'));

    expect(result.status).toBe('unknown');
    expect(result.methods).toEqual([]);
});

test('bare scoped discovery returns unknown when a traversed parent branch has an unresolved direct inherit', async () => {
    writeFixture('/std/base_room.c', [
        'inherit "/std/room_parent";',
        'void create() {}'
    ].join('\n'));
    writeFixture('/std/room_parent.c', [
        'inherit ROOM_BASE;',
        'void create() {}'
    ].join('\n'));

    const document = createDocument(
        fixturePath('/d/city/nested_unresolved.c'),
        [
            'inherit "/std/base_room";',
            '',
            'void demo() {',
            '    ::cr',
            '}'
        ].join('\n')
    );

    const result = await service.discoverAt(document, positionAfter('::cr'));

    expect(result.status).toBe('unknown');
    expect(result.methods).toEqual([]);
});

test('non-identifier left sides stay unsupported for scoped completion discovery', async () => {
    const document = createDocument(
        fixturePath('/d/city/bad_scope.c'),
        'void demo() { factory()::in; }\n'
    );

    const result = await service.discoverAt(document, positionAfter('::in'));

    expect(result.status).toBe('unsupported');
    expect(result.methods).toEqual([]);
});
```

- [ ] **Step 4: Run the red slice**

Run:

```bash
npx jest --runInBand src/__tests__/completionContextAnalyzer.test.ts src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts
```

Expected:
- `completionContextAnalyzer.test.ts` FAILS because `scoped-member` does not exist yet.
- `ScopedMethodDiscoveryService.test.ts` FAILS because the discovery service does not exist yet.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/__tests__/completionContextAnalyzer.test.ts src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts
git commit -m "test(completion): add scoped method discovery red cases"
```

### Task 2: Implement Scoped Completion Context and Discovery

**Files:**
- Modify: `src/completion/types.ts`
- Modify: `src/completion/completionContextAnalyzer.ts`
- Create: `src/objectInference/ScopedMethodDiscoveryService.ts`

- [ ] **Step 1: Extend completion context/source types with the scoped vocabulary**

Update `src/completion/types.ts` so completion can represent the new path explicitly:

```ts
export type CompletionContextKind =
    | 'identifier'
    | 'member'
    | 'scoped-member'
    | 'preprocessor'
    | 'inherit-path'
    | 'include-path'
    | 'type-position';

export type CompletionCandidateSourceType =
    | 'local'
    | 'inherited'
    | 'struct-member'
    | 'scoped-method'
    | 'efun'
    | 'simul-efun'
    | 'keyword'
    | 'macro';
```

Also extend `CompletionCandidateMetadata` with the scoped declaration payload instead of inventing a parallel side channel:

```ts
export interface CompletionCandidateMetadata {
    sourceUri?: string;
    sourceType: CompletionCandidateSourceType;
    documentationRef?: string;
    declarationKey?: string;
    symbol?: Symbol;
    scope?: Scope;
}
```

- [ ] **Step 2: Teach `CompletionContextAnalyzer` to detect scoped prefixes before `->` member logic**

Modify `src/completion/completionContextAnalyzer.ts` so it recognizes scoped prefixes without collapsing them into `member`:

```ts
private extractScopedContext(linePrefix: string): { receiverExpression: string; currentWord: string } | undefined {
    const match = linePrefix.match(/(?:^|.*\s)(::|[A-Za-z_][A-Za-z0-9_]*::)([A-Za-z0-9_]*)$/);
    if (!match) {
        return undefined;
    }

    return {
        receiverExpression: match[1],
        currentWord: match[2] ?? ''
    };
}
```

Wire it ahead of `extractReceiverContext(...)`, and explicitly reject:
- cursor positions still inside the qualifier token
- positions already inside `(...)`
- plain `identifier::` when the cursor is not on the method prefix

- [ ] **Step 3: Implement `ScopedMethodDiscoveryService` as the completion-side enumerator**

Create `src/objectInference/ScopedMethodDiscoveryService.ts` with a contract built for completion instead of concrete call resolution:

```ts
export interface ScopedDiscoveredMethod {
    name: string;
    path: string;
    documentUri: string;
    declarationRange: vscode.Range;
    definition?: string;
    documentation?: string;
    returnType?: string;
    parameters: { name: string; type?: string }[];
}

export interface ScopedMethodDiscoveryResult {
    status: 'resolved' | 'multiple' | 'unknown' | 'unsupported';
    qualifier?: string;
    methods: ScopedDiscoveredMethod[];
    reason?: 'unsupported-expression';
}
```

Implementation rules:
- use `ASTManager` + `SemanticSnapshot`, never text scans
- reuse `InheritanceResolver` for direct-inherit seed resolution
- for bare `::`, enumerate methods from direct-inherit graph only, never current-file/include
- for named `room::`, require a unique direct-inherit qualifier match before enumerating
- if any direct inherit is unresolved in a way that makes the scoped answer unsafe, downgrade to `unknown`

Do **not** mutate `ScopedMethodResolver` into a completion enumerator; if a small helper extraction is needed, keep it narrow and shared by both files instead of stuffing more logic into the 377-line resolver.

- [ ] **Step 4: Run the focused green slice**

Run:

```bash
npx jest --runInBand src/__tests__/completionContextAnalyzer.test.ts src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Run a broader non-regression check for completion context/object inference**

Run:

```bash
npx jest --runInBand src/__tests__/completionContextAnalyzer.test.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
```

Expected:
- PASS
- No regression in existing `->` receiver semantics.

- [ ] **Step 6: Commit the scoped discovery core**

```bash
git add src/completion/types.ts src/completion/completionContextAnalyzer.ts src/objectInference/ScopedMethodDiscoveryService.ts src/__tests__/completionContextAnalyzer.test.ts src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts
git commit -m "feat(completion): add scoped method discovery context"
```

## Chunk 2: Completion Wiring and Documentation

### Task 3: Write the Failing Completion-Service and Integration Coverage

**Files:**
- Create: `src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts`
- Create: `src/language/services/completion/__tests__/LanguageCompletionService.test.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Add failing unit tests for scoped candidate building and doc resolution**

Create `src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts` with focused tests around the completion-specific helper:

```ts
test('buildCandidates converts scoped discovery results into scoped-method completion candidates', async () => {
    const support = new ScopedMethodCompletionSupport(
        new FunctionDocumentationService(),
        jest.fn(async () => undefined)
    );

    const result = support.buildCandidates({
        status: 'resolved',
        methods: [{
            name: 'create',
            path: 'D:/workspace/std/base_room.c',
            documentUri: 'file:///D:/workspace/std/base_room.c',
            declarationRange: new vscode.Range(1, 0, 1, 15),
            returnType: 'void',
            parameters: []
        }]
    }, 'cr', 'file:///D:/workspace/d/city/room.c');

    expect(result).toEqual([
        expect.objectContaining({
            label: 'create',
            kind: vscode.CompletionItemKind.Method,
            metadata: expect.objectContaining({
                sourceType: 'scoped-method',
                declarationKey: 'file:///D:/workspace/std/base_room.c#1:0-1:15'
            })
        })
    ]);
});

test('resolveScopedDocumentation reads callable docs by declaration key instead of falling back to structured docs', async () => {
    const documentationService = {
        getDocForDeclaration: jest.fn(() => createCallableDoc('create', 'scopedMethod', 'file:///D:/workspace/std/base_room.c#1:0-1:15', [{
            label: 'void create()',
            parameters: [],
            returnType: 'void'
        }]))
    } as any;

    const targetDocument = createDocument('D:/workspace/std/base_room.c', 'void create() {}\n');
    const support = new ScopedMethodCompletionSupport(
        documentationService,
        jest.fn(async () => targetDocument)
    );
    const item = createCompletionItemForScopedMethod();

    const resolved = await support.applyScopedDocumentation(item, item.data!.candidate);

    expect(documentationService.getDocForDeclaration).toHaveBeenCalledWith(
        targetDocument,
        'file:///D:/workspace/std/base_room.c#1:0-1:15'
    );
    expect(resolved.documentation?.value).toContain('void create()');
});

test('unknown or unsupported scoped discovery results produce no scoped candidates and no ordinary fallback docs', () => {
    const support = new ScopedMethodCompletionSupport(
        new FunctionDocumentationService(),
        jest.fn(async () => undefined)
    );

    expect(support.buildCandidates({ status: 'unknown', methods: [] }, 'cr', 'file:///room.c')).toEqual([]);
    expect(support.buildCandidates({ status: 'unsupported', methods: [] }, 'cr', 'file:///room.c')).toEqual([]);
});
```

- [ ] **Step 2: Add a failing service-level resolve test for the new `scoped-method` branch**

Create `src/language/services/completion/__tests__/LanguageCompletionService.test.ts` with one focused regression that exercises the real `resolveCompletionItem(...)` switch:

```ts
test('resolveCompletionItem uses the scoped-method branch instead of structured documentation fallback', async () => {
    const documentationService = {
        getDocForDeclaration: jest.fn(() => createCallableDoc('create', 'scopedMethod', 'file:///D:/workspace/std/base_room.c#1:0-1:15', [{
            label: 'void create()',
            parameters: [],
            returnType: 'void'
        }]))
    } as any;
    const targetDocument = createDocument('D:/workspace/std/base_room.c', 'void create() {}\n');
    const service = new QueryBackedLanguageCompletionService(
        efunDocsManager as any,
        macroManager as any,
        undefined,
        { inferObjectAccess: jest.fn() } as any,
        undefined,
        {
            documentationService,
            scopedMethodDiscoveryService: { discoverAt: jest.fn() },
            scopedDocumentLoader: jest.fn(async () => targetDocument)
        } as any
    );
    const structuredSpy = jest.spyOn(service as any, 'applyStructuredDocumentation');

    const resolved = await service.resolveCompletionItem({
        context: createLanguageContext(createDocument('D:/workspace/room.c', '::cr'), fixtureRoot),
        item: createScopedCompletionItem()
    });

    expect(documentationService.getDocForDeclaration).toHaveBeenCalledWith(
        targetDocument,
        'file:///D:/workspace/std/base_room.c#1:0-1:15'
    );
    expect(structuredSpy).not.toHaveBeenCalled();
    expect(resolved.documentation?.value).toContain('void create()');
});
```

- [ ] **Step 3: Add failing integration tests for real completion calls**

Extend `src/__tests__/providerIntegration.test.ts` with end-to-end completion cases:

```ts
test('completion resolves bare ::create through scoped discovery instead of object inference', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'base_room.c'), 'void create() {}\nvoid reset() {}\n');

    const source = [
        'inherit "/std/base_room";',
        '',
        'void demo() {',
        '    ::cr',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'scoped-completion.c'), source);
    const objectInferenceService = new ObjectInferenceService(macroManager as any);
    const inferObjectAccess = jest.spyOn(objectInferenceService, 'inferObjectAccess');
    const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any, undefined, objectInferenceService as any);

    const result = await service.provideCompletion({
        context: createLanguageContext(document, fixtureRoot),
        position: positionAtSubstringEnd(document, source, '::cr'),
        triggerKind: vscode.CompletionTriggerKind.Invoke
    });

    expect(result.items.map((item) => item.label)).toContain('create');
    expect(inferObjectAccess).not.toHaveBeenCalled();
});

test('completion resolves room::init from the uniquely matched direct inherit branch only', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'void init() {}\nvoid create() {}\n');
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'combat.c'), 'void init_combat() {}\n');

    const source = [
        'inherit "/std/room";',
        'inherit "/std/combat";',
        '',
        'void demo() {',
        '    room::in',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'named-scoped-completion.c'), source);
    const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);

    const result = await service.provideCompletion({
        context: createLanguageContext(document, fixtureRoot),
        position: positionAtSubstringEnd(document, source, 'room::in'),
        triggerKind: vscode.CompletionTriggerKind.Invoke
    });

    expect(result.items.map((item) => item.label)).toEqual(['init']);
});

test('scoped completion stays empty when named qualifier is ambiguous', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'std'), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, 'domains'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'std', 'room.c'), 'void init() {}\n');
    fs.writeFileSync(path.join(fixtureRoot, 'domains', 'room.c'), 'void init() {}\n');

    const source = [
        'inherit "/std/room";',
        'inherit "/domains/room";',
        '',
        'void demo() {',
        '    room::in',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'room', 'ambiguous-scoped-completion.c'), source);
    const service = new QueryBackedLanguageCompletionService(efunDocsManager as any, macroManager as any);

    const result = await service.provideCompletion({
        context: createLanguageContext(document, fixtureRoot),
        position: positionAtSubstringEnd(document, source, 'room::in'),
        triggerKind: vscode.CompletionTriggerKind.Invoke
    });

    expect(result.items).toEqual([]);
});
```

- [ ] **Step 4: Run the red consumer slice**

Run:

```bash
npx jest --runInBand src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/providerIntegration.test.ts -t "scoped completion"
```

Expected:
- FAIL because the scoped completion helper and service wiring do not exist yet.

- [ ] **Step 5: Commit the red consumer tests**

```bash
git add src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "test(completion): add scoped method completion red cases"
```

### Task 4: Implement Scoped Completion Candidate Building, Doc Resolve, and Service Wiring

**Files:**
- Create: `src/language/services/completion/ScopedMethodCompletionSupport.ts`
- Modify: `src/language/services/completion/LanguageCompletionService.ts`

- [ ] **Step 1: Implement `ScopedMethodCompletionSupport.ts` as the scoped-only helper**

Create a focused helper instead of bloating the 728-line completion service further. It should expose two narrow entrypoints:

```ts
export class ScopedMethodCompletionSupport {
    constructor(
        private readonly documentationService: FunctionDocumentationService = new FunctionDocumentationService(),
        private readonly documentLoader: (uri: string) => Promise<vscode.TextDocument | undefined>
    ) {}

    public buildCandidates(
        discovery: ScopedMethodDiscoveryResult,
        prefix: string,
        currentUri: string
    ): CompletionCandidate[] {
        // filter, dedupe, sort, build declarationKey metadata
    }

    public applyScopedDocumentation(
        item: LanguageCompletionItem,
        candidate: CompletionCandidate
    ): Promise<LanguageCompletionItem> {
        // load target document from candidate.metadata.sourceUri,
        // read callable docs by declarationKey,
        // and render markdown/detail/snippet
    }
}
```

Implementation rules:
- compute the declaration key from `documentUri + declarationRange` using the same string format other callable consumers already use
- keep `sourceType` exactly `scoped-method`
- load the target document from `candidate.metadata.sourceUri` via the injected loader before calling `getDocForDeclaration(...)`
- never use `applyStructuredDocumentation(...)` for scoped candidates

- [ ] **Step 2: Wire the scoped path into `QueryBackedLanguageCompletionService`**

Modify `LanguageCompletionService.ts` in three places:

1. Construct helper dependencies near the existing services:

```ts
private readonly scopedMethodDiscoveryService: ScopedMethodDiscoveryService;
private readonly scopedCompletionSupport: ScopedMethodCompletionSupport;
```

If the current positional constructor starts getting unwieldy, switch `QueryBackedLanguageCompletionService` to an optional dependency bag for:

- `scopedMethodDiscoveryService`
- `documentationService`
- `scopedDocumentLoader`

That keeps production defaults simple while making the new service-level tests injectable.

2. Branch inside `resolveCompletionCandidates(...)` before the `member` (`->`) object-inference path:

```ts
if (result.context.kind === 'scoped-member') {
    const discovery = await this.scopedMethodDiscoveryService.discoverAt(document, position);
    return this.scopedCompletionSupport.buildCandidates(
        discovery,
        result.context.currentWord,
        document.uri.toString()
    );
}
```

3. Branch inside `resolveCompletionItem(...)`:

```ts
case 'scoped-method':
    await this.scopedCompletionSupport.applyScopedDocumentation(
        resolvedItem,
        candidate
    );
    break;
```

Leave the existing `member` / `ObjectInferenceService` path untouched.

- [ ] **Step 3: Run the focused green slice**

Run:

```bash
npx jest --runInBand src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/providerIntegration.test.ts -t "scoped completion"
```

Expected:
- PASS

- [ ] **Step 4: Run the broader completion regression suite**

Run:

```bash
npx jest --runInBand src/__tests__/completionContextAnalyzer.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/completionHandler.test.ts
```

Expected:
- PASS
- Existing ordinary completion and handler behavior remains unchanged.

- [ ] **Step 5: Run type-check and full targeted verification**

Run:

```bash
npx tsc --noEmit
npx jest --runInBand src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/completionContextAnalyzer.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/completionHandler.test.ts
```

Expected:
- TypeScript check PASS
- All targeted Jest suites PASS

- [ ] **Step 6: Commit the completion wiring**

```bash
git add src/language/services/completion/ScopedMethodCompletionSupport.ts src/language/services/completion/LanguageCompletionService.ts src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "feat(completion): add scoped method completion"
```

## Final Verification

- [ ] **Step 1: Run the end-to-end completion regression bundle**

Run:

```bash
npx jest --runInBand src/__tests__/completionContextAnalyzer.test.ts src/__tests__/providerIntegration.test.ts src/lsp/server/__tests__/completionHandler.test.ts src/objectInference/__tests__/ScopedMethodDiscoveryService.test.ts src/language/services/completion/__tests__/ScopedMethodCompletionSupport.test.ts src/language/services/completion/__tests__/LanguageCompletionService.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run the repository safety checks used for recent language-service work**

Run:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected:
- `npx tsc --noEmit` PASS
- `npm test -- --runInBand` PASS, or any unrelated pre-existing flakes are called out explicitly with exact failing suites

- [ ] **Step 3: Request code review before merge**

Use `superpowers:requesting-code-review` against the final implementation branch/diff, and do not merge until any Important issues are resolved or explicitly discussed.
