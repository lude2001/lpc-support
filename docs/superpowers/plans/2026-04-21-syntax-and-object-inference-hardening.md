# Syntax and Object Inference Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden valid LPC syntax handling, split static expression evaluation into focused modules, and make object inference increasingly consume semantic evaluation instead of duplicating local tracing.

**Architecture:** Keep the current parser / syntax / semantic / object-inference layering. `SyntaxBuilder` owns syntax node shape, `ExpressionEvaluator` remains the stable facade over smaller evaluators, and `ObjectInferenceService` gradually treats `SemanticEvaluationService` as the first source of receiver values while preserving legacy fallback behavior.

**Tech Stack:** TypeScript, ANTLR4TS-generated parser, Jest, VS Code extension services, LPC syntax/semantic model.

---

## Context

The design source is `docs/superpowers/specs/2026-04-21-syntax-and-object-inference-hardening-design.md`.

Important constraints:

- Do not add new production `new LPCLexer(...)` or `new LPCParser(...)` call sites.
- Do not let providers or object inference rescan full text for structure inference.
- Keep parser / syntax / semantic boundaries explicit; do not introduce a new generic "AST" layer.
- Keep `@lpc-return-objects` as a fallback path, not as the first answer when natural semantic evaluation succeeds.
- Treat `SyntaxKind.Missing` as malformed or unsupported syntax only; valid LPC constructs should not leak as `Missing`.

## File Map

Syntax contract:

- Modify: `src/syntax/syntaxNode.ts`
- Modify: `src/syntax/builders/statementBuilders.ts`
- Test: `src/__tests__/syntaxBuilder.test.ts`

Evaluator decomposition:

- Create: `src/semanticEvaluation/static/LpcLiteralEvaluator.ts`
- Create: `src/semanticEvaluation/static/LpcConstantEvaluator.ts`
- Create: `src/semanticEvaluation/static/LpcContainerShapeEvaluator.ts`
- Create: `src/semanticEvaluation/static/LpcObjectSourceEvaluator.ts`
- Create: `src/semanticEvaluation/static/LpcConditionEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Modify: `src/semanticEvaluation/static/StatementTransfer.ts`
- Test: `src/semanticEvaluation/__tests__/lpcLiteralEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/lpcContainerShapeEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/lpcObjectSourceEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts`
- Update as needed: `src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts`

Controlled semantic expansion:

- Modify: `src/semanticEvaluation/static/LpcConstantEvaluator.ts`
- Modify: `src/semanticEvaluation/static/LpcConditionEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts`

Object inference consolidation:

- Modify: `src/semanticEvaluation/SemanticEvaluationService.ts`
- Modify: `src/objectInference/ObjectInferenceService.ts`
- Modify only if needed: `src/objectInference/ReceiverTraceService.ts`
- Modify only after parity is proven: `src/objectInference/ReceiverExpressionResolver.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Update docs if architecture changes: `docs/object-inference-design.md`

## Chunk 1: Syntax Contract Hardening

### Task 1: Add explicit empty statement syntax support

**Files:**

- Modify: `src/syntax/syntaxNode.ts`
- Modify: `src/syntax/builders/statementBuilders.ts`
- Test: `src/__tests__/syntaxBuilder.test.ts`

- [ ] **Step 1: Write the failing syntax tests**

Add tests near `does not expose macro-style call semicolons as missing statements`.

```ts
test('represents bare empty statements without missing nodes', () => {
    const source = [
        'void demo() {',
        '    ;',
        '    return;',
        '}'
    ].join('\n');
    const document = createDocument(source, '/virtual/empty-statement.c');
    const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();

    expect(syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.Missing)).toHaveLength(0);
    expect(syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.EmptyStatement)).toHaveLength(1);
});

test('represents empty if bodies without missing nodes', () => {
    const source = [
        'void demo(int flag) {',
        '    if (flag);',
        '    return;',
        '}'
    ].join('\n');
    const document = createDocument(source, '/virtual/empty-if-body.c');
    const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();

    expect(syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.Missing)).toHaveLength(0);
    expect(syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.EmptyStatement)).toHaveLength(1);
});
```

