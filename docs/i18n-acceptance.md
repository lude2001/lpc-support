# 中英文支持验收记录

日期：2026-10-27。本记录保存 M1–M4 的本地检查证据；里程碑状态及下一步以[实施计划第 6 节](i18n-implementation-plan.md#6-工作区隔离与证据)为准。全部 Efun 正文接入与复核、注释输出语言和原生六平台终验仍需按计划完成。

## 1. 证据对应的源码

- 实施分支：`codex/i18n-complete`，当前改动尚未提交或推送。
- 实施代码基线：`96f999e5e707faf7576aa4197957ca0a06a7b388`，与只读确认的远端 `main` 提交 `f7d3fe4839dc0855421dacf29fc6341f1175a950` 源码树相同。
- 基线树：`f05b6af7c3fff26494cf7241ad9505f66bd8df03`。
- 本次 115 项源码、资源、测试与构建输入的组合指纹：`0314fa81547551270aeddd1456dad9e45371f86e828f6d30814288c87e6d778e`。
- 逐文件指纹及结果汇总：`.tmp/i18n/m1-m3-evidence.json`，SHA-256 为 `daa6dcfe49a18e312b4a1512875227391ca19125fc569f7293b4076a2484025d`。

源码或依赖发生变化后，按受影响范围复核。该指纹绑定本次证据，不能直接证明之后新增的 Rust 或文档工作。

## 2. 已执行检查

| 检查 | 实际结果 | 证据范围 |
| --- | --- | --- |
| `npm run check` | 退出 0 | 生产 TypeScript 严格构建配置 |
| `npm run check:all` | 退出 0 | 包括新增测试的全部 tsconfig |
| `npm run check:l10n` | 退出 0；373 条消息，7 个源目录文件 | 资源与实际字面调用、占位符、生成文件及 Efun 结构基线 |
| `npm run test:l10n` | 45/45，通过 | 基线漂移、分类成员、清单资源、片段身份、扫描器和目录生成的正反向用例 |
| 全部 Jest | 38 套件、298 项通过，失败及跳过为 0 | 宿主、双语动作、服务错误、真实页面 renderer 的 DOM、原有回归 |
| `npm run build` | 退出 0，生成 `dist/extension.js` 并复制模板 | 实际 TypeScript 构建和页面资源接入；本次未构建 Rust |
| `vsce ls --no-dependencies` | 438 个文件，预期 6 类语言与片段资源全部存在 | VSIX 白名单与文件布局，开发 catalogue 未被打入；未生成最终六个平台包 |

Jest 的实际命令为：

```powershell
npm test -- --runInBand --silent --verbose=false --json --outputFile .tmp/i18n/jest-m3.json
```

该 JSON 的 SHA-256 为 `3e06de31f0119229dd8cda652f18edd89a939337bf119d764a0aa5d8d5eb238e`。文件清单保存在 `.tmp/i18n/package-files-m2.txt`；其路径名对应首次资源布局检查，后续消息增加没有改变资源文件路径。

## 3. 基线与行为保护

- Efun 基线为 413 文档、23 分类、492 签名、738 参数，语义指纹为 `sha256:b365718465065a9b5799064a65453f3afc2fc9feb48aafebd991bd4752efa640`。原始 Efun 结构数据尚未迁移，基线检查没有写入或重建基线。
- 文案起点清单为 52 文件、627 条候选，每文件有内容指纹；明确 UI、人工复核、日志、生成提示词及生成正文分开登记，详见[覆盖清单](i18n-coverage.md)。
- 配置引导、索引重建和文档修复分别验证按 action / actionId 选择动作，两种文案下的配置、请求和编辑权限一致。模型 ID、用户模型描述及驱动原始内容保持原值。
- 独立审阅找出的 5 条文档服务错误已补齐本地化；双语拒绝写入、缺失快照和原始外部错误透传测试均包含在 298 项结果中，详见[定向审计](i18n-m2-review.md)。
- 文档中心与分析查看器验证静态和动态文本、ARIA、空/加载/错误状态、搜索、键盘、定位、源码保留及恶意 HTML 文本；原有 DOM 性能与状态竞争测试继续通过。
- 分析查看器的 `<pre>` 内容改用内层 `<code>`，避免 HTML 解析吞掉原始首换行。测试核对首换行及 CRLF 的原文、定位数组与协议动作。
- 原生片段只保留一条贡献，两语言文件的 9 个 key / prefix / body 一致，description 双语。用户已确认接受原生隐藏和使用记录按语言文件分开。

## 4. 环境与未验证范围

本次构建只更新扩展仓库的 TypeScript 产物与模板。未安装扩展、重载 VS Code、运行 driver、调用真实模型或修改江湖英杰传源码、配置及服务。

受限执行环境中，Jest 的 native realpath 对默认临时目录和仓库临时目录均报 EPERM；相同测试在获准的非受限执行中通过。当前环境续跑应复用已验证入口，不重复临时目录试错，也不把环境错误解释成产品失败。

DOM 与 mock 证据尚不能证明原生 VS Code 的 CSP、实际显示语言资源加载、布局及最低支持版本兼容。这些与 Rust 的跨语言缓存、Efun 全量译文、注释输出语言、CI 接线和六平台制品一起保留在后续验收范围内。

## 5. M4 Rust 消息与缓存验收

Rust 的诊断缓存改为稳定消息身份与参数，查询时投影为原有 Diagnostic 字段。宏和类型成员保存结构文档或原始正文，渲染时选择分节标题；结构文档使用 Box，序列化格式不因内存布局改变。内层缓存 schema 为 2，外层 manifest 为 3，旧格式明确拒绝。

实际执行结果：

| 检查 | 结果 |
| --- | --- |
| `cargo fmt --all` | 通过；未混入其他 Rust 模块的无关格式变更 |
| Rust workspace tests | 209 项通过：analysis 113、formatter 33、server lib 35、server bin 3、preprocessor 15、grammar binding 10 |
| workspace / all-targets clippy `-D warnings` | 退出 0 |
| `npm run build:rust` | 生成当前 Windows x64 release sidecar 与 checksum |
| 原有 `test:rust-smoke` | 通过，保留既有语言能力、语法和格式化回归 |
| 新增 `test:rust-localization` | 四个独立进程会话通过，五条诊断路由、文档和缓存行为一致 |

sidecar SHA-256 为 `759562349810aa828eec3dad8f0f43ea61c71b5053217433a00b8ca5a83ebfce`。Rust 输入、共享语言用例和验证脚本的组合指纹为 `944cb568917a8b883f5bbfeb929edd3097865ea6eee64d89692512910fda0e71`；`.tmp/i18n/m4-evidence.json` SHA-256 为 `0949d6fee8ca65ff151b5b8ff4d7a32d05f5b9da4cd1417e688414c7a87c8bad`。

四会话分别为 en 冷启动、zh-cn 热缓存、缺省语言热缓存、fr-FR 热缓存。后三次在相同 fixture、配置、缓存版本与磁盘时间戳下实际报告 `cachedFiles = totalFiles = 4`；缺省和未知语言均回退英文。对 function / macro / member / raw 的文档查询先于 didOpen，因而确实验证了闭合索引的结构文档恢复。

| 场景 | 查询前后 snapshotBuildCount | 查询前后 syntax parseCount | 诊断事实 |
| --- | --- | --- | --- |
| 英文冷启动 | 4 → 4 | 0 → 0 | 与下列会话一致 |
| 中文缓存恢复 | 0 → 0 | 0 → 0 | 与英文一致 |
| 缺省语言恢复 | 0 → 0 | 0 → 0 | 与英文一致，文案也相同 |
| 未知语言恢复 | 0 → 0 | 0 → 0 | 与英文一致，文案也相同 |

验证覆盖 didOpen、didChange、workspaceDiagnostics、sourceFileChange 后台回调与 didClose 后台回调，诊断 code/source/range/severity 的组合指纹均为 `2ded1570e0a5217e21c64052df1b31b93d6ddf017b65725596514f010629688e`。quickfix 编辑、签名、定位及用户文档正文不变；标题和插件错误按语言生成。所有测试 PID 均通过 shutdown/exit 正常退出，未强制终止。

机器报告为 `.tmp/i18n/rust-localization-smoke.json`，SHA-256 为 `2070a00f0e27f638936d1e7d4d0abed92c37a556fc22a95fdc186928745de52d`。本次曾确认本地旧 Cargo 依赖产物与源码不一致，在核验 target 路径属于本仓库后仅清理 lpc-preprocessor 包缓存，重编即恢复；该问题已解决，续跑不应再次例行 clean。

以上证明当前 Rust 自产文案和缓存路径。Efun 正文资源虽已准备，仍需 M5 两端加载、逐项独立复核与结构不变检查；实际 VS Code 和六平台结果仍由 M7 提供。

## 6. M5 全部 Efun 双语验收

M5 已通过本地出口。413 份文档的 545 个原有自然语言字段均提供 en/zh-cn，23 个分类也有两套名称；结构文件仅保留唯一签名、类型、参数、arity、引用和稳定分类 ID。结构语义指纹仍为 `sha256:b365718465065a9b5799064a65453f3afc2fc9feb48aafebd991bd4752efa640`，492 签名、738 参数和分类成员关系未变。

三组作者自检与跨组独立审阅覆盖全部 413 项。发现的原文事实错误按维护驱动固定提交 `b51f5ff7a1e49f94b5f83ba4cee28f32f1881e37` 的源码核实，两语定向更正；每条历史问题保留解决结论与依据。原先只有名称、TODO 或缺说明的条目明确显示对应语言的缺文档状态，不把翻译覆盖伪称为补齐未知 API 行为。

| 检查 | 实际结果 |
| --- | --- |
| `check:l10n` | 413 文档、23 分类、545 字段/语言、413 独立审阅通过；同源正文可重建原始 canonical hash |
| 本地化 Node 回归 | 新增 Efun guard 14 项通过，覆盖缺字段、原文漂移、结构漂移、自审冒充独立审阅、未解决/过期记录、整段例外绕过及精确修正 |
| TS 生产加载器 Jest | 4 项通过；逐份比较两语言共 826 份正文，损坏/缺失译文逐字段回退，正文空白原样，丢失两份译文仍保留签名；资源删除后查询仍使用已加载正文 |
| `test:efun-localization-consumers` | 实际 TS 与 Rust 加载器逐份物化正文和签名完全一致；en 指纹 `7f819cd0445f2dee4a8787d3fb931209db74bbb6ac63c271639bd7e468317db8`，zh-cn 指纹 `8e9aff21d0668c79760db83f330d78b32d8dc19a87c7164022329735f0bfb381` |
| Rust workspace tests / clippy | 209 项通过；workspace/all-targets `-D warnings` 通过 |
| 实际 release sidecar | SHA-256 `8ff8529e2c43e5cae26f1590c02b860edf846a4f4ce786fb222d06889ab0de76` |
| 扩展后的四会话 smoke | allocate_mapping、sprintf、read_file、clone_object、db_exec、async_read 的 hover/completion/signature 全部收到选定语言的摘要、详情和备注，签名与结构源相同 |

四会话继续验证冷启动和同缓存根下 zh-cn、缺省、fr-FR 恢复，后三次缓存均 4/4；诊断路由仍为 4/5/5/5/5 项。新 fixture 增加 Efun 调用，诊断位置事实指纹相应为 `2219278509b927a4c3958124ae1b57f5b6ff52a99afa3d5aba01a7f20003ad73`，四会话一致。文档查询前后解析和快照构建增量均为 0。所有测试进程正常退出，未强制停止，stderr 为 0。

TS 文本初始化本次记录为 en 33 ms、zh-cn 39 ms；各 8,260 次已加载查询分别为 3 ms、2 ms。这是本机一次测量，不作为跨设备性能承诺。生产查询路径仅访问内存，不再次读取语言资源或扫描 Mudlib。

机器证据 `.tmp/i18n/m5-evidence.json` 的 SHA-256 为 `458c11aaa72de3730c30b033f851c9e577faf17b6d5b30a69c1acbf978531bfb`，对应源码组合指纹 `4885bc6f5a8ba17da6ade84d7999081578e102693dff46f9f0242f0ce0f5cae4`。全量消费者报告为 `.tmp/i18n/efun-consumers.json`，sidecar 报告为 `.tmp/i18n/rust-localization-smoke-m5.json`。

[独立加载审计](i18n-m5-loader-review.md) 未发现运行时阻断缺陷。机器跨译文比较自动保护 fenced、inline 内容及 URL；未 fenced 示例仍依靠逐份独立审读和两个审阅者的当前全字段哈希，不能把正则检查描述为语义证明。整字段 retained-fragment 豁免已被拒绝并有回归用例。

## 7. M6 注释语言验收

M6 已通过本地出口。清单和共同读取函数提供 `lpc.documentation.language`，有效值 `zh-cn/en`、默认中文；缺省/非法值保持中文，按目标文档 URI 读取资源级设置，独立于界面语言。GLM 命令、文档中心 AI 委托和骨架/补全入口共同使用设置。

四套定向 Jest 共 59 项通过：语言读取 9、GLM 12、生成命令 8、文档编辑 30。覆盖 UI en/zh-cn × 输出 en/zh-cn 四组合，原有正文与路径/标签原文保护、空标签补齐、CRLF/缩进、函数参数返回契约、截断和非注释响应拒绝、文档变更后拒写。取消模型选择时模型请求和插入均为 0。

报告为 `.tmp/i18n/jest-m6.json`（最初三套 46 项通过，GLM 测试初始化问题已修）、`.tmp/i18n/jest-m6-glm.json`（GLM 12 项通过）和 `.tmp/i18n/jest-m6-cancel.json`（命令含新增取消回归 8 项通过）。修复的是 Jest hoist 导致的 mock 初始化顺序，未更改生产逻辑迎合测试。

[M6 独立审阅](i18n-m6-review.md) 未发现新行为缺陷。模型测试使用 fake Axios 响应，证明提示词和输出校验契约，不声称真实模型必定遵循语言；未调用付费模型。原生界面和六平台仍由 M7 提供证据。

## 8. M7 本地统一终验（2026-10-28）

M7 的本地实现、测试、原生界面、Windows 候选包与隔离安装均已通过。候选版本为 **0.52.20**；尚未提交、推送、创建 PR 或发布。六平台实际 CI 未执行，M7 和 goal 均不能因此标为全部完成。

| 验收面 | 实际结果 |
| --- | --- |
| TypeScript | 生产/全量类型检查、构建通过 |
| 全部 Jest | 40 套、337 项通过，0 failed/skipped |
| 本地化 Node | 102 项通过；含 Efun 契约 14 项、VSIX 检查器 43 项 |
| Rust | 复用未变 Rust 源码对应的 209 单测、严格 clippy、原有 stdio、四语言会话 smoke；两个 formatter fixture 均 syntax_ok/idempotent |
| arity | strict-arity 通过；tooNarrow/tooBroad 为 0，既有 missingSpec 1、missingDoc 34 如实保留，不把本次翻译扩大为新驱动全部 API 文档补写 |
| 原生 VS Code | 1.138.0 与最低支持版 1.82.0，各自 en/zh-cn 均通过 |
| 实际语言资源 | 每会话核对 80 处清单引用；中文的 16 个 `{original,value}` 显示字段同时核对英文源和中文值；原生 QuickInput 确实显示中文，bundle URI/文件正确 |
| 原生片段 | 9 个原生选择器条目及说明，实际 Tab 插入、占位跳转；两语言插入正文哈希一致 |
| 语言服务 | 原生 hover/completion/signature、Rust Warning 与精确 code/source/range、用户原文保留通过 |
| 两页面 | 实际 CSP/DOM、转义、ARIA、键盘、主视口恢复、无根溢出和来源跳转通过；根代理查看了实际截图 |
| Efun 文档中心 | allocate_mapping、sprintf、read_file、clone_object、db_exec、async_read 的真实外部结果、DOM 各说明字段、原结构签名及重载切换通过，四会话共 24 个代表项 |
| 原生注释生成 | 每个界面默认中文骨架、资源级英文覆盖各插入一次，原用户注释逐字保留；不调用真实模型 |
| Windows VSIX | 1268 文件，413 结构/826 正文/23 分类×2/373 消息/9 片段×2，目标、资源引用、结构与当前独立校对记录、PE 可执行头和 checksum 均通过 |
| 隔离安装 | 仅在 `.tmp/i18n/vsix-install/` 安装并同版本覆盖 0.52.20，两次均成功；核对 1254 个安装资源与当前构建字节一致，从安装目录的二进制和文档资源实际完成 stdio smoke |
| CI 接线 | 主任务执行资源/消费者检查，每个原生矩阵包执行包级门禁和双语 stdio smoke；六目标矩阵不变，YAML 静态核验通过 |

实际界面截图来自合成源码和本次专用窗口，未包含真实 Mudlib 或用户账户资料：[英文文档中心](images/i18n/function-center-en.png)、[中文文档中心](images/i18n/function-center-zh-cn.png)、[英文分析查看器](images/i18n/inspector-en.png)、[中文分析查看器](images/i18n/inspector-zh-cn.png)。完整本地截图在 `.tmp/i18n/native-shots/{latest-final,minimum-final}/`。

原生测试使用独立运行时、用户数据、语言包目录、工作区和缓存。中文不是仅传 `--locale` 的假验证：先由英文会话建立本次真实语言包注册，再核对中文原生控件与资源。语言包版本分别为 1.131.2026090407 / 1.82.2023091309。四会话均正常结束，临时根清理完成；未重载或操作江湖英杰传窗口。

测试脚本曾对 Warning、VS Code 的本地化值对象和旧 Chromium 的视口恢复做了错误假设，均只修正 harness 后取得上述终验结果，没有修改产品逻辑迎合测试。computer-use 窗口绑定工具返回“window no longer belongs ... current owner ...”且恢复仍失败，未继续向该工具输入；目测依据是同一原生测试实例保存的实际页面截图。

终验报告：

- `.tmp/i18n/jest-final-local.json`：SHA-256 `44b6ccbee90ba7f9746e4f46057fc928b95709c9a333afba4f3e1da8f355afa1`。
- `.tmp/i18n/vscode-native-latest-try.json`：SHA-256 `f719ad1c589366dd1933fb90e3163d259471a526abbffc8e372225bfc240ae11`。
- `.tmp/i18n/vscode-native-minimum-try.json`：SHA-256 `4398b3d0d8f5ea6b8d30ef35781b22ac2ff4bfd9d682544d6e93659c7210394b`。
- `.tmp/i18n/installed-vsix.json`：SHA-256 `436a21bfc24f865d91c4a7d9c3d92dc5e7d0ca2ac9ff7a1fdcb9cef369d6fd5f`。
- `.tmp/i18n/m7-evidence.json`：SHA-256 `ef58edc8d1b32e244261ab04054e19fd935a70d460b80e5992de21de581e14b5`，1444 个输入的当前本地字节组合指纹为 `2f4874b07a3d8955e0655a47625002b9231cf4b1816b87ded0b0d42aa2c1f683`。计划/验收记录排除在组合中以避免自引用；跨平台仍以同一候选提交及语义基线为准，不要求文本换行字节跨平台相同。

最终本地包 `.tmp/i18n/lpc-support-win32-x64-0.52.20.vsix` 的 SHA-256 为 `7190f211cff9a5cdff3b10f5d4f65d8ce3f70d2886d2518227709abb3f9245d6`，sidecar 为 `8ff8529e2c43e5cae26f1590c02b860edf846a4f4ce786fb222d06889ab0de76`，生产宿主 bundle 为 `1743d2c3ed3b4f89883bdcb8bf8deaaecf129a1fbb707cf2e8f1befb1693f93e`。四次原生验收使用同一产品代码/资源和二进制，随后只将版本元数据从 0.52.19 调整为未占用的 0.52.20；隔离安装核对了同一运行字节，不因此重做翻译或无关回归。

[包检查器独立审阅](i18n-m7-package-review.md) 确认三项定向问题已关闭：复用完整独立校对门禁、拒绝不符合已检查可执行格式的文件头、保留并校验 Unix 执行位。43 项合成测试不代表实际 Linux/macOS/ARM 运行通过。

当前唯一剩余工作是：得到本次提交/推送/创建 PR 的授权后，运行同一候选的六平台原生 CI，取得每包结果与哈希并补入本记录。正式发布继续由用户决定；无授权时保留当前成果和同一 goal，不重建目标或重复 M1–M6。
