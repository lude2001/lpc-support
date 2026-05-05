---
layout: doc
title: cli / lpccp
---

# cli / lpccp

`lpccp` 是 FluffOS 运行时 LPC 编译服务的本地客户端。

它不会自己启动新的 driver，也不会脱离运行中的 mud 环境单独编译。它的职责是连接一个已经启动好的 `driver`，请求这个 driver 在当前运行环境里编译、重载或验证指定的 LPC 目标，然后把结构化结果输出为 JSON。

## 使用前提

1. 必须先启动一个运行中的 `driver`
2. `lpccp` 传入的 config 路径必须和这个 `driver` 启动时使用的是同一个配置文件
3. 当前实现是本地 IPC，用于本机开发环境

## 基础用法

原有用法继续有效：

```bash
lpccp <config-path> <path>
lpccp --id <id> <path>
lpccp --dev-test <config-path> <path>
lpccp --dev-test --id <id> <path>
```

其中：

- `<config-path>` 是启动目标 `driver` 时使用的配置文件路径
- `<id>` 是调试用的内部服务标识
- `<path>` 可以是单个 LPC 文件或目录，例如 `/single/master.c`、`/single/`

## 编译模式

`lpccp` 支持三个编译模式参数：

```bash
lpccp --reload-loaded <config-path> <path>
lpccp --compile-only <config-path> <path>
lpccp --fresh-required <config-path> <path>
```

含义：

- `--reload-loaded`：默认模式。目标已加载时，尝试销毁并重载
- `--compile-only`：不尝试替换已加载对象；如果对象已经加载，会明确返回 `reload_loaded_object_failed`
- `--fresh-required`：要求当前 runtime 里目标未加载；如果已加载，会提示需要重启 runtime 后验证

`--dev-test` 可以和这些模式组合使用。

## 推荐工作流

Windows 下建议先启动开发 driver，然后另开一个终端执行 `lpccp`：

```powershell
cd D:\code\fluffos\testsuite
D:\code\fluffos\build\dist\driver.exe etc\config.test
```

单文件编译：

```powershell
D:\code\fluffos\build\dist\lpccp.exe D:/code/fluffos/testsuite/etc/config.test /single/master.c
```

目录编译：

```powershell
D:\code\fluffos\build\dist\lpccp.exe D:/code/fluffos/testsuite/etc/config.test /single/
```

仅编译验证：

```powershell
D:\code\fluffos\build\dist\lpccp.exe --compile-only D:/code/fluffos/testsuite/etc/config.test /single/master.c
```

## 返回格式

`lpccp` 的标准输出是 JSON。失败响应会稳定带有：

```json
{
  "ok": false,
  "phase": "...",
  "reason": "...",
  "message": "..."
}
```

常见 `reason`：

- `syntax_error`
- `target_not_found`
- `unsupported_target_kind`
- `reload_loaded_object_failed`
- `runtime_error`
- `service_error`
- `compile_timeout`
- `service_busy`
- `pipe_connect_failed`
- `timeout`
- `test_missing`

调用方应该优先读取 `ok`、`phase`、`reason`、`message`，再读取 `diagnostics`、`runtime_errors` 和目录 `summary`。

## 单文件编译

成功示例：

```json
{
  "version": 1,
  "ok": true,
  "kind": "file",
  "target": "/single/master.c",
  "diagnostics": [],
  "runtime_errors": [],
  "files_total": 0,
  "files_ok": 0,
  "files_failed": 0,
  "results": []
}
```

语法失败示例：

```json
{
  "version": 1,
  "ok": false,
  "kind": "file",
  "target": "/single/bad_example.c",
  "phase": "compile",
  "reason": "syntax_error",
  "message": "syntax error",
  "diagnostics": [
    {
      "severity": "error",
      "file": "/single/bad_example.c",
      "line": 12,
      "message": "syntax error"
    }
  ],
  "runtime_errors": []
}
```

## 目录编译

