# V1 对象推导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `definition`、`completion`、`hover` 三条链路提供统一的 V1 对象推导能力，支持宏路径、强规则对象函数、当前函数内变量追踪、`if/else` 并集和 `@lpc-return-objects` 文档补充。

**Architecture:** 新增 `src/objectInference/` 目录承载按请求计算的共享对象推导服务，复用现有 `ASTManager`、`MacroManager`、`PathResolver`、继承链查找和文档解析能力，不把控制流推导塞进 `SemanticSnapshot`。`definition`、`completion` 和新增的对象 hover provider 只消费统一的 `ObjectInferenceResult`，`EfunHoverProvider` 继续负责 efun / simul_efun 文档并保持 `->` 场景不回退。

**Tech Stack:** TypeScript, VS Code Extension API, Jest, ts-jest

**Spec:** `docs/superpowers/specs/2026-04-08-v1-object-inference-design.md`

**Primary validation:** `npx tsc --noEmit`

**Targeted test suites:** `npx jest --runInBand src/efun/__tests__/docParser.test.ts src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/modules/__tests__/languageModule.test.ts`

---

## File Structure

### New files
- `src/objectInference/types.ts` - 定义统一的对象推导结果、接收者分类结果和中间 tracing 类型
- `src/objectInference/ReceiverClassifier.ts` - 识别字符串路径、宏、变量、参数、函数返回、数组元素等接收者类型
- `src/objectInference/ReceiverTraceService.ts` - 在当前函数体内追踪变量来源，并处理 `if/else` 分支并集
- `src/objectInference/ReturnObjectResolver.ts` - 解析 `this_object()`、`load_object()`、`find_object()`、`clone_object()` 和 doc 返回对象集合
- `src/objectInference/ObjectCandidateResolver.ts` - 宏展开、路径归一化、去重与 `resolved/multiple/unknown/unsupported` 归类
- `src/objectInference/ObjectInferenceService.ts` - 共享入口，供 definition/completion/hover 调用
- `src/objectInference/ObjectHoverProvider.ts` - 基于对象推导结果显示对象方法 hover 文档
- `src/objectInference/__tests__/ObjectInferenceService.test.ts` - 覆盖对象推导核心规则的单测
- `src/objectInference/__tests__/ObjectHoverProvider.test.ts` - 覆盖对象 hover 的 provider 级测试
- `src/efun/__tests__/docParser.test.ts` - 锁定 `@lpc-return-objects` 解析

### Modified files
- `src/efun/types.ts` - 给 doc 模型增加返回对象集合字段
- `src/efun/docParser.ts` - 解析 `@lpc-return-objects` 标签，并修正现有 tag 边界匹配
- `src/definitionProvider.ts` - 接入 `ObjectInferenceService`，以对象候选集合驱动定义跳转
- `src/completionProvider.ts` - 让 completion provider 接收共享对象推导服务
- `src/modules/languageModule.ts` - 在语言模块中创建共享对象推导服务，注入 definition/completion/object hover provider，并保留现有宏 hover provider
- `src/__tests__/providerIntegration.test.ts` - 增加 definition 的单对象、多对象和不支持场景回归
- `src/__tests__/completionProvider.test.ts` - 增加 completion 的真实对象候选、并集排序和不支持场景回归
- `src/modules/__tests__/languageModule.test.ts` - 更新 hover provider 注册断言与订阅数量

### Existing references
- `src/definitionProvider.ts:51-72` - 当前 definition 主入口
- `src/definitionProvider.ts:188-232` - 当前对象访问识别与处理逻辑
- `src/definitionProvider.ts:421-588` - 当前对象路径解析、对象访问信息结构与提取逻辑
- `src/completion/completionQueryEngine.ts:251-287` - 当前 `member` completion 主逻辑
- `src/completion/completionQueryEngine.ts:420-476` - 当前接收者类型与通用 object 方法逻辑
- `src/modules/languageModule.ts:17-84` - 当前语言 provider 注册点
- `src/efun/docParser.ts:79-153` - 当前函数 doc 标签提取与解析逻辑

---

## Chunk 1: 先让文档系统支持返回对象集合

### Task 1: 解析 `@lpc-return-objects`

**Files:**
- Create: `src/efun/__tests__/docParser.test.ts`
- Modify: `src/efun/types.ts`
- Modify: `src/efun/docParser.ts`

- [ ] **Step 1: 先写失败测试，锁定 `@lpc-return-objects` 会被解析成路径数组**

在 `src/efun/__tests__/docParser.test.ts` 新增测试文件，直接覆盖 `parseFunctionDocs()`。测试代码写成：

```ts
import { parseFunctionDocs } from '../docParser';

describe('parseFunctionDocs', () => {
    test('parses @lpc-return-objects into returnObjects', () => {
        const docs = parseFunctionDocs([
            '/**',
            ' * @brief helper docs',
            ' * @return object 返回对象',
            ' * @lpc-return-objects {"/adm/daemons/combat_d", "ROOM_D"}',
            ' */',
            'object helper() {',
            '    return this_object();',
            '}'
        ].join('\n'), '当前文件');

        expect(docs.get('helper')).toMatchObject({
            name: 'helper',
            returnType: 'object',
            returnObjects: ['/adm/daemons/combat_d', 'ROOM_D']
        });
    });

    test('keeps @return parsing bounded when @lpc-return-objects follows it', () => {
        const docs = parseFunctionDocs([
            '/**',
            ' * @brief helper docs',
            ' * @return object 返回对象',
            ' * @lpc-return-objects {"/adm/daemons/combat_d"}',
            ' */',
            'object helper() {',
            '    return this_object();',
            '}'
        ].join('\n'), '当前文件');

        expect(docs.get('helper')?.returnValue).toBe('object 返回对象');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/efun/__tests__/docParser.test.ts`

Expected: FAIL，报出 `returnObjects` 缺失，且第二个测试会暴露 `@return` 的边界匹配把 `@lpc-return-objects` 一起吞进去。

- [ ] **Step 3: 扩展 doc 类型与 tag 解析器**

先在 `src/efun/types.ts` 的 `EfunDoc` 上增加字段：

```ts
export interface EfunDoc {
    name: string;
    syntax: string;
    description: string;
    returnType?: string;
    returnValue?: string;
    returnObjects?: string[];
    example?: string;
    details?: string;
    reference?: string[];
    category?: string;
    lastUpdated?: number;
    isSimulated?: boolean;
    note?: string;
}
```

然后在 `src/efun/docParser.ts` 里做 3 个精确修改：

1. 把 `extractTagBlock()` 的 lookahead 从 `(?=\n@\w+|$)` 改成支持横杠标签名的版本。
2. 新增一个只解析 `{"...", "..."}` 风格内容的 helper。
3. 在 `parseFunctionDocs()` 中把解析结果写回 `doc.returnObjects`。

