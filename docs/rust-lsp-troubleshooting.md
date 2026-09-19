# Rust LSP 故障排查

LPC Support 的生产语言能力由 VS Code 中的 TypeScript 宿主启动随扩展打包的 Rust 语言服务器。补全、悬浮、跳转、引用、重命名、诊断、语义高亮、文档符号、格式化和工作区索引都依赖这个进程。旧 TypeScript 语言服务器已于 2026-09 正式退役并从仓库删除，Rust sidecar 是唯一语言服务器入口，不存在任何 TypeScript 回退。

## 先确认项目配置

1. 在 mudlib 根目录放置 `lpc-support.json`。
2. 确认其中的 `configHellPath` 指向当前开发 driver 使用的真实配置文件。
3. 确认 `config.hell` / `config.dev` 中的 `mudlib directory`、`include directories`、`global include file` 和 `simulated efun file` 与实际目录一致。
4. 修改配置后执行“LPC: 重建 LPC 工作区索引”；仍未恢复时重新加载 VS Code 窗口。

## 语言功能全部不可用

打开 VS Code 的“输出”面板并选择 `LPC LSP`。如果提示缺少 `dist/bin/lpc-language-server`（Windows 为 `.exe`），请重新安装与当前操作系统和 CPU 架构匹配的 VSIX。源码开发环境可以在仓库根目录运行：

```bash
npm run build:rust
npm run test:rust-smoke
```

不要从另一平台复制原生二进制。旧 TypeScript LSP server（包括 `dist/lsp/server.js` 构建路径与 `LPC_LANGUAGE_SERVER=typescript` 回退）已随退役删除，不能也不应再作为回退使用。

## 宏、include 或继承结果不正确

- 检查 include 目录和全局 include 是否来自当前 `config.hell`。
- 检查依赖文件是否存在于 mudlib 内，并保存发生变化的头文件。
- 运行“LPC: 重建 LPC 工作区索引”，然后重新打开目标文件。
- 条件编译依赖 driver 内建但配置文件无法推导的宏时，在 `lpc-support.json` 的 `preprocessorDefines` 中显式列出宏名。

宏按源码顺序生效。`#include` 前后、`#undef` 后以及非活动条件分支中的同名宏得到不同结果属于预期行为。

## 出现大量未定义或参数数量诊断

先等待状态栏中的工作区索引完成。Rust 诊断在依赖尚未完整解析时会保守静默；若索引完成后仍有稳定误报，请记录诊断 code、文件内行列、相关 include/inherit 配置和最小复现。不要提交私有 mudlib 全量源码。

维护者应优先使用脱敏探针复现：

```bash
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --position <line:column> --semantic-tokens
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --workspace-diagnostics
```

默认报告位于 `.tmp/lsp-probe/latest.json` 和 `.tmp/lsp-probe/latest.md`，不会保存项目绝对根路径、源码正文、函数体或补全候选标签。

## 低性能 CPU 上索引过慢

冷启动需要读取并索引 mudlib；后台索引限制为一个线程，并在文件之间让出执行预算。先观察状态栏是否仍在索引，不要连续触发多个手动重建。若要量化问题，可运行：

```bash
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --position <line:column> --perf --perf-iterations 30
```

报告应同时查看启动墙钟时间、进程 CPU 时间、平均单核利用率、warm p95、超时数、分析快照重建次数和峰值常驻内存，不能只比较单次请求。

## 格式化被拒绝

格式化器遇到语法错误、不完整选区或无法安全保持的预处理结构时会返回无编辑，这是防止改坏源码的保护行为。先修复语法诊断；选区格式化应覆盖一个完整语法节点。heredoc 正文、CRLF 和尾部换行应保持不变。

## 维护者交付前检查

```bash
npm run check
npm run check:rust
npm run test:rust
npm run test:rust-smoke
npm test -- --runInBand
npm run package
```

解包 VSIX 后还应确认仅包含当前平台的原生二进制、不包含任何旧 TypeScript 语言服务器产物（该构建路径已删除），并对包内二进制执行 stdio smoke。跨平台结果以 CI 的原生平台矩阵为准，不在单台机器上伪装验证其他平台。
