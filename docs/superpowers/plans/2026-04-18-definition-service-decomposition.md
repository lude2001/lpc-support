# Definition Service Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `AstBackedLanguageDefinitionService` into a coordinator plus focused resolver/support units without changing any definition behavior.

**Architecture:** First introduce a shared `DefinitionResolverSupport` that centralizes path/document/location/cache mechanics while keeping the public definition service behavior frozen. Then extract scoped/object/direct/function-family definition paths into dedicated resolvers in the same short-circuit order the current service uses, and finally verify that service-, LSP handler-, and spawned-runtime definition behavior remain unchanged.

**Tech Stack:** TypeScript, Jest, VS Code API-compatible shims, navigation services, `ASTManager`, `ObjectInferenceService`, `TargetMethodLookup`

---

## File Map

### Create

- `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
  - shared support layer for path resolution, file opening, semantic snapshot access, include/header caches, and location normalization
- `src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts`
  - scoped definition resolver for `::method()` and `room::method()`
- `src/language/services/navigation/definition/ObjectMethodDefinitionResolver.ts`
  - object-method definition resolver for `receiver->method()`
- `src/language/services/navigation/definition/DirectSymbolDefinitionResolver.ts`
  - direct-symbol resolver for include path, macro, simul_efun doc, and variable definition short-circuits
- `src/language/services/navigation/definition/FunctionFamilyDefinitionResolver.ts`
  - function-family resolver for current-file/include/inherit/simul_efun graph traversal
- `src/language/services/navigation/definition/types.ts`
  - shared internal types such as request state and dependency bags
- `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts`
  - minimal resolver-level protection for scoped definition behavior
- `src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts`
  - minimal resolver-level protection for object-method definition behavior
- `src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts`
  - minimal resolver-level protection for direct-symbol short-circuit behavior
- `src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts`
  - minimal resolver-level protection for function-family traversal behavior
- `docs/superpowers/plans/2026-04-18-definition-service-decomposition.md`
  - this implementation plan

### Modify

- `src/language/services/navigation/LanguageDefinitionService.ts`
  - shrink into coordinator wiring and keep the public API stable
- `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`
  - preserve service-level regressions and add short-circuit-order coverage
- `src/language/services/navigation/__tests__/navigationServices.test.ts`
  - keep host-agnostic definition service behavior locked
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
  - keep LSP definition handler behavior unchanged after service decomposition
- `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
  - preserve runtime definition behavior after decomposition if any definition assertions need refresh

### Keep Unchanged

- `src/ast/astManager.ts`
- `src/completion/documentSemanticSnapshotService.ts`
- `src/language/services/navigation/LanguageHoverService.ts`
- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- `src/objectInference/**`
- `src/lsp/server/handlers/navigation/registerDefinitionHandler.ts`

---

## Chunk 1: Shared Support Extraction

### Task 1: Create an isolated worktree and capture the current definition baseline

**Files:**
- Modify: none

- [ ] **Step 1: Create a dedicated worktree**

Run:

```bash
git worktree add .worktrees/definition-service-decomposition -b codex/definition-service-decomposition
```

Expected:
- worktree created at `D:\code\lpc-support\.worktrees\definition-service-decomposition`
- branch `codex/definition-service-decomposition` checked out there

- [ ] **Step 2: Confirm the worktree is clean**

Run:

```bash
git -C D:\code\lpc-support\.worktrees\definition-service-decomposition status --short
```

Expected:
- no output

- [ ] **Step 3: Capture the current definition regression baseline**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- PASS
- this is the frozen behavior baseline for the rest of the plan

- [ ] **Step 4: Do not commit baseline-only work**

Expected:
- no commit yet

### Task 2: Add failing support-layer tests and introduce `DefinitionResolverSupport`

**Files:**
- Create: `src/language/services/navigation/definition/types.ts`
- Create: `src/language/services/navigation/definition/DefinitionResolverSupport.ts`
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Test: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

- [ ] **Step 1: Write the first failing support-driven regression tests**

Add focused tests to `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts` that lock behaviors the shared support must preserve, for example:

```ts
test('reuses include/header caches across repeated include-backed definition lookups', async () => {
    // first call warms include/header cache
    // second call should still return same location with no behavior drift
});

test('resolves simulated efun source locations from docs before graph traversal', async () => {
    // existing direct-doc short-circuit stays intact after support extraction
});
```

Rules:
- prefer extending existing service tests over inventing a new broad integration file
- focus on cache/path/location mechanics that support extraction could accidentally break

