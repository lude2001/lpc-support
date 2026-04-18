# Analysis Ownership Normalization Implementation Plan

## 目标

按 `2026-04-19-analysis-ownership-normalization-design.md` 落地 analysis owner 减债包，完成：

- 把 `DocumentSemanticSnapshotService` 从 `completion/` 正名迁出
- 建立统一可注入的分析入口
- 收瘦 `ASTManager` 为薄 facade
- 让生产代码停止把 `ASTManager.getInstance()` 当默认分析入口
- 不改变 parser/syntax/semantic 与用户可见行为

## 范围

### 在范围内

- `src/completion/documentSemanticSnapshotService.ts` 的迁移/正名
- `ASTManager`
- 直接依赖 `ASTManager.getInstance()` 的生产消费者
- 相关测试与 repo-level guard

### 不在范围内

- runtime 双文档真源统一
- `WorkspaceSession` / `createProductionLanguageServices` 的 composition root 重构
- 语言能力语义改动
- diagnostics / navigation / completion 的产品行为扩边

## 执行块

### Chunk 1：正名分析真源并引入统一接口

#### 目标

先把 owner 立起来，并给后续消费者迁移准备统一接口。

#### 代码任务

1. 将 `src/completion/documentSemanticSnapshotService.ts` 迁移到新的分析基础设施层
2. 新增统一分析入口接口
   - 至少包含：
     - `parseDocument(...)`
     - `getSyntaxDocument(...)`
     - `getSemanticSnapshot(...)`
     - `getSnapshot(...)`
     - `getBestAvailableSnapshot(...)`
     - `getBestAvailableSemanticSnapshot(...)`
     - `clearCache(...)`
     - `clearAllCache()`
3. 为过渡期保留必要路径兼容，但不得继续暴露 singleton 获取面
4. 更新 import，使新 owner 成为真实真源
5. 增加第一层 mechanical guard：
   - 生产源码不得继续从旧路径 `src/completion/documentSemanticSnapshotService.ts` 导入
   - 生产源码中 `DocumentSemanticSnapshotService.getInstance()` 的剩余集合必须显式白名单化或归零

#### 重点约束

- 只允许路径兼容 re-export
- 不允许继续从旧 completion 路径暴露 analysis service 的 singleton 获取面

#### 测试

- `parsedDocumentService.test.ts`
- `syntaxBuilder.test.ts`
- `semanticModelBuilder.test.ts`
- 为新接口 / 新路径新增最小直测

#### 验证

```powershell
npx jest --runInBand src/__tests__/parsedDocumentService.test.ts src/__tests__/syntaxBuilder.test.ts src/__tests__/semanticModelBuilder.test.ts
npx tsc --noEmit
```

### Chunk 2：切低风险生产消费者到显式注入

#### 目标

先切低风险、容易验证的消费者，建立注入主线和 repo-level guard。

#### 代码任务

1. 先建立显式 composition seams，再迁移消费者：
   - extension side 至少修改：
     - `src/modules/coreModule.ts`
     - 必要时相关 module 装配入口
   - server side 至少修改：
     - `src/lsp/server/runtime/createProductionLanguageServices.ts`
     - 必要时相关 runtime/service 装配入口
   - 目标是明确：`DocumentAnalysisService` 只能从这些 seams 分发，不能靠服务内部默认回退拿 singleton
2. 让这些低风险路径改为依赖统一分析入口，而不是 `ASTManager.getInstance()`：
   - `createDiagnosticsStack.ts`
   - `LanguageSemanticTokensService`
   - `LanguageFoldingService`
   - `symbolReferenceResolver.ts`
   - `targetMethodLookup.ts`
   - `SimulatedEfunScanner.ts`
   - `LanguageSymbolService`
   - `EfunLanguageHoverService`
   - `ScopedMethodIdentifierSupport`
   - `modules/coreModule.ts` cache invalidation bridge
3. 增加 repo-level mechanical guards：
   - 生产源码中 `ASTManager.getInstance()` 的剩余集合必须显式白名单化或归零
   - 生产源码中 `DocumentSemanticSnapshotService.getInstance()` 的剩余集合必须显式白名单化或归零
   - 生产源码不再从旧路径 `src/completion/documentSemanticSnapshotService.ts` 导入

