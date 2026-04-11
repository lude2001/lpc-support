# LPC LSP Spec A: 基础设施与迁移底座

## 1. 阶段目标

`Spec A` 是 LSP 迁移的第一阶段，其目标不是“把语言能力迁完”，而是建立一个后续可持续迁移的底座。

本阶段完成后，项目应具备以下能力：

- 扩展宿主可以拉起并管理 LSP client/server
- server 具备稳定的文档同步、配置同步、日志和生命周期管理
- 现有语言能力开始形成可复用的宿主无关接口
- 仓库具备 classic path 与 LSP path 的基础验证能力
- 后续 `Spec B` 不必重新讨论 client/server 基本架构

## 2. 范围

### 2.1 本阶段要做

1. 建立 LSP client/server 目录与构建入口
2. 建立 server 进程启动、初始化、关闭、异常恢复机制
3. 建立文档同步模型和工作区会话模型
4. 建立项目配置同步桥，确保 server 以 `lpc-support.json + config.hell` 同步结果为准
5. 建立语言服务适配接口，作为 future handlers 的统一落点
6. 建立运行模式切换方案，用于 classic / hybrid / lsp 验证
7. 建立基础测试与回归框架，覆盖 client/server 启停和桥接逻辑

### 2.2 本阶段不做

- 不迁移 completion / hover / definition 等语言能力主链
- 不迁移 diagnostics 主路径
- 不迁移 formatter 主路径
- 不删除现有 provider
- 不承诺默认启用 LSP 模式

## 3. 设计原则

### 3.1 先搭桥，不先搬家

本阶段优先解决：

- 运行骨架
- 边界抽象
- 同步机制
- 验证框架

而不是优先把某个功能“硬搬”到 server。

### 3.2 基础设施必须为后续阶段减复杂度

`Spec A` 的新增结构必须让 `Spec B` 变简单。

如果某个设计只会让后续 handler 更难写、更难测、更难调试，那么它不应进入 `Spec A`。

### 3.3 不在 A 阶段做过度抽象

本阶段只抽离后续迁移明确会复用的接口，不做泛化框架工程。

不应在 A 阶段引入：

- 不确定是否需要的中间层
- 过宽的协议封装
- 过早的跨编辑器抽象

## 4. 建议目录结构

本阶段建议逐步形成如下结构：

```text
src/
  extension.ts
  modules/
  lsp/
    client/
      activateLspClient.ts
      LspClientManager.ts
      bridges/
        configurationBridge.ts
        diagnosticsBridge.ts
        modeSwitch.ts
    server/
      main.ts
      bootstrap/
        createServer.ts
        registerCapabilities.ts
      runtime/
        DocumentStore.ts
        WorkspaceSession.ts
        ServerLogger.ts
      handlers/
        health/
    shared/
      protocol/
      conversions/
  language/
    services/
    contracts/
```

说明：

- `src/lsp/` 承载 client/server/protocol 运行结构
- `src/language/` 用于抽出宿主无关的语言服务接口
- parser / syntax / semantic / formatter 等仍留在现有目录，不做无关搬迁

该结构是方向，不要求一步到位重排所有现有文件。

## 5. 运行模式设计

本阶段建议引入实验开关：

- `classic`
- `hybrid`
- `lsp`

### 5.1 classic

- 继续使用现有 `registerLanguageProviders`
- 不依赖 LSP client 提供语言能力

### 5.2 hybrid

- 扩展启动 LSP client/server
- 经典 provider 暂不移除
- server 用于联调、日志、能力烟测、协议验证

### 5.3 lsp

- 由 client 接管后续迁移完成的语言能力
- 仅在阶段完成并通过验证后启用

本阶段的默认模式建议仍为 `classic`。

## 6. 核心基础设施设计

### 6.1 LSP Client 管理器

新增 `LspClientManager`，统一负责：

- 构造 server 启动参数
- client 启停
- 重启与异常恢复
- 模式切换时的行为收敛
- 输出日志与状态

它不负责语言分析逻辑。

### 6.2 Server 启动层

server 侧需要一个明确的 bootstrap 层，负责：

- 初始化连接
- 注册能力
- 创建工作区会话
- 挂载 document store
- 注册日志与故障保护

server 启动层不直接实现语言能力，它只负责把运行骨架拼起来。

### 6.3 Document Store

新增 server 内部 `DocumentStore`，职责是：

- 接收 `didOpen / didChange / didClose`
- 保存文档文本与版本
- 为后续 handler 提供统一文档读取入口

它是 server 内部真源，不允许每个 handler 自己维护独立文档缓存。

### 6.4 Workspace Session

新增 `WorkspaceSession`，职责是：

- 维护工作区根路径上下文
- 持有项目配置快照
- 维护 server 级共享服务实例
- 统一做缓存失效与生命周期收口

后续 language handlers 应通过 session 获取共享能力，而不是各自 new 一套依赖。

### 6.5 Configuration Bridge

新增配置桥，职责是：

- 扩展宿主负责发现或同步工作区 `lpc-support.json`
- server 只消费同步后的配置视图
- 模式开关与调试配置由宿主直接管理

关键要求：

- 不让 server 重新发明配置真源
- 不让语言能力重新首选旧 VS Code settings

## 7. 语言服务适配策略

`Spec A` 不迁功能，但必须为迁功能铺路。

建议定义一层语言服务合同，例如：

- `LanguageDocument`
- `LanguageWorkspaceContext`
- `LanguageCompletionService`
- `LanguageDefinitionService`
- `LanguageSymbolService`

