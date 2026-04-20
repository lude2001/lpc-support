# LPC Semantic Evaluation Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `lpc-support` 的受限语义求值基础设施，让对象推导与未来的返回值自然推导不再依赖持续增长的 ad-hoc 特判。

**Architecture:** 在现有 parser / syntax / semantic 主链之上新增独立的 `semanticEvaluation` 层，统一定义 Value Domain、核心静态求值、callee return 求值、环境语义 provider，并让 `ObjectInferenceService` 逐步退为消费者。第一阶段不追求完整解释器，只交付白区内可证明的值流、return 推导与配置注入候选模型。第二阶段用 `model_get/query_model_registry` 和 `this_player()` 作为代表场景，把自然推导与环境语义同时打通。

**Tech Stack:** TypeScript、ANTLR4TS、VS Code API、Jest、现有 `ParsedDocumentService` / `SyntaxBuilder` / `SemanticModelBuilder` / `ObjectInferenceService`

---

## File Structure

### New files

- `D:\code\lpc-support\src\semanticEvaluation\types.ts`
  - 定义统一 Value Domain、evaluation result、budget、diagnostics
- `D:\code\lpc-support\src\semanticEvaluation\valueFactories.ts`
  - 构造 `Exact / CandidateSet / ConfiguredCandidateSet / Unknown / NonStatic / MappingShape / ArrayShape / Union`
- `D:\code\lpc-support\src\semanticEvaluation\valueJoin.ts`
  - 统一分支合并与 union 折叠规则
- `D:\code\lpc-support\src\semanticEvaluation\static\StaticEvaluationContext.ts`
  - Core evaluator 上下文、预算、初始环境
- `D:\code\lpc-support\src\semanticEvaluation\static\StaticEvaluationState.ts`
  - `ValueEnvironment`、`ControlFlowState`、`ReturnAccumulator`
- `D:\code\lpc-support\src\semanticEvaluation\__tests__\staticEvaluationState.test.ts`
  - 只锁状态原语与 state-level join shell
- `D:\code\lpc-support\src\semanticEvaluation\static\ExpressionEvaluator.ts`
  - 白区表达式求值
- `D:\code\lpc-support\src\semanticEvaluation\static\StatementTransfer.ts`
  - 白区语句 transfer / join
- `D:\code\lpc-support\src\semanticEvaluation\static\CoreStaticEvaluator.ts`
  - 单函数抽象求值入口
- `D:\code\lpc-support\src\semanticEvaluation\calls\CalleeReturnEvaluator.ts`
  - 调用点实参与 callee return 桥接
- `D:\code\lpc-support\src\semanticEvaluation\calls\CallTargetResolver.ts`
  - 从当前调用点定位可评估 callee
- `D:\code\lpc-support\src\semanticEvaluation\environment\types.ts`
  - provider 接口与 workspace semantic context
- `D:\code\lpc-support\src\semanticEvaluation\environment\ThisPlayerProvider.ts`
  - `this_player()` 的配置候选 provider
- `D:\code\lpc-support\src\semanticEvaluation\environment\RuntimeNonStaticProvider.ts`
  - `previous_object()` 等 `non-static` provider
- `D:\code\lpc-support\src\semanticEvaluation\environment\EnvironmentSemanticRegistry.ts`
  - provider registry 与统一 dispatch
- `D:\code\lpc-support\src\semanticEvaluation\SemanticEvaluationService.ts`
  - 统一 façade，供 object inference / future consumers 使用
- `D:\code\lpc-support\src\semanticEvaluation\__tests__\valueDomain.test.ts`
- `D:\code\lpc-support\src\semanticEvaluation\__tests__\coreStaticEvaluator.test.ts`
- `D:\code\lpc-support\src\semanticEvaluation\__tests__\calleeReturnEvaluator.test.ts`
- `D:\code\lpc-support\src\semanticEvaluation\__tests__\environmentProviders.test.ts`

### Modified files

- `D:\code\lpc-support\src\objectInference\types.ts`
  - 把现有 object inference 结果与新 Value Domain 的适配点写清
- `D:\code\lpc-support\src\objectInference\ReturnObjectResolver.ts`
  - 接入 `SemanticEvaluationService`，把自然 return 推导放到 `@lpc-return-objects` 之前
