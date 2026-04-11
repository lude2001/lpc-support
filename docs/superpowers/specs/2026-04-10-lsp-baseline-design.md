# LPC LSP 迁移基线文档

## 1. 文档目标

本文档不是某一个实现阶段的施工单，而是整个 LPC LSP 迁移项目的总基线。它回答 4 个问题：

1. 为什么现在要做 LSP
2. 为什么这次不一次性把所有能力迁完
3. 后续各阶段必须共同遵守哪些架构边界
4. 什么时候才允许进入下一阶段 spec 设计

本次项目采用“基线先行、阶段递进”的策略：

- 当前先产出 `LSP 基线文档`
- 当前只设计并执行 `Spec A`
- `Spec B` 必须在 `Spec A` 完成并验收后再设计
- `Spec C` 必须在 `Spec B` 完成并验收后再设计

这不是保守，而是为了避免在基础设施未稳定前，提前承诺后续细节，导致架构反复改写。

## 2. 当前现状判断

仓库目前已经具备比较清晰的 parser / syntax / semantic 分层，也有较稳定的统一解析入口：

- `ParsedDocumentService`
- `SyntaxDocument`
- `SemanticSnapshot`
- `ASTManager`

但语言能力仍然主要通过 VS Code 扩展宿主内直接注册 provider 的方式提供：

- `completion`
- `hover`
- `definition`
- `document symbol`
- `references`
- `rename`
- `folding`
- `semantic tokens`
- `formatting`

这意味着当前项目的“语言智能”和“编辑器宿主”还没有彻底解耦。

### 2.1 已有优势

- 统一解析主路径已经形成，生产主路径不再依赖 legacy parse cache 作为真源
- formatter 已经切到 `SyntaxDocument` 真源
- object inference 已经开始依赖 syntax / semantic 边界，而不是全文正则扫描
- 项目配置已经在向 `lpc-support.json + config.hell` 收束

### 2.2 当前阻力

- 大量能力直接依赖 `vscode.*` 类型和扩展宿主生命周期
- `ParsedDocumentService`、`DiagnosticsOrchestrator`、各类 provider 中仍有明显宿主耦合
- 配置读取、诊断收集、UI 通知、缓存失效目前仍夹杂在扩展进程语义里
- 若直接“一步到位”切 LSP，风险会同时落到 parser、formatter、diagnostics、object inference、配置同步五条主线上

因此，本项目不采用“大爆炸式全量迁移”。

## 3. 总体迁移原则

后续所有阶段必须遵守以下原则。

### 3.1 真源不变原则

LSP 迁移不会改变现有核心真源链路：

- `ParsedDocument`
- `SyntaxDocument`
- `SemanticSnapshot`

不得在 LSP server 侧重新引入一个新的泛化 “AST 真源”，也不得让旧 `parseCache` 回到生产主路径核心位置。

### 3.2 先解耦，再迁移

迁移顺序必须是：

1. 先抽离宿主无关的语言服务边界
2. 再为 VS Code Provider 和 LSP Handler 提供各自适配层
3. 最后才替换运行时入口

禁止直接把现有 `vscode.*Provider` 逻辑整体搬进 LSP server。

### 3.3 宿主职责与语言职责分离

扩展宿主负责：

- 命令注册
- TreeView / Webview / 面板
- 编译与服务器管理
- 用户交互与通知
- LSP client 生命周期

LSP server 负责：

- 文档同步后的语言分析
- 语言协议能力实现
- 与语言能力直接相关的缓存、索引、推导

### 3.4 配置入口统一

项目配置仍以工作区根目录的以下来源为准：

- `lpc-support.json`
- `config.hell` 同步结果

新架构下不得把旧 `lpc.includePath`、`lpc.simulatedEfunsPath` 恢复为首选真源。若存在 VS Code 侧实验开关，仅可用于启停 LSP 或调试行为，不得替代项目语言配置。

### 3.5 渐进替换，而非立即删旧

在 `Spec A` 和其后的早期阶段，经典 provider 主路径可以继续保留，用于：

- 对照验证
- 回归比对
- 风险兜底

是否切换默认运行路径，必须基于阶段验收结果，而不是主观判断。

## 4. 目标架构基调

目标不是“把 VS Code 扩展改写成另一个项目”，而是在现有仓库里形成以下四层：

### 4.1 Host Layer

位置建议：

- `src/extension.ts`
- `src/modules/`
- `src/ui/` 或现有 UI 模块
- 后续 `src/lsp/client/`

职责：

- 扩展激活
- client 启停
- 命令与 UI
- 宿主事件转发

### 4.2 Protocol / Bridge Layer

位置建议：

- `src/lsp/shared/`
- `src/lsp/client/bridges/`
- `src/lsp/server/bridges/`