- [ ] **Step 2: Run the failing syntax tests**

Run:

```powershell
npx jest --runInBand src/__tests__/syntaxBuilder.test.ts
```

Expected: failure because `SyntaxKind.EmptyStatement` is not defined or the builder still produces `Missing`.

- [ ] **Step 3: Add `SyntaxKind.EmptyStatement`**

In `src/syntax/syntaxNode.ts`, add:

```ts
EmptyStatement = 'EmptyStatement',
```

Then add it to the statement category in `inferSyntaxNodeCategory`.

- [ ] **Step 4: Build empty statement nodes in `buildStatement`**

In `src/syntax/builders/statementBuilders.ts`, before the final `createMissingNode(ctx)`, detect statement contexts that consist only of a semicolon and return:

```ts
return b.createNode(SyntaxKind.EmptyStatement, ctx, [], {
    metadata: { source: 'empty-statement' }
});
```

Use the generated parser API if available (`ctx.SEMI?.()`), otherwise inspect `b.getChildren(ctx)` for the semicolon terminal. Keep the detection narrow so malformed statements still produce `Missing`.

- [ ] **Step 5: Run syntax tests until green**

Run:

```powershell
npx jest --runInBand src/__tests__/syntaxBuilder.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run formatter smoke tests**

Run:

```powershell
npx jest --runInBand src/__tests__/formatPrinter.test.ts src/__tests__/formatterIntegration.test.ts src/__tests__/rangeFormatting.test.ts
```

Expected: PASS. If formatter output changes because empty statements are now explicit, update tests only when the new output is correct LPC formatting.

- [ ] **Step 7: Commit syntax hardening**

```powershell
git add src/syntax/syntaxNode.ts src/syntax/builders/statementBuilders.ts src/__tests__/syntaxBuilder.test.ts
git commit -m "fix(syntax): represent valid empty statements explicitly"
```

## Chunk 2: Behavior-Preserving Evaluator Decomposition

### Task 2: Extract literal evaluation

**Files:**

- Create: `src/semanticEvaluation/static/LpcLiteralEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcLiteralEvaluator.test.ts`

- [ ] **Step 1: Add focused literal tests**

Create tests for string, char, boolean, int, float, and unsupported literal text. Build lightweight fake `SyntaxNode` literals instead of parsing full documents.

```ts
expect(evaluateLpcLiteralNode(literalNode('"login"'))).toEqual(literalValue('login'));
expect(evaluateLpcLiteralNode(literalNode('42'))).toEqual(literalValue(42, 'int'));
expect(evaluateLpcLiteralNode(literalNode('42.5'))).toEqual(literalValue(42.5, 'float'));
expect(evaluateLpcLiteralNode(literalNode('true'))).toEqual(literalValue(true, 'boolean'));
expect(evaluateLpcLiteralNode(literalNode('UNKNOWN_TOKEN'))).toEqual(unknownValue());
```

- [ ] **Step 2: Run literal tests and confirm failure**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcLiteralEvaluator.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Move literal parsing into `LpcLiteralEvaluator`**

Create:

```ts
export function evaluateLpcLiteralNode(node: SyntaxNode): SemanticValue;
export function getMetadataText(node: SyntaxNode): string | undefined;
```

Move current literal parsing logic from `ExpressionEvaluator` unchanged.

- [ ] **Step 4: Delegate literal nodes from `ExpressionEvaluator`**

Replace the current `parseLiteralNode(node)` call with `evaluateLpcLiteralNode(node)`.

- [ ] **Step 5: Run literal and core semantic tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcLiteralEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: PASS.

### Task 3: Extract condition truthiness

**Files:**

- Create: `src/semanticEvaluation/static/LpcConditionEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Modify: `src/semanticEvaluation/static/StatementTransfer.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts`

- [ ] **Step 1: Add truthiness tests**

