# `->` 成员调用不回退到 efun/simul_efun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `receiver->method(...)` 被错误回退到 simul_efun / efun 的行为，避免错误 hover、错误 definition 跳转和错误 completion 候选。

**Architecture:** 保持现有 parser / syntax / semantic 主路径不变，只在 hover、definition、completion 三条消费链路增加“成员访问不走 efun 回退”的最小判定。`definition` 通过提前截断对象访问分支来阻止后续普通函数查找；`hover` 在 efun/simul_efun 查询前识别 `->` 成员名并直接返回空结果；`completion` 主要补集成回归测试，确认 `member` 上下文不会混入 efun/simul_efun。

**Tech Stack:** TypeScript, VS Code Extension API, Jest, ts-jest

**Spec:** `docs/superpowers/specs/2026-04-08-arrow-member-no-efun-fallback-design.md`

**Primary validation:** `npx tsc --noEmit`

**Targeted test suites:** `npx jest --runInBand src/efun/__tests__/EfunHoverProvider.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts`

---

## File Structure

### 新建文件
- `src/efun/__tests__/EfunHoverProvider.test.ts` - 直接验证 `obj->foo()` 不再回退到 simul_efun / efun hover

### 重点修改文件
- `src/efun/EfunHoverProvider.ts` - 在 simul_efun / efun 查询前识别 `->` 成员访问并提前返回
- `src/definitionProvider.ts` - 对象访问命中后即终止普通函数 / simul_efun 回退
- `src/__tests__/providerIntegration.test.ts` - 增加对象访问解析失败时不跳转到 simul_efun 的集成回归
- `src/__tests__/completionProvider.test.ts` - 增加 `obj->` 场景不包含 efun/simul_efun 候选的集成回归

### 参考文件
- `src/efun/EfunDocsManager.ts`
- `src/completion/completionContextAnalyzer.ts`
- `src/completion/completionQueryEngine.ts`
- `docs/superpowers/specs/2026-04-08-arrow-member-no-efun-fallback-design.md`

---

## Chunk 1: Hover 和 Definition 回退截断

### Task 1: 为 `EfunHoverProvider` 加入 `->` 成员访问拦截

**Files:**
- Create: `src/efun/__tests__/EfunHoverProvider.test.ts`
- Modify: `src/efun/EfunHoverProvider.ts`

- [ ] **Step 1: 先写失败测试，锁定 `obj->foo()` 不显示 simul_efun/efun hover**

在 `src/efun/__tests__/EfunHoverProvider.test.ts` 新建一个直接测试 `EfunHoverProvider` 的文件，使用最小 mock manager，只暴露 `prepareHoverLookup`、`getCurrentFileDoc`、`getInheritedFileDoc`、`getIncludedFileDoc`、`getSimulatedDoc`、`getEfunDoc`。测试文档内容用 `target->write();`，断言 provider 返回 `undefined`，并且不会调用 `getSimulatedDoc` / `getEfunDoc`。

```ts
import * as vscode from 'vscode';
import { EfunHoverProvider } from '../EfunHoverProvider';

function createDocument(content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    return {
        getWordRangeAtPosition: jest.fn(() => new vscode.Range(new vscode.Position(0, 8), new vscode.Position(0, 13))),
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return lines[range.start.line].slice(range.start.character, range.end.character);
        }),
        lineAt: jest.fn(() => ({ text: lines[0] }))
    } as unknown as vscode.TextDocument;
}

describe('EfunHoverProvider', () => {
    test('does not fall back to simul efun or efun docs for arrow member access', async () => {
        const manager = {
            prepareHoverLookup: jest.fn().mockResolvedValue(undefined),
            getCurrentFileDoc: jest.fn(() => undefined),
            getInheritedFileDoc: jest.fn(() => undefined),
            getIncludedFileDoc: jest.fn().mockResolvedValue(undefined),
            getSimulatedDoc: jest.fn(() => ({ name: 'write' })),
            getEfunDoc: jest.fn().mockResolvedValue({ name: 'write' })
        };

        const provider = new EfunHoverProvider(manager as any);
        const document = createDocument('target->write();');
        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(hover).toBeUndefined();
        expect(manager.getSimulatedDoc).not.toHaveBeenCalled();
        expect(manager.getEfunDoc).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/efun/__tests__/EfunHoverProvider.test.ts`

Expected: FAIL，因为当前 `EfunHoverProvider` 仍会继续调用 `getSimulatedDoc()` 或 `getEfunDoc()`。

- [ ] **Step 3: 在 hover provider 中加入最小成员访问判定**

在 `src/efun/EfunHoverProvider.ts` 增加一个只负责识别“当前单词是否紧跟在 `->` 之后”的 helper，并在 simul_efun / efun 查询前使用它。保持当前文件、继承、include 的既有行为不变，这次只阻止 efun 兜底。

