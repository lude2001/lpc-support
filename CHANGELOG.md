# 更新日志

所有 LPC Support 扩展的重要用户可见变更都会记录在此文件中。

## [0.46.1] - 2026-05-03

### 稳定性改进

- 改进真实项目中的预处理与宏识别稳定性，减少打开大型 mudlib 文件时出现的语法误报。
- 改进 HTTP controller 中 `RequestType(...)` 等函数式宏的支持，使相关文件首次打开和刷新诊断时更稳定。
- 改进条件编译文件的诊断表现，未启用分支中的代码不会干扰当前文件的正常诊断。
- 改进模拟函数库和常用命令文件的兼容性，减少正常可编译 LPC 代码被误判为语法错误的情况。

## [0.46.0] - 2026-05-03

### 预处理与宏支持

- 改进 `#include`、`#define`、`#undef`、`#if`、`#ifdef`、`#ifndef`、`#elif`、`#else`、`#endif` 等预处理写法的识别。
- `#if 0` 和未启用的条件编译分支不再产生语法诊断。
- 修复 `RequestType(pay_add,"POST")` 后接 `public mapping ...` 这类合法 HTTP controller 写法的语法误报。
- 宏补全、宏悬停、宏定义跳转和语义高亮更准确，不再仅按大写命名猜测宏。
- 格式化会保留 `#include "..." // comment` 这类预处理行和行尾注释，缺失 include 的警告不会阻断格式化。
- 变量查看面板更准确地展示当前文件变量。

## [0.45.9] - 2026-04-29

### Macro-Backed HTTP Controller Diagnostic Fix

- 修复顶层宏调用行必须显式写分号的 parser 限制，支持 `RequestType(pay_add,"POST")` 这类宏展开体自带分号的 LPC/C 预处理写法。
- 修复 `external_system_package/http/controller/pay_game.c` 首次打开时在 `RequestType(...)` 后接 `public mapping ...` 函数声明处出现假的 ANTLR `no viable alternative` / `missing ';'` 诊断。
- 补充 parser 统一入口回归，锁定宏声明行后接函数声明不会再产生语法诊断。

## [0.45.8] - 2026-04-29

### Simulated Efun Else-If Diagnostic Fix

- 修复 simulated efun 文档预加载阶段的 legacy prototype normalize 误把 `else if(...)` 识别成旧式函数声明并补分号的问题。
- 修复 `adm/simul_efun/message.c` 首次打开时在正常 `if / else if / else` 链上出现两条假的 ANTLR `extraneous input 'else'` 诊断。
- 补充 spawned LSP runtime 回归，锁定 simulated efun 文档预加载后真实文件 version 1 的诊断结果不会继承归一化文本的错误状态。

## [0.45.7] - 2026-04-29

### Syntax Highlighting Ownership Cleanup

- 将 TextMate grammar 收敛为轻量词法兜底，只保留注释、字符串、预处理、基础关键字/类型、数字、操作符、heredoc 与 array delimiter 高亮，不再重复维护 efun、函数名、变量名和成员访问语义。
- 语义高亮继续由 LSP semantic tokens 作为主路径提供，并补齐 `->`、`.`、`?`、`:` 等独立 operator token，避免成员访问和三元表达式只靠 TextMate 兜底。
- 多行注释、heredoc 等多行 lexer token 现在会拆成逐行 semantic token，避免 VS Code 客户端收到跨行 token 后出现高亮异常。
- 新增 TextMate / semantic token 分工回归，锁定“TextMate 不再成为第二套语言事实来源”的架构边界。

## [0.45.6] - 2026-04-22

### Simulated Efun Parse Cache Fixes

- 修复模拟函数库预扫描阶段的 legacy prototype normalize 误把单行 `if (...)` 识别成函数声明的问题，避免对 `adm/simul_efun/*.c` 的源码做错误分号补全。
- 修复 `adm/simul_efun/util.c` 这类被 `simul_efun.c` include 的 helper 文件在首次 `didOpen` 时出现假的 ANTLR `extraneous input 'else'` 诊断的问题。
- 补充 scanner 级与 spawned runtime 级回归，锁定“模拟函数库文档预加载不会污染真实文件 parse cache”。

## [0.45.5] - 2026-04-22

### Scoped Hover and Callable Documentation Fixes

