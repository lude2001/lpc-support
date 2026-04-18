# Diagnostics Stack Unification Design

## 背景

当前 diagnostics 相关主路径已经不再是“功能缺失”，而是“装配边界不够干净”：

- `src/modules/diagnosticsModule.ts`
  - 生产激活路径会手动构建 `collectors + diagnosticsService`
  - 同时把 `registerDocumentLifecycle` 永久钉成 `false`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
  - 又单独构建了一套 `collectors + diagnosticsService`
- `src/diagnostics/DiagnosticsOrchestrator.ts`
  - 仍保留自己的 fallback builder
  - 仍保留 host-side document lifecycle 注册分支
- `src/diagnostics/index.ts`
  - 作为重复 barrel 残留在仓库里，没有独立生产调用方

这会造成三个明确问题：

1. 同一 diagnostics stack 有多套组装路径
2. 生产主路径已退场的 lifecycle 逻辑仍保留在实现里
3. diagnostics 公共出口同时存在两份，增加维护面

本轮目标不是改变 diagnostics 行为，而是把这些重复和死代码收掉。

## 目标

### 目标 1：统一 diagnostics stack 组装入口

extension 激活路径与 LSP runtime 必须复用同一条 diagnostics stack factory。

这条 factory 负责产出：

- `collectors`
- `diagnosticsService`

不再允许：

- `diagnosticsModule.ts` 自己拼一套
- `createProductionLanguageServices.ts` 再拼一套
- `DiagnosticsOrchestrator` fallback 再拼第三套但用不同来源

### 目标 2：删除 host-side document lifecycle 的死分支

当前生产路径中，`registerDocumentLifecycle` 已固定为 `false`，因此：

- `onDidChangeTextDocument`
- `onDidOpenTextDocument`
- `onDidCloseTextDocument`
- `onDidDeleteFiles`

这整组注册逻辑在 shipping path 上已不生效。

本轮应把它从 `DiagnosticsOrchestrator` 中移除，而不是继续保留为“也许以后会用”的兼容层。

### 目标 3：删除重复 diagnostics barrel

当前同时存在：

- `src/diagnostics.ts`
- `src/diagnostics/index.ts`

其中后者没有独立生产调用价值，属于残留 compatibility surface。

本轮应清掉这份重复 barrel，并统一保留单一 diagnostics 出口。

## 非目标

本轮不做以下事情：

- 不改变 diagnostics 诊断结果语义
- 不改变 parser / syntax / semantic 真源
- 不重做 `DiagnosticsOrchestrator` 的 UX 职责
- 不重写 `FolderScanner`
- 不把 diagnostics 改造成新的 runtime cache layer
- 不处理更重的 `ASTManager` / `DocumentSemanticSnapshotService` owner 问题

## 推荐方案

### 方案选择

本轮采用：

- **单一 diagnostics stack factory**
- **保留 `DiagnosticsOrchestrator` 为 UX-facing coordinator**
- **删除 host lifecycle dead path**

不采用：

- 再造一个更大的 diagnostics service locator
- 把 orchestrator 和 runtime 统一成同一个运行时类
- 为了“将来可能会用”保留 `registerDocumentLifecycle` 开关

## 新的组件边界

### `createDiagnosticsStack(...)`

新增一个统一的 diagnostics stack factory，位置建议为：

- `src/diagnostics/createDiagnosticsStack.ts`

它负责：

1. 基于 `MacroManager` 构建默认 collectors
2. 基于 `ASTManager` 和 collectors 构建 shared diagnostics service
3. 返回统一结果：

```ts
interface DiagnosticsStack {
    collectors: IDiagnosticCollector[];
    diagnosticsService: LanguageDiagnosticsService;
}
```

输入建议收成最小依赖：

```ts
interface CreateDiagnosticsStackOptions {
    macroManager: MacroManager;
    astManager?: ASTManager;
}
```

`astManager` 缺省时可回退到 `ASTManager.getInstance()`，但所有生产调用方最终都应复用这一 factory，而不是各自再调用 `createSharedDiagnosticsService(...)`。

### `DiagnosticsOrchestrator`

`DiagnosticsOrchestrator` 保留，但职责要收窄成：

- 管理 `DiagnosticCollection`
- 暴露 `analyzeDocument(...)`
- 暴露 `scanFolder()`
- 管理变量面板与 folder scanner 等扩展 UX 行为

它不再负责：

- 注册 host document lifecycle listeners
- 维护 `registerDocumentLifecycle` 分支
- 自己拼出 diagnostics stack

但不能：

- 再用与 module/runtime 不同的 collector/service 组装路径
- 在构造函数里保留任何 fallback builder

也就是说：

- production path 必须显式注入统一 stack
- 测试若需要构造 orchestrator，也应通过同一 factory 或显式 test doubles 注入
- 不允许以“方便测试”为理由在 orchestrator 内保留第二条装配路径

### `diagnosticsModule.ts`

模块装配改成：

1. 取 `macroManager`
2. 调用 `createDiagnosticsStack(...)`
3. 把统一 stack 注入 `DiagnosticsOrchestrator`
4. 注册到 `ServiceRegistry`

它不再：

- 手工调用 `createDefaultDiagnosticsCollectors(...)`
- 手工调用 `createSharedDiagnosticsService(...)`
- 传入 `registerDocumentLifecycle: false`
- 保留“若 active editor 是 lpc 就分析”的 dead guard