- `D:\code\lpc-support\src\objectInference\ObjectInferenceService.ts`
  - 把 receiver/call 分支改成消费 Value Domain 结果，而不是继续自己发明新候选模型
- `D:\code\lpc-support\src\lsp\server\runtime\createProductionLanguageServices.ts`
  - composition root 装配 `SemanticEvaluationService` 及 provider registry
- `D:\code\lpc-support\src\modules\coreModule.ts`
  - extension-side composition root 同步注入
- `D:\code\lpc-support\src\language\documentation\types.ts`
  - 明确 `returnObjects` 是 fallback hint，不是 authority
- `D:\code\lpc-support\src\objectInference\__tests__\ObjectInferenceService.test.ts`
- `D:\code\lpc-support\src\__tests__\providerIntegration.test.ts`
- `D:\code\lpc-support\src\lsp\__tests__\spawnedRuntime.integration.test.ts`
- `D:\code\lpc-support\docs\object-inference-design.md`
  - 同步长期架构与 `@lpc-return-objects` 新定位
- `D:\code\lpc-support\CHANGELOG.md`
  - 只在真正实现完成时再更新

### Existing files to read before editing

- `D:\code\lpc-support\src\parser\ParsedDocumentService.ts`
- `D:\code\lpc-support\src\syntax\SyntaxBuilder.ts`
- `D:\code\lpc-support\src\semantic\SemanticModelBuilder.ts`
- `D:\code\lpc-support\src\objectInference\ReturnObjectResolver.ts`
- `D:\code\lpc-support\src\objectInference\ObjectInferenceService.ts`
- `D:\code\lpc-support\src\objectInference\ReceiverTraceService.ts`
- `D:\code\shuiyuzhengfeng_lpc\adm\protocol\protocol_server.c`

## Chunk 1: Value Domain Foundation

### Task 1: Add semantic evaluation value domain and join rules

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\types.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\valueFactories.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\valueJoin.ts`
- Test: `D:\code\lpc-support\src\semanticEvaluation\__tests__\valueDomain.test.ts`

- [ ] **Step 1: Write failing value-domain tests**

Cover at least:
- `LiteralValue("login")`
- `ObjectValue` exact path
- `ConfiguredCandidateSetValue`
- `UnknownValue` vs `NonStaticValue`
- `MappingShapeValue` can represent nested static shapes
- `UnionValue` join de-duplication

- [ ] **Step 2: Run the new tests to verify failure**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/valueDomain.test.ts
```

Expected:
- FAIL because the new files/types do not exist yet

- [ ] **Step 3: Implement the minimal value domain**

Implement:
- discriminated union `SemanticValue`
- construction helpers
- stable join semantics
- no object-inference-specific fields yet

- [ ] **Step 4: Run the tests and make them pass**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/valueDomain.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/types.ts src/semanticEvaluation/valueFactories.ts src/semanticEvaluation/valueJoin.ts src/semanticEvaluation/__tests__/valueDomain.test.ts
git commit -m "feat(semantic): add value domain foundation"
```

### Task 2: Add static evaluation state primitives

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\static\StaticEvaluationContext.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\static\StaticEvaluationState.ts`
- Test: `D:\code\lpc-support\src\semanticEvaluation\__tests__\staticEvaluationState.test.ts`

- [ ] **Step 1: Write failing state tests**

Cover at least:
- environment binding
- state-level join shell
- return accumulation
- budget struct / metadata presence

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/staticEvaluationState.test.ts
```

Expected:
- FAIL because state/context files do not exist yet

- [ ] **Step 3: Implement context/state primitives**

Add:
- `ValueEnvironment`
- `ControlFlowState`
- `ReturnAccumulator`
- lightweight budget struct

- [ ] **Step 4: Run tests to verify they pass**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/staticEvaluationState.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/static/StaticEvaluationContext.ts src/semanticEvaluation/static/StaticEvaluationState.ts src/semanticEvaluation/__tests__/staticEvaluationState.test.ts
git commit -m "feat(semantic): add static evaluation state primitives"
```

## Chunk 2: Core Static Evaluator White-Zone

