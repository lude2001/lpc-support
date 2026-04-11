# Object Method Return Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-file object method return propagation so assignments like `c = B->method()` can infer `c` from the callee method's `@lpc-return-objects`, including multi-candidate receivers, inheritance dispatch, and hover behavior.

**Architecture:** Keep the existing object inference entrypoint and status model, and add one focused resolver that turns `receiver->method(...)` into propagated return candidates. Integrate it only at assignment-source tracing time, reuse the existing target-chain method lookup behavior, and extend result metadata with structured diagnostics instead of inventing a new inference state.

**Tech Stack:** TypeScript, VS Code extension APIs, Jest + ts-jest, existing parser/syntax/objectInference services.

---

## File Map

- Create: `src/objectInference/ObjectMethodReturnResolver.ts`
  Responsibility: Resolve `receiver->method(...)` return-object candidates by combining receiver inference, actual method implementation lookup, doc annotation parsing, and conservative downgrade rules.
- Modify: `src/objectInference/types.ts`
  Responsibility: Extend inference result metadata with structured diagnostics while keeping the existing `resolved|multiple|unknown|unsupported` model intact.
- Modify: `src/objectInference/ReceiverTraceService.ts`
  Responsibility: Detect `->` member-call assignment sources and delegate to `ObjectMethodReturnResolver` before falling back to the current resolver paths.
- Modify: `src/objectInference/ObjectInferenceService.ts`
  Responsibility: Wire the new resolver into tracing without changing the existing top-level entrypoint contract.
- Modify: `src/objectInference/ObjectHoverProvider.ts`
  Responsibility: Reuse the propagated candidate set for downstream hover behavior and append conservative explanatory text when some branches could not continue.
- Modify: `src/definitionProvider.ts`
  Responsibility: Extract or expose the actual target-chain method lookup logic into a reusable helper if needed by the new resolver; do not duplicate inheritance dispatch logic.
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
  Responsibility: Cover propagation through assignment chains, multi-candidate receivers, shared-base dispatch, override dispatch, and conservative downgrade rules.
- Test: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`
  Responsibility: Cover multi-implementation hover blocks and explanatory text for unresolved propagated branches.
- Modify: `README.md`
  Responsibility: Document the new cross-file propagation capability, hover behavior for multiple implementations, and current conservative limits.
- Modify: `CHANGELOG.md`
  Responsibility: Add a new release entry describing the feature, diagnostics behavior, and hover improvements.
- Modify: `package.json`
  Responsibility: Bump extension version for the new feature release.

### Task 1: Extend Result Metadata Without Changing Main Status Semantics

**Files:**
- Modify: `src/objectInference/types.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing test for structured diagnostics on conservative unknown results**

Add a focused assertion to `src/objectInference/__tests__/ObjectInferenceService.test.ts` that expects an `unknown` result caused by a missing `@lpc-return-objects` to include at least one diagnostic entry:

```ts
expect(result?.inference).toEqual({
    status: 'unknown',
    candidates: [],
    diagnostics: [
        expect.objectContaining({
            code: 'missing-return-annotation',
            methodName: 'method'
        })
    ]
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "missing @lpc-return-objects diagnostic"`

Expected: FAIL because `ObjectInferenceResult` does not yet expose `diagnostics`.

- [ ] **Step 3: Add the minimal type extension**

Update `src/objectInference/types.ts` with explicit diagnostic metadata types:

```ts
export type ObjectInferenceDiagnosticCode =
    | 'missing-return-annotation'
    | 'missing-method-doc'
    | 'unresolved-method-definition';

export interface ObjectInferenceDiagnostic {
    code: ObjectInferenceDiagnosticCode;
    message: string;
    targetObjectPath?: string;
    methodName?: string;
    definitionPath?: string;
}

export interface ObjectInferenceResult {
    status: ObjectInferenceStatus;
    candidates: ObjectCandidate[];
    reason?: ObjectInferenceReason;
    diagnostics?: ObjectInferenceDiagnostic[];
}
```

- [ ] **Step 4: Re-run the targeted test and confirm the failure moved forward**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "missing @lpc-return-objects diagnostic"`

Expected: FAIL later in execution because the resolver still does not populate diagnostics.

- [ ] **Step 5: Commit the type-only groundwork**

```bash
git add src/objectInference/types.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "refactor(object-inference): add diagnostic result metadata"
```

### Task 2: Add `ObjectMethodReturnResolver` With Single-Candidate Propagation

**Files:**
- Create: `src/objectInference/ObjectMethodReturnResolver.ts`
- Modify: `src/objectInference/ReceiverTraceService.ts`
- Modify: `src/objectInference/ObjectInferenceService.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing test for single-candidate propagation**

