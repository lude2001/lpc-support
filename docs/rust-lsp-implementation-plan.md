# Rust LSP 一次性重构实施计划

## 1. 目标

本项目将在一个开发分支内完成 TypeScript 语言服务器到 Rust 语言服务器的整体切换，并在满足行为兼容与性能门槛后一次性发布。

本次重构不是将现有 TypeScript 逐行翻译成 Rust，也不是只替换 ANTLR parser。目标是建立面向编辑器工作负载的增量分析架构：文档编辑、预处理、语法分析、语义分析、工作区索引和主要 LSP 请求共享同一份版本化分析状态。

正式版本中：

- TypeScript 只负责 VS Code 激活、配置同步、命令/UI 和 Rust 进程生命周期。
- Rust 负责所有高频、CPU 密集型语言能力。
- 用户不会接触功能不完整的分阶段发布版本。
- 现有 TypeScript LSP 在开发期作为兼容性基准保留，正式切换前不删除。

## 2. 已测基线

基线环境使用仓库的脱敏 LSP 探针和真实 LPC 项目文件 `/adm/daemons/meridiand.c`。

| 请求 | 总耗时 | 新增解析次数 | 解析耗时 |
| --- | ---: | ---: | ---: |
| Semantic tokens | 900.7 ms | 1 | 786.0 ms |
| Definition | 3135.3 ms | 32 | 2956.0 ms |
| Hover | 5748.5 ms | 56 | 5329.6 ms |
| Completion | 3.6 ms | 0 | 0.0 ms |

这组数据说明当前瓶颈同时包含：

1. 单次完整预处理与解析成本高。
2. Definition/Hover 在依赖遍历中重复构建相同文件。
3. 文档变化后以完整版本为单位失效，没有增量语法树。
4. 语法、语义和工作区索引之间缺少统一的版本化查询数据库。

首个 Rust Tree-sitter spike 已在同一真实文件上达到：

| Rust parser 场景 | 结果 |
| --- | ---: |
| 完整 CST 解析 | 2.695 ms |
| 单字符增量解析 p50 | 15 µs |
| 单字符增量解析 p95 | 17 µs |
| 单字符增量解析最大值（100 次） | 40 µs |

该结果只覆盖 CST，不包含尚未迁移的预处理、语义和工作区查询，因此不能直接作为最终端到端提升宣称；它用于证明增量 parser 路线具有足够性能余量。

## 3. 发布性能门槛

以下指标是 Rust 实现替换默认 TypeScript LSP 的硬门槛。测量使用固定语料库，报告 cold/warm p50、p95、CPU time、解析次数和峰值内存。

| 场景 | 发布门槛 |
| --- | --- |
| 约 20 KB 文件首次 semantic tokens | p95 不超过 250 ms |
| 已分析文件 semantic tokens | p95 不超过 80 ms |
| Definition / Hover 热请求 | p95 不超过 100 ms |
| Definition / Hover 冷请求 | p95 不超过 500 ms |
| 单行编辑后的增量语法更新 | p95 不超过 50 ms |
| 单行编辑后的可见诊断更新 | 计算阶段 p95 不超过 200 ms |
| 同版本同配置重复请求 | 不得触发完整重新解析 |
| 空闲状态 | 不得持续占用一个 CPU 核心 |

如果特定语料无法达到门槛，必须在报告中标明文件、阶段、原因和与 TypeScript 基线的相对提升，不允许只用平均值掩盖长尾。

## 4. 最终架构

```text
VS Code extension host
  TypeScript client
    - activation and UI
    - configuration bridge
    - process lifecycle and logs
    - compatibility/fallback switch during development only
             |
             | LSP over stdio
             v
  Rust language server
    - document store and cancellation
    - workspace/project configuration
    - FluffOS preprocessor and source mapping
    - incremental concrete syntax tree
    - semantic query database
    - dependency graph and workspace symbol index
    - diagnostics, completion, navigation, semantic tokens
    - formatting and signature help
```

### 4.1 边界原则

- TS 与 Rust 之间只传 LSP 消息和少量自定义配置/健康协议。
- 不跨进程传输完整 token stream、parse tree、`SyntaxDocument` 或 `SemanticSnapshot`。
- Rust 内部保留 parser、syntax、semantic 三层命名和职责，不泛化成新的 AST。
- 每个查询都绑定 document version、workspace config generation 和 cancellation token。
- 打开的文档以内存文本为准；未打开文件使用磁盘快照。
- 配置权威来源继续是工作区根目录的 `lpc-support.json` 与 `config.hell` 同步结果。

## 5. Rust workspace 结构

```text
rust/
  Cargo.toml
  crates/
    lpc-language-server/   # 二进制、LSP handler、调度与可观测性
    lpc-analysis/          # 版本化查询、语义模型、依赖图、索引
    lpc-syntax/            # parser 封装、typed node、trivia、range
    lpc-preprocessor/      # 条件编译、宏、include 和 source mapping
    lpc-protocol/          # 自定义 LSP 协议及健康/性能数据
```

