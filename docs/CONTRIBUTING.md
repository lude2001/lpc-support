# 开发贡献指南

## 当前生产架构

LPC Support 的生产语言能力采用 Rust + TypeScript 分工：

- `src/extension.ts`、`src/modules/` 与 `src/lsp/client/` 负责 VS Code 激活、配置同步、命令、UI 和原生进程生命周期。
- `rust/crates/lpc-language-server/` 是唯一生产语言服务器入口。
- `rust/crates/lpc-preprocessor/`、`lpc-analysis/` 与 `lpc-formatter/` 分别负责预处理、版本化语义/索引和 CST 驱动格式化。
- `rust/grammar/lpc/` 维护 Tree-sitter LPC grammar；生成产物通过 grammar 测试验证，不手改生成代码。
- `src/parser/`、`src/syntax/`、`src/semantic/` 和旧 TypeScript LSP 只保留为开发期行为基线及测试夹具，不得重新接回扩展激活路径或发布 VSIX。

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
npm test -- --runInBand
```

真实项目问题优先使用脱敏静态探针：

```bash
npm run probe:lsp -- --server rust --project <mudlib-root> --file <mudlib-path> --position <line:column>
npm run probe:lsp -- --server rust --project <mudlib-root> --file <mudlib-path> --position <line:column> --perf --perf-iterations 30 --semantic-tokens
```

不要用 driver、`lpccp` 或运行时热编译来判断编辑器静态能力。探针报告默认不保存真实根路径、源码、函数体或补全候选标签。

## Formatter 边界

生产 formatter 位于 `rust/crates/lpc-formatter/`，结构真源是 Tree-sitter CST。修改时必须验证：

- 语法错误或不安全预处理结构会拒绝格式化，而不是猜测并改坏源码。
- heredoc 正文、关闭标记、CRLF 和尾部换行保持不变。
- 全文与 range formatting 对完整节点保持一致。
- 输出再次格式化应幂等，并能重新解析为无错误语法树。

重点真实样例为 `test/lpc_code/yifeng-jian.c` 与 `test/lpc_code/meridiand.c`。

## TypeScript 宿主改动

TypeScript 可以负责：

- VS Code API 对象、Webview、命令和状态栏。
- Rust LSP 请求/通知适配、配置同步和错误提示。
- bundled efun JSON 的展示层物化，但不得解析 LPC 模拟函数源码。

如果宿主侧需要新的源码事实，先增加一个最小、脱敏的 Rust 自定义请求，再在 TypeScript 中做展示适配。

## 打包与平台

`npm run package` 会清理产物、构建当前平台 Rust release binary，并生成带平台标签的 VSIX。发布包必须：

- 只携带当前 `win32-x64`、`linux-x64`、`linux-arm64`、`darwin-x64` 或 `darwin-arm64` 原生二进制。
- 不包含旧 `dist/lsp/server.js`。
- 在缺失或不匹配二进制时给出明确错误，不静默回退到 TypeScript 分析。

平台矩阵由 `.github/workflows/ci.yml` 构建。当前平台交付前还需验证 VSIX 安装、同版本覆盖升级、initialize、health、shutdown 和 exit。

## 命名和测试

- Rust 类型使用 `PascalCase`，函数与模块使用 `snake_case`；TypeScript 遵循仓库既有 `PascalCase`/`camelCase`。
- 测试文件使用 `*.test.ts`、`*.spec.ts` 或 Rust `#[test]`。
- Tree-sitter range 使用字节偏移，LSP 边界必须正确转换 UTF-16 行列。
- 不手改 `src/antlr/` 或 Tree-sitter 生成文件。

至少为每个行为变化覆盖一个正向场景和一个保守降级场景。涉及生产切换时还要运行主路径 ownership guard，确认扩展 bundle 没有重新引入 ANTLR 或旧 TypeScript 分析服务。

## 提交流程

1. 在独立分支实现并补测试。
2. 运行与风险相称的 Rust、TypeScript、真实样例和真实项目探针。
3. 检查 `git diff --check` 与发布 bundle 内容。
4. 更新用户文档和 `CHANGELOG.md`。
5. 使用 Conventional Commits 提交。

## 参考文档

- [README](../README.md)
- [Rust LSP 一次性重构实施计划](rust-lsp-implementation-plan.md)
- [.spec-workflow/steering/tech.md](../.spec-workflow/steering/tech.md)
- [.spec-workflow/steering/structure.md](../.spec-workflow/steering/structure.md)