Add a test that proves `c = B->method(); c->query_xxx();` resolves `c` from a method annotation in another file:

```ts
test('propagates return objects from a resolved object method call assignment', async () => {
    const source = [
        'void demo() {',
        '    object B = load_object("/adm/objects/weapon_holder");',
        '    object c = B->method();',
        '    c->query_damage();',
        '}'
    ].join('\n');

    expect(result?.inference).toEqual({
        status: 'resolved',
        candidates: [
            {
                path: path.join(fixtureRoot, 'adm', 'objects', 'weapon.c'),
                source: 'assignment'
            }
        ]
    });
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "propagates return objects from a resolved object method call assignment"`

Expected: FAIL because assignment tracing currently treats `B->method()` as unknown.

- [ ] **Step 3: Implement the smallest resolver that handles single-candidate member-call propagation**

Create `src/objectInference/ObjectMethodReturnResolver.ts` with a focused API and single-candidate path first:

```ts
export class ObjectMethodReturnResolver {
    constructor(
        private readonly objectInferenceService: ObjectInferenceService,
        private readonly methodLocator: ObjectMethodLocator
    ) {}

    public async resolveMemberCallReturnOutcome(
        document: vscode.TextDocument,
        memberAccessNode: SyntaxNode
    ): Promise<ObjectResolutionOutcome> {
        const receiverNode = memberAccessNode.children[0];
        const memberNode = memberAccessNode.children[1];

        if (!receiverNode || memberNode?.kind !== SyntaxKind.Identifier || !memberNode.name) {
            return { candidates: [] };
        }

        const receiverOutcome = await this.objectInferenceService.inferReceiverCandidates(document, receiverNode);
        if (receiverOutcome.candidates.length === 0) {
            return {
                candidates: [],
                diagnostics: []
            };
        }

        // temporary single-candidate path, expanded in later tasks
    }
}
```

Update `ReceiverTraceService.resolveSourceExpression(...)` so `->` member calls delegate to this resolver before the current direct fallback path.

- [ ] **Step 4: Re-run the targeted test to verify it passes**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "propagates return objects from a resolved object method call assignment"`

Expected: PASS.

- [ ] **Step 5: Commit the first propagation slice**

```bash
git add src/objectInference/ObjectMethodReturnResolver.ts src/objectInference/ReceiverTraceService.ts src/objectInference/ObjectInferenceService.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "feat(object-inference): propagate object method return annotations"
```

### Task 3: Reuse Actual Dispatch Lookup Across Inheritance Chains

**Files:**
- Modify: `src/objectInference/ObjectMethodReturnResolver.ts`
- Modify: `src/definitionProvider.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write the failing tests for shared-base and override dispatch**

Add two tests:

```ts
test('deduplicates a shared base implementation across multiple receiver candidates', async () => {
    expect(result?.inference?.candidates).toEqual([
        { path: path.join(fixtureRoot, 'adm', 'objects', 'shared_reward.c'), source: 'assignment' }
    ]);
});

test('collects override implementations from multiple receiver candidates', async () => {
    expect(result?.inference?.candidates).toEqual([
        { path: path.join(fixtureRoot, 'adm', 'objects', 'reward_a.c'), source: 'assignment' },
        { path: path.join(fixtureRoot, 'adm', 'objects', 'reward_b.c'), source: 'assignment' },
        { path: path.join(fixtureRoot, 'adm', 'objects', 'reward_base.c'), source: 'assignment' }
    ]);
});
```

- [ ] **Step 2: Run those tests to verify they fail**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "shared base|override implementations"`

Expected: FAIL because propagation does not yet reuse actual target-chain method dispatch.

- [ ] **Step 3: Extract or expose reusable method-location logic instead of duplicating it**

Refactor the target-chain lookup currently used by `definitionProvider.ts` into a reusable helper that returns the actual implementation hit for a candidate object path:

```ts
export interface ResolvedMethodDefinition {
    filePath: string;
    range: vscode.Range;
    document: vscode.TextDocument;
}