- [ ] **Step 2: Run the focused definition tests to verify at least one new assertion fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
```

Expected:
- FAIL because the new support boundary is not implemented yet, or because new assertions reveal current support-coupling assumptions

- [ ] **Step 3: Create `definition/types.ts`**

Create `src/language/services/navigation/definition/types.ts` with shared internal types such as:

```ts
export interface DefinitionRequestState {
    processedFiles: Set<string>;
    functionDefinitions: Map<string, vscode.Location>;
}

export interface DefinitionResolverContext {
    macroManager: MacroManager;
    efunDocsManager: EfunDocsManager;
    astManager: ASTManager;
    objectInferenceService: ObjectInferenceService;
    targetMethodLookup: TargetMethodLookup;
    projectConfigService?: LpcProjectConfigService;
    host: LanguageDefinitionHost;
    semanticAdapter?: DefinitionSemanticAdapter;
}
```

Rules:
- move only internal definition-service types here
- do not export them outside the definition-service area unless currently required

- [ ] **Step 4: Create `DefinitionResolverSupport.ts`**

Create `src/language/services/navigation/definition/DefinitionResolverSupport.ts` and move in the shared mechanical helpers:

```ts
export class DefinitionResolverSupport {
    public createRequestState(): DefinitionRequestState { ... }
    public toLanguageLocations(...): LanguageLocation[] { ... }
    public toVsCodeLocation(...): vscode.Location { ... }
    public toVsCodeRange(...): vscode.Range { ... }
    public toSymbolLocation(...): vscode.Location { ... }
    public getSemanticSnapshot(...): SemanticSnapshot { ... }
    public getIncludeStatements(...): IncludeStatementLike[] { ... }
    public resolveIncludeFilePath(...): Promise<string | undefined> { ... }
    public openInheritedDocument(...): Promise<vscode.TextDocument | undefined> { ... }
    public openWorkspaceDocument(...): Promise<vscode.TextDocument | undefined> { ... }
    public tryOpenTextDocument(...): Promise<vscode.TextDocument | undefined> { ... }
    public getWorkspaceRoot(...): string { ... }
    public getPrimaryIncludeDirectory(...): Promise<string | undefined> { ... }
    public getConfiguredSimulatedEfunFile(...): Promise<string | undefined> { ... }
    public resolveExistingIncludeFiles(...): Promise<string[]> { ... }
    public findInherits(...): Set<string> { ... }
}
```

Include:
- include/header caches
- host change-listener invalidation wiring
- path helpers currently embedded in `LanguageDefinitionService`

Do **not** include:
- any resolver-specific branching
- any `provideDefinition(...)` short-circuit order

- [ ] **Step 5: Rewire `LanguageDefinitionService.ts` to use `DefinitionResolverSupport` only for moved helpers**

Modify `src/language/services/navigation/LanguageDefinitionService.ts` so that:
- constructor creates one support instance
- existing private helpers that were moved now delegate to support
- resolver behavior is otherwise unchanged in this chunk

Rules:
- keep `provideDefinition(...)` structure intact for now
- do not create resolver classes yet
- this chunk is only about separating shared mechanics from decision logic

- [ ] **Step 6: Run the focused tests again**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the support extraction**

Run:

```bash
git add src/language/services/navigation/definition/types.ts src/language/services/navigation/definition/DefinitionResolverSupport.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(definition): extract shared resolver support"
```

---

## Chunk 2: Scoped and Object-Method Definition Resolvers

### Task 3: Extract scoped definition resolution behind a dedicated resolver

**Files:**
- Create: `src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts`
- Test: `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts`
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

- [ ] **Step 1: Write failing resolver-level tests for scoped definition behavior**

Create `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts` with cases like:

```ts
test('returns locations for bare scoped method identifiers only', async () => {
    // ::create() on method identifier => returns resolved location(s)
});

test('returns undefined on qualifier and argument positions', async () => {
    // room::init(arg) on room or arg => undefined
});

test('returns undefined for ambiguous or unsupported scoped resolutions', async () => {
    // ambiguous room::init() => undefined
});
```

- [ ] **Step 2: Run the new scoped resolver test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts
```

Expected:
- FAIL because the resolver file does not exist yet

- [ ] **Step 3: Implement `ScopedMethodDefinitionResolver.ts`**

Create `src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts` with:

```ts
export class ScopedMethodDefinitionResolver {
    public async resolve(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location[] | undefined> { ... }
}
```

Move in:
- `isOnScopedMethodIdentifier(...)`
- `findScopedMethodIdentifierAtPosition(...)`
- `getScopedMethodIdentifier(...)`
- `getRangeSize(...)`

Rules:
- consume existing `ScopedMethodResolver`
- return `undefined` on non-identifier positions and unresolved/ambiguous states exactly as the spec defines

- [ ] **Step 4: Wire `LanguageDefinitionService.ts` to call the scoped resolver first**

