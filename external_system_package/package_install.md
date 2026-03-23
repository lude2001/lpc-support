# external_system_package 安装协议

本文档不是某一个包功能的说明书，而是给 Claude Code、Codex、Cursor 等 AI 助手使用的安装协议。

当用户提出类似请求时：

`Fetch and follow instructions from <github-url>/external_system_package/package_install.md`

助手应把这份文档视为安装规范，并按本文档执行，不需要了解包的业务用途。

## 职责边界

这份协议只定义一件事：

- 如何把一个 `external_system_package` 安装到目标 LPC 工作区

这份协议不负责：

- 解释包的业务功能
- 解释某个控制器、守护进程或模块是做什么的
- 强制修改项目自己的业务逻辑
- 推断项目特定的扩展接线方式

助手只需要知道：

- 工作区根目录下需要有一个 `external_system_package` 目录
- 该目录下必须有 `version.json`
- 助手应根据工作区的 `lpc-support.json` 和其中指定的 config 文件找到接入点
- 助手应根据 `version.json` 里的元数据完成宏注入和预加载注入

## 必须遵守的规则

- 不要依赖任何外部参考工程
- 不要假设全局头文件名字叫 `globals.h`
- 不要假设预加载文件名字叫 `simul_efun.c`
- 不要硬编码 `master.c`、`globals.h`、`simul_efun.c` 等文件名
- 只能根据当前工作区根目录的 `lpc-support.json` 和它指向的 config 文件定位入口
- 如果需要修改已有文件，必须做最小差异、幂等写入，避免重复注入
- 如果缺少必要文件，应创建缺失文件，而不是停止在泛泛提示

## 必备输入

安装时，助手必须先确认以下文件存在于目标工作区：

- `lpc-support.json`
- `external_system_package/version.json`

如果缺少：

- `lpc-support.json`：不能继续自动安装，应先让用户补齐项目配置
- `external_system_package/version.json`：不能继续自动安装，应先让用户补齐包元数据

## 元数据来源

### 1. `lpc-support.json`

助手必须先读取工作区根目录的 `lpc-support.json`。

至少需要使用：

- `configHellPath`

如果 `resolved` 已经存在，也应优先复用：

- `resolved.globalIncludeFile`
- `resolved.simulatedEfunFile`
- `resolved.masterFile`
- `resolved.includeDirectories`

如果 `resolved` 中缺少这些值，则再回退到 `configHellPath` 指向的 config 文件中解析。

## 2. config 文件

助手必须读取 `lpc-support.json -> configHellPath` 指向的 config 文件，并从中找到：

- `global include file`
- `simulated efun file`
- `master file`
- `include directories`

协议要求：

- `global include file` 用于定位“include 根文件”
- `simulated efun file` 用于定位“预加载注入文件”
- `master file` 只用于定位，不代表必须修改
- `include directories` 用于决定 `external_system_package.h` 应放在哪里

## 3. `version.json`

`external_system_package/version.json` 是安装元数据真源。

协议只关心两类键：

- `macro definition`
- `preload_object`

示例：

```json
{
  "httpd": {
    "version": "1.0.0",
    "description": "example",
    "preload_object": "/external_system_package/http/controller/httpd"
  },
  "lints": {
    "version": "1.0.0",
    "macro definition": {
      "LINT_D": "external_system_package/lints/lints"
    }
  }
}
```

规则：

- 所有 `macro definition` 都需要汇总进 `external_system_package.h`
- 所有 `preload_object` 都需要汇总进预加载列表
- 文档不关心其他字段含义

## 标准安装流程

### 第 1 步：确认包目录位置

助手必须确认工作区根目录下存在：

- `external_system_package/`

这是包的根目录。

如果当前包来自外部仓库：

- 将仓库中的 `external_system_package` 目录复制到目标工作区根目录
- 不要复制成别的目录名

最终目标结构至少应包含：

- `external_system_package/version.json`

### 第 2 步：定位 include 目录

助手应按以下顺序确定头文件落点：

1. 优先用 `lpc-support.json -> resolved.includeDirectories`
2. 如果没有，再从 config 文件的 `include directories` 解析
3. 选择第一个 include 根目录作为 `external_system_package.h` 的安装目录

常见结果会是：

- `/include/external_system_package.h`

但不要把 `/include` 写死为唯一可能值。

### 第 3 步：创建或更新 `external_system_package.h`

助手必须确保存在：

- `<include-root>/external_system_package.h`

如果不存在：

- 创建它

如果存在：

- 只补充缺失的宏定义
- 不要重复写入已有宏

