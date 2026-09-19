# Repository Guidelines

## 项目结构与模块组织
本仓库是 LPC 的 VS Code 扩展。语言分析由随扩展打包的 Rust sidecar 提供，TypeScript 只保留宿主装配层：

- `src/extension.ts`
  - 激活入口，负责创建 `ServiceRegistry` 并按顺序调用模块注册函数
- `src/core/`
  - 服务注册与跨模块基础设施：`ServiceRegistry`、`ServiceKeys`（EfunDocs、Compiler、ProjectConfig、ProjectConfigSnapshot、ProjectConfigOnboarding、TextDocumentHost、Diagnostics、ErrorTree）、`CacheManager`、`DocumentCache`
- `src/modules/`
  - 扩展装配层：`coreModule.ts`、`diagnosticsModule.ts`、`commandModule.ts`、`uiModule.ts`
- `src/lsp/`
  - `client/` 是 Rust sidecar 的 LSP 客户端（`activateLspClient.ts` 只有 Rust 分支）；`shared/protocol/` 放自定义协议，依赖 `vscode-languageserver-protocol`
- `rust/`
  - 语言能力真源。`rust/crates/` 下：`lpc-language-server`（stdio 二进制与 LSP 调度）、`lpc-preprocessor`（预处理/宏/include）、`lpc-analysis`（语义与工作区索引）、`lpc-formatter`（CST 格式化）、`lpc-protocol`（自定义协议）；Tree-sitter grammar 在 `rust/grammar/lpc/`，生成产物不要手改
- `src/compiler.ts`、`src/compilation/`
  - 编译链：本地 `lpccp` 与远程 HTTP 编译后端
- `src/functionDocPanel.ts`、`src/functionDocs/`、`src/efun/`
  - 函数文档中心与内置 efun 文档展示（`BundledEfunDocsProvider.ts`、`BundledEfunLoader.ts`）；Javadoc 标签解析在 `src/language/documentation/DocCommentTagParser.ts`
- `src/projectConfig/`
  - `lpc-support.json` 与 `config.hell` 的同步、快照与新手引导
- `src/diagnostics/RustDiagnosticsCommands.ts`、`src/errorTreeDataProvider.ts`
  - 消费 Rust 分析快照的诊断命令与错误树视图
- `src/glm4Client.ts`、`src/codeActions.ts`
  - GLM-4 Javadoc 生成
- `src/language/shared/WorkspaceDocumentPathSupport.ts`
  - 纯 TextDocument host 契约

编辑器资源位于 `syntaxes/`、`snippets/`、`media/` 和 `language-configuration.json`。  
测试代码在 `tests/` 与 `src/**/__tests__/`，样例 LPC 文件在 `test/`。构建产物输出到 `dist/`（Rust sidecar 二进制在 `dist/bin/lpc-language-server[.exe]`），VSIX 产物输出到仓库根目录。

### 当前主路径约束