### Task 3: Implement white-zone expression evaluation

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\static\ExpressionEvaluator.ts`
- Modify: `D:\code\lpc-support\src\semanticEvaluation\__tests__\coreStaticEvaluator.test.ts`

- [ ] **Step 1: Add failing expression tests**

Cover:
- local identifier alias
- string literal propagation
- `new("/x/y")` producing exact object value
- `load_object("/x/y")`
- mapping literal and fixed-key indexing
- conditional expression (`?:`) over literal / object values

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected:
- FAIL on missing evaluator behavior

- [ ] **Step 3: Implement `ExpressionEvaluator`**

Support only the white-zone set:
- literals
- identifiers via environment lookup
- parenthesized expressions
- mapping literal
- array literal
- fixed-key index access
- conditional expressions (`?:`)
- `new(...)`
- `load_object(...)`
- `find_object(...)`

- [ ] **Step 4: Run targeted tests again**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/static/ExpressionEvaluator.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
git commit -m "feat(semantic): evaluate white-zone expressions"
```

### Task 4: Implement white-zone statement transfer

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\static\StatementTransfer.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\static\CoreStaticEvaluator.ts`
- Modify: `D:\code\lpc-support\src\semanticEvaluation\__tests__\coreStaticEvaluator.test.ts`

- [ ] **Step 1: Add failing statement tests**

Cover:
- local declaration + assignment
- simple `if/else`
- real conditional-expression (`?:`) join
- `return` through local variable
- unsupported loop downgrades to `UnknownValue`
- budget exhaustion surfaces `UnknownValue` instead of throw

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected:
- FAIL because statement transfer does not exist yet

- [ ] **Step 3: Implement minimal statement transfer**

Rules:
- support declarations, assignments, `if/else`, `return`
- `?:` must be handled through actual `ConditionalExpression` evaluation, not by test-only branch helpers
- conservative downgrade on loop mutation
- do not add switch/recursion support yet

- [ ] **Step 4: Run the targeted tests and confirm pass**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/static/StatementTransfer.ts src/semanticEvaluation/static/CoreStaticEvaluator.ts src/semanticEvaluation/__tests__/coreStaticEvaluator.test.ts
git commit -m "feat(semantic): add white-zone statement transfer"
```

## Chunk 3: Callee Return Evaluation and model_get Baseline

### Task 5: Add call-target resolution and parameter binding

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\calls\CallTargetResolver.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\calls\CalleeReturnEvaluator.ts`
- Test: `D:\code\lpc-support\src\semanticEvaluation\__tests__\calleeReturnEvaluator.test.ts`

- [ ] **Step 1: Add failing call-evaluation tests**

Cover:
- direct literal argument binding
- local alias argument binding
- multiple literal branch union
- missing callee definition -> `UnknownValue`

- [ ] **Step 2: Run the call-evaluator tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts
```

Expected:
- FAIL because evaluator files do not exist yet

- [ ] **Step 3: Implement minimal callee bridge**

Support:
- resolve current-file/inherit/include callable target already exposed by current syntax/semantic pipeline
- bind argument values into callee initial environment
- invoke `CoreStaticEvaluator`
- respect depth/budget limits

- [ ] **Step 4: Run the call-evaluator tests and confirm pass**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/calls/CallTargetResolver.ts src/semanticEvaluation/calls/CalleeReturnEvaluator.ts src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts
git commit -m "feat(semantic): add callee return evaluator"
```

### Task 6: Lock `model_get/query_model_registry` as the first golden fixture

**Files:**
- Modify: `D:\code\lpc-support\src\semanticEvaluation\__tests__\calleeReturnEvaluator.test.ts`

- [ ] **Step 1: Add failing golden-fixture tests**

Cover:
- `PROTOCOL_D->model_get("login")->error_result(...)`
- local variable alias to `"classify_popup"`
- union result when key comes from simple `if/else`
- registry shape not statically evaluable returns `UnknownValue`

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts -t "model_get|query_model_registry"
```

Expected:
- FAIL because natural callee return inference is not wired through yet

- [ ] **Step 3: Extend the evaluator only as needed for registry-factory white zone**

