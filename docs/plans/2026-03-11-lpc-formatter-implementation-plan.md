# LPC Formatter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 LPC / FluffOS 文件增加稳定的整文格式化与选区格式化能力，支持 Allman 风格、少量 `lpc.format.*` 配置、结构化数据强制块状布局，以及对 heredoc / array delimiter / 宏 / 注释等高风险结构的安全处理。

**Architecture:** 新增独立的 `src/formatter/` 模块，围绕当前 [`src/parser/ParsedDocumentService.ts`](/D:/code/lpc-support/src/parser/ParsedDocumentService.ts) 提供的 parse tree、token stream 和 trivia 构建 formatter。Provider 仅负责接入 VS Code，服务层负责配置读取、节点边界选择和拒绝条件，中间模型与 printer 负责普通 LPC 结构、结构化数据、注释、宏和定界符文本块的分类输出。

**Tech Stack:** TypeScript, VS Code Extension API, antlr4ts, ParsedDocumentService, TokenTriviaIndex, Jest, ts-jest, `tests/mocks/MockVSCode.ts`

---

## File Structure

- Create: `src/formatter/types.ts`
  - formatter 公共类型、配置快照、格式化目标类型
- Create: `src/formatter/LPCFormattingProvider.ts`
  - 文档格式化 / 选区格式化 Provider
- Create: `src/formatter/FormattingService.ts`
  - 配置读取、语法错误拒绝、整文 / 选区分流
- Create: `src/formatter/config.ts`
  - `lpc.format.*` 配置读取和默认值
- Create: `src/formatter/model/formatNodes.ts`
  - 中间模型定义
- Create: `src/formatter/model/FormatModelBuilder.ts`
  - 从 parsed document 构建格式化模型
- Create: `src/formatter/printer/FormatPrinter.ts`
  - Allman printer 与结构化数据布局
- Create: `src/formatter/printer/PrintContext.ts`
  - 缩进、行宽、尾随空格、换行控制
- Create: `src/formatter/range/findFormatTarget.ts`
  - 选区映射到完整语法节点
- Create: `src/formatter/comments/commentFormatter.ts`
  - 注释归属与行尾注释提升逻辑
- Create: `src/formatter/macro/macroFormatter.ts`
  - 简单宏格式化与复杂宏保守策略
- Create: `src/formatter/heredoc/heredocGuard.ts`
  - `@TAG` / `@@TAG` 块的结束边界守卫
- Modify: `src/extension.ts`
  - 注册 formatter Provider
- Modify: `package.json`
  - 增加 `lpc.format.*` 配置项描述
- Modify: `tests/mocks/MockVSCode.ts`
  - 增加格式化 Provider、配置读取与 `TextEdit` 相关 mock
- Create: `src/__tests__/formatterProvider.test.ts`
- Create: `src/__tests__/formattingService.test.ts`
- Create: `src/__tests__/formatPrinter.test.ts`
- Create: `src/__tests__/rangeFormatting.test.ts`
- Create: `src/__tests__/commentFormatting.test.ts`
- Create: `src/__tests__/macroFormatting.test.ts`
- Create: `src/__tests__/heredocFormatting.test.ts`
- Create: `src/__tests__/formatterIntegration.test.ts`
- Modify: `README.md`
  - 实现完成后记录 formatter 能力与配置项
- Modify: `CHANGELOG.md`
  - 实现完成后记录用户可见变更

## Delivery Notes

- 遵循 `@test-driven-development`：先写失败测试，再写最小实现，再重构
- 完成每个任务后，用 `@verification-before-completion` 跑对应测试命令
- 不修改 `src/antlr/*`
- 不把 formatter 逻辑塞进 [`src/extension.ts`](/D:/code/lpc-support/src/extension.ts) 以外的现有大型文件
- 对高风险节点，优先选择拒绝或保守输出，而不是“看起来更整齐”

## Chunk 1: Provider Skeleton And Safe Entry Conditions

### Task 1: 注册格式化 Provider 与配置入口

**Files:**
- Create: `src/formatter/types.ts`
- Create: `src/formatter/config.ts`
- Create: `src/formatter/LPCFormattingProvider.ts`
- Create: `src/__tests__/formatterProvider.test.ts`
- Modify: `src/extension.ts`
- Modify: `package.json`
- Modify: `tests/mocks/MockVSCode.ts`

