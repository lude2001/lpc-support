# Server Language Context Unification Design

## 1. 概述

在 `0.45.1` 之后，`lpc-support` 的导航主线已经完成了第一轮减债：

- 旧的 `Workspace*` 工作区级导航子系统已退场
- `references / rename` 已收敛到“当前文件级 + 可证明继承链级”
- `definition / hover / signature help / scoped / object inference` 保持当前稳定语义

但 LSP server 侧仍保留了多套并行的 document/context 构造机械：

- navigation handler 使用 [`createNavigationCapabilityContext(...)`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/navigationHandlerContext.ts)
- completion handler 在 [`registerCompletionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/completion/registerCompletionHandler.ts) 内部自建了一套几乎同构的 `createCapabilityContext(...)`
- diagnostics runtime 在 [`DiagnosticsSession.ts`](/D:/code/lpc-support/src/lsp/server/runtime/DiagnosticsSession.ts) 内又维护了一套 workspace root/path 解析逻辑
- runtime [`vscodeShim.ts`](/D:/code/lpc-support/src/lsp/server/runtime/vscodeShim.ts) 还保留着自己的 URI/path/document 行为

这导致：

1. `fromFileUri / normalizeComparablePath / longest-prefix workspace root` 这类逻辑重复散落
2. handler 侧 document shim 行为很难保证长期一致
3. 某个 fix 经常只补到一套 shim，另一套继续沿旧路径漂移

本 spec 定义导航架构减债路线中的 `P1`：

**统一 server 侧的 language context / document / workspaceRoot 构造机械，但不改语言能力语义，也不整体重写 runtime `vscodeShim`。**

## 2. 问题陈述

### 2.1 当前存在多份并行的 server-side document/context builder

#### Navigation family

[`navigationHandlerContext.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/navigationHandlerContext.ts) 当前负责：

- 从 `DocumentStore` 读取协议层最新文本
- 构造 `LanguageCapabilityContext.document`
- 解析 `workspaceRoot`
- 提供：
  - `getText`
  - `getWordRangeAtPosition`
  - `lineAt`
  - `offsetAt`
  - `positionAt`
  - `vscode.Position / Range` 兼容对象

并被以下 handler 复用：

- [`registerDefinitionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerDefinitionHandler.ts)
- [`registerHoverHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerHoverHandler.ts)
- [`registerReferencesHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerReferencesHandler.ts)
- [`registerRenameHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerRenameHandler.ts)
- [`registerDocumentSymbolHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts)
- [`registerCodeActionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/codeActions/registerCodeActionHandler.ts)
- [`registerFoldingRangeHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts)
- [`registerSemanticTokensHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts)
- [`registerSignatureHelpHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts)

#### Completion

[`registerCompletionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/completion/registerCompletionHandler.ts) 当前又复制了一套近似实现：

- 也读 `DocumentStore`
- 也做 `workspaceRoot` longest-prefix 选择
- 也构造 `document`
- 但其 `lineAt / positionAt / range` 形态与 navigation 版并不完全相同

这已经不是“必要差异”，而是重复实现。

#### Diagnostics

[`DiagnosticsSession.ts`](/D:/code/lpc-support/src/lsp/server/runtime/DiagnosticsSession.ts) 当前虽然只需要轻量文档：

- `LanguageDocument.getText()`
- `workspaceRoot`

但它仍然复制了：

- `fromFileUri`
- `normalizeComparablePath`
- `isPathPrefix`
- workspaceRoot longest-prefix 解析

这意味着同一个“当前文档属于哪个 workspace root”问题，现在至少有 3 套实现。

### 2.2 这些重复逻辑已经构成真实维护风险

当前重复并不是纯审美问题，而是已经接近 bug 温床：

- `prepareRename` 那次 runtime 文档分裂修复，本质上就是不同 server 文档视图没有同步
- `navigationHandlerContext.ts` 已经要求返回真正的 `vscode.Position / Range`，否则下游会在运行时报 `isAfterOrEqual is not a function`
- completion 若继续保留自己的 shim，将来一旦 navigation 侧修正某个 document 行为，completion 很容易漏改

因此，下一步最有价值的不是增加新能力，而是让这些 handler 真正站在同一套 server-side language context builder 上。

