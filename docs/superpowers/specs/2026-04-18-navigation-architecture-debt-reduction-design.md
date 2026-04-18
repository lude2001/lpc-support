# 导航架构减债路线设计

## 1. 概述

截至 `0.45.1`，`lpc-support` 的导航主线已经重新收敛到“当前文件级 + 可证明继承链级”的保守边界：

- `references`
  - 函数、文件级全局变量只保留当前文件与可证明继承链级结果
- `rename`
  - 仅支持局部变量、函数参数、文件级全局变量
- `definition / hover / signature help / scoped method / object inference`
  - 继续沿当前已落地的静态主路径运行

这次收敛把产品行为拉回了 LPC 语义当前真正能承受的范围，但也暴露出一类新的技术债：

- 已退出生产主路径的旧工作区导航子系统仍完整留在源码树内
- 新主路径仍借用旧系统里的局部工具
- LSP document/context shim 仍然存在多份并行实现
- README、设计文档和 superseded spec/plan 的口径尚未完全收束
- 若继续在当前基础上追加功能，维护者会同时面对“两套导航心智模型”

本 spec 的目标不是重新设计导航能力，而是定义一条正式的、分阶段的导航架构减债路线：

- `P0`
  - 清理已退场的旧工作区导航子系统，并收口文档口径
- `P1`
  - 收敛 document/context/URI 兼容层，降低 runtime 与 handler 的重复机械
- `P2`
  - 整理历史兼容门面与过厚服务，减少长期结构漂移

其中 `P0` 会被定义为一个可直接进入 implementation plan 的第一执行包；`P1 / P2` 提供后续减债方向与边界，不在本轮一次性实现。

## 2. 问题陈述

### 2.1 当前主路径已经切换，但旧系统未真正退场

当前生产主路径已经改走：

- [`InheritedSymbolRelationService.ts`](/D:/code/lpc-support/src/language/services/navigation/InheritedSymbolRelationService.ts)
- [`LanguageReferenceService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageReferenceService.ts)
- [`LanguageRenameService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageRenameService.ts)
- [`createProductionLanguageServices.ts`](/D:/code/lpc-support/src/lsp/server/runtime/createProductionLanguageServices.ts)

但以下旧工作区导航子系统仍完整保留在源码树中：

- [`WorkspaceSymbolRelationService.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolRelationService.ts)
- [`WorkspaceSemanticIndexService.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSemanticIndexService.ts)
- [`WorkspaceReferenceCollector.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceReferenceCollector.ts)
- [`WorkspaceReferenceCandidateEnumerator.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts)
- [`WorkspaceSymbolOwnerResolver.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts)
- [`workspaceSymbolTypes.ts`](/D:/code/lpc-support/src/language/services/navigation/workspaceSymbolTypes.ts)

对应的旧测试也仍然保留在：

- [`WorkspaceSymbolRelationService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts)
- [`WorkspaceSemanticIndexService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts)
- [`WorkspaceReferenceCollector.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts)
- [`WorkspaceSymbolOwnerResolver.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts)

这意味着仓库当前同时存在：

1. 现役主路径：当前文件级 + 可证明继承链级
2. 已退场旧路径：工作区级 owner/index/relation 机械

维护者仍需要理解两套模型，且容易误把旧系统视为未来继续扩展的基础。

### 2.2 新路径仍残留对旧系统局部工具的依赖

[`InheritedSymbolRelationService.ts`](/D:/code/lpc-support/src/language/services/navigation/InheritedSymbolRelationService.ts) 目前仍从 [`WorkspaceSymbolOwnerResolver.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts) 借用 `normalizeWorkspaceUri(...)`。

这说明：

- 新旧系统还没有完成真正隔离
- 若直接删除旧子系统，会先撞上共享小工具缺位
- 当前“旧系统存在”在形式上仍有一层合理化借口

这类依赖必须先抽出到中性 util，再删除旧系统。

### 2.3 文档与设计存量还保留旧心智模型

当前文档中仍存在“历史尝试”和“当前现实”并置的情况：

- [`README.md`](/D:/code/lpc-support/README.md)
  - 顶部“当前版本重点”与正文“引用与重命名边界”容易被分阶段演进痕迹混淆
- [`docs/object-inference-design.md`](/D:/code/lpc-support/docs/object-inference-design.md)
  - 已记录 `0.45.0 -> 0.45.1` 的导航边界收窄，但尚未明确指出旧工作区导航子系统已退场
