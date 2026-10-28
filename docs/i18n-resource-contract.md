# 中英文资源契约

本契约落实中英文实施计划 M1 的资源、语言与事实边界，供后续宿主、页面、Rust、文档和检查工具共同使用。

## 1. 实施基线

- 实施目录：`D:\code\lpc-support`；实施分支：`codex/i18n-complete`。
- 本地代码基线提交：`96f999e5e707faf7576aa4197957ca0a06a7b388`。
- 2026-10-27 只读核对的 GitHub `main`：`f7d3fe4839dc0855421dacf29fc6341f1175a950`。
- 两者源码树相同：`f05b6af7c3fff26494cf7241ad9505f66bd8df03`。本地旧的 `origin/main` 引用尚未刷新，不能将其当作远端当前状态。
- Efun 基线为 413 份文档、23 类、492 个签名与 738 个参数。摘要 413 项、详细说明 131 项、备注 1 项；实施时保留字段的存在性与原意。
- 进度只在[实施计划第 6 节](i18n-implementation-plan.md#6-工作区隔离与证据)更新。本文件规定契约，不创建第二套里程碑状态。

## 2. 有效语言

| 输入 | 有效语言 | 规则 |
| --- | --- | --- |
| `zh-cn`，包括 LSP 客户端传入的大小写变体 | `zh-cn` | 对应实际发布的简体中文资源 |
| `en` 及英文区域标记 | `en` | 使用英文源消息 |
| 缺省、空值及其他语言标记 | `en` | 使用默认资源 |

`zh`、`zh-Hans`、`zh-SG`、`zh-tw` 与下划线标记不擅自映射成简体中文。VS Code 非内置扩展的运行时 bundle 按实际显示语言查找文件；仅在 Rust 或页面添加别名会使同一窗口显示不同语言。

共同用例保存在 `tests/fixtures/localization/locale-cases.json`。TypeScript 与 Rust 使用同一份输入输出用例。宿主从 VS Code 获得显示语言；LSP 客户端向 sidecar 传递该语言；页面与 Efun 展示使用同一有效语言。

原生清单加载器和运行时 bundle 的区域回退机制并不完全相同。M2 的清单资源接入需要配合测试处理已知差异，不能只给 sidecar 增加中文别名。首版真正验收的 VS Code 显示语言为 `en` 和 `zh-cn`；未提供翻译的语言显示英文。

## 3. 消息资源

- 静态贡献：`package.nls.json` 为英文，`package.nls.zh-cn.json` 为简体中文，清单使用稳定的 `%key%` 引用。
- 宿主源代码：使用字面量英文模板调用 `vscode.l10n.t()`；英文也是译文缺失时的默认消息。动态值使用编号或命名占位符，不拼接待翻译的半句话。
- 宿主运行时：`l10n/bundle.l10n.json` 记录英文消息，`l10n/bundle.l10n.zh-cn.json` 提供翻译；`package.json` 声明 `l10n` 路径。
- Webview：宿主提供有效语言和所需消息；页面脚本不自行推测用户语言。静态属性、动态状态与错误分支使用相同资源。
- Rust：集中消息目录和结构化消息标识负责渲染。诊断、补全、签名帮助与快速修复共享有效语言，不在 TypeScript 中根据中文报错句子做反向匹配。
- 翻译资源以源码或生成入口为真源。构建检查核对两种语言的键与占位符，并拒绝缺失、孤立及重复冲突项；生成文件必须能由确定的源输入重建。
- 业务分支按命令或动作 ID 判断，不能依赖翻译后的按钮文本。用户提供的模型描述、路径、符号名、代码及第三方原始报错作为参数保留。

占位符统一使用 `{0}` 等编号或 `{name}` 等单词键。格式器保留缺值及 null 的原始匹配，不自行定义 `{{}}` 反转义；浏览器与测试 mock 对齐实际宿主格式化行为。

| 中文术语 | 英文术语 | 约定 |
| --- | --- | --- |
| 内置函数 | Efun | 类型和函数名保持源码原文 |
| 模拟函数 | Simulated Efun | 不暗示驱动自带或可唯一静态解析 |
| 继承 | Inheritance | 源码关键字 `inherit` 保留 |
| 包含 | Include | 源码指令 `#include` 保留 |
| 宏 | Macro | 宏名和替换文本保持原文 |
| 声明 | Declaration | 与函数实现区分 |
| 原型 | Prototype | 与带函数体的实现区分 |
| 实现 | Implementation | 保持声明身份及定位范围 |
| 签名 | Signature | label 与参数事实保持原文 |
| 工作区索引 | Workspace index | 指 Rust 常驻索引 |
| 函数文档中心 | Function Documentation Center | 对应已有文档页面 |
| 分析查看器 | Analysis Inspector | 对应已有静态分析页面 |

## 4. Efun 结构数据与语言覆盖

采用唯一结构数据加语言覆盖，不复制中英文签名。后续迁移的目录职责为：

```text
config/efun-docs/
  docs/<efun>.json                   # 唯一结构数据和已有引用
  categories.json                    # 稳定分类 ID 到函数名的成员关系
  locales/en/<efun>.json              # 英文自然语言字段
  locales/zh-cn/<efun>.json           # 简体中文自然语言字段
  locales/en/categories.json          # 分类 ID 到英文显示名
  locales/zh-cn/categories.json       # 分类 ID 到中文显示名
```

结构数据包括函数名、类别 ID、签名 label、returnType、isVariadic、arity，以及参数 name、type、optional、variadic 等事实。原来缺省的事实不得通过迁移补造；同名重载继续区分。

语言覆盖包括 summary、details、note，以及原文已有的签名级或参数级自然语言说明。语言字段的存在性按基线登记；原文没有的说明不靠翻译臆造。引用关系保留在结构数据中，链接不因翻译被任意替换。

当前语料没有签名级或参数级 description；未来如新增，应通过稳定签名标识与参数名关联，并由检查器验证，不通过翻译改动参数结构。

分类 ID 为：`arrays`、`buffers`、`calls`、`class`、`db`、`ed`、`filesystem`、`floats`、`functions`、`general`、`interactive`、`internals`、`mappings`、`mudlib`、`numbers`、`objects`、`parsing`、`pcre`、`sockets`、`strings`、`system`、`contrib`、`uncategorized`。

TypeScript 与 Rust 物化时先读取结构事实，再按有效语言叠加正文和显示名。两种语言均随每个 VSIX 离线交付，运行时缺失资源回退英文，发布检查要求覆盖完整。函数名、类型、宏、标签和代码示例保持原文；合法中文示例采用字段级例外登记。

## 5. 缓存与生成注释

- 分析缓存保存语言无关的诊断事实及文档身份。现有已物化 message 或摘要迁移时更新缓存版本或进行明确兼容处理。
- 展示缓存包含有效语言与资源版本，不能把某个会话的中文消息作为所有会话的事实。
- 查询使用已加载资源和 Rust 常驻索引，不为本地化解析 LPC 源码、重新扫描工作区或实时联网翻译。
- `lpc.documentation.language` 独立支持 `zh-cn` 与 `en`，默认 `zh-cn`。两个注释入口共享设置，已有正文保留，新增说明遵从本次输出语言。

### 5.1 M4 迁移检查点

以下为对当前未修改 Rust 基线的只读调用链结论，供 M4 直接接续，避免续跑重新调查同一范围。

| 已确认位置 | 迁移要求 |
| --- | --- |
| `lpc-analysis/src/lib.rs` 的公开 `Diagnostic` 与内部 `FileAnalysis.diagnostics` | 保留对外 message/range/severity/code/source 形状，内部缓存改用可序列化消息事实和参数，在查询返回边界投影语言 |
| `syntax-error` 与 `lpc.typeMismatch` 的多个分支 | 消息需要独立稳定标识；仅用 diagnostic code 作翻译键不足以区分分支，中文 context 改为类型化身份 |
| `TypeMember.documentation`、`MacroDefinition.documentation`、`leading_documentation()`、`leading_macro_documentation()` | 目前已烘焙中文 Markdown 标题，需要保存结构化文档或原始内容，查询时渲染；正文、类型和源码注释保留 |
| `INDEXED_ANALYSIS_CACHE_SCHEMA_VERSION = 1` 与 `workspace_index.rs` 外层 schema `2` | 分别明确升级并拒绝旧格式，不能只依赖扩展版本环境变量碰巧使开发缓存失效 |
| `main.rs` 的初始化与 `AnalysisDatabase` 会话 | 在 initialize locale 可用后设置有效语言，不把 locale 序列化为分析事实；默认使用英文，测试需要中文时显式设置 |
| `main.rs` 的 didOpen/didChange、配置/头文件同步、后台文件变化及 didClose | 部分后台分支直接发送 publishDiagnostics，绕过发送辅助函数；将投影收口于分析查询返回边界并验证每个路由 |
| `lpc/workspaceDiagnostics` 与 quickfix | 工作区诊断复用同一投影；quickfix 标题本地化，附带诊断保留客户端 context 原文，实际 `_name` 编辑不变 |
| 文档 Markdown、成员/函数/模拟函数 hover、completion 与 signature 帮助函数 | 分节、来源、预定义宏、预处理和路径说明都纳入；不能只搜中文漏掉现有英文插件文案 |
| `efun_docs.rs` 的启动加载 | 预留有效语言入口；M5 使用共同结构与语言覆盖，不复制签名。当前 external map 未进入索引文件缓存 |
| `document_store.rs`、`syntax_store.rs`、资源加载与 main 错误出口 | 插件上下文使用结构化消息，底层 I/O/serde 原因保留；区分真实 ResponseError 与当前会致命退出的 anyhow 路径，本次迁移保持既有控制流 |

对应定向核验包括同事实双语投影、同缓存根跨语言恢复、旧 schema 拒绝、宏/成员标题不污染缓存、各实时/工作区/后台诊断路由、hover/completion/signature/quickfix、未知方法响应，以及既有依赖失效和解析计数断言。事实缓存不加入 locale；将来如缓存展示结果，再加入语言与资源版本。

## 6. 原生代码片段

保留一条原生 `contributes.snippets`，由清单 `%snippetPath%` 选择英文 `snippets/lpc.json` 或中文 `snippets/lpc.zh-cn.json`。两份文件的 9 个逻辑条目 key、prefix 和 body 完全一致，只有 description 随显示语言变化，不新增补全提供者。

VS Code 只对清单做本地化替换，片段文件中的 description 是静态字符串。原生 snippetIdentifier 包含扩展相对文件路径，因此语言切换后隐藏与最近使用记录分别保存；此方案保留原生 Insert Snippet、占位符和插入行为，不承诺内部使用记录 ID 跨语言相同。计划中的“候选身份稳定”在此明确为逻辑条目 key、prefix、body 及单一贡献数量稳定，该平台限制单独核验并写入使用说明。

采用这一方案的理由是保留现有原生入口及编辑行为；迁移至 Rust 或独立 TypeScript 提供者都会改变原生片段服务行为。M7 需要在隔离实例核验实际路径、候选数量、插入内容与 Tab 占位符，最低支持版本的运行结果仍需实际验证。

## 7. 核验与维护

结构基线由 `tests/fixtures/localization/efun-baseline.json` 保存，配合 `scripts/localization/` 中的只读检查入口核对。只有显式维护操作可以写基线；翻译与一般构建不得自动刷新基线掩盖漂移。

文案清单区分 UI、日志、生成提示词、生成的注释与人工复核项。覆盖检查只扫描扩展自身源码及资源，不扫描真实 Mudlib，也不将源码内容写入真实项目探针报告。

新增文案或 Efun 时同时更新两种语言及针对性测试；仅在用户明确扩展范围时增加其他翻译语言。执行中的证据、问题和下一步继续保存在实施计划第 6 节。

M5 已将 `docs/<name>.json` 迁为唯一结构源，正文在 `locales/{en,zh-cn}/<name>.json`，分类显示名在对应语言的 `categories.json`。两个消费者启动时逐字段选择目标语言、英文、缺正文；缺文或坏译文不能删除签名。正文不 trim、不改变代码空白。Rust 已加载正文不写入语言无关的分析缓存，查询不访问磁盘。

全量检查将迁移后的结构与锁定原文重新组合验证 provenance hash，并要求作者及另一位审阅者对当前译文哈希确认。源码事实纠正记录 sourceCorrections 的字段、固定版本依据和理由；涉及 inline/fenced/URL 的差异必须登记精确 before/after。inline 比较保护内容而非反引号位置或重复次数；整字段例外拒绝，代码片段例外受语法约束，proper-name 仅接受显式登记。未 fenced 例子的自动抽取不完整，须依靠逐份内容复核及全字段哈希，不能由机器覆盖数代替。

## 8. 参考

- [VS Code 本地化工具](https://github.com/microsoft/vscode-l10n#readme)。
- [VS Code 清单本地化实现](https://github.com/microsoft/vscode/blob/main/src/vs/platform/extensionManagement/common/extensionNls.ts)。
- [VS Code 扩展运行时本地化实现](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostLocalizationService.ts)。
- [VS Code 原生片段文件实现](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/snippets/browser/snippetsFile.ts)。