把 helper 和正则改成下面这样：

```ts
function parseReturnObjects(docComment: string): string[] | undefined {
    const block = extractTagBlock(docComment, 'lpc-return-objects');
    if (!block) {
        return undefined;
    }

    const normalized = block.trim();
    const jsonLike = normalized.replace(/^\{/, '[').replace(/\}$/, ']');

    try {
        const parsed = JSON.parse(jsonLike);
        if (!Array.isArray(parsed)) {
            return undefined;
        }

        const values = parsed
            .filter((value): value is string => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean);

        return values.length > 0 ? values : undefined;
    } catch {
        return undefined;
    }
}

export function extractTagBlock(docComment: string, tag: string): string | undefined {
    const normalizedComment = normalizeDocComment(docComment);
    const regex = new RegExp(`(?:^|\\n)@${tag}\\s+([\\s\\S]*?)(?=\\n@[A-Za-z][A-Za-z0-9-]*|$)`, 'i');
    const match = normalizedComment.match(regex);

    if (!match) {
        return undefined;
    }

    const value = match[1]
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim();

    return value || undefined;
}
```

在 `parseFunctionDocs()` 中把 `returnObjects` 写入文档：

```ts
            const returnObjects = parseReturnObjects(docComment);
            if (returnObjects) {
                doc.returnObjects = returnObjects;
            }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/efun/__tests__/docParser.test.ts`

Expected: PASS

- [ ] **Step 5: 提交文档解析改动**

```bash
git add src/efun/types.ts src/efun/docParser.ts src/efun/__tests__/docParser.test.ts
git commit -m "feat(object-inference): parse documented return objects"
```

---

## Chunk 2: 建立对象推导骨架与强规则

### Task 2: 新增共享对象推导服务并支持字面量、宏和强规则调用

**Files:**
- Create: `src/objectInference/types.ts`
- Create: `src/objectInference/ReceiverClassifier.ts`
- Create: `src/objectInference/ReceiverTraceService.ts`
- Create: `src/objectInference/ReturnObjectResolver.ts`
- Create: `src/objectInference/ObjectCandidateResolver.ts`
- Create: `src/objectInference/ObjectInferenceService.ts`
- Create: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定强规则与不支持场景**

在 `src/objectInference/__tests__/ObjectInferenceService.test.ts` 中先写 5 个用例：

```ts
test('resolves this_object() to the current document path', async () => {
    const document = createDocument(path.join(fixtureRoot, 'room.c'), 'void demo() { this_object()->query("id"); }');
    const result = await service.inferObjectAccess(document, new vscode.Position(0, 28));

    expect(result?.inference).toMatchObject({
        status: 'resolved',
        candidates: [{ path: path.join(fixtureRoot, 'room.c'), source: 'builtin-call' }]
    });
});

test('resolves load_object string paths', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), 'void demo() { load_object("/adm/daemons/combat_d")->start(); }');
    const result = await service.inferObjectAccess(document, new vscode.Position(0, 51));

    expect(result?.inference.candidates.map(item => item.path)).toEqual([
        path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c')
    ]);
});

test('resolves macro object paths', async () => {
    macroManager.getMacro.mockReturnValue({ name: 'COMBAT_D', value: '"/adm/daemons/combat_d"' });
    const document = createDocument(path.join(fixtureRoot, 'main.c'), 'void demo() { COMBAT_D->start(); }');
    const result = await service.inferObjectAccess(document, new vscode.Position(0, 25));

    expect(result?.inference).toMatchObject({ status: 'resolved' });
});

test('resolves find_object and clone_object using the same path rule', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), [
        'void demo() {',
        '    find_object("/adm/daemons/combat_d")->query();',
        '    clone_object("/adm/daemons/combat_d")->query();',
        '}'
    ].join('\n'));

    const findResult = await service.inferObjectAccess(document, new vscode.Position(1, 43));
    const cloneResult = await service.inferObjectAccess(document, new vscode.Position(2, 44));

    expect(findResult?.inference.status).toBe('resolved');
    expect(cloneResult?.inference.status).toBe('resolved');
});

test('marks array element receivers as unsupported', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), 'void demo(mixed *arr) { arr[0]->query(); }');
    const result = await service.inferObjectAccess(document, new vscode.Position(0, 33));

    expect(result?.inference).toMatchObject({
        status: 'unsupported',
        reason: 'array-element'
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts`

Expected: FAIL，因为 `src/objectInference/` 目录和服务还不存在。

- [ ] **Step 3: 先实现类型、分类器、返回值解析器和总入口的最小版本**

按下面的文件骨架创建对象推导目录。

`src/objectInference/types.ts`：

```ts
import * as vscode from 'vscode';
import { SyntaxNode } from '../syntax/types';

export type ObjectCandidateSource = 'literal' | 'macro' | 'builtin-call' | 'assignment' | 'doc';
export type ObjectInferenceStatus = 'resolved' | 'multiple' | 'unknown' | 'unsupported';
export type ReceiverKind = 'literal' | 'macro' | 'identifier' | 'call' | 'parameter' | 'index' | 'unsupported';

export interface ObjectCandidate {
    path: string;
    source: ObjectCandidateSource;
}

export interface ObjectInferenceResult {
    status: ObjectInferenceStatus;
    candidates: ObjectCandidate[];
    reason?: 'array-element' | 'unsupported-expression' | 'untracked-variable' | 'missing-doc-objects';
}

export interface ClassifiedReceiver {
    kind: ReceiverKind;
    node: SyntaxNode;
    identifierName?: string;
    callName?: string;
    argumentTexts?: string[];
}

export interface InferredObjectAccess {
    memberName: string;
    receiver: SyntaxNode;
    inference: ObjectInferenceResult;
    range: vscode.Range;
}
```

`src/objectInference/ReceiverClassifier.ts`：

```ts
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ClassifiedReceiver } from './types';

export class ReceiverClassifier {
    public classify(node: SyntaxNode): ClassifiedReceiver {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.classify(node.children[0]);
        }

        if (node.kind === SyntaxKind.IndexExpression) {
            return { kind: 'index', node };
        }

        if (node.kind === SyntaxKind.Literal) {
            const text = typeof node.metadata?.text === 'string' ? node.metadata.text : '';
            if (text.startsWith('"') && text.endsWith('"')) {
                return { kind: 'literal', node };
            }
        }

        if (node.kind === SyntaxKind.Identifier && node.name) {
            if (/^[A-Z_][A-Z0-9_]*$/.test(node.name)) {
                return { kind: 'macro', node, identifierName: node.name };
            }

            return { kind: 'identifier', node, identifierName: node.name };
        }

        if (node.kind === SyntaxKind.CallExpression) {
            const callee = node.children[0];
            if (callee?.kind === SyntaxKind.Identifier && callee.name) {
                return {
                    kind: 'call',
                    node,
                    callName: callee.name,
                    argumentTexts: node.children[1]?.children.map(child => String(child.metadata?.text ?? child.name ?? '')).filter(Boolean)
                };
            }
        }

        return { kind: 'unsupported', node };
    }
}
```