- `docs/superpowers/specs|plans`
  - 仍保留：
    - [`2026-04-18-workspace-references-rename-design.md`](/D:/code/lpc-support/docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md)
    - [`2026-04-18-workspace-references-rename.md`](/D:/code/lpc-support/docs/superpowers/plans/2026-04-18-workspace-references-rename.md)
  - 但没有 `superseded` 标记

如果不先收口这些文档，后续维护者会持续从旧 spec/plan 中吸收过期意图。

### 2.4 当前真正危险的债不在 parser/syntax/semantic，而在导航/LSP glue

本仓库当前最不该粗暴动刀的，是已经相对清晰的主干：

- parser / syntax / semantic 分层
- scoped method 主链
- object inference 主链
- single-path LSP runtime 的整体方向

当前技术债主要集中在：

- 已退场导航系统未删除
- document/context/URI shim 多份并存
- `AstBackedLanguageDefinitionService` 过厚
- `ASTManager` 仍兼任过多兼容门面职责
- `DocumentSemanticSnapshotService` 名称与目录归属不再反映真实共享角色

因此，本路线的核心原则是：

**先删退场系统，再收口兼容层，最后才处理过厚门面与命名/归属债。**

## 3. 目标与非目标

### 3.1 目标

- 明确导航架构减债的 `P0 / P1 / P2` 顺序
- 把 `P0` 定义成一个可以立刻进入 implementation plan 的执行包
- 清除旧工作区导航子系统带来的“双心智模型”
- 为后续 document/context shim 收敛与服务拆分铺平道路
- 让代码、测试、README、设计文档对“当前主路径是什么”给出一致答案

### 3.2 非目标

本路线 **不** 重新开放以下能力或方向：

- 不恢复工作区级函数 `references`
- 不恢复函数 / `struct/class` 定义 `rename`
- 不修改当前 `definition / hover / signature help / scoped completion / object inference` 的产品语义
- 不重新设计 parser / syntax / semantic 分层
- 不在本轮引入新的导航能力

## 4. 设计原则

### 4.1 退场系统必须真正退场

一旦某套设计已经退出生产真路径，就不应继续以完整子系统形式留在源码树中，除非：

- 它仍有生产依赖
- 或它处在明确的软迁移窗口中

当前旧工作区导航子系统已经不满足这两个条件，因此应从“并存”转为“拆解后删除”。

### 4.2 共享能力应抽成中性 util，而不是保留整套旧子系统

若新系统只借用旧系统中的 URI/path/document 小工具，正确方向是：

1. 抽出中性 util
2. 更新新主路径引用
3. 删除旧系统

而不是为了一个小 helper 保留完整旧 resolver/index/relation 机械。

### 4.3 先做结构清理，再做大规模服务拆分

`LanguageDefinitionService`、`ASTManager` 等热点文件的确需要瘦身，但它们不是当前最急的第一刀。

在旧导航系统未退场、document shim 仍分裂的情况下，直接做大拆分只会放大迁移面和认知负担。

### 4.4 文档必须与生产行为同步

一条设计已经退场，就不应继续让 README/spec/plan 把它表述成“当前能力”或“默认未来方向”。

本路线要求：

- README 与设计文档描述当前真实行为
- 历史 spec/plan 明确标记 superseded 或归档
- 新 spec 说明当前减债路线与原因

## 5. 路线总览

### 5.1 P0：退场旧工作区导航子系统并收口文档

目标：

- 抽出当前新链路仍依赖的 URI/path 小工具
- 删除旧 `Workspace*` 导航子系统及其测试
- 更新 README / 设计文档 / superseded spec/plan 的口径

特点：

- 不改产品语义
- 不改导航结果边界
- 不动 `definition / hover / signature help / scoped / object inference`
- 风险小、收益大、认知清理效果立竿见影

### 5.2 P1：统一 document/context/URI 兼容层

目标：

- 收敛 navigation、completion、diagnostics、runtime 中重复的 document/context 构造逻辑
- 明确 `DocumentStore`、runtime text mirror、handler context 的单一装配方向
- 减少多套 shim 并存导致的未来漂移

特点：

- 仍以“结构减债”为主
- 会触及运行链路 wiring，但不改产品语义
- 应建立新的共享 adapter/factory，而不是继续在 handler 内各写一份 shim