```ts
public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.Hover | undefined> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }

    const word = document.getText(wordRange);

    await this.efunDocsManager.prepareHoverLookup(document);

    const currentDoc = this.efunDocsManager.getCurrentFileDoc(word);
    if (currentDoc) {
        return this.createHoverContent(currentDoc);
    }

    const inheritedDoc = this.efunDocsManager.getInheritedFileDoc(word);
    if (inheritedDoc) {
        return this.createHoverContent(inheritedDoc);
    }

    const includeDoc = await this.efunDocsManager.getIncludedFileDoc(document, word);
    if (includeDoc) {
        return this.createHoverContent(includeDoc);
    }

    if (this.isArrowMemberAccess(document, wordRange)) {
        return undefined;
    }

    const simulatedDoc = this.efunDocsManager.getSimulatedDoc(word);
    if (simulatedDoc) {
        return this.createHoverContent(simulatedDoc);
    }

    const efunDoc = await this.efunDocsManager.getEfunDoc(word);
    if (!efunDoc) {
        return undefined;
    }

    return this.createHoverContent(efunDoc);
}

private isArrowMemberAccess(document: vscode.TextDocument, wordRange: vscode.Range): boolean {
    const lineText = document.lineAt(wordRange.start.line).text;
    const prefix = lineText.slice(0, wordRange.start.character);
    return /->\s*$/.test(prefix);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/efun/__tests__/EfunHoverProvider.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/efun/EfunHoverProvider.ts src/efun/__tests__/EfunHoverProvider.test.ts
git commit -m "fix(hover): stop efun fallback for arrow members"
```

---

### Task 2: 为 definition 链路阻断对象访问失败后的 simul_efun 回退

**Files:**
- Modify: `src/definitionProvider.ts`
- Test: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: 先写失败测试，锁定对象访问失败时不再跳到 simul_efun**

在 `src/__tests__/providerIntegration.test.ts` 新增一个集成测试：构造 `ghost->write();` 文档，并让 `efunDocsManager.getSimulatedDoc('write')` 返回一个假值以模拟“同名 simul_efun 存在”。断言 `provideDefinition()` 返回 `undefined`。

```ts
test('definition does not fall back to simulated efuns for unresolved arrow member calls', async () => {
    (efunDocsManager.getSimulatedDoc as jest.Mock).mockImplementation((name: string) => {
        return name === 'write' ? { name: 'write' } : undefined;
    });

    const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
    const fileName = path.join(fixtureRoot, 'arrow-definition.c');
    const document = createDocument(
        fileName,
        [
            'void demo() {',
            '    object ghost;',
            '    ghost->write();',
            '}'
        ].join('\n')
    );

    const definition = await provider.provideDefinition(
        document,
        new vscode.Position(2, '    ghost->write'.length),
        { isCancellationRequested: false } as vscode.CancellationToken
    );

    expect(definition).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

Expected: FAIL，因为当前对象访问解析失败后仍会进入 `findSimulatedEfunDefinition()` 或普通函数回退。

- [ ] **Step 3: 最小重排 definition 控制流**

把对象访问分支从 `resolveDirectDefinition()` 中提升到 `provideDefinition()` 顶层处理，让“命中了对象访问但没解析出目标”直接返回 `undefined`。`resolveDirectDefinition()` 改成只负责 include、macro、simul_efun、variable 等非对象访问分支。

```ts
async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
): Promise<vscode.Location | vscode.Location[] | undefined> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }

    const word = document.getText(wordRange);
    const objectAccess = this.analyzeObjectAccessWithAST(document, position, word);
    if (objectAccess) {
        return this.handleObjectMethodCall(document, objectAccess);
    }

    const directDefinition = await this.resolveDirectDefinition(document, position, word);
    if (directDefinition) {
        return directDefinition;
    }

    return this.findFunctionDefinition(document, word);
}

private async resolveDirectDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
): Promise<vscode.Location | undefined> {
    const includeResult = await this.handleIncludeDefinition(document, position);
    if (includeResult) {
        return includeResult;
    }

    const macroDefinition = await this.findMacroDefinition(word);
    if (macroDefinition) {
        return macroDefinition;
    }

    const simulatedEfunDefinition = await this.findSimulatedEfunDefinition(word);
    if (simulatedEfunDefinition) {
        return simulatedEfunDefinition;
    }

    return this.findVariableDefinition(word, document, position);
}
```

实现约束：
- 不改 `handleObjectMethodCall()` 的目标文件解析规则。
- 不新增 `this_object()` 等对象推断增强。
- 只修“命中对象访问后仍回退到 simul_efun / 普通函数”的 bug。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/definitionProvider.ts src/__tests__/providerIntegration.test.ts
git commit -m "fix(definition): stop efun fallback for arrow members"
```