- 语言服务器只有 Rust sidecar 一个入口；旧 TypeScript LSP 与 `LPC_LANGUAGE_SERVER=typescript` 回退已删除，不要恢复
- 旧 TypeScript 分析栈（`src/parser`、`src/syntax`、`src/semantic`、`src/formatter`、`src/antlr`、`grammar/` 等）已从仓库删除，不要在生产主路径重新引入 TypeScript 侧的 LPC 解析、诊断或全文结构扫描
- 跨文件语言能力一律消费 Rust 常驻索引及其依赖失效机制，不要在查询处理时扫描整个工作区
- 项目配置优先走工作区根目录的 `lpc-support.json` 与 `config.hell` 同步结果，不要在新代码里直接依赖旧 `lpc.includePath` / `lpc.simulatedEfunsPath` 作为首选来源
- 无法静态证明的动态 LPC 行为保持保守降级，不要猜测唯一结果

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run build`：用 esbuild 打包扩展到 `dist/`（不再生成解析器）。
- `npm run build:rust`：构建 Rust sidecar 到 `dist/bin/`。
- `npm run package`：生成 VSIX 安装包（`vscode:prepublish` 会依次执行 TS 构建、`build:rust` 与原生产物整理）。
- `npm run watch`：开发模式增量构建。
- `npm test`：运行全部 Jest 测试。
- `npm run test:unit`、`npm run test:e2e`、`npm run test:performance`、`npm run test:coverage`：按类型执行测试。
- `npm run check` / `npm run check:rust`：TypeScript / Rust 静态检查。
- `npm run test:rust`、`npm run test:rust-formatter`、`npm run test:rust-smoke`：Rust 单测、formatter 回归与原生 sidecar stdio smoke。
- `npm run clean`：清理 `dist/` 与 `out/`。
- `npm run probe:lsp -- --project <真实LPC项目根目录> --file <LPC路径> [--position 行:列]`：在真实项目上运行本机 LSP 静态探针（只支持 Rust sidecar），用于排查编辑器诊断、跳转、悬停与补全问题。

### 当前常用验证命令

- `npx tsc --noEmit`
  - 全量 tsconfig 的类型与未使用符号检查
- `npm run check`
  - 生产构建配置（`tsconfig.build.json`）的类型检查
- `npm test`
  - 全部 Jest 套件
- `npm run test:rust`、`npm run test:rust-smoke`
  - Rust workspace 单测与原生 sidecar stdio smoke

### 打包注意事项

- VSIX 只携带当前平台的原生二进制；缺失或不匹配时客户端会给出明确启动错误，不做静默回退
- 跨平台结果以 CI 的原生平台矩阵为准，不在单台机器上伪装验证其他平台

## 代码风格与命名约定
项目使用 TypeScript（`tsconfig.json` 开启 `strict: true`）。保持现有风格：4 空格缩进、显式导入、语句结尾分号。  
命名规则：类与类型使用 `PascalCase`，函数和变量使用 `camelCase`，文件名按功能命名（如 `errorTreeDataProvider.ts`）。  
命令 ID 使用 `lpc.*` 命名空间（如 `lpc.compileFile`）。Rust 侧类型用 `PascalCase`，函数与模块用 `snake_case`。

### 架构命名约定

- Rust 侧 parser / syntax / semantic / workspace index 职责独立，不要统称为新的 “AST”
- 语言事实只从 Rust sidecar 查询；TypeScript 侧不要为同一事实建立第二套实现

## 测试规范
测试框架为 Jest + `ts-jest`（见 `jest.config.js`）。测试文件统一使用 `*.test.ts` 或 `*.spec.ts`。  
涉及 VS Code API 时，优先复用 `tests/mocks/MockVSCode.ts`。  
新增功能必须附带针对性测试：TypeScript 宿主行为进 Jest，语言能力进对应 Rust crate 的 `#[test]`，跨进程行为补 `scripts/rust-lsp-smoke.mjs` 场景。

### 当前重点保护网

- `npm test`
  - 33 个 Jest 套件 / 173 个测试，覆盖扩展激活、模块装配、LSP 客户端、项目配置、函数文档中心与编译链
- `npm run test:rust` / `npm run check:rust`
  - Rust workspace 单测与 clippy
- `npm run test:rust-smoke`
  - 原生 sidecar stdio smoke：诊断、补全、签名帮助、宏生命周期、格式化，以及 quickfix 与 range formatting 场景

### 真实项目 LSP 静态探针

当用户要排查“编辑器为什么报错 / 为什么不跳转 / 为什么不补全 / hover 不对”这类问题时，优先使用本仓库的 LSP 静态探针，而不是直接猜测原因，也不要启动 driver 或走 `lpccp`。探针只模拟 VS Code 打开文件并向 Rust sidecar（`dist/bin/lpc-language-server[.exe]`）发 LSP 请求，目标是定位编辑器静态语言能力链路的问题；旧 `--server` 选项已随 TypeScript server 退役移除。

常用命令：

```powershell
npm run probe:lsp -- --project D:\code\shuiyuzhengfeng_lpc --file /adm/single/master.c
npm run probe:lsp -- --project D:\code\shuiyuzhengfeng_lpc --file /adm/single/master.c --position 12:8
```

使用约束：

- 默认报告输出到 `.tmp/lsp-probe/latest.json` 与 `.tmp/lsp-probe/latest.md`，`.tmp/` 不应提交。
- 默认报告必须保持脱敏：不写真实项目绝对根路径、不写源码正文、不写源码片段、不写函数体、不写补全候选标签。
- `--position` 使用 1-based 行列；传入后会额外请求 definition / hover / completion，并在请求超时时记录 `timedOut`。
- 只有用户明确同意时，才使用 `--include-completion-labels` 或 `LPC_PROBE_INCLUDE_COMPLETION_LABELS=1` 输出补全候选标签。
- `probe:lsp` 是静态编辑器探针，不验证 FluffOS 运行时语义；运行时编译/重载问题才考虑 `lpccp`。
- 排查完成后，在回复里引用报告里的阶段、数量、超时和诊断消息即可，不要把真实项目源码摘出来。

## 提交与 Pull Request 规范
提交信息遵循 Conventional Commits，并与仓库历史一致：`feat:`、`fix:`、`refactor:`、`docs:`、`chore:`，可选 scope（示例：`feat(diagnostics): ...`）。  
PR 至少包含：变更说明、动机、测试命令与结果、关联 Issue；涉及 UI/交互变更请附截图或 GIF。  
若有用户可感知变更，请同步更新 `CHANGELOG.md`。

## 安全与配置建议
不要提交 `.env`、API Key 或服务器敏感信息。  
服务地址与模型参数应通过 VS Code 配置项（`lpc.*`）管理，避免硬编码到源码。