Modify `LanguageDefinitionService.ts` so that:
- `provideDefinition(...)` asks the scoped resolver first
- on hit, returns immediately
- no other source logic changes in this step

- [ ] **Step 5: Run scoped + service regression tests**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
```

Expected:
- PASS

### Task 4: Extract object-method definition resolution behind a dedicated resolver

**Files:**
- Create: `src/language/services/navigation/definition/ObjectMethodDefinitionResolver.ts`
- Test: `src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts`
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

- [ ] **Step 1: Write failing resolver-level tests for object-method definition behavior**

Create `src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts` with cases like:

```ts
test('returns deduped locations for valid receiver candidates', async () => {
    // multiple candidates resolving to same method => one location
});

test('returns undefined for unknown or unsupported object inference', async () => {
    // inference unknown/unsupported => undefined
});
```

- [ ] **Step 2: Run the new object-method resolver test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts
```

Expected:
- FAIL because the resolver file does not exist yet

- [ ] **Step 3: Implement `ObjectMethodDefinitionResolver.ts`**

Create `src/language/services/navigation/definition/ObjectMethodDefinitionResolver.ts` and move in:

- `handleInferredObjectMethodCall(...)`
- `findMethodInTargetChain(...)`

Rules:
- keep current multi-candidate dedupe behavior
- keep current `unknown / unsupported => undefined` behavior
- depend on `DefinitionResolverSupport` only for location normalization utilities, not for branching

- [ ] **Step 4: Wire `LanguageDefinitionService.ts` to call the object-method resolver second**

Modify `LanguageDefinitionService.ts` so that:
- after scoped resolver
- object-method resolver runs
- on hit, returns immediately

- [ ] **Step 5: Add service-level short-circuit regression**

Extend `LanguageDefinitionService.test.ts` with a case asserting:

```ts
test('object-method hits do not fall through to direct symbol or function-family lookup', async () => {
    // spy on later paths; assert they are not called
});
```

- [ ] **Step 6: Run object-method + service regression tests**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the scoped/object resolver extraction**

Run:

```bash
git add src/language/services/navigation/definition/ScopedMethodDefinitionResolver.ts src/language/services/navigation/definition/ObjectMethodDefinitionResolver.ts src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
git commit -m "refactor(definition): extract scoped and object resolvers"
```

---

## Chunk 3: Direct Symbol Resolver

### Task 5: Extract direct-symbol definition short-circuits

**Files:**
- Create: `src/language/services/navigation/definition/DirectSymbolDefinitionResolver.ts`
- Test: `src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts`
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

- [ ] **Step 1: Write failing resolver-level tests for direct-symbol resolution**

Create `src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts` with cases like:

```ts
test('returns include-path definition when cursor is on an include statement', async () => { ... });
test('returns macro definition before falling back to function-family lookup', async () => { ... });
test('returns visible variable definition before inherited fallback', async () => { ... });
test('returns simul_efun source-doc location before graph traversal when docs already provide it', async () => { ... });
```

- [ ] **Step 2: Run the new direct-symbol resolver test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts
```

Expected:
- FAIL because the resolver file does not exist yet

- [ ] **Step 3: Implement `DirectSymbolDefinitionResolver.ts`**

Create the resolver and move in:

- `resolveDirectDefinition(...)`
- `findMacroDefinition(...)`
- `findSimulatedEfunDefinition(...)`
- `toSimulatedDocLocation(...)`
- `handleIncludeDefinition(...)`
- `resolveIncludePath(...)`
- `findVariableDefinition(...)`
- `findInheritedVariableDefinition(...)`
- `isVariableLikeSymbol(...)`

Rules:
- preserve current direct-short-circuit order:
  - include path
  - macro
  - simulated efun
  - variable
- do not add any new fallback behavior

- [ ] **Step 4: Wire `LanguageDefinitionService.ts` to call the direct-symbol resolver third**

Modify `LanguageDefinitionService.ts` so that:
- after scoped + object-method resolvers
- direct-symbol resolver runs
- on hit, returns immediately

- [ ] **Step 5: Add service-level short-circuit regression**

Extend `LanguageDefinitionService.test.ts` with a case asserting:

```ts
test('direct-symbol hits do not fall through to function-family lookup', async () => {
    // spy on function-family resolver; assert no call when macro/include/variable resolves
});
```

- [ ] **Step 6: Run direct-symbol + service tests**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the direct-symbol extraction**

Run:

```bash
git add src/language/services/navigation/definition/DirectSymbolDefinitionResolver.ts src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts
git commit -m "refactor(definition): extract direct symbol resolver"
```

---

## Chunk 4: Function-Family Resolver and Final Service Slimming

### Task 6: Extract function-family traversal into its own resolver

**Files:**
- Create: `src/language/services/navigation/definition/FunctionFamilyDefinitionResolver.ts`
- Test: `src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts`
- Modify: `src/language/services/navigation/LanguageDefinitionService.ts`
- Modify: `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`

- [ ] **Step 1: Write failing resolver-level tests for function-family traversal**

Create `src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts` with cases like:

```ts
test('returns current-file exported function definitions first', async () => { ... });
test('falls back to inherited definitions when current file misses', async () => { ... });
test('uses include implementation before header prototype when both exist', async () => { ... });
test('walks simulated efun graph when docs do not provide source range', async () => { ... });
```

- [ ] **Step 2: Run the new function-family resolver test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts
```

