# M2 宿主本地化定向审计

日期：2026-10-27。审计对象为本轮 M2 清单与宿主实现，不将 M3 页面、M4 Rust 消息和 M6 注释输出的待办误算为 M2 完成证据。此次没有启动 VS Code、sidecar 或游戏进程，也没有重新生成 M1 清单。

## 审计结论与修复

发现两组同类遗漏，均已按最小范围修复源码及源资源；新增测试待根代理汇总 bundle 后统一运行。

| 问题 | 实际出站路径与影响 | 修复 |
| --- | --- | --- |
| P2：文档作者服务的四条插件错误固定中文 | `FunctionDocumentationAuthoringService.ts:20/25/31/56` → `FunctionDocPanel.authorDocumentation()` → `functionDocPanel.ts:229–230` 的错误包装 → Webview `actionResult` → `textContent`。英文界面执行缺少范围、过时声明、重复注释或不完整注释的拒绝路径时，错误主体仍为中文。 | 仅四条 `Error` 消息改为字面量英文 `vscode.l10n.t()` 模板，映射进入 `l10n/source/services-host.json`。生成骨架、中文 TODO、用户正文、编辑前校验与编辑调用保持原有实现。 |
| P2：缺失文档快照时的插件错误固定英文 | `RustFunctionDocumentationLookupProvider.ts:110` → `FunctionDocumentationSnapshotService.build()` → `functionDocPanel.ts:395` 的失败快照诊断 → 页面状态显示。中文界面会直接显示该英文消息。 | 仅迁移插件为缺失结果构造的错误；外部 `sendRequest` 抛出的原始错误继续透传。 |

两个源文件共五条 `throw new Error` 均已核对对应源资源。对 `src/functionDocs/services/` 的所有 `throw`、`message` 和捕获出口作了定向复核，未找到其他同类宿主错误遗漏：文档质量、配置不可用和外部函数加载包装已有本地化；`diagnostic.message` 是 sidecar 返回内容，保持原样进入 M4 的消息投影范围。

## 覆盖与控制流证据

- 修复前，对 Git 差异中的 18 个生产 TS 模块作 AST 定向检查，得到 255 处本地化调用、229 个唯一模板和 229 个目录键；首参均为字面量、引用键存在，编号占位符均提供参数。英文默认 bundle 的值均等于源模板，两种 bundle 的键数均为 229。
- 迁移模块剩余中文来自远端编译协议的 `成功` 判断、GLM 提示词及其生成上下文。前者承担外部协议识别，后者属于 M6；它们没有被作为 UI 文案翻译。
- 配置引导与索引提示按 `action` 分派，安全文档修复按 `actionId` 分派，模型按 `modelId` 分派，编译模式按 `value` 分派。远端服务器的 `selected.label` 兼容分支匹配用户提供的服务器名称，没有翻译该名称。
- 路径、模型 ID、自定义模型名称和描述、符号、签名、现有注释、驱动/HTTP/stderr 原始消息仍作为原值传递或本地化模板参数；未发现先把用户内容作为消息键查询的调用。

上述 229 键是审计输入数量；本次补齐五条错误后由根代理重新汇总生成 bundle，不能沿用旧生成文件宣称新键已在原生宿主验收。

## 变量页 HTML 与诊断来源

`RustDiagnosticsCommands.ts` 的新增本地化路径没有增加未经转义的用户 HTML：

- 第 293 行对分组标题和本地化空状态调用 `escapeHtml()`；第 291 行对 sidecar 返回的 `entry.detail || entry.name` 调用同一个转义函数。该函数覆盖 `& < > " '`。
- 第 268 行的 `lang` 来自 `resolveUiLocale()`，结果限定为 `en` 与 `zh-cn`；CSS 类名只由本文件内部常量提供。
- `data-line`、`data-character` 来自既有 Rust `Position` 的 `u32` 字段。可追溯至 `lpc-analysis/src/lib.rs` 的 `Position`、`VariableEntry`，以及语言服务器 `lpc/documentVariables` 的直接序列化响应。
- 第 240 行继续将 `diagnostic.source` 原样赋给 VS Code `Diagnostic.source`，缺省为技术标识 `lpc-support`。此字段没有进入变量页 HTML，也没有被翻译为显示名称；诊断 code、范围和级别保持原路径。
- 页面动作错误走 `setStatus()` 的 `textContent`，没有通过 `innerHTML` 执行错误字符串。

现有双语变量页测试覆盖源详情中的 `<`、`>`、`&` 转义，以及跳转命令、行列数据和语言属性；这属于针对本轮插值的测试证据，不代替 M7 的原生页面验收。

## 原生 l10n 与替身边界

只读核验了本机 VS Code 1.143.1 的 `resources/app/out/vs/workbench/api/node/extensionHostProcess.js`。原生宿主固定当前会话语言，对非内置扩展使用 `bundle.l10n.<currentLanguage>.json`；默认语言使用源模板，缺失键也回退源模板。

该版本格式器的实际逻辑为：

```js
D6 = /{([^}]+)}/g;
function tA(message, args) {
    return Object.keys(args).length === 0
        ? message
        : message.replace(D6, (match, key) => args[key] ?? match);
}
```

因此缺失或 null 值保留原占位符，字符串/数字/布尔值由替换回调输出，双花括号没有额外解码规则。审计输入中的 Mock 曾增加 `{{`/`}}` 解码且只识别 `\w+` 键；该差异已交由根代理统一对齐。当前 M2 模板仅使用数字占位符且不含双花括号，未发现它影响现有调用。

Mock 在同一 Node 进程改变 `env.language`，用于检查同一行为的两种文案；原生宿主的语言生命周期和扩展初始化时机仍须通过独立实例验收。模块初始化时物化的静态文案也不能仅靠运行中改变 Mock 语言证明原生初始化正确。

## 本次检查与剩余边界

- `npm run check:all`：退出码 0。
- 修复所涉源码、测试及源资源的 `git diff --check`：退出码 0。
- 五条新增服务错误的 AST 与源资源一一对应核验：5/5，无缺键。
- 新增/参数化两种界面的四个拒绝写入分支、缺失快照错误、外部错误原样透传，以及成功文档结构和现有生成内容保持一致；没有放宽原有写入校验断言。
- 本次未重跑全量清单或 Jest。根代理先前提供的 37 套/260 项通过结果属于补齐五条错误前的候选，新增测试、bundle 重建及统一终验由根代理记录。
- 未以本次静态审计证明已安装原生扩展的 bundle 加载、完整页面操作、Rust 本地化或六个平台制品。这些仍依实施计划分别验收。