`src/objectInference/ReturnObjectResolver.ts`：

```ts
import * as vscode from 'vscode';
import { MacroManager } from '../macroManager';
import { PathResolver } from '../utils/pathResolver';
import { ClassifiedReceiver, ObjectCandidate } from './types';

export class ReturnObjectResolver {
    constructor(private readonly macroManager: MacroManager) {}

    public async resolveCall(document: vscode.TextDocument, receiver: ClassifiedReceiver): Promise<ObjectCandidate[] | undefined> {
        if (receiver.kind !== 'call' || !receiver.callName) {
            return undefined;
        }

        if (receiver.callName === 'this_object') {
            return [{ path: document.uri.fsPath, source: 'builtin-call' }];
        }

        if (!['load_object', 'find_object', 'clone_object'].includes(receiver.callName)) {
            return undefined;
        }

        const firstArgument = receiver.argumentTexts?.[0];
        if (!firstArgument) {
            return undefined;
        }

        const resolvedPath = await PathResolver.resolveObjectPath(document, firstArgument, this.macroManager);
        return resolvedPath ? [{ path: resolvedPath, source: 'builtin-call' }] : undefined;
    }
}
```

`src/objectInference/ObjectCandidateResolver.ts`：

```ts
import { ObjectCandidate, ObjectInferenceResult } from './types';

export class ObjectCandidateResolver {
    public resolve(candidates: ObjectCandidate[], reason?: ObjectInferenceResult['reason']): ObjectInferenceResult {
        const deduped = Array.from(new Map(candidates.map(item => [item.path, item])).values());
        if (deduped.length === 0) {
            return reason
                ? { status: 'unsupported', candidates: [], reason }
                : { status: 'unknown', candidates: [], reason: 'untracked-variable' };
        }

        return deduped.length === 1
            ? { status: 'resolved', candidates: deduped }
            : { status: 'multiple', candidates: deduped };
    }
}
```

`src/objectInference/ReceiverTraceService.ts`：

```ts
import * as vscode from 'vscode';
import { ClassifiedReceiver, ObjectCandidate } from './types';

export class ReceiverTraceService {
    public async traceVariable(_document: vscode.TextDocument, _position: vscode.Position, _receiver: ClassifiedReceiver): Promise<ObjectCandidate[] | undefined> {
        return undefined;
    }
}
```

`src/objectInference/ObjectInferenceService.ts`：

```ts
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { MacroManager } from '../macroManager';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { ObjectCandidateResolver } from './ObjectCandidateResolver';
import { ReceiverClassifier } from './ReceiverClassifier';
import { ReceiverTraceService } from './ReceiverTraceService';
import { ReturnObjectResolver } from './ReturnObjectResolver';
import { InferredObjectAccess, ObjectCandidate } from './types';

export class ObjectInferenceService {
    private readonly astManager = ASTManager.getInstance();
    private readonly classifier = new ReceiverClassifier();
    private readonly tracer = new ReceiverTraceService();
    private readonly candidateResolver = new ObjectCandidateResolver();
    private readonly returnResolver: ReturnObjectResolver;

    constructor(private readonly macroManager: MacroManager) {
        this.returnResolver = new ReturnObjectResolver(macroManager);
    }

    public async inferObjectAccess(document: vscode.TextDocument, position: vscode.Position): Promise<InferredObjectAccess | undefined> {
        const syntax = this.getSyntaxDocument(document);
        if (!syntax) {
            return undefined;
        }

        const objectAccess = this.findObjectAccess(syntax, position);
        if (!objectAccess) {
            return undefined;
        }

        const classified = this.classifier.classify(objectAccess.receiver);
        if (classified.kind === 'index') {
            return {
                memberName: objectAccess.memberName,
                receiver: objectAccess.receiver,
                range: objectAccess.range,
                inference: { status: 'unsupported', candidates: [], reason: 'array-element' }
            };
        }

        let candidates: ObjectCandidate[] | undefined;
        if (classified.kind === 'literal' || classified.kind === 'macro' || classified.kind === 'call') {
            candidates = await this.returnResolver.resolveCall(document, classified);
        }

        if (!candidates && classified.kind === 'identifier') {
            candidates = await this.tracer.traceVariable(document, position, classified);
        }

        return {
            memberName: objectAccess.memberName,
            receiver: objectAccess.receiver,
            range: objectAccess.range,
            inference: this.candidateResolver.resolve(candidates || [])
        };
    }

    private getSyntaxDocument(document: vscode.TextDocument): SyntaxDocument | undefined {
        return this.astManager.getSyntaxDocument(document, false) ?? this.astManager.getSyntaxDocument(document, true);
    }

    private findObjectAccess(syntax: SyntaxDocument, position: vscode.Position): { memberName: string; receiver: SyntaxNode; range: vscode.Range } | undefined {
        const candidates = [...syntax.nodes]
            .filter(node => node.range.contains(position))
            .sort((left, right) => (left.range.end.line - left.range.start.line) - (right.range.end.line - right.range.start.line));

        for (const node of candidates) {
            const target = node.kind === SyntaxKind.CallExpression ? node.children[0] : node;
            if (!target || target.kind !== SyntaxKind.MemberAccessExpression || target.children.length < 2) {
                continue;
            }

            const memberNode = target.children[1];
            if (memberNode.kind !== SyntaxKind.Identifier || !memberNode.name || !memberNode.range.contains(position)) {
                continue;
            }

            return {
                memberName: memberNode.name,
                receiver: target.children[0],
                range: target.range
            };
        }

        return undefined;
    }
}
```

这里的 `ReceiverTraceService` 是一个合法的“当前 task 不解析变量来源”实现；Task 3 会把它替换成真正的当前函数体追踪版本。