职责：

- VS Code 类型与 LSP 类型转换
- 配置同步桥
- 请求/通知协议桥
- 运行模式切换桥

### 4.3 Language Service Layer

位置建议：

- `src/language/`
- 或在现有能力基础上抽出 `services/handlers`

职责：

- 对外暴露平台无关的语言能力接口
- 组合 parser / syntax / semantic / object inference / formatter 等核心能力
- 不直接依赖 VS Code 扩展宿主 API

### 4.4 Core Analysis Layer

位置继续以现有结构为主：

- `src/parser/`
- `src/syntax/`
- `src/semantic/`
- `src/objectInference/`
- `src/formatter/`

职责：

- 解析
- 结构构建
- 语义摘要
- 推导与打印

这一层是迁移过程中最应保持稳定的部分。

## 5. 阶段策略

### 5.1 当前只做两件事

本轮只允许落地：

1. `LSP 基线文档`
2. `Spec A`

当前不编写 `Spec B`
当前不编写 `Spec C`

### 5.2 Spec A 的定位

`Spec A` 只解决“LSP 能否稳定承载后续迁移”的基础设施问题，不承诺语言能力全迁移。

它的重点是：

- 建立 client/server 运行骨架
- 定义宿主与 server 的边界
- 提炼可复用的语言服务适配接口
- 建立配置、文档、日志、模式切换的稳定桥接
- 建立后续迁移需要的测试与验证框架

### 5.3 Spec B 的准入条件

只有在 `Spec A` 完成后，且同时满足以下条件，才允许开始设计 `Spec B`：

- LSP client/server 能稳定启动、关闭、重连
- 文档同步和工作区配置同步稳定
- 已有语言核心至少形成一层可复用的 handler / service 抽象
- 基础测试框架可同时覆盖 classic provider 与 LSP path
- 迁移边界清楚，不需要在 `Spec B` 中重新决定基础架构

### 5.4 Spec C 的准入条件

只有在 `Spec B` 完成后，且同时满足以下条件，才允许开始设计 `Spec C`：

- 语言能力主链已经在 LSP 路径稳定运行
- classic path 与 LSP path 的结果差异已可度量
- diagnostics / formatter / 深层缓存策略的迁移边界明确
- server 侧性能、日志、问题定位手段已足够支撑深水区迁移

## 6. 非目标

在基线阶段，以下事项明确不是目标：

- 立即把全部 provider 一次性迁进 server
- 立即删除 classic provider 主路径
- 为了兼容 LSP 而重新发明 parser / syntax / semantic 数据结构
- 为了赶进度把配置真源退回旧 VS Code settings
- 在没有验证框架前就迁 diagnostics 和 formatter
- 在没有稳定抽象前预写 `Spec B` 和 `Spec C`

## 7. 推荐的运行策略

为降低迁移风险，建议引入实验运行模式开关，例如：

- `classic`
- `hybrid`
- `lsp`

建议初期默认仍为 `classic`，仅在开发验证或内部试用时启用 `hybrid` / `lsp`。

其中：

- `classic`：继续走现有 provider
- `hybrid`：保留经典能力，同时拉起 LSP 进行对照与烟测
- `lsp`：由 client 接管语言能力入口

该开关仅用于运行模式控制，不属于项目语言配置真源。

## 8. 风险基线

### 8.1 最大风险

最大风险不是 “LSP 起不来”，而是 “server 起得来，但语言分析边界被重新搅乱”。

一旦出现以下情况，迁移就是失败的：

- provider 为了适配 LSP 重新扫描全文做结构推断
- parser / syntax / semantic 边界退化
- formatter 为了迁移而回到文本正则主路径
- legacy parse cache 重新成为隐式真源
- 项目配置出现双真源

### 8.2 控制策略

- 每阶段只解决一类主问题
- 所有新增层必须命名清楚、职责单一
- 核心主路径优先补测试，不靠人工回归兜底
- 阶段完成后再写下一阶段 spec，避免文档先于现实漂移

## 9. 验收口径

基线文档本身的验收标准不是代码，而是团队后续决策标准是否明确：

- 当前做什么
- 当前不做什么
- 下一阶段什么时候能开始
- 架构边界是否已有统一口径

如果团队后续需要重新争论：

- 是否先迁 formatter
- 是否先删旧 provider
- 是否配置改回 VS Code settings
- 是否直接开始写 `Spec B`

则应回到本文档，以本文档为首要裁决基线。

## 10. 下一步

基于本文档，当前立即进入：

- `Spec A` 设计与实施

在 `Spec A` 完成前，不预写 `Spec B` 和 `Spec C` 细节，只在实现过程中收集约束、风险与经验，待阶段收束后再形成下一份 spec。
