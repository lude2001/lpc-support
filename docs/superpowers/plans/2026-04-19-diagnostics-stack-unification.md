# Diagnostics Stack Unification Implementation Plan

## 目标

按 `2026-04-19-diagnostics-stack-unification-design.md` 落地 diagnostics 减债包，完成：

- 统一 diagnostics stack 组装入口
- 删除 `DiagnosticsOrchestrator` 中已退场的 host document lifecycle 分支
- 删除 orchestrator fallback stack builder
- 删除重复的 `src/diagnostics/index.ts`
- 保持 diagnostics 行为与现有 shipping path 一致

## 范围

### 在范围内

- `src/diagnostics/`
- `src/modules/diagnosticsModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- diagnostics 相关单元/集成/runtime 测试

### 不在范围内

- `ASTManager` ownership 重构
- `DocumentSemanticSnapshotService` 挪层/正名
- diagnostics collector 语义重写
- runtime `vscodeShim` 重构
- parser / syntax / semantic 主路径调整

## 执行块

### Chunk 1：抽统一 diagnostics stack factory

#### 目标

引入单一 diagnostics stack factory，并让 extension module 与 LSP runtime 统一使用它。

#### 代码任务

1. 新增：
   - `src/diagnostics/createDiagnosticsStack.ts`
2. 把 stack 组装真源集中到该文件：
   - `collectors`
   - `diagnosticsService`
3. 明确收口公开装配入口：
   - `createDefaultDiagnosticsCollectors(...)` 不再作为独立公共装配 surface 保留
   - 如仍需存在，只能作为 `createDiagnosticsStack.ts` 内部实现细节或从唯一 diagnostics 主出口受控导出
   - 不允许 module/runtime 继续直接依赖它来拼 stack
4. 更新：
   - `src/modules/diagnosticsModule.ts`
   - `src/lsp/server/runtime/createProductionLanguageServices.ts`
5. 停止在上述两个生产入口里直接调用：
   - `createDefaultDiagnosticsCollectors(...)`
   - `createSharedDiagnosticsService(...)`
6. 补一条更早的静态/装配保护：
   - 锁定 `extension.ts -> registerDiagnostics -> shared factory` 这条链已经成立
   - 锁定 repo 当前不存在生产 import 指向 `src/diagnostics/index.ts`

#### 测试

新增或更新：

- `src/diagnostics/__tests__/createDiagnosticsStack.test.ts`
- `src/modules/__tests__/diagnosticsModule.test.ts`
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- 一个轻量 import-scan / activation-level guard test

并显式锁定：

- `registerDiagnostics(...)` 生产路径不再传递 lifecycle flag
- `extension.ts -> registerDiagnostics -> shared factory` 这条链成立

#### 验证命令

```powershell
npx jest --runInBand src/diagnostics/__tests__/createDiagnosticsStack.test.ts src/modules/__tests__/diagnosticsModule.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts <guard-test-path>
npx tsc --noEmit
```

#### review 关注点

- 是否真的只剩一条 diagnostics stack 生产装配入口
- module/runtime 是否没有再偷偷各自组装一套

### Chunk 2：清理 `DiagnosticsOrchestrator` 的 dead lifecycle 与 fallback builder

#### 目标

把 orchestrator 收成 UX-facing coordinator，不再保留 host lifecycle dead path，也不再自带 stack fallback builder。

#### 代码任务

1. 从 `src/diagnostics/DiagnosticsOrchestrator.ts` 中移除：
   - `registerDocumentLifecycle`
   - `onDidChangeTextDocument(...)`
   - `onDidCloseTextDocument(...)`
   - `onDidDeleteFiles(...)`
   - `clearDocumentAnalysisState(...)`
   - 仅为这些 listener 服务的状态维护
2. 移除：
   - `createDiagnosticsService()` 中的 fallback stack builder 责任
   - `initializeCollectors()` 中承担装配真源的责任
3. 让 orchestrator 只消费显式注入的 stack/test doubles

#### 测试

更新：

- `src/__tests__/diagnosticsOrchestrator.test.ts`
- `src/lsp/__tests__/diagnosticsParity.test.ts`
- `src/modules/__tests__/diagnosticsModule.test.ts`

需要显式证明：

- orchestrator 仍能手动分析文档
- folder scan 行为不变
- parity 结果未漂移
- 代码中不再存在 `registerDocumentLifecycle` 生产路径

#### 验证命令

```powershell
npx jest --runInBand src/__tests__/diagnosticsOrchestrator.test.ts src/lsp/__tests__/diagnosticsParity.test.ts src/modules/__tests__/diagnosticsModule.test.ts
npx tsc --noEmit
```

#### review 关注点

- orchestrator 是否还残留第二条 stack 装配路径
- lifecycle dead path 是否真的被删除而不是仅失活

### Chunk 3：删除重复 barrel 并补生产装配保护网

#### 目标

收掉 `src/diagnostics/index.ts`，并补齐一条真实生产接缝保护，证明删除重复出口后 bundle/bootstrap 仍然正确。

#### 代码任务

1. 删除：
   - `src/diagnostics/index.ts`
2. 统一 diagnostics 主出口
   - 明确只保留 `src/diagnostics.ts`
3. 更新 import 路径与相关测试
4. 补一条真实生产装配保护：
   - 优先考虑 `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
   - 如更合适，也可在 extension activation 侧补直接装配保护
5. 增加 import-scan 或 compile-style guard，证明：
   - repo 中无生产 import 指向 `src/diagnostics/index.ts`

这里的静态 import-scan 是删除 `src/diagnostics/index.ts` 的主 gate；
runtime / activation 真实装配测试用于删除后的回归保护，而不是替代静态证明。

#### 测试

新增或更新：

- `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
  - 或等价的 production activation wiring test
- 可能补一个轻量 import guard 测试

#### 验证命令

```powershell
npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/modules/__tests__/diagnosticsModule.test.ts
npx tsc --noEmit
npm test -- --runInBand
```

#### review 关注点

- 删除 `src/diagnostics/index.ts` 后是否还存在隐藏生产引用
- runtime / activation 的 diagnostics 装配是否仍然稳定

## 建议执行顺序

1. Chunk 1
2. Chunk 1 review
3. Chunk 2
4. Chunk 2 review
5. Chunk 3
6. whole-branch review

不要把三块一起改完再统一 review。

## 风险与应对

### 风险 1：orchestrator 测试会强依赖旧 fallback 语义

应对：

- 测试改成显式注入 stack 或 doubles
- 不为兼容旧测试保留第二条装配路径

### 风险 2：runtime 仍然通过旧 barrel 间接导入 diagnostics

应对：

- Chunk 1 先加静态 import guard
- Chunk 3 再加 runtime / activation 真实保护
- 补一条真实 production wiring 测试

### 风险 3：删 lifecycle 分支时误伤 folder scan / 手动分析

应对：

- 先保留手动 `analyzeDocument(...)` / `scanFolder()` 行为测试
- 用 parity 测试锁结果，不只看类型通过

## 完成标准

完成时必须同时满足：

1. diagnostics stack 只剩单一生产装配入口
2. `DiagnosticsOrchestrator` 不再包含 host lifecycle dead path
3. `DiagnosticsOrchestrator` 不再包含 fallback stack builder
4. `src/diagnostics/index.ts` 已删除
5. diagnostics parity 行为未变
6. 至少一条真实生产装配保护网存在
7. `npx tsc --noEmit` 通过
8. 全量 `npm test -- --runInBand` 通过