#### 测试

- 对应服务的现有单测/集成测试
- 新增 guard test

#### 验证

```powershell
npx jest --runInBand <low-risk-consumer-tests> <guard-test-path>
npx tsc --noEmit
```

### Chunk 3：切高耦合消费者到显式注入

#### 目标

迁移 completion / signature help / navigation / object inference 相关主路径。

#### 代码任务

1. 迁移：
   - `LanguageCompletionService`
   - `LanguageDefinitionService`
   - `LanguageSignatureHelpService`
   - `InheritedFunctionRelationService`
   - `InheritedFileGlobalRelationService`
   - `InheritedSymbolRelationService`
   - `ScopedMethodResolver`
   - `ScopedMethodDiscoveryService`
   - `ObjectInferenceService`
   - `GlobalObjectBindingResolver`
   - `InheritedGlobalObjectBindingResolver`
2. 删除这些路径中对 `ASTManager.getInstance()` 的默认依赖
3. 保持 runtime / handler / provider 行为不漂

#### 测试

- `providerIntegration.test.ts`
- `navigationServices.test.ts`
- `LanguageDefinitionService.test.ts`
- `LanguageSignatureHelpService.test.ts`
- `ObjectInferenceService.test.ts`
- 相关 handler/runtime 回归

#### 验证

```powershell
npx jest --runInBand <integration-and-consumer-tests>
npx tsc --noEmit
```

### Chunk 4：收瘦 ASTManager 并删除 legacy 产品 API

#### 目标

在消费者切完后，把 `ASTManager` 收成真正的薄 facade。

#### 代码任务

1. 删除 legacy API：
   - `getCompletionItems(...)`
   - `getStructMemberCompletions(...)`
   - `getFunctionDefinition(...)`
   - `getHoverInfo(...)`
   - `getDiagnostics(...)`
2. 保留最小桥接职责：
   - `parseDocument(...)`
   - `getSyntaxDocument(...)`
   - `getSemanticSnapshot(...)`
   - `getSnapshot(...)` / best-available bridge
   - cache invalidation
3. 清理相应死测试、兼容路径和注释

#### 测试

- `astManager.test.ts`
- 受影响消费者的回归测试
- repo-level guard 继续通过

#### 验证

```powershell
npx jest --runInBand src/__tests__/astManager.test.ts <affected-consumer-tests>
npx tsc --noEmit
npm test -- --runInBand
```

## 风险与应对

### 风险 1：接口表面不完整，completion 仍被迫保留侧门

应对：

- 在 Chunk 1 就把 `getSnapshot(...)` / `getBestAvailableSnapshot(...)` / `getBestAvailableSemanticSnapshot(...)` 纳入接口

### 风险 2：迁移过程中 support/helper 自己偷偷 new 一份 analysis service

应对：

- 在 plan 执行中明确只有 extension/runtime composition seams 可以创建与分发 service
- helper/factory/support 只消费注入依赖

### 风险 3：repo 里仍残留 AST singleton 旁路

应对：

- 增加 mechanical guards
- 白名单显式化
- 每个 chunk review 都要求检查新增/残留调用点

## 完成标准

完成时必须同时满足：

1. `DocumentSemanticSnapshotService` 不再位于 `src/completion/`
2. 生产代码不再以 `ASTManager.getInstance()` 为默认分析入口
   - 剩余集合必须等于显式白名单或归零
3. 生产代码不再以 `DocumentSemanticSnapshotService.getInstance()` 为默认分析入口
   - 剩余集合必须等于显式白名单或归零
4. 生产代码不再从旧 completion snapshot 路径导入分析真源
5. extension side 与 server side 都通过明确装配 seam 分发 `DocumentAnalysisService`
6. `ASTManager` 不再保留 legacy completion/hover/definition/diagnostics API
7. parser/syntax/semantic 行为不变
8. `npx tsc --noEmit` 通过
9. 全量 `npm test -- --runInBand` 通过