- [x] **Step 1: 写失败测试，确认扩展会注册文档格式化与选区格式化 Provider**

```ts
import * as vscode from 'vscode';
import { activate } from '../extension';

test('activate 注册 LPC 文档与选区格式化 provider', () => {
    activate({ subscriptions: [] } as any);

    expect(vscode.languages.registerDocumentFormattingEditProvider).toHaveBeenCalledWith(
        'lpc',
        expect.anything()
    );
    expect(vscode.languages.registerDocumentRangeFormattingEditProvider).toHaveBeenCalledWith(
        'lpc',
        expect.anything()
    );
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/formatterProvider.test.ts --runInBand`
Expected: FAIL，提示 mock 中未定义注册方法或扩展入口未注册 formatter

- [x] **Step 3: 在 mock、配置读取和扩展入口中补齐最小注册链路**

```ts
// tests/mocks/MockVSCode.ts
registerDocumentFormattingEditProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
registerDocumentRangeFormattingEditProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),

// src/extension.ts
const formattingProvider = new LPCFormattingProvider(new FormattingService());
context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('lpc', formattingProvider),
    vscode.languages.registerDocumentRangeFormattingEditProvider('lpc', formattingProvider)
);
```

- [x] **Step 4: 在 `package.json` 中加入最小配置项骨架**

```json
"lpc.format.indentSize": {
  "type": "number",
  "default": 4,
  "minimum": 2,
  "maximum": 8,
  "description": "LPC formatter indentation size"
}
```

- [x] **Step 5: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/formatterProvider.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: 提交 Provider 和配置骨架**

```bash
git add src/formatter/types.ts src/formatter/config.ts src/formatter/LPCFormattingProvider.ts src/extension.ts package.json tests/mocks/MockVSCode.ts src/__tests__/formatterProvider.test.ts
git commit -m "feat(formatter): register formatter providers"
```

### Task 2: 建立格式化服务的安全入口

**Files:**
- Create: `src/formatter/FormattingService.ts`
- Create: `src/formatter/range/findFormatTarget.ts`
- Create: `src/__tests__/formattingService.test.ts`
- Create: `src/__tests__/rangeFormatting.test.ts`

- [x] **Step 1: 写失败测试，覆盖语法错误拒绝和非完整选区拒绝**

```ts
test('有语法错误时拒绝整文格式化', async () => {
    const service = new FormattingService();
    jest.spyOn(parsedService, 'get').mockReturnValue({ diagnostics: [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'err')]} as any);

    await expect(service.formatDocument(document)).resolves.toEqual([]);
});

test('选区不覆盖完整节点时拒绝格式化', async () => {
    const service = new FormattingService();
    jest.spyOn(rangeResolver, 'findFormatTarget').mockReturnValue(null);

    await expect(service.formatRange(document, new vscode.Range(1, 2, 1, 5))).resolves.toEqual([]);
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/formattingService.test.ts src/__tests__/rangeFormatting.test.ts --runInBand`
Expected: FAIL，提示 `FormattingService` / `findFormatTarget` 缺失

- [x] **Step 3: 实现最小拒绝逻辑**

```ts
if (parsed.diagnostics.length > 0) {
    return [];
}

if (!target) {
    return [];
}
```

- [x] **Step 4: 让服务层暂时返回“原文替换 edit”，只打通链路**

```ts
return [vscode.TextEdit.replace(fullRange, document.getText(fullRange))];
```

- [x] **Step 5: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/formattingService.test.ts src/__tests__/rangeFormatting.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: 提交安全入口**

```bash
git add src/formatter/FormattingService.ts src/formatter/range/findFormatTarget.ts src/__tests__/formattingService.test.ts src/__tests__/rangeFormatting.test.ts
git commit -m "feat(formatter): add safe formatter entry conditions"
```

## Chunk 2: Core Printing For LPC Structures

### Task 3: 实现 Allman printer 与普通块结构格式化

**Files:**
- Create: `src/formatter/model/formatNodes.ts`
- Create: `src/formatter/model/FormatModelBuilder.ts`
- Create: `src/formatter/printer/PrintContext.ts`
- Create: `src/formatter/printer/FormatPrinter.ts`
- Create: `src/__tests__/formatPrinter.test.ts`
- Modify: `src/formatter/FormattingService.ts`