目录请求会返回聚合结果，并在 `results` 中给出每个失败文件的结构化信息：

```json
{
  "version": 1,
  "ok": false,
  "kind": "directory",
  "target": "/single/",
  "files_total": 3,
  "files_ok": 1,
  "files_failed": 2,
  "results": [
    {
      "file": "/single/a.c",
      "ok": true,
      "diagnostics": [],
      "runtime_errors": []
    },
    {
      "file": "/single/b.c",
      "ok": false,
      "phase": "compile",
      "reason": "syntax_error",
      "message": "syntax error",
      "diagnostics": [
        {
          "severity": "error",
          "file": "/single/b.c",
          "line": 8,
          "message": "syntax error"
        }
      ],
      "runtime_errors": []
    }
  ],
  "summary": {
    "syntax_error_count": 1,
    "reload_failed_count": 0,
    "runtime_error_count": 0,
    "unsupported_count": 0,
    "service_error_count": 0
  },
  "diagnostics": []
}
```

目录请求的判断逻辑建议是：

1. 先看顶层 `ok`
2. 再看 `files_failed`
3. 再看 `summary`
4. 最后遍历 `results`，逐个读取每个文件的 `ok`、`phase`、`reason`、`message`、`diagnostics`、`runtime_errors`

## 头文件

`.h` 文件不是独立编译目标。例如：

```bash
lpccp <config-path> /include/foo.h
```

会返回：

```json
{
  "kind": "header",
  "ok": false,
  "phase": "target",
  "reason": "unsupported_target_kind",
  "message": "header files are not standalone compile targets"
}
```

## dev_test

`--dev-test` 不再把缺少入口当成编译失败。无 `dev_test()` 时会返回：

```json
{
  "ok": false,
  "compile_status": "ok",
  "test_status": "missing",
  "phase": "dev_test",
  "reason": "test_missing",
  "message": "Object does not define dev_test()"
}
```

这表示编译本身已经通过，只是目标对象没有提供 smoke test 入口。

## 运行时错误

运行时错误会进入 `runtime_errors`：

```json
{
  "runtime_errors": [
    {
      "object": "/single/runtime",
      "program": "/single/runtime.c",
      "line": 123,
      "error_type": "runtime_error",
      "message": "bad argument",
      "trace": []
    }
  ]
}
```

当前 `trace` 字段先保留为空数组；错误本身、对象、程序和行号会尽量捕获。

## 连接失败

连接失败现在也会从 stdout 返回结构化 JSON：

```json
{
  "ok": false,
  "phase": "connect",
  "reason": "pipe_connect_failed",
  "message": "cannot connect to compile service pipe",
  "error": {
    "type": "pipe_connect_failed",
    "win32": 2
  }
}
```

退出码仍然是 `2`，用于区分服务或传输失败。旧版本 `lpccp` 可能仍只把连接失败写到 stderr，调用方可以把 stderr 作为兼容兜底。

常见原因：

- 目标 `driver` 还没有启动
- `lpccp` 使用的 config 路径和 `driver` 启动时使用的不是同一个
- `driver` 启动失败，没有真正进入可用状态
- 编译服务正忙或连接超时

## 退出码

- `0`：请求成功，通常返回 `ok: true`
- `1`：请求已送达，但编译、重载、运行或测试阶段失败，返回 `ok: false`
- `2`：本地连接或服务传输失败，stdout 仍会尽量返回结构化 JSON

## 适用场景

- 编辑器保存后触发单文件编译
- 本地工具做目录级批量检查
- 为 IDE、LSP 或自定义开发工具提供运行时编译后端

## 注意事项

- `lpccp` 走的是运行中的 FluffOS VM 语义，不是独立离线编译器语义
- 它请求的是运行环境里的真实编译、重载或验证，不是单纯静态语法检查
- `compile-only` 适合确认源文件能否通过编译，但不会替换已加载对象
- `fresh-required` 适合要求干净 runtime 状态的验证
- 因此它更适合本地开发环境，而不是生产环境