第一批代码先创建 `lpc-language-server`、`lpc-protocol` 和最小文档仓库。其余 crate 在对应行为契约进入实现时增加，避免一开始生成大量空壳。

## 6. 解析与增量策略

首选 Tree-sitter 风格的增量 CST。是否直接采用 Tree-sitter LPC grammar，由 grammar spike 决定，但必须满足：

- 正确覆盖 FluffOS/LPC 扩展语法。
- 不完整编辑状态下稳定恢复并产生可定位错误。
- 保留 formatter 所需的注释、空白和 token range。
- 支持旧树应用文本编辑后增量重解析。
- `yifeng-jian.c`、`meridiand.c` 和现有 parser/syntax tests 建立等价 corpus。

如果 Tree-sitter grammar 无法在限定时间内达到兼容性，备选方案是 Rust 全量 parser + 增量语义查询；但该方案只有在性能门槛仍可满足时才能成为正式实现。

预处理器输出必须保留原始源码坐标映射。inactive region、宏展开和 include 事实不能通过修改后文本的行列猜测恢复。

## 7. 语义与索引策略

- 一个文件版本只产生一个分析快照。
- parser、syntax、semantic、diagnostics、tokens 和 navigation 从同一快照派生。
- 依赖图按 include、inherit、simul_efun 与配置 generation 建模。
- 文件变化只失效自身及受影响的反向依赖查询。
- 工作区索引持久驻留，文件变更做增量 upsert/remove，不在 Hover 或 Definition 请求内扫描工作区。
- 冷索引采用有界并行；默认并发度面向低性能 CPU，避免占满所有逻辑核心。
- 前台请求优先于后台索引，后台任务必须支持取消和让出执行预算。

## 8. 行为兼容

迁移以外部行为为准，不要求 Rust 内部对象与 TypeScript 同构。

必须建立双实现差异测试：

- parse diagnostics：code、severity、message category、range。
- semantic tokens：类型、modifier、range。
- document symbols、definition、references、hover、completion、signature help。
- formatter：全文、range formatting、注释/trivia 与幂等性。
- 预处理：宏、条件编译、inactive region、include 和 source mapping。
- workspace config：`lpc-support.json` / `config.hell` 同步结果。

允许有意修正现有缺陷，但每项差异必须记录为明确决策并添加回归测试。

## 9. 内部实施顺序

这些是开发顺序，不是对用户发布多个版本。

### Gate A：基建与可观测性

- 创建 Rust workspace 和最小 stdio LSP server。
- TS 客户端支持开发期开关并启动 Rust sidecar。
- 实现 initialize、shutdown、exit、文档同步、health。
- 扩展探针以识别 Rust server、请求耗时、版本与分析计数。

完成标准：VS Code/LSP 探针可以选择 Rust server，打开真实 LPC 文件并读取健康状态。

### Gate B：预处理与语法

- 建立 LPC grammar corpus。
- 实现增量 CST 和 source mapping。
- 对齐 parse diagnostics、node ranges、trivia 和主要 syntax facts。

完成标准：固定 corpus 无未解释结构差异，单行增量更新达到性能门槛。

### Gate C：语义与结构能力

- 实现文档符号、semantic tokens、folding、基础 diagnostics。
- 建立版本化语义查询缓存。

完成标准：真实样例与现有单元/集成测试的对外结果一致。

### Gate D：工作区能力

- 实现 include/inherit 依赖图和持久工作区索引。
- 迁移 completion、hover、definition、references、rename、signature help。
- 实现前台优先、有界并行和取消。

完成标准：Definition/Hover 不触发工作区扫描或同版本完整重解析，并达到延迟门槛。

### Gate E：Formatter 与完整切换

- 迁移 formatter 和 range formatting。
- 跑真实文件幂等性与现有 formatter 回归集。
- 完成平台二进制打包、启动失败诊断和崩溃日志。
- 默认启用 Rust server，移除面向用户的双实现选择。

完成标准：功能矩阵、性能矩阵、平台打包和真实项目探针全部通过。

## 10. 构建与发布

- CI 构建 Windows、Linux、macOS 的 x64/ARM64 目标；实际发布目标以当前用户平台数据确认。
- 每个 VSIX 只携带对应平台二进制。
- release 构建启用优化、去除不必要符号，并记录二进制 SHA-256。
- TS build 在打包前验证目标 Rust binary 存在且可执行。
- 远程 SSH、WSL、容器场景运行目标环境对应的 server binary，不能从本机跨平台启动。
- 如果未来支持 VS Code Web，需要单独的 WASM/Web worker 方案；不以牺牲桌面端性能为本次前置条件。

## 11. 风险与控制

| 风险 | 控制措施 |
| --- | --- |
| LPC grammar 行为漂移 | corpus + 双实现差异测试 + 真实项目探针 |
| formatter 丢失 trivia | CST 保留原始范围，格式化最后切换 |
| 原生二进制平台缺失 | 平台矩阵 CI 和平台专用 VSIX |
| 后台索引继续压满低端 CPU | 有界并行、前台优先、取消、空闲调度 |
| Rust 崩溃导致功能全失 | 进程守护、可读错误日志；开发期可回退 TS |
| 性能提升只体现在 microbenchmark | 真实 LSP 请求 p95 与 CPU time 作为发布门槛 |