- [x] **Step 1: 写失败测试，覆盖函数、`if/else`、循环、匿名函数的 Allman 布局**

```ts
test('普通函数与控制流按 Allman 输出', () => {
    const source = 'void test(){if(x){foo();}else{bar();}}';
    expect(format(source)).toBe([
        'void test()',
        '{',
        '    if (x)',
        '    {',
        '        foo();',
        '    }',
        '    else',
        '    {',
        '        bar();',
        '    }',
        '}'
    ].join('\n'));
});

test('匿名函数按小型 Allman 函数输出', () => {
    const source = 'function f = function(int x){return x+1;};';
    expect(format(source)).toContain('function(int x)\n{');
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/formatPrinter.test.ts --runInBand`
Expected: FAIL，输出仍为原文或 printer 缺失

- [x] **Step 3: 构建最小中间模型，只覆盖函数、块、控制流、匿名函数**

```ts
export interface FormatNode {
    kind: 'file' | 'function' | 'block' | 'statement' | 'anonymous-function';
    text?: string;
    children?: FormatNode[];
}
```

- [x] **Step 4: 在 printer 中实现 Allman 和基础空格标准化**

```ts
printBlock(header: string, children: FormatNode[]): string {
    return `${header}\n{\n${childrenText}\n}`;
}
```

- [x] **Step 5: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/formatPrinter.test.ts src/__tests__/formattingService.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: 提交普通块结构格式化**

```bash
git add src/formatter/model/formatNodes.ts src/formatter/model/FormatModelBuilder.ts src/formatter/printer/PrintContext.ts src/formatter/printer/FormatPrinter.ts src/formatter/FormattingService.ts src/__tests__/formatPrinter.test.ts
git commit -m "feat(formatter): print core LPC blocks in Allman style"
```

### Task 4: 实现结构化数据块布局

**Files:**
- Modify: `src/formatter/model/formatNodes.ts`
- Modify: `src/formatter/model/FormatModelBuilder.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`
- Modify: `src/__tests__/formatPrinter.test.ts`
- Create: `src/__tests__/formatterIntegration.test.ts`

- [x] **Step 1: 写失败测试，覆盖 `mapping`、二维数组、嵌套 `mapping`、`new(..., field : value)`**

```ts
test('mapping 与二维数组强制块状展开且不加尾随逗号', () => {
    const source = 'mapping data = ([ "name":"sword", "actions":({ "slash", "parry" }) ]);';
    const output = format(source);

    expect(output).toContain('mapping data = ([');
    expect(output).toContain('    "name" : "sword"');
    expect(output).toContain('    "actions" : ({');
    expect(output).not.toContain(',\n]);');
});

test('new(..., field : value) 按结构化数据块布局', () => {
    const source = 'object x = new(Item, name:"sword", id:"changjian");';
    expect(format(source)).toContain('new(\n');
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/formatPrinter.test.ts src/__tests__/formatterIntegration.test.ts --runInBand`
Expected: FAIL，结构化数据仍保持单行或尾随逗号规则错误

- [x] **Step 3: 为结构化数据增加专用节点和 printer 分支**

```ts
kind: 'mapping' | 'array' | 'struct-init' | 'class-init' | 'new-init'
```

- [x] **Step 4: 实现递归块状展开**

```ts
printCollection(items: FormatNode[]): string {
    return items.map(printItem).join(',\n');
}
```

- [x] **Step 5: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/formatPrinter.test.ts src/__tests__/formatterIntegration.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: 提交结构化数据布局**

```bash
git add src/formatter/model/formatNodes.ts src/formatter/model/FormatModelBuilder.ts src/formatter/printer/FormatPrinter.ts src/__tests__/formatPrinter.test.ts src/__tests__/formatterIntegration.test.ts
git commit -m "feat(formatter): format structured LPC data blocks"
```

### Task 5: 补齐 `struct` / `class` 定义、`switch` 范围语法和 `foreach ref`

**Files:**
- Modify: `src/formatter/model/FormatModelBuilder.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`
- Modify: `src/__tests__/formatterIntegration.test.ts`