- 修复 `::query(...)` scoped 父类调用 hover 错误回退到当前文件同名函数文档的问题；当 scoped 解析失败时，普通函数 hover 不再抢占 `::method()` 场景。
- 修复 `char::query(...)` 这类具名 inherit 分支调用 definition 可跳转但 hover 为空的问题；scoped hover 现在会使用完整函数声明范围装配 callable-documentation。
- 统一 scoped method 与对象方法 lookup 的 declaration key 语义：文档与 signature help 使用完整函数范围，definition 仍定位到函数名 token，避免多候选链路和文档索引互相污染。
- 补充 scoped range、ordinary hover fallback、object-method lookup declaration range 和真实 `user.c` scoped query 场景回归。

## [0.45.4] - 2026-04-21

### Syntax and Semantic Object Inference Hardening

- 新增显式 `EmptyStatement` 语法节点，合法空语句和 `if (flag);` 不再被表示为 `Missing`，formatter 也会保留可见分号而不是静默丢失空语句。
- 将静态表达式求值拆分为更清晰的 literal、constant、container shape、object source、condition 和 type predicate 子模块，降低 `ExpressionEvaluator` 继续膨胀成临时规则集合的风险。
- 新增保守的静态 `+`、`&&`、`||` 折叠：仅在可证明的 literal / truthiness 白区内产出结果，未知或混合风险表达式继续保持 `unknown`。
- 对象推导现在可以消费 receiver 表达式的语义求值结果，支持局部 receiver 中的静态路径拼接和 `new("/std/" + "classify_pop")` 这类直接 receiver 场景。
- 保留 identifier 可见绑定与作用域优先级：内层 block 局部变量不会泄漏到外层，同名宏 fallback 不会被已离开作用域的局部绑定污染。
- 补强 `PROTOCOL_D->model_get("navigation_popup")->create_action(...)`、concatenated `load_object`、folded `new(...)`、visible binding、non-static 和 provider integration 回归，确保 `@lpc-return-objects` 继续只是 fallback-only。

## [0.45.3] - 2026-04-21

### Semantic Evaluation Foundation

- 新增 LPC 受限语义求值基础层，面向对象方法推导提供统一的 Value Domain、函数内静态求值、callee return 推导和环境语义 provider，不再继续把复杂返回对象规则堆在对象推导器内部。
- 对象方法链现在会优先消费自然语义推导结果；`model_get("login")` 这类静态 registry / mapping / `new` / `load_object` 返回链可以精确落到实际模型对象，`@lpc-return-objects` 保留为 fallback，而不再覆盖可证明结果。
- `PROTOCOL_D->model_get("navigation_popup")->create_action(...)` 这类宏 receiver 调用现在也会先展开宏并进入自然 return 推导，避免回退到 `@lpc-return-objects` 的全量候选集合。
- 修正宏式函数调用语句的分号归属，`call_other(...);` 等调用不再额外生成 `Missing` 分号残片并打断函数内语义求值。
- `this_player()` 已接入配置驱动的环境语义 provider，helper 包装返回 `this_player()` 的场景也能继续传播到对象方法跳转、悬停和补全链路。
- `previous_object(...)` 现在被明确归类为 non-static 运行时调用栈来源，不会因为 `@lpc-return-objects` 注解而错误跳到静态候选对象。
- 补强嵌套 `if / else if` 调用点、partial-return 分支合并、helper 包装 runtime provider、spawned runtime 和 provider integration 回归，确保自然语义推导不会在关键链路上退回旧 fallback。

## [0.45.2] - 2026-04-20

### Architecture Cleanup

- 完成 analysis / documentation / completion / hover / signature help / navigation / object inference / runtime document source 的 ownership normalization，主要语言服务现在统一退回到 composition root + factory 装配，不再在主服务内部偷偷自组装依赖。
- 统一函数文档、scoped completion、hover renderer、document symbol snapshot、reference / rename adapter 和 document host/path support 的 owner，移除多条历史 fallback 与 self-assembly 路径。
- 收紧 `ASTManager`、`WorkspaceSession`、`ParsedDocumentService`、`LspClientManager` 等基础设施入口，减少零参默认配置与隐式单例残影，主语言能力链的基础设施使用方式更加一致。
- 这次发布不引入新的语言功能，重点是稳定现有能力、清理死代码和降低后续功能演进的结构阻力。

## [0.45.1] - 2026-04-18

### Navigation Capability Narrowing

