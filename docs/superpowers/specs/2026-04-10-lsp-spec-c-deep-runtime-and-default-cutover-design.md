# LPC LSP Spec C: 深水区迁移与单一路径切换设计

## 状态

- 状态：已完成并收口
- 完成时间：2026-04-11
- 实际结果：
  - `diagnostics` 已迁入 LSP runtime，并由 shared diagnostics service + server publish path 承担生产主链
  - `formatter` 已迁入 LSP runtime，并由 shared formatting service + formatting handlers 承担生产主链
  - 公开运行入口已经收束为单一路径 LSP，用户侧不再暴露多模式配置
  - spawned runtime、workspace/config sync、bundle boundary、single-path cutover 回归已作为阶段收尾验证证据

以下内容保留为本阶段的架构记录，但以“已落地结果”解释为准。

## 1. 阶段定位

`Spec C` 承接 `Spec A` 与 `Spec B` 的既有产出，不再重新讨论以下前提：

- `client/server` 运行骨架已经建立
- `WorkspaceSession`、`DocumentStore`、配置同步桥、模式切换机制已经落地
- `completion`、`hover`、`definition`、`references`、`rename`、`documentSymbol`、`foldingRange`、`semanticTokens` 已具备 LSP 路径与 parity evidence
- `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` 仍然是分析真源

`Spec C` 是整个迁移项目的深水区阶段。它的职责不是继续扩展“能工作的 LSP 能力”，而是完成以下闭环：

1. 把 `diagnostics` 迁入 LSP 路径
2. 把 `formatter` 迁入 LSP 路径
3. 完成 runtime / transport / parity / telemetry 硬化
4. 将项目运行路径收束为单一的 `lsp`

因此，`Spec C` 的目标是“深挖并收口”，不是再搭一层新底座。

## 2. 总目标

本阶段的正式目标定义为：

1. `diagnostics` 在 LSP server 中成为唯一生产实现路径
2. `formatter` 在 LSP server 中成为唯一生产实现路径
3. 项目最终只保留一种生产运行模式，即 `lsp`
4. `classic` / `hybrid` 只允许作为迁移期临时脚手架存在，且必须在 `Spec C` 收尾前移除
5. 最终运行形态具备完整的问题定位机制，但不再依赖长期兼容模式兜底

这里的“全面切换到 LSP”在本阶段的含义是：

- 用户与生产路径只看到 `lsp`
- 语言能力主链与深水区能力都以 LSP path 为唯一正式入口
- classic / hybrid 不作为长期产品形态保留

## 3. 非目标

`Spec C` 明确不做：

- 不重新设计 `Spec A` 的基础设施边界
- 不重新定义 `Spec B` 的 8 项能力服务接口
- 不为了赶进度而继续扩写 classic / hybrid 兼容架构
- 不把项目配置真源退回旧 VS Code settings
- 不在 `formatter` 中回退到文本正则真源
- 不在 `diagnostics` 中回退到 legacy parse cache 或 provider 内全文扫描

这意味着：`Spec C` 的重点是“收束为单一 LSP 运行路径”，而不是长期维护多模式并存。

## 4. 阶段成功标准

`Spec C` 完成时，必须同时满足以下结论：

1. `diagnostics` 与 `formatter` 均具备 LSP path 主实现
2. LSP path 下的 `diagnostics` 与 `formatter` 有可重复的 parity / regression evidence
3. 单一 `lsp` 路径具备完整 transport 级、运行时级、回归级验证证据
4. `classic` / `hybrid` 的迁移脚手架已从公开产品面移除，只残留极小内部过渡代码时也不得再形成用户可见分流
5. 问题定位路径清晰，包括日志、能力开关与最小复现手段

这 5 条现已同时成立，项目已完成单一路径 LSP 切换。

## 5. 四条主线设计

### 5.1 Diagnostics 迁移主线

#### 目标

将当前诊断调度、收集、聚合与发布主路径迁入 LSP server，并由 client 负责最小宿主桥接。

