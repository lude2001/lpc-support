# 表达式接收者 `->` 定义跳转不回退到 simul_efun/efun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `environment(ob)->query()` 这类表达式接收者的 `->` 方法调用在定义跳转时错误回退到 simul_efun / efun 的问题。

**Architecture:** 保持当前 definition 主路径不变，只在 `src/definitionProvider.ts` 内把“对象访问识别”和“对象来源解析”拆开。`provideDefinition()` 仍然先判断是否命中对象访问，但命中后不再要求左侧接收者必须立即可还原成标识符或字符串；如果只是识别出了对象访问语义而当前架构无法解析目标文件，就直接返回 `undefined`，禁止继续回退到普通函数或 simul_efun 链路。

**Tech Stack:** TypeScript, VS Code Extension API, Jest, ts-jest

**Spec:** `docs/superpowers/specs/2026-04-08-expression-arrow-definition-no-efun-fallback-design.md`

**Primary validation:** `npx tsc --noEmit`

**Targeted test suites:** `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

---

## File Structure

### 重点修改文件
- `src/definitionProvider.ts` - 扩展对象访问识别范围，让表达式接收者也会命中对象访问语义，并在来源不可解析时直接返回空结果而不是回退到 simul_efun
- `src/__tests__/providerIntegration.test.ts` - 新增 `environment(ob)->query()` 回归测试，锁定同名 simul_efun 存在时也不发生错误跳转

### 参考文件
- `docs/superpowers/specs/2026-04-08-expression-arrow-definition-no-efun-fallback-design.md`
- `src/definitionProvider.ts:51-95`
- `src/definitionProvider.ts:188-232`
- `src/definitionProvider.ts:529-588`

---

## Chunk 1: 用测试复现表达式接收者回退 bug

### Task 1: 为 `environment(ob)->query()` 增加 definition 回归测试

**Files:**
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 `environment(ob)->query()` 不回退到 simul_efun**

在 `src/__tests__/providerIntegration.test.ts` 现有 `definition does not fall back to simul_efun when object method resolution fails` 用例后，新增一个新的回归测试。测试要继续复用当前文件里已经存在的 `fixtureRoot`、`createDocument(...)`、`macroManager`、`efunDocsManager` 和 `vscode.workspace` mocks。

新增测试代码：

```ts
    test('definition does not fall back to simul_efun for expression-based arrow receivers', async () => {
        efunDocsManager.getSimulatedDoc.mockImplementation((name: string) => (
            name === 'query' ? { name: 'query' } : undefined
        ));
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string) => (key === 'lpc.simulatedEfunsPath' ? 'simul_efuns' : undefined))
        });

        const simulatedEfunFile = path.join(fixtureRoot, 'simul_efuns', 'query.c');
        fs.mkdirSync(path.dirname(simulatedEfunFile), { recursive: true });
        fs.writeFileSync(simulatedEfunFile, 'mixed query(string key) {\n}\n');
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([vscode.Uri.file(simulatedEfunFile)]);
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
            if (uri.fsPath === simulatedEfunFile) {
                return createDocument(simulatedEfunFile, fs.readFileSync(simulatedEfunFile, 'utf8'));
            }

            return undefined;
        });

        const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
        const document = createDocument(
            path.join(fixtureRoot, 'expression-object-method.c'),
            [
                'void demo(object ob) {',
                '    environment(ob)->query("short");',
                '}'
            ].join('\n')
        );

        const definition = await provider.provideDefinition(
            document,
            new vscode.Position(1, 23),
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect(definition).toBeUndefined();
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
    });
```

这里的核心断言不是“能跳到哪里”，而是“不要掉到 simul_efun”。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts -t "definition does not fall back to simul_efun for expression-based arrow receivers"`

Expected: FAIL。当前实现中 `environment(ob)` 不会被 `extractObjectReceiver()` 识别为对象接收者，所以最后仍会触发 simul_efun 回退。

- [ ] **Step 3: 提交测试进度点**

```bash
git add src/__tests__/providerIntegration.test.ts
git commit -m "test(definition): cover expression arrow fallback regression"
```

---

## Chunk 2: 最小调整对象访问识别与失败语义

### Task 2: 让表达式接收者命中对象访问语义并在无法解析来源时直接返回空结果