- 收窄 `references / rename` 的能力边界：函数 `references` 不再做工作区级名字扩散，只保留当前文件级与可证明继承链级结果。
- 函数与 `struct/class` 定义现在不再支持 `rename`；`rename` 仅保留局部变量、函数参数和文件级全局变量。
- 文件级全局变量的 `references / rename` 只会沿静态可解析且可证明的 `inherit` 链扩展；发生遮蔽、分支歧义或未解析 `inherit` 时会保守降级。
- LSP runtime 现在明确区分“函数 rename 被拒绝”和“局部变量/参数等仍可正常 rename”的路径，并补充对应的 spawned runtime 回归。

## [0.45.0] - 2026-04-18

### 工作区级引用与安全重命名

- 新增工作区级 `references` 与安全 `rename`：函数、文件级全局变量和类型定义现在可以跨文件返回引用结果，并在可证明安全时生成多文件重命名编辑。
- 本地变量和参数仍然保持当前文件内语义，不会被错误扩展到工作区级引用或重命名。
- 工作区级 owner 解析改为保守证明策略：当声明归属无法唯一证明时，`references` 只会保守降级为当前文件结果或空结果，`rename` 会直接拒绝，而不会按同名猜测跨文件关系。
- 同文件中的函数 prototype / implementation 现在会被视为同一个 callable family；跨文件 `.h/.c` 不能唯一证明归属时，仍会保守失败。
- 新增 `WorkspaceSemanticIndexService`、owner resolver、reference collector、navigation service、runtime wiring 与 handler 集成回归覆盖，并修正“本地声明被无关同名文件误判 ambiguous”以及“外部 unresolved token 仅凭名字唯一被错误升级”为工作区级 owner 的问题。

## [0.44.0] - 2026-04-18

### Scoped 方法补全

- 新增 `::method()` 与 `room::method()` 的 scoped 方法补全能力；输入显式父对象或具名 inherit 分支前缀时，现在可以直接获得 direct inherit 图中的方法候选。
- scoped completion 统一复用 inherit-only 发现路径，不再错误回退到当前文件同名函数、include 文件、普通函数、模拟函数或 efun。
- 当 qualifier 歧义、direct inherit 未解析、父链不完整或结构不受支持时，scoped completion 会保守返回空候选，避免给出错误补全。
- scoped completion item resolve 现在走 declaration-based 文档链，补全项说明与既有 scoped definition、hover 和 signature help 保持一致。
- 补充 scoped discovery、completion context、completion service、provider integration 与生产 runtime wiring 的回归覆盖，并修正参数区误触发和多目标 scoped 候选的保守元数据语义。

## [0.43.0] - 2026-04-17

### Scoped 方法解析

- 新增 `::method()` 与 `room::method()` 的 scoped method 解析能力，显式父对象调用和具名 inherit 分支调用现在可以稳定进入定义跳转、悬停和签名帮助主链。
- `::factory()` 与 `room::factory()` 现在可以继续复用 `@lpc-return-objects` 返回对象传播，后续 `ob->method()` 定义跳转能够顺着 scoped 调用结果继续落到真实对象实现。
- scoped method 解析统一走 inherit-only 路径，不再错误回退到当前文件同名函数、include 文件、普通函数、模拟函数或 efun。
- 当 direct inherit 图存在 qualifier 歧义、未解析 inherit 或不完整父链时，scoped method 结果会保守降级为 `unknown`，避免对部分已解析父链给出错误确定答案。
- 补充 scoped resolver、documented-return、definition、hover、signature help、runtime wiring 与多行 `::` 调用边界的回归覆盖，并修复生产 runtime 中 scoped resolver 工作区根路径被冻结到启动 `cwd` 的问题。

## [0.42.0] - 2026-04-17

### 对象方法推导增强

- 新增“继承链静态全局对象绑定”推导能力：子对象现在可以继承父对象中声明点可静态证明的文件级 `object` 绑定，并把它用于对象方法补全、定义跳转、悬停和签名帮助。
- 对象推导优先级升级为：局部绑定 > 当前文件全局对象绑定 > 继承链全局对象绑定 > 宏 fallback，减少 inherited global 被同名宏错误抢走的情况。
- 新增继承链中的全局别名链、对象方法 initializer、unsupported / no-initializer blocker 和跨文件 alias cycle 回归覆盖，继承分支下的保守降级语义更稳定。
- 补充 inherited global 的 completion / definition / signature help consumer 回归，确保核心推导结果能稳定透传到语言服务入口。

## [0.41.0] - 2026-04-17

### 对象方法推导增强