### 5.3 P2：瘦身过厚门面与热点服务

目标：

- 拆分 `AstBackedLanguageDefinitionService`
- 继续给 `ASTManager` 瘦身，收回过厚兼容职责
- 为 `DocumentSemanticSnapshotService` 提供更中性的命名/归属层

特点：

- 风险与改动面最高
- 必须建立在 `P0 / P1` 已完成的前提上
- 更适合在结构已干净之后做职责分离

## 6. P0：第一执行包定义

### 6.1 范围

`P0` 只做三件事：

1. 抽出旧系统里仍被新链路使用的共享小工具
2. 删除旧工作区导航子系统及其旧测试
3. 收口 README / 设计文档 / superseded spec/plan

### 6.2 具体改动

#### 6.2.1 抽出共享 URI/path 小工具

新增一个中性的 util 文件，位置建议：

- `src/language/services/navigation/navigationPathUtils.ts`
  - 或
- `src/language/services/shared/navigationPathUtils.ts`

它至少承接：

- `normalizeWorkspaceUri(...)`

若实现中发现还有零散的 `fromFileUri` / path compare 逻辑也确实被多个导航/LSP 入口共享，可以顺手并入，但 `P0` 不为“收集所有 util”而扩大范围。

约束：

- util 必须是中性位置
- 不得继续放在 `WorkspaceSymbolOwnerResolver.ts` 之下
- 新主路径改为只依赖 util，不再依赖旧系统文件

#### 6.2.2 删除旧工作区导航子系统

在新 util 落位后，删除：

- [`WorkspaceSymbolRelationService.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolRelationService.ts)
- [`WorkspaceSemanticIndexService.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSemanticIndexService.ts)
- [`WorkspaceReferenceCollector.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceReferenceCollector.ts)
- [`WorkspaceReferenceCandidateEnumerator.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts)
- [`WorkspaceSymbolOwnerResolver.ts`](/D:/code/lpc-support/src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts)
- [`workspaceSymbolTypes.ts`](/D:/code/lpc-support/src/language/services/navigation/workspaceSymbolTypes.ts)

并同步删除其旧测试：

- [`WorkspaceSymbolRelationService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts)
- [`WorkspaceSemanticIndexService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts)
- [`WorkspaceReferenceCollector.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts)
- [`WorkspaceSymbolOwnerResolver.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts)

如果存在仍然引用这些文件的测试或 helper，应一并更新到当前 `InheritedSymbolRelationService` 主路径，或直接删除随旧子系统退场的残余测试。

但 `P0` 不能简单理解成“删旧代码 + 删旧测试”。旧套件里仍有两类低层保护网需要迁移到新测试：

1. 仍被新主路径复用的 URI 归一化行为
2. 仍会影响当前文件级 + 可证明继承链级导航的低层去重 / owner-uri / workspace-root 边界

因此，`P0` 删除旧测试前至少要新增或迁移以下保护网：

- 一个新的中性 util 测试
  - 建议文件：
    - `src/language/services/navigation/__tests__/navigationPathUtils.test.ts`
  - 覆盖：
    - `normalizeWorkspaceUri(...)`
    - Windows 路径大小写 / 斜杠 / `file://` 规范化
- 把仍然直接服务于 `InheritedSymbolRelationService` 的低层归一化/去重边界迁到现役测试
  - 首选落点：
    - [`InheritedSymbolRelationService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts)
    - [`navigationServices.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/navigationServices.test.ts)

`P0` 的规则是：

- 可以删除旧工作区级 owner/index/relation 行为测试
- 不能无迁移地删除“新主路径仍然依赖的低层行为”测试

#### 6.2.3 收口文档与 superseded 标记

需要更新：

- [`README.md`](/D:/code/lpc-support/README.md)
  - 确保“当前版本重点”和“引用与重命名边界”一致
  - 不再让旧工作区导航模型在任何段落里呈现为当前能力
- [`docs/object-inference-design.md`](/D:/code/lpc-support/docs/object-inference-design.md)
  - 明确 `0.45.1` 后导航主路径已收敛到“当前文件级 + 可证明继承链级”
  - 指出旧工作区导航尝试已退场
