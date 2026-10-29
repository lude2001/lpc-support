# 中英文覆盖清单

本清单将实际展示入口与资源、事实和验收位置对应，防止只迁移含中文的字符串而遗漏原有英文提示。实施状态统一记录在[实施计划第 6 节](i18n-implementation-plan.md#6-工作区隔离与证据)，本文件不维护第二份进度。

## 1. 文案扫描基线

起点扫描使用 `scripts/localization/text-inventory.mjs`，报告为 `.tmp/i18n/text-inventory.json`。报告包含各文件 SHA-256 和逐项位置、稳定条目 ID、文案上下文与分类，统计为 52 个扩展自身文件、627 条候选，解析错误为 0。

| 分类 | 数量 | 处理规则 |
| --- | --- | --- |
| 明确 UI | 309 | 按实际消费者迁移并验证中英文 |
| 人工复核 | 270 | 追踪显示路径；不能直接排除或计作已翻译 |
| 日志 | 34 | 区分开发日志、面向用户的输出和可能进入页面的错误 |
| 生成提示词 | 5 | 由独立注释输出语言处理 |
| 生成注释内容 | 9 | 保留已有正文，仅新增内容服从输出语言 |

该报告是带文件指纹的工作区起点快照，不等同于完成证明。后续中文和英文都要覆盖；动态 HTML、异常透传、外部资源及日志出站仍按下表逐项审阅。真实 LPC 用户源码不进入此扫描。

## 2. 展示入口与资源归属

| 展示入口 | 主要源码或资源 | 资源及验收归属 |
| --- | --- | --- |
| 扩展名称、说明、命令、视图、设置与 token 说明 | `package.json` | `package.nls*.json`；清单资源全键、技术值不变检查 |
| 命令与编译管理交互、终端名称、服务器选择 | `src/modules/commandModule.ts` | `l10n/source/commands.json`；命令行为及用户配置不变 |
| 配置初始化、引导按钮与文档链接 | `src/projectConfig/ProjectConfigOnboardingService.ts` | `l10n/source/infrastructure.json`；按 action ID 的双语分支与持久化行为 |
| 编译包装说明与异常 | `src/compilation/` | 同上；原始 driver、HTTP、stderr 内容保留，插件提示按语言生成 |
| 索引进度、重建、sidecar 启动与崩溃 | `src/lsp/client/` | 同上；语言不影响重启限额、索引请求及同步 payload |
| 错误树、变量视图与扫描输出 | `src/errorTreeDataProvider.ts`、`src/diagnostics/RustDiagnosticsCommands.ts` | 同上；HTML 转义、固定命令和范围、双语状态 |
| 模型选择与生成命令宿主交互 | `src/glm4Client.ts`、`src/codeActions.ts` | `l10n/source/authoring-host.json`；模型 ID、用户描述、配置写回及生成校验保留 |
| 文档中心宿主状态、质量和操作 | `src/functionDocPanel.ts`、`src/functionDocs/services/` | `l10n/source/documentation-host.json`；快照、动作 ID、状态及用户文档保留 |
| 文档服务拒绝编辑与 Rust 未就绪等异常 | `FunctionDocumentationAuthoringService.ts`、`RustFunctionDocumentationLookupProvider.ts` | `l10n/source/services-host.json`；异常进入页面的出站路径及原始外部错误透传 |
| 文档中心静态与动态页面 | `src/functionDocPanelTemplate.ts`、`src/templates/functionDocPanel.*` | 页面资源目录；静态文本、ARIA、错误/空/加载状态、XSS、搜索及键盘 |
| 分析查看器页面 | `src/analysisInspector/` | 页面资源目录；全部视图、动态属性、事实与源码原文、定位、键盘 |
| Rust 诊断与语言服务说明 | `rust/crates/lpc-analysis/`、`rust/crates/lpc-language-server/` | M4 消息目录；实时与工作区输出、缓存、悬停/补全/签名/修复及用户可见错误 |
| Efun 正文、分类与物化 | `config/efun-docs/`、`src/efun/`、Rust `efun_docs.rs` | M5 全量双语资源；结构基线和两个消费者一致性 |
| 代码片段 | `snippets/lpc*.json` | 清单本地化路径；9 个 key/prefix/body 不变、单一贡献、说明双语 |
| 生成骨架与 GLM 输出正文 | `FunctionDocumentationAuthoringService.ts`、`src/glm4Client.ts` | M6 独立语言设置；两入口、四种界面/输出语言组合及已有正文保护 |
| 使用说明和本次变更说明 | `README.md`、`README.en.md`、`docs/CONTRIBUTING.md`、`CHANGELOG.md` | M7 实际功能说明与验收证据；不将开发过程混入用户更新日志 |

## 3. 消息和资源的边界检查

`scripts/localization/build-bundles.mjs` 从 `l10n/source/*.json` 确定性生成 native bundle，并检查实际 `vscode.l10n.t()` 与页面 `localize()` 调用的字面模板、缺键、孤立键、重复冲突和占位符参数。它检查已接入的消息；页面和 Rust 等尚未迁移入口仍需要按第 2 节验收。

用户提供的文本、函数/参数名、路径、宏、类型、代码、已有注释和外部驱动消息不作为 UI 模板翻译。插件自己产生的异常即使原本为英文，只要会进入通知、快照或页面，就需要登记；不能以“原始错误”为名绕开本地化。

浏览器显示必须按文本或属性上下文转义；消息插值不代表 HTML 转义。默认语言、缺失译文回退与离线资源位置需要分别验证。

## 4. Efun 和原生片段的独立基线

Efun 结构基线为 `tests/fixtures/localization/efun-baseline.json`，语义指纹为 `sha256:b365718465065a9b5799064a65453f3afc2fc9feb48aafebd991bd4752efa640`。413 文档、23 分类、492 签名、738 参数及已有引用关系均受保护，译文不进入结构指纹。

用户已选择保留原生片段入口，接受隐藏和最近使用记录按语言文件分开。两份资源只改变 description，逻辑条目键、prefix、body 和贡献数量的检查纳入 `manifest-localization.test.mjs`；实际 VS Code 插入及最低支持版本验收仍由 M7 提供。