Minimum additions:
- nested `MappingShapeValue`
- fixed-key lookup by statically known string set
- simple `if (info[\"mode\"] == \"new\")` object-source selection
- do not wire `@lpc-return-objects` here; evaluator must return `UnknownValue` when static analysis cannot prove the registry shape

- [ ] **Step 4: Re-run the focused tests and confirm pass**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts -t "model_get|query_model_registry"
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/__tests__/calleeReturnEvaluator.test.ts
git commit -m "feat(semantic): support registry-backed return inference"
```

## Chunk 4: Environment Providers and Object Inference Integration

### Task 7: Add environment semantic provider registry

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\environment\types.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\environment\ThisPlayerProvider.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\environment\RuntimeNonStaticProvider.ts`
- Create: `D:\code\lpc-support\src\semanticEvaluation\environment\EnvironmentSemanticRegistry.ts`
- Modify: `D:\code\lpc-support\src\semanticEvaluation\__tests__\environmentProviders.test.ts`

- [ ] **Step 1: Add failing environment-provider tests**

Cover:
- `this_player()` -> `ConfiguredCandidateSetValue`
- missing `playerObjectPath` -> `UnknownValue`
- `previous_object()` -> `NonStaticValue`
- registry dispatch prefers exact matching provider

- [ ] **Step 2: Run the provider tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/environmentProviders.test.ts
```

Expected:
- FAIL because providers do not exist yet

- [ ] **Step 3: Implement provider registry and first providers**

Do:
- move `this_player()` semantics out of `ReturnObjectResolver`
- keep exact `this_object()` in core/builtin path
- explicitly classify `previous_object()` as `NonStaticValue`
- ensure `RuntimeNonStaticProvider` results survive consumer integration later and are not downgraded to annotation candidates

- [ ] **Step 4: Re-run the provider tests and confirm pass**

Run:
```powershell
npx jest --runInBand src/semanticEvaluation/__tests__/environmentProviders.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/environment/types.ts src/semanticEvaluation/environment/ThisPlayerProvider.ts src/semanticEvaluation/environment/RuntimeNonStaticProvider.ts src/semanticEvaluation/environment/EnvironmentSemanticRegistry.ts src/semanticEvaluation/__tests__/environmentProviders.test.ts
git commit -m "feat(semantic): add environment semantic providers"
```

### Task 8: Add the façade and wire object inference to consume semantic evaluation first

**Files:**
- Create: `D:\code\lpc-support\src\semanticEvaluation\SemanticEvaluationService.ts`
- Modify: `D:\code\lpc-support\src\objectInference\ReturnObjectResolver.ts`
- Modify: `D:\code\lpc-support\src\objectInference\ObjectInferenceService.ts`
- Modify: `D:\code\lpc-support\src\objectInference\types.ts`
- Modify: `D:\code\lpc-support\src\lsp\server\runtime\createProductionLanguageServices.ts`
- Modify: `D:\code\lpc-support\src\modules\coreModule.ts`
- Modify: `D:\code\lpc-support\src\language\documentation\types.ts`
- Modify: `D:\code\lpc-support\docs\object-inference-design.md`

- [ ] **Step 1: Add failing integration tests**

Cover:
- natural return inference outranks `@lpc-return-objects`
- environment provider result outranks annotation fallback
- `previous_object()` / `NonStaticValue` outranks annotation fallback and remains terminal
- annotation still works when semantic evaluation returns `UnknownValue`
- `CandidateSetValue` cannot be overridden by annotation fallback
- object inference output status remains backward-compatible for existing consumers
- `model_get/query_model_registry` consumer integration now proves natural inference at object-inference level

- [ ] **Step 2: Run focused integration tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts -t "semantic evaluation|return-objects|this_player|model_get|previous_object"
```

Expected:
- FAIL because object inference is not consuming the new façade yet

- [ ] **Step 3: Implement façade and wire priority rules**

Priority must be:
1. natural semantic return inference
2. environment semantic provider result
3. `@lpc-return-objects`
4. `unknown`

Additional hard rule:
- only `UnknownValue` may continue to annotation fallback
- any non-`UnknownValue` semantic result, including `ConfiguredCandidateSetValue`, `CandidateSetValue`, and `NonStaticValue`, must short-circuit before `@lpc-return-objects`