写入规则：

- 读取 `version.json`
- 收集所有模块中的 `macro definition`
- 将其转换为 C 宏定义

例如：

```json
"macro definition": {
  "LINT_D": "external_system_package/lints/lints"
}
```

应写成：

```c
#define LINT_D "/external_system_package/lints/lints"
```

规范：

- 宏值应统一写成以 `/` 开头的 LPC 路径
- 如果元数据里没有前导 `/`，助手应自动补上

### 第 4 步：让 include 根文件加载 `external_system_package.h`

助手必须找到 config 文件中 `global include file` 指向的 include 根文件。

然后：

- 如果该文件尚未包含 `external_system_package.h`，则插入
- 如果已包含，则不重复写入

插入形式通常为：

```c
#include "external_system_package.h"
```

要求：

- 只做最小注入
- 不要重排目标文件已有 include 顺序，除非必须

### 第 5 步：定位预加载注入文件

助手必须找到 config 文件中 `simulated efun file` 指向的文件。

协议中不把这个文件名写死为 `simul_efun.c`。

无论它在项目里实际叫什么，助手都应把它视为：

- 预加载注入文件

### 第 6 步：从 `version.json` 生成预加载对象列表

助手必须读取 `version.json` 中所有模块的：

- `preload_object`

并汇总成一个 LPC 字符串数组。

例如：

```json
"preload_object": "/external_system_package/http/controller/httpd"
```

说明该对象应进入 external package 预加载列表。

规则：

- 只收集存在 `preload_object` 的模块
- 没有 `preload_object` 的模块，不进入预加载列表
- 路径应统一规范成以 `/` 开头的 LPC 路径

### 第 7 步：向预加载注入文件写入加载流程

如果 `version.json` 中至少存在一个 `preload_object`，助手必须向预加载注入文件中注入以下逻辑：

1. 一个 external package 预加载对象数组
2. 一个 `load_external_system_packages()` 函数
3. 在该文件的初始化流程中调用它

职责要求：

- `load_external_system_packages()` 负责遍历 `preload_object` 列表并 `load_object`
- 必须是幂等的，不重复插入同名数组、函数或调用
- 不能覆盖原文件已有初始化逻辑，只能追加

协议只要求助手注入“external package 预加载流程”。

协议不要求助手解释这些对象具体做什么。

### 第 8 步：`master file` 只做定位，不默认修改

助手应根据 config 文件中的 `master file` 找到 master 对象源码位置。

但默认行为是：

- 只记录这个入口存在
- 不自动修改 `master file`

如果未来某个 package_install.md 明确要求修改 `master file`，应由该包文档单独声明。

当前通用协议不要求也不默认修改它。

## 验证规则

### 最低验证

助手至少应验证：

- `external_system_package/` 已存在于工作区根目录
- `external_system_package/version.json` 可读取
- `external_system_package.h` 已创建或已更新
- include 根文件已经加载 `external_system_package.h`
- 预加载注入文件已找到
- 如果存在 `preload_object`，预加载流程已注入

### 如果没有 `preload_object`

则应明确报告：

- 当前包没有声明 `preload_object`
- 因此不需要注入预加载流程

## 输出要求

安装完成后，助手应报告：

1. 工作区根目录下是否已存在 `external_system_package`
2. `lpc-support.json` 使用了哪个 `configHellPath`
3. 找到的 include 根文件是哪一个
4. `external_system_package.h` 是新建还是增量更新
5. 从 `version.json` 注入了哪些宏定义
6. 找到的预加载注入文件是哪一个
7. 从 `version.json` 注入了哪些 `preload_object`
8. 哪些文件被修改了

## 常见错误

- 把 `package_install.md` 写成包功能说明
- 依赖外部参考工程路径而不是当前工作区配置
- 假设 include 根文件固定叫 `globals.h`
- 假设预加载注入文件固定叫 `simul_efun.c`
- 没有创建 `external_system_package.h`
- 没有把 `macro definition` 注入 `external_system_package.h`
- 没有根据 `preload_object` 注入 `load_external_system_packages()` 流程
- 重复注入导致同一个宏、数组或函数出现多次

## 最小成功标准

满足以下条件即可认为安装协议执行完成：

- 工作区根目录下存在 `external_system_package`
- 助手已通过 `lpc-support.json` 和 config 文件定位到 include 根文件与预加载注入文件
- `external_system_package.h` 已存在且已包含 `version.json` 中声明的宏
- include 根文件已加载 `external_system_package.h`
- 如果 `version.json` 中存在 `preload_object`，预加载流程已注入
