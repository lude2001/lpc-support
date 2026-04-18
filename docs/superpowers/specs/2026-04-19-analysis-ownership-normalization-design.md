# Analysis Ownership Normalization Design

## 背景

在 navigation / definition / diagnostics 的大类减债都收口后，当前最大的剩余架构债已经不再是某个业务服务“太大”，而是**分析真源的 owner 不清、注入边界不清**。

当前存在三个直接问题：

1. `ASTManager` 仍是跨层 god facade
   - 既持有 parse / syntax / semantic 访问
   - 又仍挂着 completion / hover / definition / diagnostics 等旧产品能力
2. `DocumentSemanticSnapshotService` 明明是分析真源，却还挂在 `src/completion/`
   - 名义 owner 错了
   - 也诱导后续代码把分析基础设施误当 completion 私有工具
3. 生产代码仍大量直接 `ASTManager.getInstance()`
   - runtime / module composition root 还没有真正拥有 parse/syntax/semantic 入口
   - 谁需要分析，谁就自己摸单例

这一包的目标不是重写 parser/syntax/semantic，也不是立刻重写 runtime composition root；而是先把**分析基础设施 owner**和**统一注入边界**固定下来。

## 目标

### 目标 1：把分析真源从 `completion/` 正名并迁出

当前：

- `src/completion/documentSemanticSnapshotService.ts`

本轮后应变成一个明确的分析基础设施服务，不再以 `completion` 为 owner。

### 目标 2：把 `ASTManager` 收瘦成薄 facade

`ASTManager` 只保留：

- `parseDocument(...)`
- `getSyntaxDocument(...)`
- `getSemanticSnapshot(...)`
- cache invalidation / best-available snapshot bridge

它不再保留产品级 helper：

- `getCompletionItems(...)`
- `getStructMemberCompletions(...)`
- `getFunctionDefinition(...)`
- `getHoverInfo(...)`
- `getDiagnostics(...)`

### 目标 3：建立统一可注入的分析入口

生产代码不再直接 `ASTManager.getInstance()`。

取而代之的是一个统一、可注入的分析入口接口，供：

- completion
- navigation
- signature help
- object inference
- structure
- diagnostics stack factory

统一依赖。

## 非目标

本轮不做：

- runtime 双文档真源（`DocumentStore` vs `vscodeShim.textDocuments`）统一
- `createProductionLanguageServices` / `WorkspaceSession` 的 composition root 重构
- parser / syntax / semantic 的层级重写
- object inference / scoped / navigation 语义变更

这些是后续包。

## 推荐路线

### 方案选择

本轮采用：

- **先正名 owner**
- **再引入统一分析接口**
- **最后让生产消费者切到注入**

不采用：

- 先大规模重构 server composition root
- 先把 runtime 文档真源改成单一来源
- 一边改 owner，一边改语义

原因很明确：  
如果不先把分析真源 owner 立起来，后续任何 runtime/container 改造都只是在搬运错误边界。

## 新的组件边界

### 1. `DocumentSemanticSnapshotService` 的新归属

建议迁移到：

- `src/semantic/documentSemanticSnapshotService.ts`

保留原有职责：

- `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` 组装
- snapshot / analysis cache
- refresh scheduling
- best-available snapshot

但不再把它放在 `completion/` 目录下。

### 2. 新的统一分析接口

新增一个最小、可注入的接口，例如：

```ts
export interface DocumentAnalysisService {
    parseDocument(document: vscode.TextDocument, useCache?: boolean): ParseResult;
    getSyntaxDocument(document: vscode.TextDocument, useCache?: boolean): SyntaxDocument | undefined;
    getSemanticSnapshot(document: vscode.TextDocument, useCache?: boolean): SemanticSnapshot;
    getSnapshot(document: vscode.TextDocument, useCache?: boolean): DocumentSemanticSnapshot;
    getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot;
    getBestAvailableSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot;
    clearCache(uri?: string): void;
    clearAllCache(): void;
}
```

名字可以在实现时再收敛，但它必须表达：

- 这是分析基础设施入口
- 不是 completion / navigation 私有 helper
- 不是新的“泛 AST 门面”

### 3. `ASTManager`

`ASTManager` 在本轮后的角色：

- 一个薄 facade / compatibility bridge
- 内部委托给真正的分析服务

它可以暂时继续存在，但：

- 不再承担产品级 helper
- 不再成为新代码默认注入点

### 4. 生产消费者

这些服务要逐步改成显式注入分析入口：

- `LanguageCompletionService`
- `LanguageDefinitionService`
- `LanguageSignatureHelpService`
- `LanguageSemanticTokensService`
- `LanguageFoldingService`
- `InheritedFunctionRelationService`
- `InheritedFileGlobalRelationService`
- `InheritedSymbolRelationService`
- `ScopedMethodResolver`
- `ScopedMethodDiscoveryService`
- `ObjectInferenceService`
- `GlobalObjectBindingResolver`
- `InheritedGlobalObjectBindingResolver`
- `diagnostics/createDiagnosticsStack.ts`
- `symbolReferenceResolver.ts`
- `targetMethodLookup.ts`
- `SimulatedEfunScanner.ts`
- `LanguageSymbolService`
- `EfunLanguageHoverService`
- `ScopedMethodIdentifierSupport`
- `modules/coreModule.ts` 中的 cache invalidation bridge

