# Syntax and Object Inference Hardening Design

## 1. Context

`lpc-support` already has a parser / syntax / semantic split and a newly introduced semantic evaluation foundation. The recent `model_get` work proved that the long-term direction is correct: object method inference should first consume natural semantic evaluation and only fall back to `@lpc-return-objects` when the natural value remains `unknown`.

The follow-up bug around `call_other(...);` exposed a lower-level contract problem: a valid statement terminator was surfaced as a `SyntaxKind.Missing` node. The immediate fix moved this back into grammar by changing `macroInvoke` statements to consume `SEMI`, which is the right class of fix. It also highlighted a broader goal:

**合法 LPC 语法不应该泄漏为 `Missing` 并污染语义层；对象推导器不应该继续承担语法修补和局部解释器职责。**

We also reviewed `tmp/external-lpc-language-server` as a reference implementation. It is not a small ANTLR wrapper. It is closer to a TypeScript compiler fork: custom scanner, parser, binder, checker, flow graph, type facts, symbol resolution, and language services. Direct migration would be too disruptive, but several design points are useful.

## 2. Reference Findings

### 2.1 Syntax Layer Discipline

The reference parser handles statement boundaries directly in parser code:

- `parseStatement()` turns `SemicolonToken` into an empty statement.
- `parseExpressionOrLabeledStatement()` consumes semicolons after expressions.
- `parseReturnStatement()` owns the return expression and semicolon.

The lesson for this project is not "replace ANTLR." The lesson is:

**Syntax nodes should represent language constructs, not parser leftovers.**

For our codebase, this means:

- Normal empty statements should not become `Missing`.
- Normal expression statement semicolons should not become `Missing`.
- Macro-style function calls should remain complete expression statements.
- `Missing` should mean real syntax damage or genuinely unsupported grammar, not ordinary punctuation.

### 2.2 Constant Evaluator Shape

The reference project has `createEvaluator(...)`, a small expression evaluator used for string/number constants, unary/binary operations, identifiers, property/entity names, and element access. This is useful because our `ExpressionEvaluator` is currently doing several jobs at once:

- literal interpretation
- container shape evaluation
- object source evaluation
- type predicate calls
- direct call delegation
- condition truthiness

The lesson is:

**Make the value evaluator explicitly layered.**

We should not let `ExpressionEvaluator` become a bag of ad-hoc cases. It should become a coordinator over smaller evaluators with narrow responsibilities.

### 2.3 Type Checker and Flow Narrowing

The reference project has a TypeScript-style binder/checker system with flow nodes, `TypeFacts`, and type predicate narrowing. It supports JSDoc-style type predicates like:

```c
/**
 * @returns {o is "object.c"}
 */
fn(object o) {
    return 1;
}
```

This is much stronger than our current value-domain evaluator, but it is also a large architectural commitment. We should not port it wholesale. The useful design idea is:

**Control-flow facts should eventually be first-class, but we can grow toward that incrementally.**

The current `StatementTransfer` state join is enough for the present object inference work. A full flow graph should remain a later option, not the next step.

## 3. Goals

This design has three goals:

1. Tighten the syntax layer so valid LPC syntax produces stable, meaningful `SyntaxNode` structures.
2. Refactor semantic evaluation into clearer components inspired by the reference evaluator design.
3. Gradually move object receiver tracing and object-return propagation into `SemanticEvaluationService`, leaving object inference as a consumer and compatibility/fallback layer.

## 4. Non-Goals

This design does not propose:

- replacing ANTLR with the reference project's custom parser
- porting the reference binder/checker/flow graph
- building a full LPC interpreter
- removing `@lpc-return-objects`
- modeling runtime-only sources such as `previous_object()` as statically precise
- supporting arbitrary loops, dynamic containers, or unrestricted function side effects in one pass

## 5. Proposed Design

### 5.1 Syntax Hardening

Add an explicit syntax-layer contract:

**Any valid LPC source fragment that the grammar claims to support should not produce `SyntaxKind.Missing`.**

Initial target areas:

- Empty statements:

```c
;
```

- Macro-style call statements:

```c
call_other(model, "init");
```

- Ordinary expression statements:

```c
foo();
x = y;
```

- Return statements:

```c
return;
return model;
```

Implementation direction:

- Add `SyntaxKind.EmptyStatement`, or intentionally filter empty statement parse nodes from `Block` children.
- Keep `Missing` for real malformed syntax and unsupported grammar only.
- Add syntax tests that assert `missingNodeCount === 0` for representative valid snippets.
- Avoid adding semantic-layer no-op handling for syntax leftovers.

Success criteria:

- `call_other(...);` has no `Missing` semicolon node.
- Bare `;` is represented intentionally, not as `Missing`.
- Existing formatter range logic still handles real missing nodes for malformed snippets.

### 5.2 Semantic Evaluator Decomposition

Split `ExpressionEvaluator` into focused helpers while preserving the public `evaluate(node, state)` entry point.

Proposed units:

- `LpcLiteralEvaluator`
  - parses literal token metadata into `literalValue`
  - owns string, char, int, float, boolean/null handling

- `LpcConstantEvaluator`
  - folds pure constants
  - supports parenthesized expressions
  - supports `+`, `-`, numeric operations where safe
  - eventually supports string concatenation for static path fragments