### `createProductionLanguageServices.ts`

LSP runtime 侧改成：

1. 取 `macroManager`
2. 调用同一个 `createDiagnosticsStack(...)`
3. 只消费 `diagnosticsService`

它不再：

- 本地重建 `createDefaultDiagnosticsCollectors(...)`
- 本地重建 `createSharedDiagnosticsService(...)`

### diagnostics exports

统一出口后：

- 保留一个 diagnostics 主出口
- 删除 `src/diagnostics/index.ts`

如果需要额外导出 `createDiagnosticsStack(...)`，应从唯一保留的 diagnostics 主出口统一导出。

## 代码迁移策略

### 第 1 步：引入统一 stack factory

先新增 `createDiagnosticsStack.ts`，抽出当前重复的：

- `createDefaultDiagnosticsCollectors(...)`
- `createSharedDiagnosticsService(...)` 组合逻辑

### 第 2 步：让 extension 与 runtime 走同一路径

分别替换：

- `src/modules/diagnosticsModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`

使它们只依赖新 factory。

### 第 3 步：删除 orchestrator dead lifecycle path 与 fallback builder

从 `DiagnosticsOrchestrator` 中移除：

- `registerDocumentLifecycle` 选项
- `registerCommandsAndEvents()` 中的 document lifecycle 注册分支
- `onDidChangeTextDocument(...)`
- `onDidCloseTextDocument(...)`
- `onDidDeleteFiles(...)`
- `clearDocumentAnalysisState(...)`
- 与这些 listener 专门绑定的缓存清理逻辑
- `createDiagnosticsService()` 中的 fallback builder 责任
- `initializeCollectors()` 中承担装配真源的责任

保留对 `analyzeDocument(...)` / `scanFolder()` 仍然必要的最小状态。

### 第 4 步：删除重复 barrel

确认无生产 import 依赖后，删除：

- `src/diagnostics/index.ts`

并统一保留：

- `src/diagnostics.ts`

## 失败语义

本轮必须保证：

- diagnostics 结果不因装配入口变化而改变
- extension 激活路径与 LSP runtime 仍得到同构 collectors / shared diagnostics service
- 删除 host lifecycle 分支后，现有 shipping path 行为保持不变

本轮不接受：

- 为保留旧测试而继续保留 `registerDocumentLifecycle` 开关
- 把 `DiagnosticsOrchestrator` 改成新的大而全 service
- 在 runtime 侧保留“临时” diagnostics stack 旁路

## 测试矩阵

### 1. factory 单测

新增对 `createDiagnosticsStack(...)` 的直接测试，至少覆盖：

- 默认构建返回 collectors 与 diagnosticsService
- 显式传入 `astManager` 时被使用
- 产出的 shared diagnostics service 可直接收集 diagnostics

### 2. `diagnosticsModule` 集成测试

更新 `src/modules/__tests__/diagnosticsModule.test.ts`，改为锁定：

- `registerDiagnostics(...)` 调用统一 factory
- 不再传入 `registerDocumentLifecycle`
- 仍把 `DiagnosticsOrchestrator` 注册到 `ServiceRegistry`
- 仍正常追踪 `dispose()`

### 3. `createProductionLanguageServices` 测试

补/改 runtime 组装测试，锁定：

- diagnostics service 来自统一 factory
- runtime 不再本地重建 collectors/service

### 4. diagnostics parity / orchestrator 回归

保留并更新：

- `src/lsp/__tests__/diagnosticsParity.test.ts`
- `src/__tests__/diagnosticsOrchestrator.test.ts`

重点证明：

- shared diagnostics 结果未漂移
- orchestrator 仍能手动分析文档
- folder scan 行为不变

### 5. runtime / activation 真实接缝保护

至少补一条真实生产装配保护网，二选一即可：

- spawned server diagnostics 路径
- extension activation diagnostics 装配路径

目标不是重复 parity 断言，而是锁住：

- bundle / bootstrap 仍能解析 diagnostics 主出口
- runtime 仍从统一 stack factory 拿到 diagnostics service
- 删除重复 barrel 后不会在生产构建中悄悄断线

### 6. 负向保护

补一条明确保护：

- repo 中不再存在 `registerDocumentLifecycle` 生产开关的活跃使用路径
- repo 中不再存在 `src/diagnostics/index.ts` 的生产 import

## 验收标准

完成后应满足：

1. `diagnosticsModule.ts` 与 `createProductionLanguageServices.ts` 共用同一 diagnostics stack factory
2. `DiagnosticsOrchestrator` 不再包含 host document lifecycle dead path
3. `DiagnosticsOrchestrator` 不再保留 fallback stack builder
4. `src/diagnostics/index.ts` 被删除
5. diagnostics parity 行为不变
6. `npx tsc --noEmit` 通过
7. diagnostics / module / runtime 相关测试通过

## 后续衔接

本轮完成后，diagnostics 相关主债会从：

- “重复装配 + 死分支 + 重复出口”

收敛成：

- “ASTManager / DocumentSemanticSnapshotService 的 owner 归属仍偏重”

也就是说，这包是继续推进整体架构收口的前置清理包，不是最终的分析层 owner 重构。
