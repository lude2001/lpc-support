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

## 打包与平台

`npm run package` 会清理产物、构建当前平台 Rust release binary，并生成带平台标签的 VSIX。发布包必须：

- 只携带当前 `win32-x64`、`linux-x64`、`linux-arm64`、`darwin-x64` 或 `darwin-arm64` 原生二进制。
- 不再包含任何 TypeScript 语言服务器产物（旧 `dist/lsp/server.js` 构建路径已随退役删除）。
- 在缺失或不匹配二进制时给出明确错误，不静默回退。

平台矩阵由 `.github/workflows/ci.yml` 构建。当前平台交付前还需验证 VSIX 安装、同版本覆盖升级、initialize、health、shutdown 和 exit。

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