## 3. 目标与非目标

### 3.1 目标

- 统一 server 侧 path/root 解析 helper
- 统一 handler 侧 `LanguageCapabilityContext` 与 document shim 构造
- 把所有当前复用 `createNavigationCapabilityContext(...)` 的 handler 收口到同一共享 builder
- 让 completion 不再保留一套独立但同构的 context shim
- 让 diagnostics 至少复用相同的 path/root 解析与轻量 document 构造

### 3.2 非目标

本轮 **不** 做以下事情：

- 不修改 `definition / hover / references / rename / signature help / completion / diagnostics` 的产品语义
- 不重写 [`vscodeShim.ts`](/D:/code/lpc-support/src/lsp/server/runtime/vscodeShim.ts) 整体行为
- 不改变 `DocumentStore` 的真源角色
- 不改变 `WorkspaceSession` 对外契约
- 不顺手拆分 [`LanguageDefinitionService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageDefinitionService.ts)
- 不顺手瘦身 [`astManager.ts`](/D:/code/lpc-support/src/ast/astManager.ts)
- 不改 formatter handler；它当前只消费 `DocumentStore` 文本，不属于本轮共享 language context 的同构问题

## 4. 方案对比

### 4.1 推荐方案：共享 server-side language context factory

做法：

- 新增一组共享构造器/工具
- 统一：
  - `fromFileUri`
  - `normalizeComparablePath`
  - workspace root longest-prefix 解析
  - navigation/completion handler 的 document shim
- diagnostics 通过轻量出口复用相同底层 helper

优点：

- 风险可控
- 最大化消除当前最明显的复制粘贴
- 不必一次性重写 runtime `vscodeShim`

缺点：

- `vscodeShim.ts` 仍会保留自己的内部 URI/path 行为
- 这是“先统一 server builder”，不是“全仓单一实现”

### 4.2 激进方案：连 `vscodeShim` 一起整体统一

做法：

- 不只统一 handler/completion/diagnostics
- 连 runtime `vscodeShim.ts` 的 URI/path/document 构造也一起收进共享底层

优点：

- 理论上最干净

缺点：

- 改动面过大
- 会把 `DocumentStore`、runtime text mirror、`openTextDocument` 行为一起拉进迁移
- 与本轮“结构减债而非 runtime 重写”的目标不匹配

### 4.3 过窄方案：只统一 path/root helper，不统一 document shim

做法：

- 只抽 `fromFileUri / normalizeComparablePath / resolveWorkspaceRoot`
- navigation / completion 各自保留自己的 document shim

优点：

- 最稳

缺点：

- 收益太小
- 最大的重复恰恰仍然留在 document/context builder

### 4.4 结论

本 spec 采用 **4.1 推荐方案**：

**统一 server 侧 language context 构造，但不在本轮重写整个 runtime `vscodeShim`。**

## 5. 架构设计

### 5.1 两层结构

本轮推荐新增两层：

#### `serverPathUtils.ts`

建议位置：

- `src/lsp/server/runtime/serverPathUtils.ts`
  - 或
- `src/lsp/server/shared/serverPathUtils.ts`

职责：

- 只放纯 helper，不触碰 `DocumentStore`
- 包含：
  - `fromFileUri(uri: string): string`
  - `normalizeComparablePath(path: string): string`
  - `isPathPrefix(root: string, candidate: string): boolean`
  - `resolveWorkspaceRootFromRoots(documentUri: string | undefined, roots: string[]): string`

要求：

- 所有 server-side path/root 解析都改从这里走
- 不再允许 navigation/completion/diagnostics 各自维护一份副本

#### `ServerLanguageContextFactory.ts`

建议位置：

- `src/lsp/server/runtime/ServerLanguageContextFactory.ts`

职责：

- 持有 `DocumentStore` 与 `WorkspaceSession`
- 统一构造：
  - 完整 `LanguageCapabilityContext`
  - 完整 document shim
  - diagnostics 需要的轻量 `LanguageDocument` 与 `workspaceRoot`

### 5.2 推荐接口

推荐接口不做“大而全万能工厂”，而是明确给出两个出口：

```ts
export class ServerLanguageContextFactory {
    public constructor(
        private readonly documentStore: DocumentStore,
        private readonly workspaceSession: WorkspaceSession
    ) {}

    public createCapabilityContext(documentUri?: string): LanguageCapabilityContext { ... }

    public createDiagnosticsRequestContext(documentUri: string): {
        document: LanguageDocument;
        workspaceRoot: string;
    } { ... }
}
```

内部共享：

- `resolveWorkspaceRoot(...)`
- `createDocumentShim(...)`
- `createLightweightDocument(...)`

这样做的原因是：

- navigation / completion / signature help / structure / codeAction 需要完整 `LanguageCapabilityContext`
- diagnostics 只需要较轻的 `document + workspaceRoot`
- 不必为了形式统一，强迫 diagnostics 也拿一份完整 navigation-style document shim

## 6. 共享 document shim 契约

### 6.1 必须保留的行为

新的共享 document shim 至少必须保持 navigation 当前依赖的行为：

- `uri`
  - `toString()`
  - `fsPath`
  - `path`
  - `scheme`
- `version`
- `fileName`
- `languageId`
- `lineCount`
- `getText(range?)`
- `getWordRangeAtPosition(position)`
- `lineAt(lineOrPosition)`
- `offsetAt(position)`
- `positionAt(offset)`

### 6.2 关键兼容约束

- `getWordRangeAtPosition(...)` 返回值必须继续使用真正的 `vscode.Range`
- `lineAt(...).range` 与 `rangeIncludingLineBreak` 也必须继续使用真正的 `vscode.Range / Position`
- 不能退回纯对象字面量，否则 rename / definition 等下游会再次触发运行时方法缺失

### 6.3 Completion 的处理方式

completion 之前那份 shim 与 navigation 略有差异，但本轮不建议保留独立实现。

推荐做法：

- 共享同一份 document shim 底座
- 如果 completion 某处确实只需要更轻的返回形态，应在共享 factory 内部以明确、小范围分支处理
- 不要再让 `registerCompletionHandler.ts` 自己维护一份整套 builder

## 7. 消费者范围

### 7.1 必须切到共享 factory 的 handler

当前所有复用 `createNavigationCapabilityContext(...)` 的 handler 都应切到共享 factory：

- [`registerDefinitionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerDefinitionHandler.ts)
- [`registerHoverHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerHoverHandler.ts)
- [`registerReferencesHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerReferencesHandler.ts)
- [`registerRenameHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerRenameHandler.ts)
- [`registerDocumentSymbolHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts)
- [`registerCodeActionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/codeActions/registerCodeActionHandler.ts)
- [`registerFoldingRangeHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts)
- [`registerSemanticTokensHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts)
- [`registerSignatureHelpHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts)