#### 设计要求

- `DiagnosticsOrchestrator` 背后的分析逻辑必须进一步抽成宿主无关服务
- server 侧通过统一的诊断入口消费：
  - `ParsedDocumentService`
  - `SyntaxDocument`
  - `SemanticSnapshot`
  - 现有 collector / analyzer 能力
- 诊断发布应以 LSP `publishDiagnostics` 为主
- classic diagnostics path 在切换期保留，但只作为对照和回退

#### 关键边界

- `diagnostics` 的结构真源继续是 parser / syntax / semantic 主链
- 不允许 collector 为了迁移重新扫描全文做结构判断
- 不允许通过恢复 `parseCache` 真源来“让 LSP 先跑起来”
- 不允许 UI 面板逻辑泄漏回 server 核心

#### 额外注意

当前仓库里诊断不仅是“发红线”，还带有变量检查、文件夹扫描、错误面板等扩展体验。因此 `Spec C` 需要把它拆成两类：

- `analysis diagnostics`
  - 进入 LSP server
- `host-side diagnostic UX`
  - 继续留在扩展宿主，通过桥接消费 server 结果

这条边界要写清楚，否则会把 panel / tree view 和 server 能力再次搅在一起。

### 5.2 Formatter 迁移主线

#### 目标

将格式化能力迁入 LSP server，并让 `SyntaxDocument` 继续作为唯一结构真源。

#### 设计要求

- `FormattingService` 仍然是格式化核心入口
- server 侧通过 document formatting / range formatting handler 暴露能力
- classic formatter provider 在切换期保留，但只作为对照与兜底
- 格式化规则、printer 分派与真实样例回归继续沿用现有 formatter 测试体系

#### 关键边界

- `formatter` 真源只能是 `SyntaxDocument`
- 不允许为了迁到 LSP 而退回正则或纯文本切分路径
- `FormatPrinter` 与各 delegate 的职责边界不能被重新混平
- range formatting 行为必须显式做 parity 检查，不能只验 full formatting

#### 重点回归对象

`Spec C` 中 formatter 回归仍应重点覆盖：

- `src/__tests__/formatPrinter.test.ts`
- `src/__tests__/formatterIntegration.test.ts`
- `src/__tests__/rangeFormatting.test.ts`
- `src/__tests__/yifengDebug.test.ts`
- `test/lpc_code/yifeng-jian.c`
- `test/lpc_code/meridiand.c`

也就是说，formatter 迁移不是“接个 handler 就算完成”，而是必须保住既有格式化语义。

### 5.3 Runtime Hardening 主线

#### 目标

把当前“功能正确但还偏开发态”的 LSP runtime 打磨到能作为唯一生产入口长期运行。

#### 本主线必须覆盖

- 真实 spawned client/server 生命周期验证
- transport 级 request / notification round-trip 验证
- 文档同步、配置同步、诊断发布、格式化请求的真实链路验证
- 异常恢复、日志、问题定位、最小健康检查
- workspace roots、多工作区、配置变更、重载路径的稳定性验证

#### 设计要求

- 继续保留 `health` 类最小请求作为 runtime 快速自检入口
- 增加能够覆盖真实 server bundle 的 smoke / integration 级验证
- 明确区分：
  - mocked integration
  - spawned runtime integration
  - user-facing parity regression

#### 关键边界

- server bundle 必须持续保持 Node-safe，不允许重新引入运行时 `require("vscode")`
- diagnostics / formatter 迁入后，也必须遵守 server-only host boundary
- 如果需要 `vscode` 兼容层或 shim，只能作为 server runtime 的受控基础设施，不能反向污染 classic path

### 5.4 单一路径切换主线

#### 目标

在满足明确门槛后，将项目运行路径收束为唯一的 `lsp`。

#### 推荐切换方式

不是“从今天起长期多模式并存”，而是走以下顺序：