- [ ] **Step 4: 运行测试确认强规则通过**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts`

Expected: PASS，至少 `this_object()`、三类对象函数、宏路径和 `arr[i]` 的 `unsupported` 应全部通过。

- [ ] **Step 5: 提交对象推导骨架**

```bash
git add src/objectInference/types.ts src/objectInference/ReceiverClassifier.ts src/objectInference/ReceiverTraceService.ts src/objectInference/ReturnObjectResolver.ts src/objectInference/ObjectCandidateResolver.ts src/objectInference/ObjectInferenceService.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "feat(object-inference): add object inference skeleton"
```

---

## Chunk 3: 补上变量追踪、并集和 doc 返回对象

### Task 3: 在当前函数内追踪变量来源，并消费 `@lpc-return-objects`

**Files:**
- Modify: `src/objectInference/ReceiverTraceService.ts`
- Modify: `src/objectInference/ReturnObjectResolver.ts`
- Modify: `src/objectInference/ObjectInferenceService.ts`
- Modify: `src/objectInference/__tests__/ObjectInferenceService.test.ts`

- [ ] **Step 1: 先补失败测试，锁定变量追踪、并集和 doc 返回对象**

在 `src/objectInference/__tests__/ObjectInferenceService.test.ts` 增加 4 个用例：

```ts
test('traces a local variable assigned from load_object', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), [
        'void demo() {',
        '    object c;',
        '    c = load_object("/adm/daemons/combat_d");',
        '    c->query("id");',
        '}'
    ].join('\n'));

    const result = await service.inferObjectAccess(document, new vscode.Position(3, 8));
    expect(result?.inference).toMatchObject({ status: 'resolved' });
});

test('merges if/else assignments into multiple object candidates', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), [
        'void demo() {',
        '    object c;',
        '    if (random(2)) {',
        '        c = load_object("/adm/daemons/combat_d");',
        '    } else {',
        '        c = load_object("/d/city/npc/guard");',
        '    }',
        '    c->query("id");',
        '}'
    ].join('\n'));

    const result = await service.inferObjectAccess(document, new vscode.Position(7, 8));
    expect(result?.inference).toMatchObject({ status: 'multiple' });
    expect(result?.inference.candidates).toHaveLength(2);
});

test('reads custom function return objects from doc comments', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), [
        '/**',
        ' * @brief helper docs',
        ' * @return object 返回对象',
        ' * @lpc-return-objects {"/adm/daemons/combat_d", "/d/city/npc/guard"}',
        ' */',
        'object helper() {',
        '    return 0;',
        '}',
        'void demo() {',
        '    helper()->query("id");',
        '}'
    ].join('\n'));

    const result = await service.inferObjectAccess(document, new vscode.Position(9, 15));
    expect(result?.inference).toMatchObject({ status: 'multiple' });
});