### 7.2 Completion

[`registerCompletionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/completion/registerCompletionHandler.ts) 必须改用共享 factory，不再保留本地 `createCapabilityContext(...)`、`fromFileUri(...)`、`normalizeComparablePath(...)` 等私有实现。

### 7.3 Diagnostics

[`DiagnosticsSession.ts`](/D:/code/lpc-support/src/lsp/server/runtime/DiagnosticsSession.ts) 至少要改为：

- 复用共享 path/root helper
- 通过 factory 的轻量出口创建 diagnostics request 所需上下文

### 7.4 明确不在范围内的 handler

[`registerFormattingHandlers.ts`](/D:/code/lpc-support/src/lsp/server/handlers/formatting/registerFormattingHandlers.ts) 当前只基于 `DocumentStore` 文本和 range 做 format 调用，不消费同构的 `LanguageCapabilityContext`，因此不纳入本轮收敛范围。

## 8. 迁移顺序

### 8.1 第一步：抽 `serverPathUtils`

先把重复的：

- `fromFileUri`
- `normalizeComparablePath`
- `isPathPrefix`
- `resolveWorkspaceRootFromRoots`

收成一处，然后让：

- navigation handler context
- completion handler
- diagnostics session

都先切到同一套 path/root helper。

这是本轮风险最低的第一步。

### 8.2 第二步：引入 `ServerLanguageContextFactory`

先让 navigation family 切到共享 factory：

- definition / hover / references / rename / documentSymbol
- codeAction / foldingRange / semanticTokens / signatureHelp

这样可以用一条现有最稳定的路径替换 `createNavigationCapabilityContext(...)`。

### 8.3 第三步：completion 切换

再让 completion 切到共享 factory。

这一阶段要特别检查：

- completion request 的 document 行为
- completion resolve 时 `documentUri` 缺省路径
- `lineAt / offsetAt / positionAt` 对补全位置推断的影响

### 8.4 第四步：diagnostics 轻量出口切换

最后让 diagnostics 从共享 factory 获取轻量 request context。

这样做的原因是 diagnostics 对 document 需求最少，但对 workspaceRoot 正确性要求很高，适合作为共享 path/root helper 的最后一段验证。

## 9. 风险与缓解

### 风险 1：Completion 行为因统一 shim 发生细微漂移

缓解：

- completion 单独保留一组 handler 级回归
- 必要时在共享 factory 内提供受控的小差异出口，而不是保留整份复制实现

### 风险 2：Diagnostics 被强迫吃完整 navigation shim，导致结构变重

缓解：

- diagnostics 明确走轻量出口
- 只共享底层 path/root/helper 与少量 document 构造逻辑

### 风险 3：统一过程中又重新引入 runtime 文档视图分裂

缓解：

- 明确 `DocumentStore` 是协议层最新文本真源
- 共享 factory 一律从 `DocumentStore` 读协议文本
- 不在本轮改变 `registerCapabilities.ts -> __syncTextDocument(...)` 的同步策略

### 风险 4：改了一半 handler，留下半过渡层

缓解：

- 验收口径必须是“所有当前复用 `createNavigationCapabilityContext(...)` 的 handler 都切到共享 factory”
- 不能只迁移导航目录下的几个 handler

## 10. 测试矩阵

### 10.1 共享 util / factory 单测

新增测试应覆盖：

- `fromFileUri`
- `normalizeComparablePath`
- workspace root longest-prefix 选择
- document shim：
  - `getText`
  - `getWordRangeAtPosition`
  - `lineAt`
  - `offsetAt`
  - `positionAt`
- Windows `file://` 路径规范化边界

### 10.2 Handler 集成测试

必须保持以下 handler 回归继续通过：

- navigation handler tests
- code action handler tests
- folding range / semantic tokens tests
- signature help handler tests

并新增至少一条验证：

- 这些 handler 不再直接依赖各自私有 shim 构造器，而是通过共享 factory 装配

### 10.3 Completion 回归

必须覆盖：

- completion request 正常返回
- completion resolve 正常返回
- `documentUri` 缺省时仍能构造安全 context
- completion 使用的 `document` 行为不发生语义漂移

### 10.4 Diagnostics/runtime 回归

必须覆盖：

- `DiagnosticsSession` 的 workspaceRoot 解析不变
- 未保存文本仍以 `DocumentStore` 为真源
- runtime integration 不重新引入文档视图分裂问题

## 11. 验收标准

完成本轮后，应满足：

1. navigation / completion / diagnostics 不再各自维护一套 path/root helper
2. 所有当前复用 `createNavigationCapabilityContext(...)` 的 handler 都切到共享 factory
3. completion 不再保留独立但同构的 document/context builder
4. diagnostics 至少复用相同 path/root helper 与轻量上下文出口
5. `npx tsc --noEmit` 通过
6. 相关 handler 测试通过
7. spawned runtime 关键回归通过

## 12. 设计结论

本轮 `P1` 的目标不是改变语言能力，而是：

**把“server 如何从协议文本构造 language context”这件事收敛成一条共享 builder。**

它承接 `P0` 的结果：

- `P0` 删除了已经退场的旧导航系统
- `P1` 继续删除仍然活着的重复 server-side shim

等这一步完成后，才适合继续进入 `P2`：

- 拆 `LanguageDefinitionService`
- 瘦 `ASTManager`
- 正名 `DocumentSemanticSnapshotService`

也就是说，`P1` 是从“退场旧系统”走向“统一现役 glue”的过渡层收口步骤。它做完之后，LSP server 侧的主路径表达才会真正与当前产品现实一致。