Cover object truthiness, literal boolean, zero, non-zero, empty string, non-empty string, null, unknown, and union.

```ts
expect(evaluateLpcTruthiness(objectValue('/std/object'))).toBe(true);
expect(evaluateLpcTruthiness(literalValue(0))).toBe(false);
expect(evaluateLpcTruthiness(unknownValue())).toBeUndefined();
```

- [ ] **Step 2: Run condition tests and confirm failure**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Move duplicate truthiness logic**

Create:

```ts
export type LpcTruthiness = true | false | undefined;
export function evaluateLpcTruthiness(value: SemanticValue): LpcTruthiness;
```

Move the duplicated `isDefinitelyTruthy` logic out of both `ExpressionEvaluator` and `StatementTransfer`.

- [ ] **Step 4: Delegate conditional and if transfer truthiness**

Use `evaluateLpcTruthiness` in:

- `ExpressionEvaluator.evaluateConditionalExpression`
- `ExpressionEvaluator.evaluateUnaryExpression` for `!`
- `StatementTransfer.transferIfStatement`

- [ ] **Step 5: Run semantic tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: PASS.

### Task 4: Extract container shape evaluation

**Files:**

- Create: `src/semanticEvaluation/static/LpcContainerShapeEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcContainerShapeEvaluator.test.ts`

- [ ] **Step 1: Add container helper tests**

Cover:

- Mapping literal shape construction.
- Fixed string key lookup.
- Union or candidate-set string key lookup.
- Missing mapping key remains `unknown`.
- Array literal shape construction.
- Fixed numeric index lookup.
- Spread array element remains `unknown`.

- [ ] **Step 2: Run container tests and confirm failure**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcContainerShapeEvaluator.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Extract static key and index utilities**

Create:

```ts
export function literalValueToStaticKey(value: SemanticValue): string | undefined;
export function literalValueToArrayIndex(value: SemanticValue): number | undefined;
export function collectStaticStringSet(value: SemanticValue): string[] | undefined;
```

Move current implementations unchanged, because `LpcObjectSourceEvaluator` will reuse `collectStaticStringSet`.

- [ ] **Step 4: Extract mapping and array operations**

Create a class or functions that accept an expression callback:

```ts
export interface LpcContainerShapeEvaluatorDependencies {
    evaluateExpression(node: SyntaxNode | undefined, state: StaticEvaluationState): SemanticValue;
}
```

Keep recursion through the facade callback so `ExpressionEvaluator` remains the public coordinator.

- [ ] **Step 5: Delegate container cases from `ExpressionEvaluator`**

Delegate:

- `SyntaxKind.MappingLiteralExpression`
- `SyntaxKind.ArrayLiteralExpression`
- `SyntaxKind.IndexExpression`

- [ ] **Step 6: Run tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcContainerShapeEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: PASS.

### Task 5: Extract object source evaluation

**Files:**

- Create: `src/semanticEvaluation/static/LpcObjectSourceEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcObjectSourceEvaluator.test.ts`

- [ ] **Step 1: Add object source tests**

Cover:

- Literal string to `objectValue`.
- Union of literal strings to union of object values.
- Candidate-set/configured-candidate-set of literal strings to object candidates.
- Unknown path remains `unknown`.

- [ ] **Step 2: Run object source tests and confirm failure**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcObjectSourceEvaluator.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Move object source conversion**

Create:

```ts
export function evaluateLpcObjectSourceValue(targetValue: SemanticValue): SemanticValue;
export function isLpcObjectSourceCallName(name: string | undefined): name is 'load_object' | 'find_object';
```

Use `collectStaticStringSet` from `LpcContainerShapeEvaluator`.

- [ ] **Step 4: Delegate `new`, `load_object`, and `find_object`**

In `ExpressionEvaluator`, delegate:

- `SyntaxKind.NewExpression`
- Identifier call names `load_object` and `find_object`

Do not add `clone_object` yet unless an existing test already expects it; this chunk is behavior-preserving.