本轮完成后，生产代码里不应再新增 `ASTManager.getInstance()`。

若存在暂时无法在本轮迁走的 compat 调用点，必须在 spec / plan 中列成白名单，而不是默认放过。

## owner 与装配约束

本轮虽然**不**重做 runtime composition root，但必须把 analysis owner 边界写硬：

- `DocumentAnalysisService` 只能由现有 composition seams 创建与分发
  - extension side：模块装配层
  - server side：runtime service 装配层
- support / helper / factory / resolver 不得自行 `new` 或单独持有第二份 analysis service
- `createDiagnosticsStack`、resolver support、completion helpers 等只能消费注入进来的 analysis service
- 过渡期 re-export 只允许做路径兼容
  - 不允许继续暴露 singleton 获取面
  - 不允许借 re-export 保留第二条 owner 路径
- 生产源码不得继续从旧路径 `src/completion/documentSemanticSnapshotService.ts` 导入分析真源服务

## 代码迁移策略

### 第 1 步：正名与迁移分析真源

1. 把 `src/completion/documentSemanticSnapshotService.ts` 迁到新的分析层位置
2. 更新所有 import
3. 保留必要的兼容 re-export，只限过渡期

目标：

- 先把 owner 纠正
- 不在这一步改变行为

### 第 2 步：抽统一分析接口

1. 定义最小分析接口
2. 让 `ASTManager` 基于它实现/委托
3. 明确新代码依赖的是接口，不是 singleton

目标：

- 让“分析能力”有明确的注入契约

### 第 3 步：切生产消费者到注入

按风险从低到高切：

1. structure / diagnostics stack factory
2. completion / signature help
3. navigation / object inference 相关

目标：

- 生产代码中消除直接 `ASTManager.getInstance()` 依赖

### 第 4 步：删除 `ASTManager` 里的 legacy 产品 API

在消费者切完后，删除：

- `getCompletionItems(...)`
- `getStructMemberCompletions(...)`
- `getFunctionDefinition(...)`
- `getHoverInfo(...)`
- `getDiagnostics(...)`

以及相应的死测试/兼容路径。

## 失败语义

本轮必须保证：

- parse / syntax / semantic 结果不变
- completion / navigation / diagnostics 行为不变
- cache 失效语义不变
- spawned runtime 行为不变
- 生产源码级搜索不再新增 `ASTManager.getInstance()`
- 生产源码级搜索不再新增对旧 completion snapshot 路径的 import

本轮不接受：

- 通过默认参数继续把 `ASTManager.getInstance()` 当成“看不见的注入”
- 为了过渡，长期保留两套分析入口
- 把旧产品 helper 留在 `ASTManager` 里“以后再删”
- support/helper/factory 自己偷偷创建 analysis service

## 测试矩阵

### 1. 分析真源迁移保护

需要覆盖：

- `parsedDocumentService.test.ts`
- `syntaxBuilder.test.ts`
- `semanticModelBuilder.test.ts`
- `providerIntegration.test.ts`

目标：

- 确保分析真源迁移后 parser/syntax/semantic 主链不漂

### 2. `ASTManager` 收瘦保护

新增/更新：

- `astManager.test.ts`

目标：

- 明确锁定它保留的最小职责
- 明确锁定 legacy 产品 API 已移除

### 3. 生产消费者注入保护

针对主要服务补测试，确认：

- 不再直接调用 `ASTManager.getInstance()`
- 通过显式注入的分析入口工作

至少覆盖：

- `LanguageCompletionService`
- `LanguageDefinitionService`
- `LanguageSignatureHelpService`
- `ObjectInferenceService`
- `InheritedFunctionRelationService`
- `InheritedFileGlobalRelationService`
- `InheritedSymbolRelationService`
- `ScopedMethodDiscoveryService`
- `symbolReferenceResolver`
- `targetMethodLookup`
- `SimulatedEfunScanner`
- `LanguageSymbolService`
- `EfunLanguageHoverService`
- `ScopedMethodIdentifierSupport`
- `coreModule` cache invalidation bridge

### 4. 运行时回归

保留并复跑：

- `spawnedRuntime.integration.test.ts`
- `navigationHandlers.test.ts`
- `diagnosticsParity.test.ts`

目标：

- 确保 owner/注入变化不影响 shipping runtime

## 验收标准

完成后必须满足：

1. `DocumentSemanticSnapshotService` 不再位于 `src/completion/`
2. 生产代码不再直接依赖 `ASTManager.getInstance()` 作为默认分析入口
   - 若有白名单例外，必须在实现文档中明确列出且数量收敛
3. `ASTManager` 不再保留 legacy completion/hover/definition/diagnostics 产品 API
4. 分析入口通过统一接口注入主要消费者
5. parser/syntax/semantic 主链行为不变
6. `npx tsc --noEmit` 通过
7. 全量 `npm test -- --runInBand` 通过

## 后续衔接

本轮完成后，下一包就可以更干净地处理：

- runtime 双文档真源统一
- `createProductionLanguageServices` 真正成为唯一 server composition root
- `WorkspaceSession` 不再兼任 feature service 容器

也就是说，这一包解决的是：

- **analysis owner**

下一包解决的是：

- **runtime composition owner**