- `LpcContainerShapeEvaluator`
  - owns mapping/array shape construction
  - owns fixed key/index access
  - preserves union/candidate behavior

- `LpcTypePredicateEvaluator`
  - already extracted
  - owns `mapp`, `pointerp`, `stringp`, `objectp`, `undefinedp`

- `LpcObjectSourceEvaluator`
  - owns `new`, `load_object`, `find_object`, `clone_object`
  - converts static string sets to `objectValue`
  - should not know about language-service providers

- `LpcConditionEvaluator`
  - owns truthiness, `!`, `&&`, `||`, condition folding
  - returns tri-state true / false / unknown
  - used by `StatementTransfer`

`ExpressionEvaluator` remains the facade, but each semantic idea has a named home. This makes future additions look intentional rather than like one more special case.

Success criteria:

- Existing `model_get` natural return tests still pass.
- `ExpressionEvaluator` shrinks and mostly delegates.
- Adding one new semantic primitive requires editing a focused module and its test.

### 5.3 Object Inference as Consumer

Current object inference contains several older responsibilities:

- receiver classification
- macro receiver resolution
- builtin call object resolution
- local variable tracing
- documented return fallback
- consumer-specific candidate shaping

The semantic evaluation layer now overlaps with parts of this, especially local value flow and callee return. The long-term direction should be:

```text
SyntaxDocument
  -> SemanticEvaluationService
      -> SemanticValue
  -> ObjectInferenceService
      -> ObjectInferenceResult
```

Object inference should eventually focus on:

- locating the receiver expression at a cursor position
- asking semantic evaluation for the receiver value
- converting `object` / candidate values into method lookup candidates
- invoking fallback paths only when semantic evaluation returns `unknown`
- preserving diagnostics and user-facing status

`ReceiverTraceService` should become either:

- an internal strategy of semantic evaluation, or
- a compatibility path used only until semantic evaluation covers the same cases

Success criteria:

- `ObjectInferenceService` does less local data-flow work directly.
- `SemanticEvaluationService` is the first source of truth for receiver values.
- `@lpc-return-objects` remains fallback-only.
- `non-static` results block fallback just like today.

### 5.4 Documentation and Traceability

Every semantic enhancement should add:

- a focused unit test for the new evaluator behavior
- one integration test showing provider behavior if user-visible
- a short note in `docs/object-inference-design.md` when it changes architecture

For reference-derived ideas, do not copy code. Cite the design pattern in project docs if needed:

- parser owns valid statement punctuation
- constant evaluator folds pure expressions
- type/flow facts can become first-class later

## 6. Phased Plan

### Phase A: Syntax Contract Hardening

Deliverables:

- `SyntaxKind.EmptyStatement` or explicit empty-statement filtering
- tests for valid snippets producing zero `Missing`
- no semantic-layer workaround for valid punctuation

Risk:

- Formatter/range formatting may currently depend on some `Missing` nodes for malformed snippets.

Mitigation:

- Only remove `Missing` for valid grammar constructs.
- Keep malformed-snippet tests intact.

### Phase B: Evaluator Decomposition

Deliverables:

- Move literal parsing, constants, containers, object sources, and conditions into focused modules.
- Keep `ExpressionEvaluator.evaluate()` API stable.
- Add tests beside each helper.

Risk:

- Behavior-preserving refactor could accidentally change `unknown` vs `union` semantics.

Mitigation:

- Run targeted semantic tests plus provider integration before and after.
- Avoid broad feature expansion during extraction.

### Phase C: Controlled Semantic Expansion

Deliverables:

- String concatenation for static path fragments:

```c
load_object("/adm/" + "protocol")
```

- Logical `&&` / `||` condition folding for guard branches.
- Optional static missing-key representation if needed for mapping shape guards.

Risk:

- Over-eager folding may turn unknown runtime expressions into false precision.

Mitigation:

- Only fold when every operand is statically known.
- Unknown in any required part stays unknown.

### Phase D: Object Inference Consolidation

Deliverables:

- Route more receiver identifier tracing through `SemanticEvaluationService`.
- Reduce direct object-specific tracing in `ObjectInferenceService`.
- Keep documented-return fallback behavior unchanged.

Risk:

- Existing object inference tests cover many legacy edge cases.

Mitigation:

- Migrate one source at a time.
- Keep old path until the semantic path proves parity.
- Remove old path only after tests prove no behavior loss.

## 7. Open Questions

1. Should `EmptyStatement` exist as a public `SyntaxKind`, or should empty statements be filtered out of syntax documents?
2. Should string concatenation be part of `LpcConstantEvaluator` immediately, or wait until the first user-visible object inference case needs it?
3. Should `ReceiverTraceService` be moved into `semanticEvaluation/static`, or kept in `objectInference` until semantic parity is complete?

## 8. Recommendation

Use a conservative incremental approach:

1. First harden syntax so valid code does not produce accidental `Missing`.
2. Then split `ExpressionEvaluator` into small evaluators without adding behavior.
3. Then add new semantic behavior one white-zone rule at a time.
4. Finally migrate object inference consumers toward `SemanticEvaluationService`.

This borrows the reference project's best design habits while preserving this repository's existing layered architecture.
