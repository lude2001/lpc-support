# Rust LSP 一次性重构实施计划

## 1. 目标

本项目将在一个开发分支内完成 TypeScript 语言服务器到 Rust 语言服务器的整体切换，并在满足行为兼容与性能门槛后一次性发布。

本次重构不是将现有 TypeScript 逐行翻译成 Rust，也不是只替换 ANTLR parser。目标是建立面向编辑器工作负载的增量分析架构：文档编辑、预处理、语法分析、语义分析、工作区索引和主要 LSP 请求共享同一份版本化分析状态。

功能完整、语义正确和保守避免误报是发布的第一优先级。性能指标只能通过缓存、增量计算、索引复用和请求调度取得，不能通过删除语言能力、缩小合法 LPC 语义或跳过必要分析来达成；任何功能回归都会直接阻断发布，无论性能数字是否达标。

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
- Gate B：完成本次切换范围。Tree-sitter LPC grammar、增量 CST、复合条件编译求值与屏蔽、include facts、动态 heredoc token 和恒等源码映射已实现。全局 include、直接 include 与嵌套 include 按实际包含顺序传递宏环境：头文件读取包含点之前的定义，并把 define/undef 结果回流，宏路径 include 同样可解析；缓存键只包含头文件条件、修改及嵌套依赖实际涉及的宏。真实项目在 `__PACKAGE_DB__` 配置下审计 6769 个 `.c/.h` 文件，语法错误文件为 0；CI 对仓库固定 LPC 样例执行严格审计。会改变源码长度的宏不改写编辑器主 CST；预处理层保留宏事实，语法层稳定接纳函数式宏和字符串宏组合，语义层会单独解析整行函数式宏展开并把其生成的变量/函数声明映射回调用行，避免破坏原始源码坐标。
- Gate C：完成。document symbols、semantic tokens、folding、语法 diagnostics、未使用局部量、可证明的类型错误、已知函数参数数量、未定义直接调用和未定义值符号诊断及对应 quick fix 全部由 Rust 快照提供。否定性诊断只在 include/inherit/simulated efun 依赖完整时启用，并识别 FluffOS 预定义宏、头文件宏、宏源码顺序、多变量 `foreach`、匿名函数参数与命名继承限定符；头文件和被文本包含的 `.c` 片段因依赖最终宿主上下文而保守静默。全局未使用检查与旧 driver 的局部声明位置规则继续遵守原配置开关；参数检查独立为默认关闭的 `enableUnusedParameterCheck`，启用时只检查函数实现，绝不诊断前置声明。`searchEfunDefinitionInInheritanceChain` 已由 Rust 跳转路径兑现，默认继续阻止 efun 继承链扫描，开启后只搜索可见继承图。类型流只报告静态可证明的错误；不确定的动态 LPC 表达式按设计保守降级，避免以“更深分析”为名恢复误报。
- Gate D：完成。单后台线程工作区索引、显式 rebuild/progress、磁盘增删改、definition、hover、references、rename、completion 和 signature help 共用常驻快照。include/inherit、宏路径、配置 generation 与正反向依赖变化会使相关缓存失效；对象候选可通过包装返回、分支赋值、`foreach`、数组/映射字面量、确定索引及索引赋值传播，动态索引保持保守。
- Gate E：完成。Rust CST formatter 覆盖全文与 range formatting，并通过 heredoc、CRLF、语法安全和幂等检查；`format.indentSize` 通过配置同步成为 Rust 全文与选区格式化的统一缩进真源。变量面板、文件夹诊断、Javadoc 函数范围及函数文档中心均通过 Rust 自定义请求获取源码事实；扩展激活只装配项目配置、静态 bundled efun 展示、命令/UI 和 Rust 客户端，不再实例化旧 TypeScript frontend、semantic snapshot、模拟 efun 扫描或函数文档源码分析服务。只服务于旧 TS 缓存和异步诊断调度的 `lpc.performance.*` 设置已移除，避免保留无效开关。当前平台 VSIX 已完成打包、覆盖安装和原生服务生命周期验证，Windows、Linux、macOS 的 x64/ARM64 目标由 CI 六平台原生矩阵构建。

上述 Gate 记录的是架构切换已落地，不再等同于“功能完整迁移已经验收”。用户实际使用随后发现宏、跨文件 Javadoc 和函数签名语义缺陷，因此完整迁移验收已重新打开；只有这些差异及后续审计发现均有驱动源码、真实 mudlib、自动化测试与 LSP 探针证据后，才可再次宣告完成。它同样不构成合入稳定分支或发布授权。