export async function resolveMethodDefinitionInTargetChain(
    document: vscode.TextDocument,
    targetFilePath: string,
    methodName: string
): Promise<ResolvedMethodDefinition | undefined> {
    // move the existing recursive inheritance walk here without changing semantics
}
```

Update `definitionProvider.ts` to call this helper, then update `ObjectMethodReturnResolver` to use the same helper so both features share one dispatch truth source.

- [ ] **Step 4: Re-run the focused tests and verify they pass**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "shared base|override implementations"`

Expected: PASS.

- [ ] **Step 5: Commit the dispatch reuse refactor**

```bash
git add src/definitionProvider.ts src/objectInference/ObjectMethodReturnResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "refactor(object-inference): share target-chain method resolution"
```

### Task 4: Support Multi-Candidate Receiver Propagation and Conservative Unknown Rules

**Files:**
- Modify: `src/objectInference/ObjectMethodReturnResolver.ts`
- Modify: `src/objectInference/ReceiverTraceService.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: Write failing tests for mixed-known and missing-annotation branches**

Add coverage for these cases:

```ts
test('downgrades to unknown when one actual method implementation lacks @lpc-return-objects', async () => {
    expect(result?.inference).toEqual({
        status: 'unknown',
        candidates: [],
        diagnostics: [
            expect.objectContaining({
                code: 'missing-return-annotation',
                targetObjectPath: path.join(fixtureRoot, 'adm', 'objects', 'b.c'),
                methodName: 'method'
            })
        ]
    });
});

test('downgrades to unknown when an annotated return object path cannot be resolved', async () => {
    expect(result?.inference?.diagnostics).toEqual([
        expect.objectContaining({
            code: 'unresolved-method-definition',
            methodName: 'method'
        })
    ]);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "lacks @lpc-return-objects|cannot be resolved"`

Expected: FAIL because current propagation either does not merge multiple branches or does not emit diagnostics on downgrade.

- [ ] **Step 3: Implement full-set propagation with all-or-nothing proof semantics**

In `ObjectMethodReturnResolver.ts`, extend the resolver to:

```ts
for (const receiverCandidate of receiverCandidates) {
    const definition = await resolveMethodDefinitionInTargetChain(document, receiverCandidate.path, methodName);
    if (!definition) {
        diagnostics.push({
            code: 'unresolved-method-definition',
            message: `已定位 ${receiverCandidate.path}，但无法找到 ${methodName} 的实际实现`,
            targetObjectPath: receiverCandidate.path,
            methodName
        });
        return { candidates: [], diagnostics };
    }

    const returnObjects = readReturnObjectsFromDefinition(definition);
    if (!returnObjects) {
        diagnostics.push({
            code: 'missing-return-annotation',
            message: `已定位 ${receiverCandidate.path}->${methodName} 的实际定义，但该方法未标注 @lpc-return-objects，无法继续推导返回对象`,
            targetObjectPath: receiverCandidate.path,
            methodName,
            definitionPath: definition.filePath
        });
        return { candidates: [], diagnostics };
    }
}
```

Map the final merged return-object paths to `source: 'assignment'`, and if any branch cannot be proven, return no candidates plus diagnostics so the caller becomes `unknown`.

- [ ] **Step 4: Re-run the focused tests and confirm they pass**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts -t "lacks @lpc-return-objects|cannot be resolved"`

Expected: PASS.

- [ ] **Step 5: Commit the conservative multi-branch propagation behavior**

```bash
git add src/objectInference/ObjectMethodReturnResolver.ts src/objectInference/ReceiverTraceService.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "fix(object-inference): downgrade unresolved method returns conservatively"
```

### Task 5: Surface Multi-Implementation Hover Results

**Files:**
- Modify: `src/objectInference/ObjectHoverProvider.ts`
- Test: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`

- [ ] **Step 1: Write failing hover tests for multi-implementation display**

Add tests that expect separate hover blocks for distinct implementations, even when signatures look similar:

```ts
expect((hover as vscode.Hover).contents).toEqual(expect.arrayContaining([
    expect.stringContaining('/obj/a.c::method'),
    expect.stringContaining('/std/base.c::method')
]));
```

Add a second test that expects an explanatory line when some propagated branches could not continue:

```ts
expect(renderedHover).toContain('另有 1 个候选实现无法继续推导');
```

- [ ] **Step 2: Run the focused hover tests and verify they fail**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts -t "multi-implementation|无法继续推导"`

Expected: FAIL because hover currently does not format multi-implementation sections or explanatory text for unresolved propagated branches.

- [ ] **Step 3: Implement minimal hover grouping without collapsing distinct files**

Update `ObjectHoverProvider.ts` so it:

```ts
const sections = resolvedDocs.map((entry, index) => [
    `### 实现 ${index + 1}: ${entry.filePath}::${memberName}`,
    entry.markdown
].join('\n\n'));