- [`2026-04-18-workspace-references-rename-design.md`](/D:/code/lpc-support/docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md)
- [`2026-04-18-workspace-references-rename.md`](/D:/code/lpc-support/docs/superpowers/plans/2026-04-18-workspace-references-rename.md)
  - 增加明确的 superseded 说明，指向：
    - [`2026-04-18-navigation-capability-narrowing-design.md`](/D:/code/lpc-support/docs/superpowers/specs/2026-04-18-navigation-capability-narrowing-design.md)
    - 本文档

`P0` 不要求一口气把所有旧设计文档移动到 `archive/`；只要求先把最容易误导当前维护者的 `workspace-references-rename` 那组文档标成 superseded。

### 6.3 不做什么

`P0` 明确不做：

- 不调整 `InheritedSymbolRelationService` 的行为边界
- 不重构 `LanguageReferenceService` / `LanguageRenameService` 的产品语义
- 不动 `createProductionLanguageServices.ts` 的主路径装配策略
- 不改 `definition / hover / signature help`
- 不改 parser / syntax / semantic / object inference
- 不顺手处理 `DocumentStore` 或 runtime shim 统一问题

### 6.4 风险与缓解

#### 风险 1：新链路对旧系统仍有隐性依赖

缓解：

- 在删除旧文件前用 `rg` 全仓搜索其 import/export 关系
- 先抽 util，再迁移引用，再删旧系统

#### 风险 2：删除旧测试后保护网变薄

缓解：

- 删除旧工作区导航测试的同时，不减少当前现役主路径测试
- 先补上新的 util/低层归一化测试，再删除旧套件
- 至少保留并运行：
  - [`navigationServices.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/navigationServices.test.ts)
  - [`InheritedSymbolRelationService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts)
  - [`navigationHandlers.test.ts`](/D:/code/lpc-support/src/lsp/server/__tests__/navigationHandlers.test.ts)
  - [`spawnedRuntime.integration.test.ts`](/D:/code/lpc-support/src/lsp/__tests__/spawnedRuntime.integration.test.ts)

#### 风险 3：文档 superseded 标记不够醒目，后续仍被误读

缓解：

- 在旧 spec/plan 顶部添加醒目的 superseded 段落
- 明确指向当前生效的收窄设计与本减债路线文档

### 6.5 P0 验收标准

完成 `P0` 后，应满足：

1. 生产代码不再 import 任何 `Workspace*` 旧导航子系统文件
2. 仓库中不再保留旧工作区导航实现与其旧测试
3. 新主路径若仍需 URI 归一化，只依赖中性 util
4. 旧测试删除前，新的 util/低层归一化保护网已经落位
5. README 与设计文档对当前导航边界给出一致口径
6. `workspace-references-rename` 旧 spec/plan 被明确标记为 superseded
7. 当前导航测试与 spawned runtime 集成测试仍全部通过

## 7. P1：document/context/URI shim 收敛方向

`P1` 在 `P0` 之后执行，核心目标不是删除功能，而是统一兼容层。

### 7.1 问题

当前 navigation、completion、diagnostics 与 runtime 仍存在多份 document/context shim 或局部 helper：

- [`navigationHandlerContext.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/navigationHandlerContext.ts)
- [`registerCompletionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/completion/registerCompletionHandler.ts)
- [`vscodeShim.ts`](/D:/code/lpc-support/src/lsp/server/runtime/vscodeShim.ts)
- [`registerCapabilities.ts`](/D:/code/lpc-support/src/lsp/server/bootstrap/registerCapabilities.ts)

这些层并非都应删除，但它们当前更像“多份独立实现”，而不是围绕单一共享 adapter/factory 组装。

特别要注意，`P1` 的消费者范围不能只按“目录名”理解。当前 [`createNavigationCapabilityContext(...)`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/navigationHandlerContext.ts) 已经被多类 handler 直接复用，包括但不限于：

- [`registerDefinitionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerDefinitionHandler.ts)
- [`registerHoverHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerHoverHandler.ts)
- [`registerReferencesHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerReferencesHandler.ts)
- [`registerRenameHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerRenameHandler.ts)
- [`registerDocumentSymbolHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts)
- [`registerCodeActionHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/codeActions/registerCodeActionHandler.ts)
- [`registerFoldingRangeHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts)
- [`registerSemanticTokensHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts)
- [`registerSignatureHelpHandler.ts`](/D:/code/lpc-support/src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts)

