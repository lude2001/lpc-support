---
layout: doc
title: cli / lpccp
---

# cli / lpccp

`lpccp` 是 FluffOS 运行时 LPC 编译服务的本地客户端。

它不会自己启动新的 driver，也不会脱离运行中的 mud 环境单独编译。  
它的职责是连接一个已经启动好的 `driver`，请求这个 driver 在当前运行环境里重新编译并装载指定的 LPC 文件或目录，然后把结构化结果输出为 JSON。

## 使用前提

1. 必须先启动一个运行中的 `driver`
2. `lpccp` 传入的 config 路径必须和这个 `driver` 启动时使用的是同一个配置文件
3. 当前实现是本地 IPC，用于本机开发环境

## 用法

```bash
./lpccp <config-path> <path>
```

调试模式也支持直接传内部 `id`：

```bash
./lpccp --id <id> <path>
```

其中：

- `<config-path>` 是启动目标 `driver` 时使用的配置文件路径
- `<path>` 可以是：
  - 单个 LPC 文件，例如 `/single/master.c`
  - 一个目录，例如 `/single/`

## 推荐工作流

Windows 下建议优先使用 [`build.cmd`](/D:/code/fluffos/build.cmd) 产出 [`build/dist`](/D:/code/fluffos/build/dist)：

```powershell
build.cmd
```

然后：

1. 启动 `driver`
2. 再调用 `lpccp`

例如 testsuite 环境：

```powershell
cd D:\code\fluffos\testsuite
D:\code\fluffos\build\dist\driver.exe etc\config.test
```

另开一个终端执行：

```powershell
D:\code\fluffos\build\dist\lpccp.exe D:/code/fluffos/testsuite/etc/config.test /single/master.c
```

目录编译：

```powershell
D:\code\fluffos\build\dist\lpccp.exe D:/code/fluffos/testsuite/etc/config.test /single/
```

## 返回格式

`lpccp` 的标准输出始终是 JSON。

为了一致性，当前协议无论是单文件还是目录请求，都会尽量返回同一组顶层字段。  
区别在于有些字段只在目录请求里真正有意义，在单文件请求里通常为 `0` 或空数组。

### 单文件编译

成功示例：

```json
{
  "diagnostics": [],
  "files_failed": 0,
  "files_ok": 0,
  "files_total": 0,
  "kind": "file",
  "ok": true,
  "results": [],
  "target": "/single/master.c",
  "version": 1
}
```

字段说明：

| 字段 | 类型 | 含义 |
|------|------|------|
| `version` | `number` | 协议版本，当前为 `1` |
| `kind` | `string` | 请求类型，单文件时固定为 `file` |
| `target` | `string` | 本次编译请求的目标路径 |
| `ok` | `boolean` | 本次请求是否整体成功 |
| `diagnostics` | `array` | 当前请求对应的诊断列表 |
| `files_total` | `number` | 为了统一协议保留的字段。单文件请求下通常为 `0` |
| `files_ok` | `number` | 为了统一协议保留的字段。单文件请求下通常为 `0` |
| `files_failed` | `number` | 为了统一协议保留的字段。单文件请求下通常为 `0` |
| `results` | `array` | 为了统一协议保留的字段。单文件请求下通常为空数组 |

其中最重要的判断逻辑是：

- 先看 `ok`
- 再看 `diagnostics`
- 如果是目录请求，再看 `files_total / files_ok / files_failed / results`

失败时，`diagnostics` 中会包含结构化诊断，例如：

```json
{
  "severity": "error",
  "file": "/single/bad_example.c",
  "line": 12,
  "message": "syntax error"
}
```

单条 `diagnostics` 的字段说明：

| 字段 | 类型 | 含义 |
|------|------|------|
| `severity` | `string` | 诊断级别，通常是 `warning` 或 `error` |
| `file` | `string` | 诊断所属文件 |
| `line` | `number` | 对应源文件行号 |
| `message` | `string` | 诊断文本 |

解释规则：

- 如果 `ok: true` 且 `diagnostics` 为空，表示这次编译没有收集到错误或警告
- 如果 `ok: false` 且 `diagnostics` 非空，通常表示 driver 在编译过程中收集到了错误或警告
- 如果 `ok: false` 但 `diagnostics` 为空，通常说明失败发生在更早的请求级阶段，例如对象未成功装载或连接层出错

### 目录编译

目录请求会返回聚合结果：

```json
{
  "version": 1,
  "ok": false,
  "kind": "directory",
  "target": "/single/",
  "files_total": 3,
  "files_ok": 2,
  "files_failed": 1,
  "results": [
    {
      "file": "/single/a.c",
      "ok": true,
      "diagnostics": []
    },
    {
      "file": "/single/b.c",
      "ok": false,
      "diagnostics": [
        {
          "severity": "error",
          "file": "/single/b.c",
          "line": 8,
          "message": "syntax error"
        }
      ]
    }
  ],
  "diagnostics": []
}
```

字段说明：

| 字段 | 类型 | 含义 |
|------|------|------|
| `version` | `number` | 协议版本，当前为 `1` |
| `kind` | `string` | 请求类型，目录请求时固定为 `directory` |
| `target` | `string` | 目录路径 |
| `ok` | `boolean` | 整个目录请求是否全部成功 |
| `files_total` | `number` | 目录下参与编译的 `.c` 文件总数 |
| `files_ok` | `number` | 成功文件数 |
| `files_failed` | `number` | 失败文件数 |
| `results` | `array` | 每个文件的单独编译结果 |
| `diagnostics` | `array` | 目录级诊断。当前通常为空，主要诊断在 `results` 内部 |

`results` 数组中的每一项都代表一个文件，形状通常是：

```json
{
  "file": "/single/a.c",
  "ok": true,
  "diagnostics": []
}
```

其中字段含义是：

| 字段 | 类型 | 含义 |
|------|------|------|
| `file` | `string` | 该文件的路径 |
| `ok` | `boolean` | 该文件是否编译成功 |
| `diagnostics` | `array` | 该文件对应的错误和警告列表 |

目录请求的判断逻辑建议是：

1. 先看顶层 `ok`
2. 再看 `files_failed` 是否大于 `0`
3. 最后遍历 `results`，逐个读取每个文件的 `ok` 和 `diagnostics`

## 标准错误输出

如果 `lpccp` 无法连接到对应的编译服务，它会把错误写到标准错误，例如：

```text
Error: cannot connect to compile service pipe \\.\pipe\fluffos-lpccp-xxxxxxxxxxxxxxxx (win32=2)
```

常见原因：

- 目标 `driver` 还没有启动
- `lpccp` 使用的 config 路径和 `driver` 启动时使用的不是同一个
- `driver` 启动失败，没有真正进入可用状态

## 退出码

- `0`：请求成功，且返回 `ok: true`
- `1`：请求已送达，但编译失败，返回 `ok: false`
- `2`：本地连接或请求级错误，例如无法连接到编译服务

## 适用场景

- 编辑器保存后触发单文件编译
- 本地工具做目录级批量检查
- 为 IDE、LSP 或自定义开发工具提供运行时编译后端

## 注意事项

- `lpccp` 走的是运行中的 FluffOS VM 语义，不是独立离线编译器语义
- 它请求的是“真实重编译并装载”，不是单纯静态语法检查
- 因此它更适合本地开发环境，而不是生产环境