1. 迁移期内允许 `classic` / `hybrid` 作为临时验证脚手架
2. `lsp` 完成深水区能力与 runtime hardening
3. 完整验证集通过后，移除对外模式分流
4. 项目收束为单一 `lsp` 入口

#### 为什么必须这样切

因为“单一路径切换”是产品结论，不只是配置结论。  
即使 `diagnostics` 和 `formatter` 已经在 server 里跑通，只要以下任一项不稳，就不能直接收束：

- transport 级链路不稳
- 多工作区行为不稳
- 日志和问题定位路径不清楚
- classic supplemental behavior 还存在未收口差异

因此 `Spec C` 会把“单一路径收束”写成阶段正式目标，但它必须是阶段末尾的 exit action，而不是阶段开头的前置假设。

## 6. 推荐实现分层

`Spec C` 不引入新的顶层分层，只强化现有四层分工：

### 6.1 Host Layer

继续负责：

- client 生命周期
- UI / 命令 / 面板
- 迁移期切换控制与最终收口
- 观测与用户提示

### 6.2 Protocol / Bridge Layer

重点新增或增强：

- diagnostics bridge
- formatting request bridge
- transport / health / telemetry bridge
- recovery / observability bridge

### 6.3 Language Service Layer

重点新增或增强：

- `LanguageDiagnosticsService`
- `LanguageFormattingService`
- 现有能力矩阵与 diagnostics / formatter 的统一 workspace context 消费

### 6.4 Core Analysis Layer

继续稳定，不做无关搬迁：

- `src/parser/`
- `src/syntax/`
- `src/semantic/`
- `src/objectInference/`
- `src/formatter/`
- `src/diagnostics/` 中真正属于分析层的部分

## 7. Diagnostics 详细设计要求

### 7.1 目标结构

建议把 diagnostics 分成三层：

1. `LanguageDiagnosticsService`
   - 宿主无关
   - 输出统一诊断结果
2. `classic diagnostics adapter`
   - 把统一结果适配为现有 classic surface
3. `lsp diagnostics publisher`
   - 把统一结果发布为 LSP diagnostics

### 7.2 调度要求

- 调度与防抖必须统一管理，避免 classic 和 lsp 各有一套异步时序
- 文档级诊断与工作区级诊断要显式区分
- 文件夹扫描与面板刷新要走宿主事件，不直接塞进 server 分析循环

### 7.3 验证要求

每类诊断至少要有：

- classic-vs-lsp 行为对照
- 真实配置变更后的结果更新验证
- 文档更新后的版本一致性验证
- 不回退 legacy parseCache 的回归测试

## 8. Formatter 详细设计要求

### 8.1 目标结构

建议把 formatter 分成三层：

1. `LanguageFormattingService`
   - 宿主无关
   - 暴露 full / range formatting
2. `classic formatting adapter`
   - 适配 `vscode.TextEdit[]`
3. `lsp formatting handler`
   - 适配 `TextEdit[]` LSP 输出

### 8.2 行为要求

- full formatting 与 range formatting 必须分别验证
- 配置驱动的缩进、换行与 printer 行为不能因为 host 切换而出现隐式差异
- 格式化失败时要有可诊断路径，不能静默吞错

### 8.3 验证要求

formatter 至少要补足：

- classic-vs-lsp formatter parity harness
- 真实样例文件 golden regression
- range formatting regression
- 对 `SyntaxDocument` 真源的守护测试

## 9. 单一路径切换门槛

以下条件已作为阶段收尾门槛执行，用于确认项目正式收束为单一 `lsp` 路径：

1. `Spec B` 的 8 项能力仍保持 parity evidence
2. `diagnostics` 已在 LSP path 稳定运行
3. `formatter` 已在 LSP path 稳定运行
4. 真实 spawned runtime integration 通过
5. server bundle 持续满足 Node-safe 约束
6. 多工作区 / 配置变更 / 文档同步 / transport 级 smoke tests 通过
7. `classic` / `hybrid` 的对外模式入口已移除，或明确标记为内部迁移脚手架并不再作为产品能力存在
8. CHANGELOG、README、运行模式说明已经更新到“单一 LSP 路径”口径