- 新增“当前文件静态全局对象绑定”推导能力：`object COMBAT_D = load_object(...); COMBAT_D->method()` 这类写法现在可以稳定参与对象方法推导。
- 当前文件中由声明点静态可证明的文件级 `object` 变量，现在会自动服务于成员补全、定义跳转、悬停和签名帮助。
- 当前文件可见的全局 `object` 绑定现在优先于同名宏；当全局绑定存在但来源无法静态证明时，系统会保守保持 `unknown/unsupported`，不再错误回退到宏路径。
- 新增文件级全局对象别名、documented-return initializer、对象方法 initializer 和相关 consumer 回归覆盖，进一步提升对象方法链路的稳定性。

## [0.40.1] - 2026-04-14

### callable-documentation 与签名帮助升级

- 新增统一的 callable-documentation 主链：当前文件、继承文件、include 文件、模拟函数库、标准 efun 与对象方法文档现在共享同一套结构化文档模型。
- 新增签名帮助能力，支持当前文件、继承文件、include 文件、模拟函数库、标准 efun 与对象方法调用。
- 标准 efun 文档切换为完全本地、结构化的内置 bundle，运行时不再请求 `mud.wiki`。
- 函数文档悬停、函数文档面板与 `@lpc-return-objects` 返回对象传播统一复用共享文档服务。
- 补充 callable-documentation / signature help / formatter parity / object inference 回归覆盖，并修复全量测试中的 fixture 与缓存稳定性问题。

## [0.40.0] - 2026-04-12

### 重大更新

- 扩展已经完成单一路径 LSP 切换，补全、悬停、跳转、引用、重命名、诊断、语义高亮和格式化现在统一由同一条 LSP 语言服务链路提供。
- 项目配置全面收敛到 `lpc-support.json`，不再继续使用旧版 VS Code 路径设置作为兼容入口。

### 新增与改进

- 补全、悬停、定义跳转、引用查找、重命名、文档大纲、代码折叠、语义高亮统一到 LSP。
- 文档格式化和选区格式化统一到 LSP，编辑器体验更一致。
- `code action`、宏相关悬停和 efun / 文件函数悬停已并入统一语言服务主链。
- 模拟函数入口文件和宏目录配置现在统一写入 `lpc-support.json`。
- 标准 efun 文档切换为完全本地、结构化的内置 bundle，运行时不再请求 `mud.wiki`。
- 当前文件、继承文件、include 文件、模拟函数库、标准 efun 与对象方法文档现在统一走 callable-documentation 管线。
- 新增签名帮助能力，支持当前文件、继承文件、include 文件、模拟函数库、标准 efun 与对象方法调用。
- 编译管理继续支持本地 `lpccp` 和远程 HTTP 两种模式。

### 兼容性调整

- 移除旧版 `lpc.includePath`、`lpc.simulatedEfunsPath` 和 `lpc.migrateProjectConfig` 配置/迁移入口。
- 不再公开 `lpc.experimental.lspMode` 多模式切换配置。
- 项目现在默认要求通过 `lpc-support.json` 提供 LPC 工作区配置。

## [0.34.0] - 2026-04-09

### 对象方法返回传播

- 新增跨文件对象方法返回传播：当实际实现通过 `@lpc-return-objects` 标注返回对象后，`c = B->method(); c->query_xxx()` 现在可以继续传播到下一跳对象方法解析。
- 当接收者存在多个候选对象时，扩展会分别分派到各自的实际实现，并合并这些实现声明的返回对象候选。
- 多个实际实现的悬停说明现在按实现拆分为独立区块展示，便于区分不同对象来源的签名与文档。
- 如果任一实际实现缺少 `@lpc-return-objects`，传播会保守降级为 unknown，并在悬停中明确解释是哪些实现缺少返回对象标注。

## [0.33.0] - 2026-04-09

### 对象方法智能推导

- `obj->method()` 现在可以根据字符串路径、宏路径、内置函数和当前函数内变量赋值链推导对象来源。
- 基于对象推导结果，成员补全、跳转到定义和悬停提示的准确性明显提升。
- 新增 `playerObjectPath` 配置，用于支持 `this_player()` 的对象推导。
- 支持通过 `@lpc-return-objects` 为自定义函数标注返回对象。

## [0.32.1] - 2026-04-08

### 修复

- 修复 `对象->方法()` 悬停时错误回退到模拟函数库或标准 efun 文档的问题。
- 修复 `对象->方法()` 跳转到定义时错误回退到模拟函数库的问题。
- 修复成员补全混入同前缀 efun 候选的问题。