if (objectAccess.inference.diagnostics?.length) {
    sections.push(`> 另有 ${objectAccess.inference.diagnostics.length} 个候选实现无法继续推导`);
}

return new vscode.Hover(new vscode.MarkdownString(sections.join('\n\n---\n\n')));
```

Do not merge blocks merely because signatures or docs are similar; only deduplicate by actual implementation definition.

- [ ] **Step 4: Re-run the focused hover tests and verify they pass**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts -t "multi-implementation|无法继续推导"`

Expected: PASS.

- [ ] **Step 5: Commit the hover presentation update**

```bash
git add src/objectInference/ObjectHoverProvider.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts
git commit -m "feat(object-inference): show multi-implementation hover docs"
```

### Task 6: Update Release Documentation and Versioning

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: Write the failing release checklist in the plan itself**

Before editing docs, copy this checklist into your working notes and verify each item after editing:

```md
- README documents cross-file `receiver->method()` return propagation
- README documents conservative downgrade when any actual implementation lacks `@lpc-return-objects`
- README documents multi-implementation hover behavior
- CHANGELOG has a new top release entry for this feature
- package.json version is bumped from 0.33.0 to 0.34.0
```

- [ ] **Step 2: Update `README.md` with concrete new behavior**

Add or adjust examples under the object inference section to include:

```md
- 跨文件对象方法返回传播：`c = B->method(); c->query_xxx()` 会根据 `method` 的 `@lpc-return-objects` 继续推导 `c`
- 当 `B` 有多个候选对象时，扩展会分别定位各自实际命中的方法实现，并合并返回对象候选
- 若任一实际命中的方法缺少 `@lpc-return-objects`，返回传播会保守降级为 `unknown`
- 多实现悬停会按实现分块展示，不会因为签名相似而自动折叠
```

- [ ] **Step 3: Update `CHANGELOG.md` with a new top entry**

Add a release section above `0.33.0`, for example:

```md
## [0.34.0] - 2026-04-09

### 对象推导增强

- 新增跨文件对象方法返回传播：`c = B->method()` 现在可根据目标方法的 `@lpc-return-objects` 继续推导 `c`
- 支持多候选对象分别沿继承链定位实际命中的方法实现，并合并返回对象候选
- 多实现对象方法悬停现在按实现分块展示完整文档
- 当某个实际命中实现缺少 `@lpc-return-objects` 时，推导保守降级并给出明确说明
```

- [ ] **Step 4: Bump the extension version in `package.json`**

Change:

```json
"version": "0.33.0"
```

to:

```json
"version": "0.34.0"
```

- [ ] **Step 5: Verify the release docs and version together**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts && npx tsc --noEmit`

Expected: PASS, plus manual confirmation that `README.md`, `CHANGELOG.md`, and `package.json` all reflect the shipped behavior.

- [ ] **Step 6: Commit the release-facing updates**

```bash
git add README.md CHANGELOG.md package.json
git commit -m "docs: document object method return propagation"
```

### Task 7: Run Full Focused Verification

**Files:**
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
- Test: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`
- Test: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Run the full focused object-inference suite**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/providerIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the TypeScript verification**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Build the extension bundle**

Run: `npm run build`

Expected: PASS with regenerated parser artifacts and a clean `dist/` bundle.

- [ ] **Step 4: Package the VSIX for release validation**

Run: `npm run package`

Expected: PASS and a new `lpc-support-0.34.0.vsix` at repo root.

- [ ] **Step 5: Commit the completed feature branch state**

```bash
git add src/objectInference src/definitionProvider.ts src/objectInference/__tests__/ObjectInferenceService.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/providerIntegration.test.ts README.md CHANGELOG.md package.json
git commit -m "feat(object-inference): propagate object method return annotations"
```

## Self-Review

- Spec coverage: covered propagation for single and multi-candidate receivers, shared-base deduplication, override dispatch, conservative downgrade rules, hover multi-implementation display, and structured diagnostics.
- Placeholder scan: no `TODO`, `TBD`, or “similar to task N” shortcuts remain; each task includes concrete files, commands, and code snippets.
- Type consistency: the plan consistently uses `ObjectMethodReturnResolver`, `ObjectInferenceDiagnostic`, `resolveMemberCallReturnOutcome`, and a version bump to `0.34.0`.