这 8 条缺一不可。

## 10. 推荐的收束策略

### 10.1 迁移期

- `classic` / `hybrid` 只作为迁移验证脚手架
- `lsp` 持续补齐深水区能力

### 10.2 收束时

- 移除对外多模式分流
- 将 `lsp` 作为唯一正式运行路径
- 在切换窗口内增加更强的日志与故障提示

### 10.3 收束后

- 所有新增能力只允许走 LSP path
- classic / hybrid 不再作为产品运行模式存在

### 10.4 暂不在 Spec C 内承诺的动作

- 不在 `Spec C` 中承诺一次性删掉所有历史代码痕迹
- 不在 `Spec C` 中承诺把所有经典时代的内部辅助实现都在同一天物理删除完毕

因为“单一路径切换完成”和“代码库里完全没有任何历史遗留痕迹”不是同一个工程动作。

## 11. 主要风险与回避策略

### 11.1 风险：为了单一路径切换而牺牲诊断精度

如果 diagnostics 为了适应 server runtime 退化成更浅层的文本检查，那么单一路径切换没有意义。

回避策略：

- 诊断精度优先于切换速度
- classic-vs-lsp diagnostics parity 必须显式记录

### 11.2 风险：formatter 在 host 切换后出现隐式差异

格式化最容易出现“看起来能用，但输出 subtly changed”。

回避策略：

- 继续以现有 formatter 回归样例为准
- LSP path 输出必须接受真实 golden regression

### 11.3 风险：单一路径切换后问题无法快速定位

如果项目切成单一路径 LSP 后出问题，却没有 clear 诊断与日志路径，迁移会立刻变成支持负担。

回避策略：

- 增强 health、日志、故障提示与最小复现说明
- 不依赖长期保留 classic mode 作为运营层面的兜底

### 11.4 风险：classic supplemental behavior 遗留

即使主链已经进 LSP，classic path 可能还残留补充 hover、补充命令耦合、宿主侧额外行为。

回避策略：

- `Spec C` 中要显式清点 classic-only supplemental behavior
- 决定哪些迁入 LSP，哪些保留在 host

## 12. 验证策略

`Spec C` 的验证必须比 `Spec B` 更重，因为它承担单一路径切换。

### 12.1 语言能力回归

- 继续执行 `Spec B` 的 capability matrix
- 确保 8 项能力在单一路径切换前不回归

### 12.2 Diagnostics 回归

- 文档级诊断
- 工作区级诊断
- 配置变更触发
- collector / analyzer 主链回归

### 12.3 Formatter 回归

- full formatting
- range formatting
- golden sample regression

### 12.4 Runtime 回归

- spawned client/server startup
- request / notification round-trip
- reconnect / shutdown behavior
- workspace sync / document sync / diagnostics publish smoke tests

### 12.5 Single-Path Cutover 回归

- 项目正式入口确认为 `lsp`
- 不再对外暴露 classic / hybrid 运行模式
- README / CHANGELOG / 配置说明同步正确

## 13. 验收口径

`Spec C` 已完成，项目当前状态为：

- LSP 已成为唯一正式语言运行模式
- `diagnostics` 与 `formatter` 已迁入 LSP 主路径
- runtime 已具备长期运行所需的验证、日志与回退手段

现在可以正式认定“项目已经全面切换到单一路径 LSP 模式”。

## 14. 进入下一阶段后的建议

`Spec C` 完成后，下一步不一定是继续出新的大 spec。更合理的后续动作可能是：

- classic 路径清退计划
- 单一路径 LSP 上线后的问题收敛计划
- diagnostics / formatter 的性能专项硬化
- 观测与支持工具补强

也就是说，`Spec C` 更像迁移项目的“完成切换阶段”，而不是再往后无限分阶段延伸。