## 12. 完成定义

只有同时满足以下条件才认为重构完成：

1. Rust server 覆盖当前默认 LSP 的用户可见功能。
2. 固定 corpus 与真实 LPC 项目的行为差异全部解释并测试。
3. 本文性能门槛通过，且低性能 CPU 验收无持续满核。
4. TypeScript 客户端不再执行生产语法或语义分析。
5. 平台 VSIX 能启动正确二进制，健康检查、退出和升级正常。
6. README、CHANGELOG、贡献文档和故障排查文档已更新。

## 13. 分支实施状态

状态以 `codex/rust-lsp-rearchitecture` 当前代码和自动化测试为准：

- Gate A：完成。Rust stdio server、TS sidecar、增量文档同步、health、构建和真实项目探针已接通。
- Gate B：完成本次切换范围。Tree-sitter LPC grammar、增量 CST、复合条件编译求值与屏蔽、include facts、动态 heredoc token 和恒等源码映射已实现。真实项目在 `__PACKAGE_DB__` 配置下审计 6753 个 `.c/.h` 文件，语法错误文件为 0；CI 对仓库固定 LPC 样例执行严格审计。会改变源码长度的完整文本宏展开没有进入本次实现，宏事实由预处理层保留，语法层直接覆盖项目使用的函数式宏和字符串宏组合。
- Gate C：进行中。document symbols、semantic tokens、folding、语法 diagnostics、未使用局部量、可证明的 literal 初始化/返回类型错误、已知函数参数数量诊断和对应 quick fix 已实现；更深的表达式类型流与完整行为差异测试仍待补齐。
- Gate D：进行中。单后台线程工作区索引、显式 rebuild/progress、磁盘增删改、definition、hover、references、rename、completion 和 signature help 已有共享快照实现；现有 bundled efun 文档已作为补全、hover、签名帮助和参数数量诊断的共同权威来源，include/inherit 可见图用于优先查询与保守引用范围。宏路径依赖和配置 generation 级反向失效仍待补齐。
- Gate E：进行中。CST 驱动的 Rust 全文/range formatter、heredoc 正文保护与真实 `yifeng-jian.c`、`meridiand.c` 语法安全和幂等检查已接入；Rust 已成为默认运行时，打包会强制构建原生服务并生成当前平台专用 VSIX，CI 覆盖 Windows/Linux/macOS 的 x64/ARM64 原生产物。代码中段复杂预处理指令和旧 TS 生产分析路径删除仍待完成。

这里的“已实现”只表示 Rust 路径具备对应能力并有针对性测试，不等同于已满足第 12 节的最终发布完成定义。

2026-09-15 的真实项目差异复核确认 Gate D 仍是发布阻断项。Rust 已修复函数级 `varargs` 参数数量误报、源码函数 Javadoc 丢失、补全跨作用域污染和未知对象方法的猜测式跳转；类型可证明的对象成员、裸 `::`/`efun::`、struct/class 字段、include/inherit 路径、预处理上下文、函数 snippet、配置驱动的全局 include 与实例解析也已进入自动化契约。真实工程已覆盖宏对象、`model_get` 传播、`load_object`、`this_player()`、include 指令和继承成员。剩余阻断项主要是命名 scoped qualifier 的精确父类选择、更深的分支/容器对象流推断、引用/重命名的更大规模差异语料，以及最终低性能设备 cold/warm p50、p95 和峰值内存验收。在这些差异全部闭合前，不得把“请求有返回”解释为功能等价，也不得以性能数据替代功能验收。

### 13.1 当前性能证据

同一真实项目与 `/adm/daemons/meridiand.c` 探针的 Rust 路径结果如下。这里是一次完整探针的阶段耗时，不伪装成多轮 p95：

| 场景 | Rust 实测 | TypeScript 基线 | 观察到的差异 |
| --- | ---: | ---: | ---: |
| Semantic tokens | 5.7 ms | 900.7 ms | 约 158 倍更快 |
| Definition | 0.5 ms | 3135.3 ms | 约 6270 倍更快 |
| Hover | 0.3 ms | 5748.5 ms | 约 19162 倍更快 |
| Completion | 2.4 ms | 3.6 ms | 约 1.5 倍更快 |
| 完整 CST 解析 | 1.939 ms | 786.0 ms | 约 405 倍更快 |
| 单字符增量解析 p95 | 8 µs | 无增量基线 | 不再完整重解析 |

工作区 6753 个源文件的语法审计耗时约 1.28 秒。后台索引刻意使用单线程并在文件间让出执行预算，完整墙钟时间约 14 秒，换取低性能 CPU 上不持续占满所有核心。正式发布结论仍应在目标低性能设备上重复采样 cold/warm p50、p95、CPU time 与峰值内存。