- [x] **Step 1: 写失败测试，覆盖 `struct/class` 定义、`case 1..5` 和 `foreach (ref mixed item in arr)`**

```ts
test('struct 与 class 定义按成员逐行布局', () => {
    const source = 'struct Weapon { string name; int damage; }';
    expect(format(source)).toContain('struct Weapon\n{\n    string name;');
});

test('switch 范围运算保持紧凑', () => {
    expect(format('switch(x){case 1..5: foo();}')).toContain('case 1..5:');
});

test('foreach ref 保持类型顺序和关键字位置', () => {
    expect(format('foreach(ref mixed item in arr){foo(item);}')).toContain('foreach (ref mixed item in arr)');
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/formatterIntegration.test.ts --runInBand`
Expected: FAIL，`struct/class` 或 `switch/foreach` 输出不符合预期

- [x] **Step 3: 实现对应 builder / printer 分支**

```ts
// struct/class member printing
// switch label printing keeps RANGE_OP compact
// foreach formatter preserves ref before type/name
```

- [x] **Step 4: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/formatterIntegration.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: 提交语法特例支持**

```bash
git add src/formatter/model/FormatModelBuilder.ts src/formatter/printer/FormatPrinter.ts src/__tests__/formatterIntegration.test.ts
git commit -m "feat(formatter): support lpc structural syntax cases"
```

## Chunk 3: Comments, Macros, Heredocs, And Final Verification

### Task 6: 接入注释归属与 Javadoc 规则

**Files:**
- Create: `src/formatter/comments/commentFormatter.ts`
- Create: `src/__tests__/commentFormatting.test.ts`
- Modify: `src/formatter/model/FormatModelBuilder.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`

- [x] **Step 1: 写失败测试，覆盖行尾注释提升、函数前注释跟随、Javadoc `*` 对齐**

```ts
test('多行展开时将行尾注释提升成独立注释', () => {
    const source = 'mapping data = ([ "name":"sword" ]); // weapon data';
    const output = format(source);
    expect(output).toContain('// weapon data\nmapping data = ([');
});

test('函数前独立注释跟随函数节点移动', () => {
    const source = '// demo\nvoid test(){return;}';
    const output = format(source);
    expect(output.startsWith('// demo\nvoid test()')).toBe(true);
});

test('Javadoc 只规范化星号对齐', () => {
    const source = '/**\n* @brief demo\n*/\nvoid test(){}';
    expect(format(source)).toContain(' * @brief demo');
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/commentFormatting.test.ts --runInBand`
Expected: FAIL，注释仍然停留在原位置或 Javadoc 未对齐

- [x] **Step 3: 基于 `TokenTriviaIndex` 实现注释归属**

```ts
// 函数/块前注释附着到下一个节点
// 行尾注释在节点从单行变多行时提升
// 结构化数据内部注释保守处理
```

- [x] **Step 4: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/commentFormatting.test.ts src/__tests__/tokenTriviaIndex.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: 提交注释处理**

```bash
git add src/formatter/comments/commentFormatter.ts src/formatter/model/FormatModelBuilder.ts src/formatter/printer/FormatPrinter.ts src/__tests__/commentFormatting.test.ts
git commit -m "feat(formatter): preserve and normalize comment ownership"
```

### Task 7: 实现宏和 heredoc / array delimiter 守卫

**Files:**
- Create: `src/formatter/macro/macroFormatter.ts`
- Create: `src/formatter/heredoc/heredocGuard.ts`
- Create: `src/__tests__/macroFormatting.test.ts`
- Create: `src/__tests__/heredocFormatting.test.ts`
- Modify: `src/formatter/model/FormatModelBuilder.ts`
- Modify: `src/formatter/FormattingService.ts`

- [x] **Step 1: 写失败测试，覆盖简单宏、复杂多行宏保守处理、`@TAG` / `@@TAG` 结束行列 0 约束**

