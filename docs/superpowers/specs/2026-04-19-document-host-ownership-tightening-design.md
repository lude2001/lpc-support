# Document Host Ownership Tightening

## Context

`WorkspaceDocumentPathSupport` 已经成为共享 document/path 基础设施，但生产代码仍然能通过两种方式绕开“显式 owner”约束：

1. 直接导入 `defaultTextDocumentHost` / `defaultWorkspaceDocumentHost`
2. 依赖构造函数里的 `host ?? defaultTextDocumentHost` / `host ?? defaultWorkspaceDocumentHost`

这会让 document 打开与 workspace 文件发现继续保留 ambient fallback，而不是由 composition roots 明确拥有。

当前典型残留点包括：

- `src/functionDocPanel.ts`
- `src/diagnostics/FolderScanner.ts`
- `src/modules/commandModule.ts`
- `src/macroManager.ts`
- `src/objectInference/GlobalObjectBindingResolver.ts`
- `src/objectInference/InheritedGlobalObjectBindingResolver.ts`
- `src/objectInference/scopedInheritanceTraversal.ts`
- `src/language/services/navigation/InheritedFunctionRelationService.ts`
- `src/language/services/navigation/InheritedFileGlobalRelationService.ts`
- `src/language/services/navigation/LanguageDefinitionService.ts`
- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- `src/language/services/completion/ScopedMethodCompletionSupport.ts`

## Goal

把 production 中的 document-host 选择权收回到 composition roots：

- 只有 composition roots 可以决定使用哪一个 document host
- 生产消费者只能接收显式注入的 `host` 或 `WorkspaceDocumentPathSupport`
- 不再允许 service / helper / UI 组件在内部悄悄回退到 ambient default host

## Non-goals

- 不改变 document 打开、workspace root 解析、include/inherit 路径解析的产品语义
- 不重写 `WorkspaceDocumentPathSupport` 的路径算法
- 不改 parser / syntax / semantic 主路径
- 不清理测试或示例里的轻量默认 seam，除非它们影响生产 owner 约束

## Recommended Approach

### 1. Host factories stay centralized, but ambient defaults stop being a production seam

`WorkspaceDocumentPathSupport.ts` 保留 host 接口与 shared path logic，但默认 host 不再作为生产代码可自由依赖的 ambient singleton。

设计约束：

- 只允许 composition roots 创建 VS Code-backed host
- 生产消费者不直接导入 `defaultTextDocumentHost` / `defaultWorkspaceDocumentHost`
- `WorkspaceDocumentPathSupport` 需要显式 `host`

可接受的形态：

- shared module 导出 `createVsCodeTextDocumentHost()` / `createVsCodeWorkspaceDocumentHost()`
- 或保留现有 host 对象但仅由 composition roots 使用

核心原则不是名字，而是 owner：

- root owns host creation
- consumers receive host explicitly

### 2. Remove constructor fallbacks in production services

下列生产服务/辅助类需要去掉 `host ?? default...` 逻辑：

- `InheritedFunctionRelationService`
- `InheritedFileGlobalRelationService`
- `LanguageDefinitionService`
- `LanguageSignatureHelpService`
- `GlobalObjectBindingResolver`
- `InheritedGlobalObjectBindingResolver`
- `scopedInheritanceTraversal`
- `ScopedMethodCompletionSupport`

这些类应改成：

- 接受显式注入的 `host`
- 或接受显式注入的 `WorkspaceDocumentPathSupport`

哪一层更合适，按职责定：

- 只需要 `openTextDocument` 的类：注入 `TextDocumentHost`
- 同时需要 path 解析的类：注入 `WorkspaceDocumentPathSupport`

### 3. Extension/UI callers also stop opening documents through ambient defaults

以下 extension/UI 层生产路径也要收口：

- `FunctionDocPanel`
- `FolderScanner`
- `commandModule`
- `MacroManager`

设计方向：

- 从 core/root 注册 shared host 或 shared `WorkspaceDocumentPathSupport`
- command/UI 层通过 registry/service injection 取得 owner
- 不再在业务代码里直接导入 `defaultTextDocumentHost`

### 4. Composition roots become the only production host owners

本轮仅允许下列生产入口显式决定 host：

- `src/modules/coreModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`

它们负责：

- 构建 VS Code-backed host
- 注册/传递 shared `WorkspaceDocumentPathSupport`
- 把 host 注入给语言服务、object inference、UI/command 侧消费者

## Testing Strategy

### Ownership guards

扩展 `src/__tests__/documentAnalysisOwnershipGuard.test.ts`：

- 生产代码中 `defaultTextDocumentHost` / `defaultWorkspaceDocumentHost` 的 import 白名单应只剩 composition roots
- 生产代码中不再存在 `host ?? defaultTextDocumentHost`
- 生产代码中不再存在 `host ?? defaultWorkspaceDocumentHost`

### Service tests

补服务级回归，证明显式 host 注入后行为不变：

- navigation / definition
- signature help
- inherited relation services
- scoped completion support
- global object binding resolvers

### Extension/runtime tests

补 wiring 测试，证明：

- coreModule 注册 shared host / path support
- production runtime wiring 使用同一份 host owner
- command/UI 侧不再自己偷开 document host

## Acceptance Criteria

- 生产代码中 document host 的创建只发生在 composition roots
- 生产消费者不再导入 ambient default host
- service/helper 构造函数不再默默 fallback 到 ambient default host
- `WorkspaceDocumentPathSupport` 成为唯一共享 path/document opening owner
- `npx tsc --noEmit` 通过
- `npm test -- --runInBand` 通过