2026-09-16 的最终真实项目复核覆盖 6769 个 `.c/.h` 文件，全部可读且 Tree-sitter 语法错误文件为 0。用户报告过误报的 `/cmds/skill/new_skills.c` 在原位置诊断为 0；全工作区诊断稳定为迁移前基线的 21 条（12 条已知参数数量、9 条真实未使用局部量），没有新增 `lpc.undefinedFunction` 或 `lpc.undefinedSymbol`。文档化函数的 hover 返回完整签名和 Javadoc 正文，函数文档查询同时返回当前文件、inherit 与 include 分组。真实 `/adm/daemons/restart_d.c` 中，`runtime_daemon_paths()` 的 11 个静态目标可经 `foreach`、`catch(...)` 和对象成员调用解析为 11 个真实实现，诊断为 0。自动化保护网同时覆盖歧义命名继承、未知对象、动态索引、跨函数同名局部量等负向场景，确保不以唯一名称或不完整候选猜测跳转与重命名。宏能力进一步以真实 `/clone/cloth/yaodai.c` 验证：`WAIST` 的悬浮包含定义与源码位置，跳转精确落到 `/include/armor.h` 的宏名称范围；自动化同时覆盖函数式宏 snippet、配置宏、非活动条件分支、重定义和 `#undef` 生命周期。

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

工作区 6753 个源文件的最终语法审计耗时 1.378 秒。后台索引刻意使用单线程并在文件间让出执行预算。为模拟受限 CPU，Windows 探针进程树固定到 1 个逻辑核并设为 BelowNormal；5 次全新进程/全量索引采样的 cold 启动墙钟 p50 为 16.894 秒、p95 为 17.284 秒，进程 CPU time p50 为 8.031 秒、p95 为 8.953 秒，平均单核利用率 p50 为 46.3%、p95 为 50.5%，峰值常驻内存 p95 为 106.0 MiB。该约束测试证明索引不会持续占满单核；它仍应与未来真实低性能设备的体验反馈并行观察。

同一单核受限环境对真实 `/adm/daemons/restart_d.c` 的 11 候选容器对象流进行 30 次 warm 采样：semantic tokens p95 1.7 ms、definition p95 3.2 ms、references p95 3.8 ms、hover p95 2.6 ms、completion p95 4.4 ms，全部 0 超时，采样期间 parse 与 semantic rebuild 增量均为 0。函数文档完整查询单次为 9.1 ms。

最终提交代码在同一真实工作区的复核索引了 6768 个磁盘文件并打开 1 个目标文档：冷启动墙钟 20.536 秒、进程 CPU time 12.484 秒、平均利用率为单个逻辑核的 59.1%、峰值常驻内存 131.1 MiB。随后 30 次 warm 采样的 semantic tokens / definition / references / hover / completion p95 分别为 1.4 / 1.1 / 4.2 / 1.0 / 1.3 ms，全部 0 超时、0 parse rebuild、0 semantic rebuild；完整函数文档查询为 6.8 ms。

最近一次自动化回归为 Jest 168/168 套件、1379/1379 测试通过；Rust workspace 当前为 126/126 单元测试通过，clippy `-D warnings` 通过。该数字是当前保护网基线，不单独证明迁移完成。原生 stdio smoke 额外覆盖 efun 继承链开关的关闭/开启行为、补全触发字符、签名帮助逗号重触发、宏定义/悬浮/高亮/补全/引用/重命名、`#undef` 与条件编译生命周期、多行及带空格参数的函数宏、未 include 头文件宏隔离、include 导入条件宏、头文件变更失效与宏生成声明的文档符号/悬浮/跳转、跨文件多候选方法的结构化 Javadoc 保留、2 空格 formatter 配置覆盖 8 空格 LSP 请求选项，以及可配置诊断、跨文件能力、shutdown 和 exit。宏顺序专项测试进一步覆盖调用方定义传入头文件、头文件 undef 回流、宏路径 include、导入函数宏生成声明，以及 include 前后不同的跳转和高亮范围。真实项目的脱敏全工作区 LSP 诊断审计覆盖全部索引文件：修复成员调用接收者误识别、嵌套匿名函数返回类型串扰、多变量 `foreach` 与匿名函数参数绑定后，诊断由 108 条降至 21 条；其中不再存在 `lpc.typeMismatch`、`lpc.undefinedFunction` 或 `lpc.undefinedSymbol`，剩余诊断仍须结合最新 FluffOS 参数语义重新审计，而不能沿用旧结论直接视为源码问题。

当前 Windows x64 平台已重新完成干净打包；真实项目 `/feature/skill.c` 的宏光标探针确认返回 `macro` token、定义、结构化悬浮、418 个精确引用和可重命名范围，同一文档还区分 110 个 driver efun 与 41 个 simulated efun，诊断为 0；`/cmds/std/look.c` 的跨文件方法探针确认 `world_object_button` 返回结构化 Javadoc，定义、签名帮助和补全均带文档。`lpc-support-win32-x64-0.52.13.vsix` 的 SHA-256 为 `a1b994287ec35191e3dc1da45f755a715ddc0b40a33e5d7ed7046a753fc01778`；VSIX 共 436 个条目，只包含约 752 KiB 的 `dist/extension.js`、模板、故障排查文档和 Rust sidecar，不包含 `dist/lsp/server.js` 或 ANTLR 生成源码。包内 `lpc-language-server.exe` SHA-256 与构建记录及旁路校验文件一致，为 `ef773f048e3d76646123f8dc13f5fe1ef698b65183d8bef69ca849078d553b8a`。其他目标平台由 CI 的 Windows/Linux/macOS x64/ARM64 六平台原生构建矩阵覆盖；未在本 Windows 主机伪装成跨平台安装验收。
