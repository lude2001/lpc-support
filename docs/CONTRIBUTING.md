# 开发贡献指南

## 当前生产架构

LPC Support 的生产语言能力采用 Rust + TypeScript 分工：

- `src/extension.ts`、`src/modules/` 与 `src/lsp/client/` 负责 VS Code 激活、配置同步、命令、UI 和原生进程生命周期。
- `rust/crates/lpc-language-server/` 是唯一生产语言服务器入口。
- `rust/crates/lpc-preprocessor/`、`lpc-analysis/` 与 `lpc-formatter/` 分别负责预处理、版本化语义/索引和 CST 驱动格式化。
- `rust/grammar/lpc/` 维护 Tree-sitter LPC grammar；生成产物通过 grammar 测试验证，不手改生成代码。
- 旧 TypeScript 分析栈与 LSP server（`src/parser/`、`src/syntax/`、`src/semantic/` 等）已于 2026-09 退役并从仓库删除，Rust sidecar 是唯一语言服务器入口；不要重新引入这些目录或把旧实现接回扩展激活路径。

生产代码必须遵守以下约束：

- 不在 TypeScript Provider、命令或 UI 中解析 LPC 源码或扫描全文推断结构。
- 不在查询处理时扫描整个工作区；所有跨文件能力消费 Rust 常驻索引及其依赖失效机制。
- 不把动态 LPC 行为猜成唯一结果。无法静态证明时返回空结果或保守候选集合。
- parser、syntax、semantic 与 workspace index 保持独立职责，不统称为新的“AST”。
- 项目事实优先来自工作区 `lpc-support.json` 与其同步的 `config.hell`，不得恢复旧设置作为生产真源。

## Rust 语言能力改动

新增或修改语言行为时：

1. 在对应 Rust crate 中实现事实提取或查询，不在 TypeScript 侧增加第二套逻辑。
2. 让诊断、悬停、签名、补全、跳转、引用和重命名尽量共享同一解析身份与候选集合。
3. 对不确定路径使用保守降级，并为误报、跨作用域污染和歧义目标补负向测试。
4. 涉及 include、inherit、宏或配置的变化时，同时验证正反向依赖失效和未保存文档版本。
5. 用户可感知变化同步更新 `CHANGELOG.md`。

常用验证：

```bash
npm run check
npm run check:rust
npm run test:rust
npm run test:rust-formatter
npm run test:rust-smoke
npm run test:ci-tools
npm test -- --runInBand
```

真实项目问题优先使用脱敏静态探针：

```bash
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --position <line:column>
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --position <line:column> --perf --perf-iterations 30 --semantic-tokens
```

不要用 driver、`lpccp` 或运行时热编译来判断编辑器静态能力。探针报告默认不保存真实根路径、源码、函数体或补全候选标签。

## Formatter 边界

生产 formatter 位于 `rust/crates/lpc-formatter/`，结构真源是 Tree-sitter CST。修改时必须验证：

- `source.rs` 从生成 grammar 的 CST 取得 token 边界；只将指令掩码用于原文结构解析，不求值或丢弃条件编译分支。宏身份消费 Rust 预处理快照，不能为格式化扫描工作区。
- `layout.rs` 只规划空白编辑；指令、宏调用参数、注释与字面量保持原文，已有换行序列和尾部换行保留。长列表断行向外层传播，并在有界迭代后稳定。
- 生产入口重新解析候选，核对 token 原文 / 次序、CST 形状与幂等性；有效分支存在语法错误或检查失败时不返回编辑。未启用分支不能解析的片段作为原文保护。
- 全文与 range formatting 使用相同计划和保护；选区另行检查结果幂等性。Allman / K&R、行宽、空格 / 制表符要覆盖配置实时同步及无工作区文件场景。
- 这些静态不变量不等于运行时语义证明，尤其不承诺 `__LINE__` 等源码位置相关行为不变。

重点真实样例为 `test/lpc_code/yifeng-jian.c` 与 `test/lpc_code/meridiand.c`。

全量验收必须在源码副本上运行，候选写入单独的新目录，不对真实项目执行批量格式化：