**Files:**
- Modify: `src/definitionProvider.ts`
- Test: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: 调整 `ObjectAccessInfo`，允许“命中对象访问但来源未知”**

在 `src/definitionProvider.ts` 顶部，把 `ObjectAccessInfo` 改成允许对象来源缺失。不要再让它隐含“所有对象访问都一定能得到 `objectExpression`”。

把接口改成：

```ts
interface ObjectAccessInfo {
    objectExpression?: string;
    methodName: string;
    isMethodCall: boolean;
    objectIsString: boolean;
    objectIsMacro: boolean;
}
```

这样后续逻辑可以显式表达“这是对象访问，但当前解析不了来源”。

- [ ] **Step 2: 只要命中 `MemberAccessExpression` 就生成对象访问信息**

在 `tryBuildObjectAccessInfo()` 中保留右侧成员名校验，但不要再因为 `extractObjectReceiver(...)` 返回 `undefined` 就直接放弃整个对象访问识别。把它改成“先识别对象访问，再尽量解析来源”。

把该函数改成：

```ts
    private tryBuildObjectAccessInfo(
        node: SyntaxNode | undefined,
        targetWord: string,
        isMethodCall: boolean
    ): ObjectAccessInfo | undefined {
        if (!node || node.kind !== SyntaxKind.MemberAccessExpression || node.children.length < 2) {
            return undefined;
        }

        const memberNode = node.children[1];
        if (memberNode.kind !== SyntaxKind.Identifier || memberNode.name !== targetWord) {
            return undefined;
        }

        const receiver = this.extractObjectReceiver(node.children[0]);

        return {
            objectExpression: receiver?.objectExpression,
            methodName: targetWord,
            isMethodCall,
            objectIsString: receiver?.objectIsString ?? false,
            objectIsMacro: receiver?.objectIsMacro ?? false
        };
    }
```

重点：
- `receiver` 现在是可选
- 左侧来源未知时也照样返回 `ObjectAccessInfo`
- 不去扩展 `extractObjectReceiver()` 识别 `environment(ob)` 对应的真实文件

- [ ] **Step 3: 在目标路径解析处显式处理“来源未知”**

在 `resolveObjectAccessTargetPath()` 中增加一个最早返回，明确表达“对象来源未知时直接结束”。不要让它继续尝试任何普通函数或 simul_efun 路径。

目标形态：

```ts
    private resolveObjectAccessTargetPath(objectAccess: ObjectAccessInfo): string | undefined {
        if (!objectAccess.objectExpression) {
            return undefined;
        }

        if (objectAccess.objectIsString) {
            return this.parseStringPath(objectAccess.objectExpression);
        }

        if (objectAccess.objectIsMacro) {
            const macro = this.macroManager.getMacro(objectAccess.objectExpression);
            if (!macro?.value) {
                return undefined;
            }

            return this.parseStringPath(macro.value);
        }

        return undefined;
    }
```

这里不要额外新增变量解析、返回值推断、`environment()` 特判或 `this_object()` 增强。

- [ ] **Step 4: 运行定向测试确认 bug 被修住**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

Expected: PASS。至少以下两个回归必须同时通过：
- `definition does not fall back to simul_efun when object method resolution fails`
- `definition does not fall back to simul_efun for expression-based arrow receivers`

- [ ] **Step 5: 运行类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: 提交实现**

```bash
git add src/definitionProvider.ts src/__tests__/providerIntegration.test.ts
git commit -m "fix(definition): stop efun fallback for expression arrow calls"
```

---

## Chunk 3: 回归确认

### Task 3: 验证普通函数链路未受影响

**Files:**
- Modify: none
- Test: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: 运行当前定义跳转回归集**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts`

Expected: PASS

- [ ] **Step 2: 运行完整关键回归集**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts src/__tests__/completionProvider.test.ts src/efun/__tests__/EfunHoverProvider.test.ts`

Expected: PASS

- [ ] **Step 3: 再跑一次类型检查**

Run: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 4: 提交验证后的最终状态**

```bash
git add src/definitionProvider.ts src/__tests__/providerIntegration.test.ts
git commit -m "test(definition): lock expression arrow fallback behavior"
```

说明：如果 Task 2 的实现提交已经包含了最终测试文件状态，这一步不需要制造重复提交；可以跳过提交，只保留验证记录。