- [ ] **Step 5: Run semantic tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcObjectSourceEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts
```

Expected: PASS.

### Task 6: Extract pure constant expression folding

**Files:**

- Create: `src/semanticEvaluation/static/LpcConstantEvaluator.ts`
- Modify: `src/semanticEvaluation/static/ExpressionEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts`

- [ ] **Step 1: Add behavior-preserving constant tests**

Cover only existing behavior in this chunk:

- Parenthesized expression delegates to child.
- Literal equality.
- Literal inequality.
- Unknown mixed operands stay `unknown`.

- [ ] **Step 2: Run constant tests and confirm failure**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Extract equality and parenthesis folding**

Create a helper that accepts a callback for recursive evaluation:

```ts
export interface LpcConstantEvaluatorDependencies {
    evaluateExpression(node: SyntaxNode | undefined, state: StaticEvaluationState): SemanticValue;
}
```

Support only current behavior first. Return `undefined` from helper when it does not own the node, so the facade can continue to fall through cleanly.

- [ ] **Step 4: Delegate parenthesized and binary equality cases**

In `ExpressionEvaluator`, delegate parenthesized expressions and current `==`, `===`, `!=`, `!==` literal comparisons to `LpcConstantEvaluator`.

- [ ] **Step 5: Run decomposition regression set**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcLiteralEvaluator.test.ts src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts src/semanticEvaluation/__tests__/lpcContainerShapeEvaluator.test.ts src/semanticEvaluation/__tests__/lpcObjectSourceEvaluator.test.ts src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts
```

Expected: PASS.

- [ ] **Step 6: Typecheck and commit evaluator decomposition**

Run:

```powershell
npx tsc --noEmit
```

Expected: no TypeScript errors.

Commit:

```powershell
git add src/semanticEvaluation/static src/semanticEvaluation/__tests__
git commit -m "refactor(semantic): split static expression evaluators"
```

## Chunk 3: Controlled Semantic Expansion

### Task 7: Fold static string concatenation

**Files:**

- Modify: `src/semanticEvaluation/static/LpcConstantEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts`

- [ ] **Step 1: Add failing string concatenation tests**

Add focused helper tests:

```ts
expect(evaluateReturnedExpression('mixed demo() { return "/adm/" + "model"; }'))
    .toEqual(literalValue('/adm/model'));
```

Add object source integration:

```ts
expect(evaluateReturnedExpression('mixed demo() { return load_object("/adm/" + "model/login"); }'))
    .toEqual(objectValue('/adm/model/login'));
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: FAIL because `+` does not fold strings yet.

- [ ] **Step 3: Implement conservative `+` folding**

Only fold when both operands are literals.

Rules:

- string + string => string
- string + int/float/boolean/null => string using `String(value)`
- int/float + int/float => numeric sum, preserving `int` only when both inputs are integer and result is integer
- Any unknown or non-literal operand => `unknown`

- [ ] **Step 4: Run tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: PASS.

### Task 8: Fold logical `&&` and `||` without false precision

**Files:**

- Modify: `src/semanticEvaluation/static/LpcConditionEvaluator.ts`
- Modify: `src/semanticEvaluation/static/LpcConstantEvaluator.ts`
- Test: `src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts`
- Test: `src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts`

- [ ] **Step 1: Add failing logical tests**

Cover:

- `1 && "ok"` returns `"ok"` or truthy literal result, depending on existing expression-value convention chosen in implementation.
- `0 && unknown` returns false/zero without evaluating unknown precision.
- `1 || unknown` returns true/one without requiring unknown.
- `unknown && 1` remains `unknown`.
- `unknown || 1` remains `unknown`.

For `StatementTransfer`, add:

```ts
if (objectp(model) && stringp(name)) {
    result = model;
}
```

where both predicates are known and the branch should be selected.

- [ ] **Step 2: Choose value convention before implementation**

Use C/LPC expression semantics if already represented by syntax: `&&` and `||` should produce boolean-like literal `true`/`false` for branch folding. Do not introduce operand-returning JavaScript semantics unless tests prove LPC expects it.

- [ ] **Step 3: Implement tri-state logical folding**

Rules:

- `&&`: false left => `false`; true left and known right => right truthiness as boolean; unknown required side => `unknown`.
- `||`: true left => `true`; false left and known right => right truthiness as boolean; unknown required side => `unknown`.
- Never fold to true or false from a partially unknown required operand.

- [ ] **Step 4: Run semantic tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/lpcConditionEvaluator.test.ts src/semanticEvaluation/__tests__/lpcConstantEvaluator.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: PASS.

### Task 9: Commit controlled semantic expansion

**Files:**

- Modify: `src/semanticEvaluation/static/LpcConstantEvaluator.ts`
- Modify: `src/semanticEvaluation/static/LpcConditionEvaluator.ts`
- Test: semantic evaluator tests changed above

- [ ] **Step 1: Run broader semantic regression**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts src/semanticEvaluation/__tests__/SemanticEvaluationService.test.ts src/__tests__/providerIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Typecheck**

Run:

```powershell
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```powershell
git add src/semanticEvaluation src/__tests__/providerIntegration.test.ts
git commit -m "feat(semantic): fold safe LPC constant conditions"
```