## [0.32.0] - 2026-03-27

### 启动驱动调整

- “启动 MUD 驱动”命令改为固定通过 `lpcprj config` 启动。
- 当系统中未检测到 `lpcprj` 时，扩展会提示用户先安装开发驱动环境。
- 移除旧版 `lpc.driver.command` 启动配置项及相关兼容逻辑。

## [0.3.1] - 2026-03-23

### 稳定性修复

- 修复 `lpc-support.json` 在 `config.hell` 未变化时仍被重复回写的问题。
- 修复无项目配置工作区仍触发宏扫描和模拟函数扫描的问题。

## [0.3.0] - 2026-03-22

### 项目级配置

- 新增项目根目录配置文件 `lpc-support.json`。
- 扩展开始根据 `lpc-support.json` 自动同步 `config.hell` 中的关键字段。
- 宏扫描、模拟函数文档加载、编译配置逐步收敛到项目级配置。

### 编译管理

- “管理编译服务器”升级为统一的“编译管理”入口。
- 新增本地 `lpccp` 编译模式。
- 远程 HTTP 编译和本地 `lpccp` 配置统一收敛到 `lpc-support.json`。

## [0.2.8] - 2026-03-22

### 格式化修复

- 修复复杂 `mapping` 和数组结构被错误压成单行的问题。
- 修复字符串拼接中必要空格被移除的问题。
- 改进独立 `if` 语句之间的空行规则。

## [0.2.7] - 2026-03-15

### 首版格式化支持

- 新增 LPC 文档格式化与选区格式化。
- 支持函数、循环、匿名函数、`struct/class`、`mapping`、数组等常见结构的格式化整理。
- 新增 `lpc.format.indentSize` 配置项。

## [0.2.6] - 2026-03-09

### 补全体验修复

- 修复多变量声明场景下局部变量补全文档显示错误的问题。

## [0.2.5] - 2026-03-09

### 符号重构修复

- 修复不同函数内同名局部变量在重命名和引用查找中被错误串联的问题。

## [0.2.4] - 2026-03-09

### 补全性能优化

- 引入基于文档语义快照的补全查询链路。
- 补全和语义高亮开始复用统一的解析/语义结果，减少重复分析开销。

## [0.2.3] - 2026-03-07

### 发布整理

- 更新扩展图标。
- 重写 README，补充功能、命令和配置说明。
- 修复 VSIX 打包流程。

## [0.2.2] - 2026-03-07

### Efun 文档离线化

- 标准 efun 文档改为随扩展离线打包。
- 运行时默认直接使用内置文档。

## [0.2.1] - 2026-03-04

### 诊断规则可配置化

- 新增 `lpc.enforceLocalVariableDeclarationAtBlockStart` 配置项。

## [0.2.0] - 2025-10-06

### 性能与稳定性

- 提升解析、分析和诊断响应速度。
- 优化缓存策略。
- 改进路径解析和扩展稳定性。

## [0.1.8] - 2024-09-27

### 语法支持增强

- 新增多种 LPC 语法支持，包括二进制字面量、右索引表达式、switch 范围匹配等。

## [0.1.7] - 2025-09-04

### 重要修复

- 修复局部变量和函数参数补全缺失的问题。

## [0.1.6] - 2025-09-04

### 新增

- 支持 include 文件跳转。

## [0.1.5] - 2025-09-03

### 修复

- 支持函数内部 `class` 局部变量声明。
- 改进动态路径表达式解析。

## [0.1.4] - 2025-01-15

### 改进

- 增强跨文件函数跳转能力。

## [0.1.3] - 2025-01-15

### 新增

- 完整支持 `include "filename";` 与 `include expression;` 语法。

## [0.1.2] - 2025-08-26

### 新增

- 错误树视图支持复制错误详情。

## [0.1.1] - 2025-08-25

### 改进

- 移除函数参数使用检查，减少不必要警告。

## [0.0.4] - 2025-05-31

### 新增与改进

- 扩展模拟函数库文档支持。
- 增强继承链支持。
- 新增基于继承链检索的函数文档面板。
- 新增 `Ctrl+F5` 编译快捷键。

## [0.0.3] - 2025-02-25

### 新增与修复

- 增强代码补全。
- 改进服务管理界面。
- 修复宏定义处理和部分诊断误报。

## [0.0.2] - 2025-01-25

### 初始版本

- 提供语法高亮、代码补全、诊断、宏定义和 Efun 文档支持。