test('classifies bare object parameters as unknown instead of unsupported', async () => {
    const document = createDocument(path.join(fixtureRoot, 'main.c'), 'void demo(object ob) { ob->query("id"); }');
    const result = await service.inferObjectAccess(document, new vscode.Position(0, 28));

    expect(result?.inference).toMatchObject({
        status: 'unknown',
        reason: 'untracked-variable'
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts`

Expected: FAIL，因为 `ReceiverTraceService` 当前还不会从函数体里提取来源表达式，`ReturnObjectResolver` 也还没消费 doc `returnObjects`。

- [ ] **Step 3: 实现当前函数内的变量追踪和 `if/else` 并集**

把 `src/objectInference/ReceiverTraceService.ts` 替换成基于语法树的当前函数体追踪器。实现要点：

- 先找到包含当前位置的最小 `FunctionDeclaration`
- 只遍历这个函数中在当前位置之前结束的节点
- 支持两类来源：
  - `VariableDeclarator` 初始化表达式
  - `AssignmentExpression` 的右值
- `IfStatement` 两分支分别收集，再合并候选结果

把整个文件改成：

```ts
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ClassifiedReceiver, ObjectCandidate } from './types';
import { ReturnObjectResolver } from './ReturnObjectResolver';

export class ReceiverTraceService {
    private readonly astManager = ASTManager.getInstance();

    constructor(private readonly returnResolver: ReturnObjectResolver) {}

    public async traceVariable(document: vscode.TextDocument, position: vscode.Position, receiver: ClassifiedReceiver): Promise<ObjectCandidate[] | undefined> {
        if (!receiver.identifierName) {
            return undefined;
        }

        const syntax = this.astManager.getSyntaxDocument(document, false) ?? this.astManager.getSyntaxDocument(document, true);
        if (!syntax) {
            return undefined;
        }

        const functionNode = [...syntax.nodes]
            .filter(node => node.kind === SyntaxKind.FunctionDeclaration && node.range.contains(position))
            .sort((left, right) => {
                const leftSize = (left.range.end.line - left.range.start.line) * 10_000 + (left.range.end.character - left.range.start.character);
                const rightSize = (right.range.end.line - right.range.start.line) * 10_000 + (right.range.end.character - right.range.start.character);
                return leftSize - rightSize;
            })[0];

        if (!functionNode) {
            return undefined;
        }

        return this.collectFromNode(document, functionNode, receiver.identifierName, position);
    }

    private async collectFromNode(
        document: vscode.TextDocument,
        node: SyntaxNode,
        variableName: string,
        usagePosition: vscode.Position
    ): Promise<ObjectCandidate[] | undefined> {
        if (node.range.start.isAfter(usagePosition)) {
            return undefined;
        }

        if (node.kind === SyntaxKind.VariableDeclarator && node.name === variableName && node.children[1]) {
            return this.returnResolver.resolveExpression(document, node.children[1]);
        }

        if (node.kind === SyntaxKind.AssignmentExpression && node.children[0]?.kind === SyntaxKind.Identifier && node.children[0].name === variableName) {
            return this.returnResolver.resolveExpression(document, node.children[1]);
        }

        if (node.kind === SyntaxKind.IfStatement) {
            const thenCandidates = node.children[1]
                ? await this.collectFromNode(document, node.children[1], variableName, usagePosition)
                : undefined;
            const elseCandidates = node.children[2]
                ? await this.collectFromNode(document, node.children[2], variableName, usagePosition)
                : undefined;
            return [...(thenCandidates || []), ...(elseCandidates || [])];
        }

        const collected: ObjectCandidate[] = [];
        for (const child of node.children) {
            if (child.range.start.isAfter(usagePosition)) {
                continue;
            }

            const nested = await this.collectFromNode(document, child, variableName, usagePosition);
            if (nested) {
                collected.push(...nested);
            }
        }

        return collected.length > 0 ? collected : undefined;
    }
}
```

- [ ] **Step 4: 让 doc 返回对象和参数 `unknown` 真正参与解析**

在 `src/objectInference/ReturnObjectResolver.ts` 中新增一个 `resolveExpression()`，让 trace 找到的右值表达式也能复用同一套规则；同时支持当前文件 doc 注释里的 `returnObjects`。

把类扩成下面这样：

```ts
import * as vscode from 'vscode';
import { parseFunctionDocs } from '../efun/docParser';
import { MacroManager } from '../macroManager';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { PathResolver } from '../utils/pathResolver';
import { ClassifiedReceiver, ObjectCandidate } from './types';

export class ReturnObjectResolver {
    constructor(private readonly macroManager: MacroManager) {}

    public async resolveExpression(document: vscode.TextDocument, expression: SyntaxNode): Promise<ObjectCandidate[] | undefined> {
        if (expression.kind === SyntaxKind.Literal) {
            const text = typeof expression.metadata?.text === 'string' ? expression.metadata.text : '';
            const resolvedPath = await PathResolver.resolveObjectPath(document, text, this.macroManager);
            return resolvedPath ? [{ path: resolvedPath, source: 'literal' }] : undefined;
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name && /^[A-Z_][A-Z0-9_]*$/.test(expression.name)) {
            const resolvedPath = await PathResolver.resolveObjectPath(document, expression.name, this.macroManager);
            return resolvedPath ? [{ path: resolvedPath, source: 'macro' }] : undefined;
        }

        const classified = this.classifyCall(expression);
        if (!classified) {
            return undefined;
        }

        if (classified.callName === 'this_object') {
            return [{ path: document.uri.fsPath, source: 'builtin-call' }];
        }

        if (['load_object', 'find_object', 'clone_object'].includes(classified.callName)) {
            const firstArgument = classified.argumentTexts?.[0];
            if (!firstArgument) {
                return undefined;
            }

            const resolvedPath = await PathResolver.resolveObjectPath(document, firstArgument, this.macroManager);
            return resolvedPath ? [{ path: resolvedPath, source: 'builtin-call' }] : undefined;
        }

        const docs = parseFunctionDocs(document.getText(), '当前文件');
        const doc = docs.get(classified.callName);
        if (!doc?.returnObjects || doc.returnObjects.length === 0) {
            return undefined;
        }

        const resolved = await Promise.all(doc.returnObjects.map(async item => {
            const path = await PathResolver.resolveObjectPath(document, item.startsWith('"') ? item : `"${item}"`, this.macroManager)
                ?? await PathResolver.resolveObjectPath(document, item, this.macroManager);
            return path ? { path, source: 'doc' as const } : undefined;
        }));

        return resolved.filter((item): item is ObjectCandidate => Boolean(item));
    }

    private classifyCall(node: SyntaxNode): ClassifiedReceiver | undefined {
        if (node.kind !== SyntaxKind.CallExpression) {
            return undefined;
        }

        const callee = node.children[0];
        if (!callee || callee.kind !== SyntaxKind.Identifier || !callee.name) {
            return undefined;
        }

        return {
            kind: 'call',
            node,
            callName: callee.name,
            argumentTexts: node.children[1]?.children.map(child => String(child.metadata?.text ?? child.name ?? '')).filter(Boolean)
        };
    }
}
```

最后在 `ObjectInferenceService` 里把 `tracer` 初始化改为 `new ReceiverTraceService(this.returnResolver)`，并让 `identifier` 分支通过 tracer 获得候选；参数名但无来源时返回：

```ts
        if (!candidates && (classified.kind === 'identifier' || classified.kind === 'parameter')) {
            candidates = await this.tracer.traceVariable(document, position, classified);
        }

        const inference = candidates
            ? this.candidateResolver.resolve(candidates)
            : this.candidateResolver.resolve([], classified.kind === 'index' ? 'array-element' : 'untracked-variable');
```

这里要把 `ObjectCandidateResolver.resolve()` 改成：

```ts
    public resolve(candidates: ObjectCandidate[], reason: ObjectInferenceResult['reason'] = 'untracked-variable'): ObjectInferenceResult {
        const deduped = Array.from(new Map(candidates.map(item => [item.path, item])).values());
        if (deduped.length === 0) {
            return reason === 'array-element' || reason === 'unsupported-expression'
                ? { status: 'unsupported', candidates: [], reason }
                : { status: 'unknown', candidates: [], reason };
        }

        return deduped.length === 1
            ? { status: 'resolved', candidates: deduped }
            : { status: 'multiple', candidates: deduped };
    }
```

- [ ] **Step 5: 运行对象推导单测确认通过**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectInferenceService.test.ts`

Expected: PASS，新增的变量追踪、并集、doc 返回对象和参数 `unknown` 行为都通过。

- [ ] **Step 6: 提交变量追踪实现**

```bash
git add src/objectInference/ReceiverTraceService.ts src/objectInference/ReturnObjectResolver.ts src/objectInference/ObjectInferenceService.ts src/objectInference/ObjectCandidateResolver.ts src/objectInference/__tests__/ObjectInferenceService.test.ts
git commit -m "feat(object-inference): trace local object sources"
```

---

## Chunk 4: 让 definition 消费对象推导结果

### Task 4: 用对象候选集合驱动 `->` 定义跳转

**Files:**
- Modify: `src/definitionProvider.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: 先写失败测试，锁定单对象、多对象与不支持场景**

在 `src/__tests__/providerIntegration.test.ts` 现有 definition 回归后追加 3 个用例：

```ts
test('definition resolves this_object() member calls to the current file', async () => {
    const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
    const document = createDocument(
        path.join(fixtureRoot, 'self.c'),
        [
            'string query_self() {',
            '    return "ok";',
            '}',
            '',
            'void demo() {',
            '    this_object()->query_self();',
            '}'
        ].join('\n')
    );

    const definition = await provider.provideDefinition(document, new vscode.Position(5, 19), {} as vscode.CancellationToken) as vscode.Location;
    expect(definition.uri.fsPath).toBe(document.uri.fsPath);
    expect(definition.range.line).toBe(0);
});

test('definition returns multiple locations for merged object candidates with separate implementations', async () => {
    const daemonFile = path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c');
    const guardFile = path.join(fixtureRoot, 'd', 'city', 'npc', 'guard.c');
    fs.mkdirSync(path.dirname(daemonFile), { recursive: true });
    fs.mkdirSync(path.dirname(guardFile), { recursive: true });
    fs.writeFileSync(daemonFile, 'string query_name() { return "combat"; }\n');
    fs.writeFileSync(guardFile, 'string query_name() { return "guard"; }\n');

    (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
        const content = fs.readFileSync(uri.fsPath, 'utf8');
        return createDocument(uri.fsPath, content);
    });

    const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
    const document = createDocument(
        path.join(fixtureRoot, 'branch.c'),
        [
            'void demo() {',
            '    object c;',
            '    if (random(2)) {',
            '        c = load_object("/adm/daemons/combat_d");',
            '    } else {',
            '        c = load_object("/d/city/npc/guard");',
            '    }',
            '    c->query_name();',
            '}'
        ].join('\n')
    );

    const definition = await provider.provideDefinition(document, new vscode.Position(7, 11), {} as vscode.CancellationToken) as vscode.Location[];
    expect(definition).toHaveLength(2);
});

test('definition returns undefined for unsupported array element receivers without efun fallback', async () => {
    const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
    const document = createDocument(path.join(fixtureRoot, 'unsupported.c'), 'void demo(mixed *arr) { arr[0]->query(); }');
    const definition = await provider.provideDefinition(document, new vscode.Position(0, 31), {} as vscode.CancellationToken);

    expect(definition).toBeUndefined();
    expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

Expected: FAIL，因为 `definitionProvider` 还不知道共享对象推导结果，也不会返回多位置。

- [ ] **Step 3: 让 `LPCDefinitionProvider` 接入对象推导服务并支持多结果**

在 `src/definitionProvider.ts` 做 4 个改动：

1. 构造函数增加可选 `objectInferenceService`，默认自己 new 一个，避免现有测试全部重写。
2. `provideDefinition()` 一旦命中 `->`，直接让对象推导服务处理，不再自己解析 `ObjectAccessInfo`。
3. 保留现有“普通函数/宏/include”链路给非对象访问场景。
4. 当推导结果为 `multiple` 时返回 `vscode.Location[]`。

把构造函数和入口改成：

```ts
import { ObjectInferenceService } from './objectInference/ObjectInferenceService';

export class LPCDefinitionProvider implements vscode.DefinitionProvider {
    private readonly objectInferenceService: ObjectInferenceService;

    constructor(
        macroManager: MacroManager,
        efunDocsManager: EfunDocsManager,
        objectInferenceService?: ObjectInferenceService
    ) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
        this.astManager = ASTManager.getInstance();
        this.objectInferenceService = objectInferenceService ?? new ObjectInferenceService(macroManager);
    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken) {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const inferredAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (inferredAccess && inferredAccess.memberName === word) {
            return this.handleInferredObjectAccess(document, inferredAccess);
        }

        const directDefinition = await this.resolveDirectDefinition(document, position, word);
        if (directDefinition) {
            return directDefinition;
        }

        return this.findFunctionDefinition(document, word);
    }
}
```

新增 `handleInferredObjectAccess()`：

```ts
    private async handleInferredObjectAccess(
        document: vscode.TextDocument,
        inferredAccess: InferredObjectAccess
    ): Promise<vscode.Location | vscode.Location[] | undefined> {
        if (inferredAccess.inference.status === 'unknown' || inferredAccess.inference.status === 'unsupported') {
            return undefined;
        }

        const locations = (await Promise.all(
            inferredAccess.inference.candidates.map(candidate => this.findMethodInTargetChain(document, candidate.path, inferredAccess.memberName))
        )).filter((location): location is vscode.Location => Boolean(location));

        if (locations.length === 0) {
            return undefined;
        }

        const uniqueLocations = Array.from(new Map(locations.map(location => [`${location.uri.fsPath}:${location.range.start.line}:${location.range.start.character}`, location])).values());
        return uniqueLocations.length === 1 ? uniqueLocations[0] : uniqueLocations;
    }
```

把老的 `ObjectAccessInfo`、`analyzeObjectAccessWithAST()`、`tryBuildObjectAccessInfo()`、`extractObjectReceiver()`、`resolveObjectAccessTargetPath()` 相关分支删掉，避免两套对象访问来源逻辑并存。

- [ ] **Step 4: 运行 definition 回归集确认通过**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

Expected: PASS，原来的“不回退 simul_efun”回归继续通过，新增 `this_object()`、多 location 和数组不支持场景也通过。

- [ ] **Step 5: 提交 definition 接入**

```bash
git add src/definitionProvider.ts src/__tests__/providerIntegration.test.ts
git commit -m "feat(definition): use object inference for arrow calls"
```

---

## Chunk 5: 让 completion 优先返回真实对象方法

### Task 5: 在 `member` completion 中接入对象推导并处理并集排序

**Files:**
- Modify: `src/completionProvider.ts`
- Modify: `src/__tests__/completionProvider.test.ts`

- [ ] **Step 1: 先写失败测试，锁定真实对象候选、宏对象和公共方法排序**

在 `src/__tests__/completionProvider.test.ts` 末尾追加 3 个用例：

```ts
test('returns real object methods for this_object receivers', async () => {
    const document = createDocument(path.join(fixtureRoot, 'self.c'), [
        'string query_self() {',
        '    return "ok";',
        '}',
        '',
        'void demo() {',
        '    this_object()->query_',
        '}'
    ].join('\n'));

    const result = await provider.provideCompletionItems(document, new vscode.Position(5, '    this_object()->query_'.length), {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
    expect(result.map(item => item.label)).toContain('query_self');
});

test('uses macro object paths to build member completions', async () => {
    macroManager.getMacro.mockReturnValue({ name: 'COMBAT_D', value: '"/adm/daemons/combat_d"' });
    fs.mkdirSync(path.join(fixtureRoot, 'adm', 'daemons'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'string query_name() { return "combat"; }\n');
    const document = createDocument(path.join(fixtureRoot, 'macro.c'), 'void demo() { COMBAT_D->query_; }');

    const result = await provider.provideCompletionItems(document, new vscode.Position(0, 26), {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
    expect(result.map(item => item.label)).toContain('query_name');
});

test('sorts methods shared by all merged candidates ahead of candidate-specific methods', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'adm', 'daemons'), { recursive: true });
    fs.mkdirSync(path.join(fixtureRoot, 'd', 'city', 'npc'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), 'string query_name() { return "combat"; }\nstring shared_call() { return "shared"; }\n');
    fs.writeFileSync(path.join(fixtureRoot, 'd', 'city', 'npc', 'guard.c'), 'string guard_only() { return "guard"; }\nstring shared_call() { return "shared"; }\n');

    const document = createDocument(path.join(fixtureRoot, 'branch.c'), [
        'void demo() {',
        '    object c;',
        '    if (random(2)) {',
        '        c = load_object("/adm/daemons/combat_d");',
        '    } else {',
        '        c = load_object("/d/city/npc/guard");',
        '    }',
        '    c->',
        '}'
    ].join('\n'));

    const result = await provider.provideCompletionItems(document, new vscode.Position(7, '    c->'.length), {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
    const labels = result.map(item => item.label);
    expect(labels.indexOf('shared_call')).toBeLessThan(labels.indexOf('guard_only'));
});
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts`

Expected: FAIL，因为当前 `queryMemberCandidates()` 只会给简单类型成员或通用 object 方法。

- [ ] **Step 3: 给 completion provider 注入共享对象推导服务**

先在 `src/completionProvider.ts` 构造函数上增加可选依赖：

```ts
import { ObjectInferenceService } from './objectInference/ObjectInferenceService';

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider<vscode.CompletionItem> {
    private readonly objectInferenceService: ObjectInferenceService;

    constructor(
        efunDocsManager: EfunDocsManager,
        macroManager: MacroManager,
        instrumentation?: CompletionInstrumentation,
        objectInferenceService?: ObjectInferenceService
    ) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        this.astManager = ASTManager.getInstance();
        this.objectInferenceService = objectInferenceService ?? new ObjectInferenceService(this.macroManager);
        this.instrumentation = instrumentation ?? new CompletionInstrumentation();
        this.projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(this.macroManager));
        this.queryEngine = new CompletionQueryEngine({
            snapshotProvider: this.astManager,
            projectSymbolIndex: this.projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer(),
            macroManager: this.macroManager,
            efunProvider: {
                getAllFunctions: () => this.efunDocsManager.getAllFunctions(),
                getAllSimulatedFunctions: () => this.efunDocsManager.getAllSimulatedFunctions()
            }
        });
        this.staticItems = this.buildStaticItems();
    }
}
```

- [ ] **Step 4: 在 `provideCompletionItems()` 里异步消费对象推导结果并生成真实对象方法候选**

不要把 `CompletionQueryEngine` 改成同步对象推导器。保持它继续负责“上下文分析 + 原有基础候选”，把对象推导放到 `LPCCompletionItemProvider.provideCompletionItems()` 的异步层消费，这样可以合法使用 `await` 打开目标对象文件并递归收集继承链方法。

把 `provideCompletionItems()` 改成下面这种结构：

```ts
    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        const trace = this.instrumentation.startRequest({
            documentUri: document.uri.toString(),
            documentVersion: document.version,
            triggerKind: context.triggerKind,
            triggerCharacter: context.triggerCharacter
        });

        try {
            this.warmInheritedIndex(document);

            const result = this.queryEngine.query(document, position, context, token, trace);
            if (token.isCancellationRequested) {
                trace.complete(result.context.kind, 0);
                return [];
            }

            const inferredCandidates = result.context.kind === 'member'
                ? await this.buildObjectInferenceCandidates(document, position, token)
                : undefined;
            const finalCandidates = inferredCandidates ?? this.appendInheritedFallbackCandidates(document, result);
            const items = finalCandidates.map(candidate => this.createCompletionItem(candidate, result, document));
            trace.complete(result.context.kind, items.length);
            return items;
        } catch (error) {
            console.error('Error providing completions:', error);
            trace.complete('identifier', 0);
            return [];
        }
    }
```

再在 provider 内新增 3 个 helper：

```ts
    private async buildObjectInferenceCandidates(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<CompletionCandidate[] | undefined> {
        const inferredAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (!inferredAccess || token.isCancellationRequested) {
            return undefined;
        }

        if (inferredAccess.inference.status === 'unknown') {
            return undefined;
        }

        if (inferredAccess.inference.status === 'unsupported') {
            return [];
        }

        return this.collectMethodCandidatesForObjects(document, inferredAccess.inference.candidates.map(item => item.path));
    }

    private async collectMethodCandidatesForObjects(
        document: vscode.TextDocument,
        targetPaths: string[]
    ): Promise<CompletionCandidate[]> {
        const methodCounts = new Map<string, { candidate: CompletionCandidate; count: number }>();

        for (const targetPath of targetPaths) {
            const methods = await this.collectFunctionsFromTarget(document, targetPath, new Set<string>());
            for (const func of methods) {
                const key = `${func.sourceUri}:${func.name}`;
                const existing = methodCounts.get(key);
                if (existing) {
                    existing.count += 1;
                    continue;
                }

                methodCounts.set(key, {
                    count: 1,
                    candidate: {
                        key,
                        label: func.name,
                        kind: vscode.CompletionItemKind.Method,
                        detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                        sortGroup: 'type-member',
                        metadata: {
                            sourceUri: func.sourceUri,
                            sourceType: 'inherited',
                            documentationRef: func.definition
                        }
                    }
                });
            }
        }

        return Array.from(methodCounts.values())
            .sort((left, right) => right.count - left.count || left.candidate.label.localeCompare(right.candidate.label))
            .map(entry => entry.candidate);
    }

    private async collectFunctionsFromTarget(
        document: vscode.TextDocument,
        targetPath: string,
        visited: Set<string>
    ): Promise<FunctionSummary[]> {
        if (visited.has(targetPath)) {
            return [];
        }

        visited.add(targetPath);
        const targetDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
        const snapshot = this.astManager.getSemanticSnapshot(targetDocument, false);
        const functions = snapshot.exportedFunctions.map(func => ({ ...func, origin: 'inherited' as const }));

        for (const inheritStatement of snapshot.inheritStatements) {
            const resolvedPaths = await PathResolver.resolveInheritPath(targetDocument, inheritStatement.value, this.macroManager);
            for (const resolvedPath of resolvedPaths) {
                functions.push(...await this.collectFunctionsFromTarget(targetDocument, resolvedPath, visited));
            }
        }

        return functions;
    }
```

这里不要删除 `CompletionQueryEngine` 原有的 `receiverType` / `struct-member` / 通用 object fallback 逻辑；它继续作为“对象推导未知时”的后备路径。

- [ ] **Step 5: 运行 completion 回归集确认通过**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts`

Expected: PASS，旧的 `payload->hp`、泛型 object 方法回归继续通过，同时新增的 `this_object()`、宏路径和并集排序测试通过。

- [ ] **Step 6: 提交 completion 接入**

```bash
git add src/completionProvider.ts src/__tests__/completionProvider.test.ts src/objectInference/ObjectInferenceService.ts
git commit -m "feat(completion): infer object members for arrow access"
```

---

## Chunk 6: 新增对象 hover provider 并接入语言模块

### Task 6: 用独立对象 hover provider 显示对象方法文档

**Files:**
- Create: `src/objectInference/ObjectHoverProvider.ts`
- Create: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`
- Modify: `src/modules/languageModule.ts`
- Modify: `src/modules/__tests__/languageModule.test.ts`

- [ ] **Step 1: 先写失败测试，锁定对象 hover 的已解析和多候选行为**

在 `src/objectInference/__tests__/ObjectHoverProvider.test.ts` 里写 2 个用例：

```ts
test('shows method syntax from the resolved object file', async () => {
    fs.mkdirSync(path.join(fixtureRoot, 'adm', 'daemons'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'adm', 'daemons', 'combat_d.c'), [
        '/**',
        ' * @brief 查询名字',
        ' */',
        'string query_name() {',
        '    return "combat";',
        '}'
    ].join('\n'));

    const document = createDocument(path.join(fixtureRoot, 'main.c'), 'void demo() { load_object("/adm/daemons/combat_d")->query_name(); }');
    const hover = await provider.provideHover(document, new vscode.Position(0, 54));

    expect(hover).toBeDefined();
    expect(String((hover as any).contents[0]?.value ?? (hover as any).contents)).toContain('query_name');
});

test('returns a conservative summary for merged candidates without a unique shared implementation', async () => {
    const document = createDocument(path.join(fixtureRoot, 'branch.c'), [
        '/**',
        ' * @brief helper docs',
        ' * @return object 返回对象',
        ' * @lpc-return-objects {"/adm/daemons/combat_d", "/d/city/npc/guard"}',
        ' */',
        'object helper() { return 0; }',
        'void demo() { helper()->query_name(); }'
    ].join('\n'));

    const hover = await provider.provideHover(document, new vscode.Position(6, 25));
    expect(String((hover as any).contents[0]?.value ?? (hover as any).contents)).toContain('可能来自多个对象');
});
```

在 `src/modules/__tests__/languageModule.test.ts` 中把 hover provider 注册断言改成 2 次，并让宏 hover 用例改为取最后一个 provider：

```ts
expect(vscode.languages.registerHoverProvider).toHaveBeenCalledTimes(2);

const macroHoverProvider = (vscode.languages.registerHoverProvider as jest.Mock).mock.calls.at(-1)?.[1];
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts src/modules/__tests__/languageModule.test.ts`

Expected: FAIL，因为对象 hover provider 还不存在，语言模块也只注册了宏 hover provider。

- [ ] **Step 3: 实现 `ObjectHoverProvider`，并保持 `EfunHoverProvider` 专注 efun 文档**

新增 `src/objectInference/ObjectHoverProvider.ts`：

```ts
import * as vscode from 'vscode';
import type { EfunDoc } from '../efun/types';
import { parseFunctionDocs } from '../efun/docParser';
import { ObjectInferenceService } from './ObjectInferenceService';

export class ObjectHoverProvider implements vscode.HoverProvider {
    constructor(private readonly objectInferenceService: ObjectInferenceService) {}

    public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        const inferredAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (!inferredAccess) {
            return undefined;
        }

        if (inferredAccess.inference.status === 'unknown' || inferredAccess.inference.status === 'unsupported') {
            return undefined;
        }

        const docs = await Promise.all(inferredAccess.inference.candidates.map(candidate => this.loadMethodDoc(candidate.path, inferredAccess.memberName)));
        const resolvedDocs = docs.filter((doc): doc is EfunDoc => Boolean(doc));

        if (resolvedDocs.length === 1) {
            return new vscode.Hover(new vscode.MarkdownString([`\`\`\`lpc`, resolvedDocs[0].syntax, '\`\`\`', '', resolvedDocs[0].description].join('\n')));
        }

        if (resolvedDocs.length > 1) {
            return new vscode.Hover(`可能来自多个对象：${inferredAccess.inference.candidates.map(item => `\`${item.path}\``).join(', ')}`);
        }

        return undefined;
    }

    private async loadMethodDoc(targetPath: string, methodName: string) {
        const targetDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
        const docs = parseFunctionDocs(targetDocument.getText(), '对象方法');
        return docs.get(methodName);
    }
}
```