## Chunk 4: Object Inference Consolidation

### Task 10: Add a semantic receiver value entrypoint

**Files:**

- Modify: `src/semanticEvaluation/SemanticEvaluationService.ts`
- Test: `src/semanticEvaluation/__tests__/SemanticEvaluationService.test.ts`

- [ ] **Step 1: Add failing service tests**

Add tests for evaluating an arbitrary expression at a point inside a containing function:

```ts
object model = load_object("/adm/model/navigation_popup");
model->create_action("上一页", cmd);
```

The service should evaluate the receiver identifier `model` at the member access position to `objectValue('/adm/model/navigation_popup')`.

- [ ] **Step 2: Define the entrypoint**

Add:

```ts
public async evaluateExpressionAtPosition(
    document: vscode.TextDocument,
    expression: SyntaxNode
): Promise<SemanticEvaluationOutcome>
```

This should:

- Resolve the containing function.
- Build state before `expression.range.start`.
- Evaluate the expression with `ExpressionEvaluator`.
- Return `source: 'natural'` for non-unknown values, otherwise `source: 'unknown'`.

- [ ] **Step 3: Keep call expression behavior unchanged**

Have `evaluateCallExpression` continue its current natural-then-environment behavior. Do not route environment calls through the new arbitrary-expression method unless a test requires it.

- [ ] **Step 4: Run service tests**

Run:

```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/SemanticEvaluationService.test.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected: PASS.

### Task 11: Let object inference try semantic receiver values first

**Files:**

- Modify: `src/objectInference/ObjectInferenceService.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Inject semantic evaluation into `ObjectInferenceService`**

Extend `ObjectInferenceServiceDependencies` with:

```ts
semanticEvaluationService: Pick<SemanticEvaluationService, 'evaluateExpressionAtPosition'>;
```

Store it as a private dependency. Update `createDefaultObjectInferenceService` to pass the existing `semanticEvaluationService`.

- [ ] **Step 2: Add semantic-first receiver tests**

Add tests where receiver identifiers are known by local semantic state:

```c
void demo() {
    object model = load_object("/std/classify_pop");
    model->add_data_button("x", "y");
}
```

Assert that inference resolves `/std/classify_pop` without needing documented fallback.

- [ ] **Step 3: Convert semantic values to object candidates**

Add a small private helper in `ObjectInferenceService`:

```ts
private semanticValueToOutcome(value: SemanticValue): ObjectResolutionOutcome | undefined
```

Rules:

- `object` => one candidate with source `semantic`
- `union` => flatten object entries; if any required entry is unknown/non-static, return `undefined`
- `candidate-set` / `configured-candidate-set` => convert contained object values if exact
- `non-static` => `{ candidates: [], reason: 'non-static' }`
- `unknown` => `undefined`

If `ObjectCandidate['source']` does not yet include `semantic`, either add it with tests or use the closest existing source only if no UI-visible source labels depend on it.