```ts
test('简单宏允许规范空格', () => {
    expect(format('#define FOO(x,y) ((x)+(y))')).toBe('#define FOO(x, y) ((x) + (y))');
});

test('复杂多行宏保持 token 顺序', () => {
    const source = '#define FOO(x) \\\nif(x){ \\\nbar(x); \\\n}';
    expect(TestHelper.extractTokens(format(source))).toEqual(TestHelper.extractTokens(source));
});

test('heredoc 正文不动且结束行保持列 0', () => {
    const source = 'string msg = @TEXT\nhello\nTEXT;';
    const output = format(source);
    expect(output).toContain('\nTEXT;');
    expect(output).not.toContain('\n    TEXT;');
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npx jest src/__tests__/macroFormatting.test.ts src/__tests__/heredocFormatting.test.ts --runInBand`
Expected: FAIL，宏分类或 heredoc 守卫缺失

- [x] **Step 3: 实现宏安全分类与 heredoc 守卫**

```ts
export function classifyMacro(text: string): 'safe' | 'unsafe' { ... }
export function canSafelyFormatDelimitedText(node: FormatTarget): boolean { ... }
```

- [x] **Step 4: 对局部选中 heredoc / array delimiter 正文的情况直接拒绝**

```ts
if (target.kind === 'heredoc-body' || target.kind === 'array-delimiter-body') {
    return [];
}
```

- [x] **Step 5: 重新运行测试并确认通过**

Run: `npx jest src/__tests__/macroFormatting.test.ts src/__tests__/heredocFormatting.test.ts src/__tests__/rangeFormatting.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: 提交宏与定界符守卫**

```bash
git add src/formatter/macro/macroFormatter.ts src/formatter/heredoc/heredocGuard.ts src/formatter/model/FormatModelBuilder.ts src/formatter/FormattingService.ts src/__tests__/macroFormatting.test.ts src/__tests__/heredocFormatting.test.ts
git commit -m "feat(formatter): guard macros and delimited text blocks"
```

### Task 8: 完成集成验证与用户文档

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `src/__tests__/formatterIntegration.test.ts`

- [x] **Step 1: 补一个端到端回归测试，覆盖整文格式化、选区格式化、语法错误拒绝**

```ts
test('formatter 端到端行为符合首版约束', async () => {
    expect(await formatDocument(validDocument)).toHaveLength(1);
    expect(await formatRange(validDocument, validRange)).toHaveLength(1);
    expect(await formatDocument(invalidDocument)).toEqual([]);
});
```

- [x] **Step 2: 运行集成测试并修正缺口**

Run: `npx jest src/__tests__/formatterIntegration.test.ts --runInBand`
Expected: FAIL 后补齐，最终 PASS

- [x] **Step 3: 更新 README 和 CHANGELOG**

```md
- 新增 LPC 文档格式化和选区格式化
- 支持 `lpc.format.*` 基础配置
- heredoc / array delimiter / 复杂宏采用保守安全策略
```

- [x] **Step 4: 跑最终验证**

Run: `npx jest src/__tests__/formatterProvider.test.ts src/__tests__/formattingService.test.ts src/__tests__/formatPrinter.test.ts src/__tests__/rangeFormatting.test.ts src/__tests__/commentFormatting.test.ts src/__tests__/macroFormatting.test.ts src/__tests__/heredocFormatting.test.ts src/__tests__/formatterIntegration.test.ts --runInBand`
Expected: PASS

Run: `npm test -- --runInBand`
Expected: PASS

Run: `npm run build`
Expected: PASS，产出成功

- [ ] **Step 5: 提交最终结果**

```bash
git add README.md CHANGELOG.md src/formatter src/extension.ts package.json tests/mocks/MockVSCode.ts src/__tests__/formatterProvider.test.ts src/__tests__/formattingService.test.ts src/__tests__/formatPrinter.test.ts src/__tests__/rangeFormatting.test.ts src/__tests__/commentFormatting.test.ts src/__tests__/macroFormatting.test.ts src/__tests__/heredocFormatting.test.ts src/__tests__/formatterIntegration.test.ts
git commit -m "feat(formatter): add LPC document and range formatting"
```

## Plan Review Checklist

- 每个任务都能独立提交
- 每个任务都有明确失败测试和最小实现路径
- 计划始终以 `ParsedDocumentService` 为解析入口
- plan 中没有要求修改 `src/antlr/*`
- 高风险结构优先走保守策略
- 最终验证覆盖单测、完整测试和构建

Plan complete and saved to `docs/plans/2026-03-11-lpc-formatter-implementation-plan.md`. Ready to execute?