```bash
node scripts/run-cargo.mjs run --release --manifest-path rust/Cargo.toml -p lpc-language-server --example formatter-audit -- <source-copy> <new-candidate-directory>
node scripts/verify-formatter-corpus.mjs <source-copy> <candidates> <audit.json> <FluffOS-checkout>/tools/lpc-syntax/tokenizer.mjs
```

第一条命令的标准输出保存为 `audit.json`，包含相对文件名、成功 / 原样 / 拒绝数量、生效分支结构核验与耗时，不写源码正文。第二条使用独立驱动 checkout 的 tokenizer 检查实际变更文件，记录参考实现哈希；它是开发验收工具，不打包或接入生产解析路径。两者必须分别查看结果，不能将安全拒绝计作格式化成功。

参考 FluffOS 的[格式化器安全检查](https://github.com/fluffos/fluffos/blob/master/tools/lpc-syntax/format.mjs)与[语料验收工具](https://github.com/fluffos/fluffos/blob/master/tools/lpc-syntax/bin/format-corpus.mjs)。上游采用 token 布局；本扩展继续维护 Rust / CST 空白编辑路径。

## TypeScript 宿主改动

TypeScript 可以负责：

- VS Code API 对象、Webview、命令和状态栏。
- Rust LSP 请求/通知适配、配置同步和错误提示。
- bundled efun JSON 的展示层物化，但不得解析 LPC 模拟函数源码。

如果宿主侧需要新的源码事实，先增加一个最小、脱敏的 Rust 自定义请求，再在 TypeScript 中做展示适配。

## 中英文本地化

界面支持 `en` 与 `zh-cn`，未知或缺省界面语言回退为英文。新增用户可见文案时，同时维护以下资源：

- 清单文案在 `package.nls.json` 与 `package.nls.zh-cn.json` 中保持全键对应；命令、协议、配置和语义 token 的技术标识不随语言变化。
- TypeScript 宿主使用字面英文模板 `vscode.l10n.t()`，译文放在 `l10n/source/*.json`，格式为英文模板到中文字符串的映射。动态值使用占位参数，两种语言的占位符必须一致；Webview 按 HTML 上下文转义译文与动态值。
- `npm run build:l10n` 从源词表生成 `l10n/bundle.l10n*.json`。提交源词表和生成资源，通过检查确认同步，避免直接修改生成文件。
- Rust 接收会话的界面语言，在输出边界渲染诊断、快速修复与结构化文档。诊断 code、severity、range、导航位置和编辑内容保持同一事实；缓存保存可再次按语言渲染的结构，不缓存某个会话的译文。用户注释正文和外部错误输出保持原文。
- Efun 的 `config/efun-docs/docs/` 与 `categories.json` 保存结构和稳定分类 ID；`locales/en/`、`locales/zh-cn/` 只保存对应的 `summary`、`details`、`note`，维持原字段存在性。修改译文不应改变签名、参数身份、arity 或分类成员关系。原文缺少说明时明确标注，不推测行为；确需修正原文错误时记录固定源码证据、保护内容差异和独立复核结果。
- 原生片段的两份资源保留相同的条目键、prefix 和 body，仅 description 本地化。资源路径不同，VS Code 的隐藏状态与使用记录按语言分别保存。

注释写入语言是独立设置 `lpc.documentation.language`，可选 `zh-cn` / `en`，默认 `zh-cn`。文档骨架与 AI 生成均应读取该设置，不用界面语言推断；已有注释不自动翻译。

本地验证：

```bash
npm run build:l10n
npm run check:l10n
npm run test:l10n
npm run test:efun-localization-consumers
npm run build:rust
npm run test:rust-localization
npm run check:vsix-localization -- <明确的VSIX路径> --target win32-x64
```

`check:l10n` 只读检查资源同步、Efun 结构基线及译文契约，不能借由自动重建基线接受漂移。消费者测试对照 TypeScript 与 Rust 实际加载的 413 份双语文档和签名，会用 Cargo 运行专用 exporter。Rust 双语 stdio 测试使用隔离的临时源码、子进程和缓存，覆盖诊断路由、快速修复、文档与跨语言缓存恢复；必须先构建当前源码的 sidecar。它不启动 FluffOS，也不使用真实 mudlib。

CI 在主任务运行资源、契约和消费者检查，并在六个平台的原生包构建后运行双语 stdio 测试。本机成功不能代替六平台结果，自动测试也不能代替 VS Code 实例中的语言切换、片段和 Webview 交互验收。

`check:vsix-localization` 直接读取 ZIP，不提取或执行文件，核对清单/NLS/bundle/原生片段、全部 Efun 正文及结构、当前独立复核记录、资源引用、VSIX 平台、可执行文件头和 checksum；Unix 包还要保留执行位。六个平台的 CI 都执行此门禁。合成头格式测试只证明检查器行为，不能算作对应平台运行通过。

原生界面验收先准备专用 VS Code 测试运行时与兼容的官方中文语言包目录，再运行：

```powershell
npm run test:vscode-localization -- --vscode-executable-path <测试Code.exe> --extensions-dir <专用语言包目录> --report .tmp/i18n/vscode-native.json --screenshots-dir .tmp/i18n/native-shots
```

此入口不安装扩展或隐式下载运行时；显式 `--version <版本>` 才会下载该版本。运行时使用自己创建的临时用户数据、合成工作区、缓存和子进程，依次测试 en/zh-cn，并验证真实原生中文界面与语言包注册，不能只检查 `--locale`。`--hold` 支持在本任务窗口等待截图目测，创建它打印的 continue 文件后继续。任何清理残留都必须按报告中的自有根目录核对，不能按进程名停止其他实例。不得指向正在使用的游戏工作区、普通用户扩展目录或用户数据目录。

## 打包与平台

`npm run package` 会清理产物、构建当前平台 Rust release binary，并生成带平台标签的 VSIX。发布包必须：

- 只携带当前 `win32-x64`、`win32-arm64`、`linux-x64`、`linux-arm64`、`darwin-x64` 或 `darwin-arm64` 原生二进制。
- 不再包含任何 TypeScript 语言服务器产物（旧 `dist/lsp/server.js` 构建路径已随退役删除）。
- 在缺失或不匹配二进制时给出明确错误，不静默回退。

平台矩阵由 `.github/workflows/ci.yml` 构建。当前平台交付前还需验证 VSIX 安装、同版本覆盖升级、initialize、health、shutdown 和 exit。

CI 在每个平台打包后运行该原生 sidecar 的 stdio smoke，全部通过才上传对应 artifact。LSP 测试按 URI 和文档版本等待诊断通知；依赖刷新可能交错发布其他文件的诊断，不得用“最后一份通知”代表当前用例，也不得为消除测试失败而过滤真实诊断。

维护者从同一次成功的 main CI 下载六个平台的 VSIX，再到 Marketplace 网页手动更新扩展。平台包对应关系、下载、上传及补齐步骤见[通过网页发布到 VS Code Marketplace](marketplace-release.md)。工作流变更同样需要 PR 和 required checks，不能通过账号豁免直接推送 main。

## 命名和测试

- Rust 类型使用 `PascalCase`，函数与模块使用 `snake_case`；TypeScript 遵循仓库既有 `PascalCase`/`camelCase`。
- 测试文件使用 `*.test.ts`、`*.spec.ts` 或 Rust `#[test]`。
- Tree-sitter range 使用字节偏移，LSP 边界必须正确转换 UTF-16 行列。
- 不手改 Tree-sitter 生成文件（`rust/grammar/` 下的生成产物）。

至少为每个行为变化覆盖一个正向场景和一个保守降级场景。涉及生产主路径改动时还要确认扩展 bundle 没有重新引入 ANTLR、旧 TypeScript 分析栈或第二套语言服务。

## 提交流程

1. 在独立分支实现并补测试。
2. 运行与风险相称的 Rust、TypeScript、真实样例和真实项目探针。
3. 检查 `git diff --check` 与发布 bundle 内容。
4. 更新用户文档和 `CHANGELOG.md`。
5. 使用 Conventional Commits 提交。

## 参考文档

- [README](../README.md)
- [Rust LSP 一次性重构实施计划](rust-lsp-implementation-plan.md)
- [Rust LSP 故障排查](rust-lsp-troubleshooting.md)
- [通过网页发布到 VS Code Marketplace](marketplace-release.md)