- [ ] **Step 4: Try semantic evaluation before legacy tracing**

In `resolveCandidates`, before receiver-kind-specific legacy paths, call:

```ts
const semanticOutcome = await this.semanticEvaluationService.evaluateExpressionAtPosition(document, receiverNode);
```

Use the converted outcome only when it has candidates, reason `non-static`, or diagnostics. If it is unknown, continue exactly as before.

- [ ] **Step 5: Run object inference tests**

Run:

```powershell
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts
```

Expected: PASS.

### Task 12: Preserve `model_get(...)->method()` specificity

**Files:**

- Modify if needed: `src/objectInference/ObjectInferenceService.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Add/confirm regression for `PROTOCOL_D->model_get("navigation_popup")->create_action(...)`**

The regression should assert that `create_action` resolves only to `navigation_popup_model.c`, not to the full `@lpc-return-objects` candidate set.

- [ ] **Step 2: Run provider integration**

Run:

```powershell
npx jest --runInBand src/__tests__/providerIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Probe real workspace if available**

If `D:\code\shuiyuzhengfeng_lpc` exists, run the existing LSP/provider probe script or add a temporary local probe that checks:

```text
D:\code\shuiyuzhengfeng_lpc\cmds\usr\new_banghui.c
PROTOCOL_D->model_get("navigation_popup")->create_action(...)
```

Expected: one definition target under:

```text
D:\code\shuiyuzhengfeng_lpc\adm\protocol\model\navigation_popup_model.c
```

Do not commit temporary probe scripts.

### Task 13: Commit object inference consolidation

**Files:**

- Modify: `src/semanticEvaluation/SemanticEvaluationService.ts`
- Modify: `src/objectInference/ObjectInferenceService.ts`
- Tests changed above
- Modify docs if architecture changed: `docs/object-inference-design.md`

- [ ] **Step 1: Run object inference regression set**

Run:

```powershell
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts src/objectInference/__tests__/ScopedMethodReturnResolver.test.ts src/__tests__/providerIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Typecheck**

Run:

```powershell
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```powershell
git add src/semanticEvaluation src/objectInference src/__tests__/providerIntegration.test.ts docs/object-inference-design.md
git commit -m "refactor(object-inference): consume semantic receiver values first"
```

## Chunk 5: Final Verification and Packaging

### Task 14: Full regression

**Files:**

- No source files unless failures require fixes.

- [ ] **Step 1: Run TypeScript check**

Run:

```powershell
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 2: Run full Jest suite**

Run:

```powershell
npm test -- --runInBand
```

Expected: all suites pass.

- [ ] **Step 3: Package extension**

Run:

```powershell
npm run package
```

If ANTLR/JVM memory fails, rerun with:

```powershell
$env:JAVA_TOOL_OPTIONS='-Xms64m -Xmx512m'; npm run package
```

Expected: a new `.vsix` is generated in the repository root.

- [ ] **Step 4: Update release docs only if user-visible behavior changed**

If semantic/object inference behavior changed in a user-visible way, update:

- `CHANGELOG.md`
- `README.md` if the documented capability changed
- any relevant file under `docs/`

- [ ] **Step 5: Final commit if release docs or package metadata changed**

```powershell
git add CHANGELOG.md README.md docs package.json package-lock.json
git commit -m "docs: document semantic object inference hardening"
```

## Execution Notes

- Keep each chunk independently green before moving on.
- Prefer preserving behavior during extraction chunks; add new semantic behavior only in Chunk 3.
- If a valid LPC snippet produces `SyntaxKind.Missing`, fix syntax/builder ownership rather than adding semantic-layer no-ops.
- If semantic evaluation returns `non-static`, do not fall back to `@lpc-return-objects`.
- If semantic evaluation returns `unknown`, legacy object inference and `@lpc-return-objects` fallback remain valid.
- Do not delete `ReceiverTraceService` in this plan unless tests prove full parity and the deletion is a separate reviewed chunk.