- [ ] **Step 4: Re-run focused integration tests and confirm pass**

Run:
```powershell
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts -t "semantic evaluation|return-objects|this_player|model_get|previous_object"
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/semanticEvaluation/SemanticEvaluationService.ts src/objectInference/ReturnObjectResolver.ts src/objectInference/ObjectInferenceService.ts src/objectInference/types.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/modules/coreModule.ts src/language/documentation/types.ts docs/object-inference-design.md
git commit -m "feat(semantic): wire semantic evaluation into object inference"
```

## Chunk 5: Whole-System Verification and Documentation

### Task 9: Add spawned-runtime and regression protection

**Files:**
- Modify: `D:\code\lpc-support\src\lsp\__tests__\spawnedRuntime.integration.test.ts`
- Modify: `D:\code\lpc-support\src\__tests__\providerIntegration.test.ts`

- [ ] **Step 1: Add failing runtime regressions**

Cover:
- `model_get("login")->error_result(...)` in a realistic runtime-backed fixture
- `this_player()->query_name()` still works with config-backed semantic provider
- fallback annotation still provides object candidates when the evaluator intentionally hits gray-zone input
- annotation mismatch does not override an exact natural semantic result
- `this_object()` still resolves through the exact builtin path after provider extraction
- `previous_object()` stays non-static at consumer/runtime level and does not degrade to `UnknownValue` or annotation fallback

- [ ] **Step 2: Run runtime-focused tests and confirm failure**

Run:
```powershell
npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts src/__tests__/providerIntegration.test.ts -t "model_get|this_player|this_object|previous_object|fallback|mismatch"
```

Expected:
- FAIL until runtime wiring is complete

- [ ] **Step 3: Fix minimal runtime wiring gaps**

Only adjust:
- service bundle assembly
- test fixtures
- evaluation context hydration

Do not expand language semantics in this step.

- [ ] **Step 4: Re-run runtime-focused tests and confirm pass**

Run:
```powershell
npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts src/__tests__/providerIntegration.test.ts -t "model_get|this_player|this_object|previous_object|fallback|mismatch"
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```powershell
git add src/lsp/__tests__/spawnedRuntime.integration.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "test(semantic): lock runtime semantic evaluation regressions"
```

### Task 10: Run full verification and finalize docs

**Files:**
- Modify: `D:\code\lpc-support\CHANGELOG.md` (only if the implementation is shipping in this branch)

- [ ] **Step 1: Run typecheck**

Run:
```powershell
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 2: Run full test suite**

Run:
```powershell
npm test -- --runInBand
```

Expected:
- PASS

- [ ] **Step 3: Run packaging smoke test**

Run:
```powershell
npm run package
```

Expected:
- PASS and produce a VSIX

- [ ] **Step 4: Update release-facing docs if this branch is being shipped**

Only if the implementation is actually merged for release:
- summarize semantic evaluation foundation
- document the rollout in `CHANGELOG.md`

Do not re-stage `docs/object-inference-design.md` here; that file is already owned by Chunk 4.

- [ ] **Step 5: Commit**

```powershell
git add CHANGELOG.md
git commit -m "docs(semantic): document evaluation foundation rollout"
```

## Notes for Execution

- Keep `@lpc-return-objects` in place throughout the rollout; do not remove it in the same implementation line.
- Do not attempt loops, switch, recursion, dynamic container construction, or general string evaluation in the first implementation.
- Keep `previous_object()` explicitly classified as `NonStaticValue`; do not downgrade it to plain `UnknownValue`.
- `this_object()` remains an exact builtin path and should not be forced through config providers.
- `this_player()` must move to the environment provider layer even if its consumer-facing behavior stays compatible.
- `model_get/query_model_registry` is the first golden fixture, not a one-off special case.

## Suggested review checkpoints

- After Chunk 1: value model sanity and terminology review
- After Chunk 2: white-zone evaluator boundaries review
- After Chunk 3: `model_get` natural return inference review
- After Chunk 4: consumer integration and priority rules review
- After Chunk 5: runtime and release verification review

Plan complete and saved to `docs/superpowers/plans/2026-04-20-lpc-semantic-evaluation-foundation.md`. Ready to execute?
