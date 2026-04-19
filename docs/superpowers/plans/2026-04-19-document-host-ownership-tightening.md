# Document Host Ownership Tightening Plan

## Goal

把 production 的 ambient document-host fallback 收回到 composition roots，消灭 `defaultTextDocumentHost/defaultWorkspaceDocumentHost` 的生产旁路，同时保持现有行为不变。

## Step 1: Tighten the shared owner boundary

- 更新 `src/language/shared/WorkspaceDocumentPathSupport.ts`
- 明确 host factory / host owner 的边界
- 让 `WorkspaceDocumentPathSupport` 需要显式 `host`
- 准备 ownership guard 所需的稳定 import / callsite 形态

## Step 2: Rewire language/object-inference services to explicit hosts

- 去掉这些类里的 ambient host fallback：
  - `InheritedFunctionRelationService`
  - `InheritedFileGlobalRelationService`
  - `LanguageDefinitionService`
  - `LanguageSignatureHelpService`
  - `GlobalObjectBindingResolver`
  - `InheritedGlobalObjectBindingResolver`
  - `scopedInheritanceTraversal`
  - `ScopedMethodCompletionSupport`
- 按职责选择注入：
  - `TextDocumentHost`
  - 或 `WorkspaceDocumentPathSupport`

## Step 3: Rewire extension/UI production callers

- 收口：
  - `FunctionDocPanel`
  - `FolderScanner`
  - `commandModule`
  - `MacroManager`
- 它们改从 registry / root-owned support 拿 document host
- 不再直接 import ambient default host

## Step 4: Update composition roots

- `src/modules/coreModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`

工作内容：

- 构建 shared host / path support
- 向所有需要的消费者显式传递
- 让 root 成为 production 唯一 host owner

## Step 5: Guards and verification

- 扩展 `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
- 补 service / runtime wiring tests
- 跑：
  - `npx tsc --noEmit`
  - `npm test -- --runInBand`

## Out of Scope

- `vscodeShim.ts` 整体重写
- parser / syntax / semantic 主路径调整
- path 算法语义改写
- UI 功能变化