---

## Chunk 2: Completion 回归锁定与总体验证

### Task 3: 为 completion 链路补集成回归，锁定 `member` 上下文不混入 efun

**Files:**
- Modify: `src/__tests__/completionProvider.test.ts`

- [ ] **Step 1: 先写失败测试，明确 `obj->` 只返回成员候选**

在 `src/__tests__/completionProvider.test.ts` 新增一个测试，让 `efunDocsManager.getAllFunctions()` 返回 `['write', 'query']`，文档内容包含一个 `class Payload payload; payload->h` 场景。断言补全结果包含 `hp`，但不包含 `write`。

```ts
test('does not mix efun candidates into arrow member completions', async () => {
    (efunDocsManager.getAllFunctions as jest.Mock).mockReturnValue(['write', 'query']);

    const content = [
        'class Payload {',
        '    int hp;',
        '}',
        '',
        'void demo() {',
        '    class Payload payload;',
        '    payload->h',
        '}'
    ].join('\n');
    const document = createDocument(path.join(fixtureRoot, 'member-no-efun.c'), content);

    const result = await provider.provideCompletionItems(
        document,
        new vscode.Position(6, '    payload->h'.length),
        { isCancellationRequested: false } as vscode.CancellationToken,
        {} as vscode.CompletionContext
    ) as vscode.CompletionItem[];

    expect(result.map(item => item.label)).toContain('hp');
    expect(result.map(item => item.label)).not.toContain('write');
});
```

- [ ] **Step 2: 运行测试，确认当前行为并记录结果**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts`

Expected: 如果当前实现已经正确，这个测试会直接 PASS；如果 provider 层未来曾混入 efun，则这里会 FAIL。无论结果如何都保留该测试，作为回归保护网。

- [ ] **Step 3: 仅在测试失败时做最小修正**

如果测试失败，优先检查以下两个点并做最小修改：

1. `appendInheritedFallbackCandidates()` 是否错误处理了 `member` 上下文。
2. `provideCompletionItems()` 是否在 query engine 结果之外又拼入了 efun 静态候选。

目标状态应保持为：

```ts
private appendInheritedFallbackCandidates(
    document: vscode.TextDocument,
    result: CompletionQueryResult
): CompletionCandidate[] {
    if (result.context.kind !== 'identifier' && result.context.kind !== 'type-position') {
        return result.candidates;
    }

    const snapshot = this.astManager.getBestAvailableSnapshot(document);
    this.refreshInheritedIndex(document);

    const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(snapshot.uri);
    if (inheritedSymbols.functions.length === 0 && inheritedSymbols.types.length === 0) {
        return result.candidates;
    }
}
```

如果当前实现已经和上面一致，则这一小步不需要修改生产代码，只保留新增测试即可。

以及：

```ts
const result = this.queryEngine.query(document, position, context, token, trace);
const candidates = this.appendInheritedFallbackCandidates(document, result);
const items = candidates.map(candidate => this.createCompletionItem(candidate, result, document));
return items;
```

不要新增“对象方法智能推断”逻辑；这次只锁定不混入 efun/simul_efun。

- [ ] **Step 4: 运行定向测试，确认 completion 回归稳定**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts src/__tests__/completionQueryEngine.test.ts`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/__tests__/completionProvider.test.ts src/completionProvider.ts src/completion/completionQueryEngine.ts
git commit -m "test(completion): lock arrow member candidates to member context"
```

---

## Chunk 3: 汇总验证

### Task 4: 跑类型检查和目标回归集

**Files:**
- Modify: none
- Test: `src/efun/__tests__/EfunHoverProvider.test.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Test: `src/__tests__/completionProvider.test.ts`

- [ ] **Step 1: 运行类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 2: 运行目标回归集**

Run: `npx jest --runInBand src/efun/__tests__/EfunHoverProvider.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts`

Expected: PASS

- [ ] **Step 3: 检查普通函数调用未回归**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts -t "resolves efun documentation lazily"`

Expected: PASS，证明普通标识符场景的 efun 行为仍然存在。

- [ ] **Step 4: 提交验证后的最终变更**

```bash
git add src/efun/EfunHoverProvider.ts src/efun/__tests__/EfunHoverProvider.test.ts src/definitionProvider.ts src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts src/completionProvider.ts src/completion/completionQueryEngine.ts
git commit -m "fix(language): stop efun fallback for arrow member calls"
```

说明：如果 Task 3 未改动 `src/completionProvider.ts` 或 `src/completion/completionQueryEngine.ts`，最终提交时不要强行加入未修改文件。