这里不要修改 `EfunHoverProvider` 的职责；它仍只负责 efun / simul_efun，并继续靠已有 `isArrowMemberAccess()` 逻辑阻止 `->` 场景的 efun 回退。

- [ ] **Step 4: 在语言模块里创建共享对象推导服务并注册对象 hover provider**

把 `src/modules/languageModule.ts` 改成：

```ts
import { ObjectHoverProvider } from '../objectInference/ObjectHoverProvider';
import { ObjectInferenceService } from '../objectInference/ObjectInferenceService';

export function registerLanguageProviders(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const efunDocsManager = registry.get(Services.EfunDocs);
    const macroManager = registry.get(Services.MacroManager);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);
    const objectInferenceService = new ObjectInferenceService(macroManager);

    const completionProvider = new LPCCompletionItemProvider(
        efunDocsManager,
        macroManager,
        completionInstrumentation,
        objectInferenceService
    );

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('lpc', new LPCDefinitionProvider(macroManager, efunDocsManager, objectInferenceService)),
        vscode.languages.registerHoverProvider('lpc', new ObjectHoverProvider(objectInferenceService)),
        vscode.languages.registerHoverProvider('lpc', {
            provideHover: async (document, position) => {
                const range = document.getWordRangeAtPosition(position);
                if (!range) {
                    return;
                }

                const word = document.getText(range);
                if (!/^[A-Z][A-Z0-9_]*_D$/.test(word)) {
                    return;
                }

                const macro = macroManager?.getMacro(word);
                if (macro) {
                    return new vscode.Hover(macroManager.getMacroHoverContent(macro));
                }

                const canResolve = await macroManager?.canResolveMacro(word);
                if (canResolve) {
                    return new vscode.Hover(`宏 \`${word}\` 已定义但无法获取具体值`);
                }
            }
        })
    );
}
```

把 `src/modules/__tests__/languageModule.test.ts` 的订阅数量从 `12` 改成 `13`，并新增对象 hover provider 注册断言：

```ts
expect(vscode.languages.registerHoverProvider).toHaveBeenNthCalledWith(1, 'lpc', expect.any(Object));
expect(vscode.languages.registerHoverProvider).toHaveBeenNthCalledWith(2, 'lpc', expect.objectContaining({
    provideHover: expect.any(Function)
}));
expect(context.subscriptions).toHaveLength(13);
```

- [ ] **Step 5: 运行对象 hover 和语言模块测试确认通过**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts src/modules/__tests__/languageModule.test.ts src/efun/__tests__/EfunHoverProvider.test.ts`