因此 `P1` 的正确表述不是“统一 navigation/completion/diagnostics/runtime 四块”，而是：

**统一所有复用 document/context shim 的 LSP handler 与 runtime 装配点。**

### 7.2 方向

`P1` 应建立一个共享的 document/context adapter/factory，让 handler 不再各自制造局部 shim。

推荐方向：

- 新增统一的 server-side document/context adapter
- 明确：
  - `DocumentStore` 是协议层最新文本真源
  - runtime `workspace.textDocuments` 是镜像视图
  - handler 通过共享 adapter 获取语义上完整的一致 document/context
- 实施时应以“所有当前复用 `createNavigationCapabilityContext(...)` 的 handler 都切到共享 adapter”为验收口径，而不是只改导航目录下的一部分 handler

### 7.3 边界

`P1` 不改当前导航/补全/诊断的产品语义，只改其装配与共享桥接结构。

## 8. P2：过厚门面与热点服务瘦身方向

### 8.1 `AstBackedLanguageDefinitionService`

当前 [`LanguageDefinitionService.ts`](/D:/code/lpc-support/src/language/services/navigation/LanguageDefinitionService.ts) 已承担过多来源整合职责。

`P2` 应把它拆成更清晰的 resolver/bridge：

- local/in-file
- inherit/include
- scoped method
- efun/simul_efun
- object method / return propagation bridge

目标不是把逻辑分散，而是让每类来源各有边界，而主 service 只做协调。

### 8.2 `ASTManager`

[`astManager.ts`](/D:/code/lpc-support/src/ast/astManager.ts) 仍然偏厚。

`P2` 应继续把它收回为 facade，只保留：

- 统一解析入口
- syntax/semantic 获取
- 少量确属 facade 的桥接能力

不再让它继续承担补全/导航/格式化之外的广义兼容职责。

### 8.3 `DocumentSemanticSnapshotService`

[`documentSemanticSnapshotService.ts`](/D:/code/lpc-support/src/completion/documentSemanticSnapshotService.ts) 现在已成为多个子系统共享的语义入口，但目录和命名仍暗示它是 completion 专属。

`P2` 应考虑：

- 提供更中性的命名或导出层
- 让其共享角色在代码组织上与现实一致

这属于命名/归属债，不是 `P0/P1` 的阻塞项。

## 9. 测试与验证要求

本路线虽然以减债为主，但每个阶段都必须建立清晰保护网。

### 9.1 P0 验证

- `npx tsc --noEmit`
- `npm test -- --runInBand`
- 至少定向确认：
  - [`navigationServices.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/navigationServices.test.ts)
  - [`InheritedSymbolRelationService.test.ts`](/D:/code/lpc-support/src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts)
  - [`navigationHandlers.test.ts`](/D:/code/lpc-support/src/lsp/server/__tests__/navigationHandlers.test.ts)
  - [`spawnedRuntime.integration.test.ts`](/D:/code/lpc-support/src/lsp/__tests__/spawnedRuntime.integration.test.ts)

### 9.2 P1 验证

除全量类型/测试外，应增加真实 runtime 下 document sync / handler context 一致性回归。

### 9.3 P2 验证

应以“等价行为 + 更清晰边界”为目标，重点防止 service 拆分后 definition/hover/signature help 漏掉路径。

## 10. 建议执行顺序

建议按以下顺序推进：

1. `P0`
   - 清理旧 `Workspace*` 导航子系统
   - 抽共享 URI util
   - 收口文档与 superseded 标记
2. `P1`
   - 统一 document/context shim
3. `P2`
   - 拆 `LanguageDefinitionService`
   - 瘦 `ASTManager`
   - 正名 `DocumentSemanticSnapshotService`

若资源有限，至少应优先完成 `P0`，因为它能立刻消除当前仓库最显著的双心智模型问题。

## 11. 设计结论

本路线的核心判断是：

**当前仓库的主要导航技术债，不是主架构尚未成立，而是过渡路径已经退场却没有真正离开源码树。**

因此最合适的减债顺序不是继续新增能力，也不是直接大拆热点服务，而是：

1. 先删除已退场系统
2. 再收敛真正仍有价值的兼容层
3. 最后处理过厚门面与命名/归属债

`P0` 是这条路线中最小、最安全、最值得立刻执行的一步；它完成后，导航主路径的结构表达将首次与当前产品现实完全一致。