Expected:
- FAIL because the resolver file does not exist yet

- [ ] **Step 3: Implement `FunctionFamilyDefinitionResolver.ts`**

Move in:

- `findFunctionDefinition(...)`
- `findFunctionDefinitions(...)`
- `findInheritedFunctionDefinitions(...)`
- `findFunctionInCurrentFileIncludes(...)`
- `findInSimulatedEfuns(...)`
- `findFunctionInSimulatedEfunGraph(...)`
- `findFunctionInFileByAST(...)`
- `findFunctionInSemanticSnapshot(...)`
- `findMethodInFile(...)`
- `getIncludeFiles(...)`
- `getHeaderFunctionIndex(...)`

Rules:
- keep current current-file/include/inherit/simul_efun traversal semantics
- keep implementation-over-header preference
- keep graph traversal bounded by current visited-file behavior

- [ ] **Step 4: Slim `LanguageDefinitionService.ts` into a coordinator**

Modify `LanguageDefinitionService.ts` so that:
- constructor creates:
  - `DefinitionResolverSupport`
  - `ScopedMethodDefinitionResolver`
  - `ObjectMethodDefinitionResolver`
  - `DirectSymbolDefinitionResolver`
  - `FunctionFamilyDefinitionResolver`
- `provideDefinition(...)` contains only:
  - request normalization
  - resolver short-circuit order
  - final `LanguageLocation[]` conversion

- [ ] **Step 5: Run service-level definition regressions**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit the function-family extraction and coordinator slimming**

Run:

```bash
git add src/language/services/navigation/definition/FunctionFamilyDefinitionResolver.ts src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
git commit -m "refactor(definition): decompose function-family resolver"
```

---

## Chunk 5: Final Integration Verification

### Task 7: Re-run LSP handler and spawned-runtime definition protections

**Files:**
- Modify: `src/lsp/server/__tests__/navigationHandlers.test.ts` (only if assertions need refresh)
- Modify: `src/lsp/__tests__/spawnedRuntime.integration.test.ts` (only if assertions need refresh)

- [ ] **Step 1: Run targeted LSP definition regressions**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- PASS

- [ ] **Step 2: If any definition assertion broke only because of wiring shape, adjust tests without changing product semantics**

Rules:
- do not weaken assertions unless strictly necessary
- do not refresh snapshots or ranges unless the new value is demonstrably behavior-equivalent

- [ ] **Step 3: Re-run targeted LSP definition regressions**

Run:

```bash
npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- PASS

### Task 8: Final verification and cleanup check

**Files:**
- Modify: none unless verification reveals a defect

- [ ] **Step 1: Run TypeScript verification**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 2: Run the full definition-focused verification set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/ObjectMethodDefinitionResolver.test.ts src/language/services/navigation/__tests__/DirectSymbolDefinitionResolver.test.ts src/language/services/navigation/__tests__/FunctionFamilyDefinitionResolver.test.ts src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Run the full project suite**

Run:

```bash
npm test -- --runInBand
```

Expected:
- PASS

- [ ] **Step 4: Commit any final verification-only test adjustments**

Run:

```bash
git add src/language/services/navigation src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts
git commit -m "test(definition): lock decomposed definition service regressions"
```

Only do this step if verification required final test-only edits after Task 7 or Task 8.

---

## Notes For Execution

- Keep the public `AstBackedLanguageDefinitionService` export and constructor contract stable unless tests prove an internal-only dependency bag change is needed.
- Do not let resolver classes call each other directly; the coordinator controls order.
- Do not move hover or signature-help code into this plan.
- If `DefinitionResolverSupport` starts accumulating resolver branching, stop and split that logic back into the relevant resolver before proceeding.
- Preserve the current short-circuit order exactly:
  - scoped
  - object-method
  - direct-symbol
  - function-family
- If a refactor introduces behavior drift in `LanguageDefinitionService.test.ts`, treat it as a blocker rather than updating expectations casually.