本阶段不要求所有实现都迁过去，但要求：

- 这些接口的职责边界被定义清楚
- 后续能力迁移时有明确落点
- 新的 LSP handler 不直接依赖现有 `vscode.*Provider` 类

### 7.1 为什么不能直接复用 provider

因为现有 provider 普遍存在以下问题：

- 直接吃 `vscode.TextDocument`
- 直接返回 `vscode.Location` / `vscode.Hover` / `vscode.CompletionItem`
- 直接依赖宿主事件或输出方式

这些类可以在过渡期被包装，但不能成为 server 核心 handler 的长期真身。

### 7.2 A 阶段最小可接受结果

本阶段至少要把“未来的迁移落点”定下来：

- 哪些逻辑属于纯语言服务
- 哪些逻辑属于 VS Code 适配层
- 哪些逻辑属于 LSP 适配层

即使暂时不重写 provider，也必须给出清晰边界。

## 8. 测试与验证设计

本阶段建议新增以下验证类型。

### 8.1 启停与模式测试

验证：

- client 能启动 server
- server 能正常初始化
- mode switch 不会破坏 classic 路径
- server 异常退出时 client 能给出可诊断结果

### 8.2 配置桥测试

验证：

- 工作区配置可以正确送达 server
- `lpc-support.json` 更新后的同步行为正确
- 不会退回旧配置真源

### 8.3 文档同步测试

验证：

- `didOpen`
- 增量或全量 `didChange`
- `didClose`
- 文档版本一致性

### 8.4 Handler 占位烟测

即便本阶段不迁主能力，也建议保留一个最小 health/check handler，用于验证：

- 请求能进 server
- 响应能回到 client
- 日志和异常链路是通的

## 9. 风险与回避策略

### 9.1 风险：A 阶段过早迁能力

如果在基础设施未收敛前就开始迁 completion / definition，极容易出现：

- 边迁边改底座
- handler 与协议层双向反咬
- 测试口径不稳

回避策略：

- A 阶段只搭底座
- 主能力迁移留给后续 `Spec B`

### 9.2 风险：server 与 classic path 双真源

如果 classic path 一套缓存，server path 另一套真源，后续差异会越来越难解释。

回避策略：

- 尽早把 future handlers 的共享真源指向同一套 parser / syntax / semantic 主链
- 不允许 server 私下重建另一套结构真源

### 9.3 风险：宿主职责失控

如果 client 侧顺手把很多语言逻辑继续留在扩展宿主，最后只是“套了个 LSP 壳”。

回避策略：

- 宿主只保留 client 管理、模式切换、UI、命令和桥接职责
- 语言分析决策不留在宿主侧

## 10. A 阶段验收标准

满足以下标准，才视为 `Spec A` 完成。

这里的“完成”指的是 Phase A 基础设施已经具备进入下一阶段的工程前提，并且已通过单元测试、mocked integration 测试与类型检查验证；它不等同于“真实 spawned client/server 生命周期、跨进程传输链路和完整语言能力已经在生产路径上证明完备”。

1. LSP client/server 已能在当前扩展中稳定拉起和关闭
2. server 具备统一的文档存储、工作区会话和配置同步入口
3. 项目中已经定义出后续语言 handler 要落入的服务接口或适配边界
4. 已有基础测试覆盖启停、同步、模式切换和最小请求链路
5. 默认用户路径仍可安全停留在 classic 模式
6. 团队无需重新讨论 `Spec B` 的基础架构前提

## 10.1 完成证据清单

- [x] Runtime mode resolution verified by unit tests
- [x] Host activation and mocked client manager lifecycle verified
- [x] Classic mode remains default
- [x] Server document store, workspace session, and health handler contract verified by unit tests
- [x] Workspace config sync bridge verified by tests on mocked activation/client paths
- [x] Language contracts defined
- [x] Phase A verification sweep recorded with passing Jest + typecheck results

以下内容当前未作为 Phase A 完成证据声明：

- [ ] 真实 spawned client/server 进程生命周期已通过端到端验证
- [ ] 真实传输层 health round-trip 已通过端到端验证
- [ ] `lsp` 模式已具备完整、可替代 classic 的语言功能

## 11. 完成后的产出物

`Spec A` 结束时，建议至少具备以下产出：

- 可运行的 client/server 骨架
- 基础日志与 health 请求
- 配置桥与文档桥
- 运行模式开关
- 一份 A 阶段完成报告
- 一份进入 `Spec B` 的约束清单

## 12. 进入下一阶段的规则

只有当本阶段达到第 10 节的验收标准后，才开始设计：

- `Spec B`

`Spec B` 将只在 A 阶段的现实产出上设计，不提前假设未落地结构已经稳定存在。

## 13. 验证证据

2026-04-10 在仓库根目录执行以下命令，结果均为 PASS。

这些证据证明的是 Phase A 的单元测试、mocked integration 测试和类型检查结果；不应解读为已经完成真实 spawned client/server 的端到端生命周期验证或 transport-level request round-trip 验证。

- `npx jest --runInBand src/lsp/__tests__/modeSwitch.test.ts src/lsp/__tests__/LspClientManager.test.ts src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/server/__tests__/healthHandler.test.ts src/__tests__/extension.test.ts`
  - 结果：6 个测试套件通过，24 个测试通过，0 个失败
  - 覆盖范围：mode switch、宿主激活路径、mocked client manager、document store、workspace session、health handler、extension entrypoint
- `npx tsc --noEmit`
  - 结果：通过，无类型错误输出