Expected: PASS，且现有 `EfunHoverProvider` 测试继续通过，说明对象 hover 接入没有破坏 efun 侧的 `->` 拦截行为。

- [ ] **Step 6: 提交 hover 接入**

```bash
git add src/objectInference/ObjectHoverProvider.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/modules/languageModule.ts src/modules/__tests__/languageModule.test.ts
git commit -m "feat(hover): add object method hover provider"
```

---

## Chunk 7: 全量回归与类型检查

### Task 7: 验证三条链路与关键回归集

**Files:**
- Modify: none
- Test: `src/efun/__tests__/docParser.test.ts`
- Test: `src/objectInference/__tests__/ObjectInferenceService.test.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Test: `src/__tests__/completionProvider.test.ts`
- Test: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`
- Test: `src/modules/__tests__/languageModule.test.ts`

- [ ] **Step 1: 运行对象推导与 provider 定向回归集**

Run: `npx jest --runInBand src/efun/__tests__/docParser.test.ts src/objectInference/__tests__/ObjectInferenceService.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/modules/__tests__/languageModule.test.ts`

Expected: PASS

- [ ] **Step 2: 运行 `->` 相关现有回归，确认没有破坏旧修补**

Run: `npx jest --runInBand src/efun/__tests__/EfunHoverProvider.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts`

Expected: PASS

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 4: 记录最终实现提交**

```bash
git add src/efun/types.ts src/efun/docParser.ts src/efun/__tests__/docParser.test.ts src/objectInference src/definitionProvider.ts src/completionProvider.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts src/modules/languageModule.ts src/modules/__tests__/languageModule.test.ts
git commit -m "feat(language): add v1 object inference for arrow access"
```

说明：如果前面的 task 已经按计划提交了分阶段 commits，这一步只需要补最终整理 commit，不要重复提交同样内容。
