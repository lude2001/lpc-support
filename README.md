# LPC Support

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![CI](https://github.com/lude2001/lpc-support/actions/workflows/ci.yml/badge.svg)](https://github.com/lude2001/lpc-support/actions/workflows/ci.yml)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

[English README](https://github.com/lude2001/lpc-support/blob/main/README.en.md)

LPC Support 是面向 VS Code 的 LPC / FluffOS 语言扩展，提供日常 mudlib 开发所需的编辑、分析、文档和编译辅助能力。

扩展以静态可证明为核心原则：能从当前文件、include、inherit、项目配置、内置 efun 文档或明确用户配置中证明的结果会参与补全、跳转和诊断；无法可靠证明的运行时动态行为会保守降级，避免把正常 LPC 代码误报或跳转到错误位置。

## 功能概览

### 编辑器能力

- LPC 语法高亮与语义高亮
- 文档大纲与代码折叠
- 代码片段
- 文档格式化与选区格式化
- 行注释、块注释和常用快捷键支持

### 代码智能

- 关键字、类型、修饰符、宏、函数和对象方法补全
- 当前文件、include 文件、inherit 文件、模拟函数库和标准 efun 的悬停文档
- 函数签名帮助
- 函数、变量、宏、include 文件和对象方法的定义跳转
- 当前文件级与可证明 inherit 链级引用查找
- 局部变量、函数参数和文件级全局变量重命名
- 函数文档面板

### 诊断与类型检查

- LPC 语法错误诊断
- 未使用局部变量、参数和全局变量检查
- 局部变量声明位置检查
- 宏、include、对象访问和基础语义诊断
- 保守类型检查，包括可证明的赋值、返回值、参数和常见表达式类型不匹配
- 文件夹批量扫描
- 错误诊断中心

### 编译与运行辅助

- 编译当前 LPC 文件
- 批量编译目录中的 `.c` 文件
- 本地 `lpccp` 编译模式
- 远程 HTTP 编译模式
- 启动开发驱动
- 统一编译管理入口

## 安装

你可以通过以下方式安装：

1. 在 VS Code 扩展市场搜索 `LPC[FluffOS]`
2. 命令行安装：`code --install-extension ludexiang.lpc-support`
3. 使用本地 `.vsix` 文件安装

## 快速开始

扩展优先使用工作区根目录的 `lpc-support.json` 作为项目入口。推荐在 mudlib 根目录创建：

```json
{
  "version": 1,
  "configHellPath": "config/config.dev",
  "instanceResolutionFunctions": {
    "this_player": ["/clone/user/user"],
    "environment": ["/inherit/room/room"]
  },
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": true,
      "compileMode": "reload-loaded"
    },
    "remote": {
      "activeServer": "本地开发服",
      "servers": []
    }
  }
}
```

最小配置只需要：

- `version`：当前固定为 `1`
- `configHellPath`：指向真实使用的 `config.hell` / `config.dev`

如果你只使用语言能力，不需要编译管理，可以暂时不配置 `compile`。如果你希望某些运行时函数的返回对象参与对象方法补全和跳转，可以再补充 `instanceResolutionFunctions`。

## 项目配置

### `lpc-support.json`

`lpc-support.json` 只保存扩展入口配置和用户明确选择的功能配置。mudlib 运行时事实仍以真实 driver 配置文件为准。

当前会消费的主要字段：

- `version`
- `configHellPath`
- `instanceResolutionFunctions`
- `compile.mode`
- `compile.local.useSystemCommand`
- `compile.local.lpccpPath`
- `compile.local.compileMode`
- `compile.remote.activeServer`
- `compile.remote.servers`

### `config.hell` / `config.dev`

扩展会根据 `configHellPath` 读取 FluffOS 项目事实，包括：

- mudlib 目录
- include 目录
- simulated efun 文件
- master 文件
- global include 文件

这些信息会用于宏解析、include 解析、模拟函数库文档、对象解析和部分语言能力。

### `instanceResolutionFunctions`

`instanceResolutionFunctions` 用来告诉扩展：“这个函数在当前 mudlib 中通常会返回哪些对象文件”。它只影响静态语言能力，不会改变运行时行为，也不会执行这些函数。

字段写在 `lpc-support.json` 顶层，结构为：

```json
{
  "instanceResolutionFunctions": {
    "函数名": ["/对象文件路径1", "/对象文件路径2"]
  }
}
```

配置规则：

- key 是函数名，不带括号，例如 `this_player`、`environment`、`find_player`、`get_actor`
- value 是对象文件路径数组，建议使用以 `/` 开头的 mudlib / 工作区绝对对象路径
- 路径可以省略 `.c`，例如 `/clone/user/user` 会解析到 `/clone/user/user.c`
- 路径必须能在当前 VS Code 工作区中解析到真实文件，否则该候选会被忽略
- 同一个函数可以配置多个候选对象，扩展会把它们都作为可能返回值
- 不建议使用相对路径；相对路径会按当前源码文件所在目录解析，跨文件时容易产生不一致

典型配置：

```json
{
  "instanceResolutionFunctions": {
    "this_player": ["/clone/user/user"],
    "this_user": ["/clone/user/user"],
    "environment": ["/inherit/room/room"],
    "find_player": ["/clone/user/user"],
    "get_actor": ["/clone/user/user", "/clone/npc/npc"]
  }
}
```

命中后，下面这类代码会把配置的对象文件用于补全、悬停、签名帮助、定义跳转和后续简单赋值传播：

```c
this_player()->query_name();

object me = this_player();
me->query_name();

get_actor(id)->query_name();
```

边界：

- 配置按函数名命中，不会根据不同参数返回不同对象；`get_actor("player")` 和 `get_actor("npc")` 会得到同一组候选
- 对 FluffOS 已知运行时 efun，扩展会先检查基本参数数量；参数数量明显不合法时不会使用该配置
- 该配置适合返回单个 `object` 的函数，不适合返回 `object *` 的函数
- `users()`、`all_inventory()`、`children()`、`objects()` 等返回对象数组的 efun 当前不会因为配置而变成数组元素解析
- `this_object()` 不需要配置，它天然解析为当前文件
- `master()` 通常不需要配置，扩展会优先从 `config.hell` / `config.dev` 的 `master file` 读取
- 配置对象路径不是宏表达式；请直接写对象文件路径，不要写 `USER_D` 这类宏名

### VS Code 设置

常用设置：

- `lpc.enableTypeChecking`：启用或关闭 `lpc.type.*` 类型检查诊断
- `lpc.enableUnusedGlobalVarCheck`：启用或关闭未使用全局变量检查
- `lpc.enforceLocalVariableDeclarationAtBlockStart`：启用或关闭局部变量必须声明在块开头的检查
- `lpc.format.indentSize`：格式化缩进宽度
- `lpc.performance.debounceDelay`：诊断防抖延迟
- `lpc.performance.enableMonitoring`：启用轻量性能监控
- `lpc.javadoc.enableAutoGeneration`：启用 Javadoc 注释生成
- `lpc.glm4.*`：配置 GLM-4 注释生成能力

## 语言能力边界

### 静态可证明原则

扩展会尽量复用可证明的本地事实：

- 当前文件语义
- include 文件
- 可解析的 inherit 链
- 内置标准 efun 文档
- 模拟函数库源码和注释
- `lpc-support.json`
- `config.hell` / `config.dev`
- 用户显式配置的对象候选

当代码依赖运行时状态、动态路径、复杂数据流或无法解析的 inherit 目标时，扩展会保守处理，不做工作区级同名猜测。

### 引用与重命名

当前支持：

- 局部变量和函数参数的当前文件内重命名
- 文件级全局变量在当前文件和可证明 inherit 链内的引用与重命名
- 函数引用的当前文件级与可证明 inherit 链级结果

当前不支持：

- 函数重命名
- `struct` / `class` 定义重命名
- 不可靠的工作区全局同名扩散

### 对象与实例解析

扩展可以把可证明的对象来源用于 `obj->method()` 补全、悬停、签名帮助和定义跳转。

常见支持来源：

- 字符串路径对象，例如 `"/obj/user"->query_name()`
- 宏路径对象，例如 `COMBAT_D->query_name()`
- `this_object()`
- `master()`
- `load_object(path)` / `find_object(path)` / `clone_object(path)`
- 当前文件和 inherit 链中可证明的文件级 `object` 绑定
- 当前函数内简单变量赋值链
- 简单 `if / else` 分支合并
- 可证明的受限函数返回对象
- `@lpc-return-objects` 注释 fallback
- `instanceResolutionFunctions` 配置的运行时函数候选

默认不会静态猜测：

- `arr[i]->method()`
- 动态拼接对象路径
- 动态 inherit
- `create()` / `setup()` / `reset()` 中运行时写入的全局状态
- 任意跨函数数据流、复杂循环、动态容器构造和闭包调用
- 返回 `object *` 的 efun 数组元素传播

如果某个运行时函数在你的项目里有稳定的单对象返回类型，可以用 `instanceResolutionFunctions` 显式提供候选；如果返回值会随参数、调用栈、房间状态或玩家状态变化，建议不要配置，避免补全和跳转产生误导。

### 类型检查

类型检查默认开启，并以 warning 形式报告 `lpc.type.*` 诊断。它会在可证明时检查：

- 局部变量和全局变量赋值
- 函数返回值
- 直接函数调用参数
- efun、simul-efun 和项目内函数返回值
- 基础数组、mapping、对象、class / struct 和常见表达式类型
- `objectp()`、`stringp()` 等类型守卫能证明的窄化场景

类型信息不足、依赖运行时动态值或存在任一重载缺少可靠类型时，检查会保守跳过。可以通过 VS Code 设置关闭：

```json
{
  "lpc.enableTypeChecking": false
}
```

## 格式化

扩展提供文档格式化和选区格式化，重点覆盖：

- 函数、`if / else`、循环和匿名函数的 Allman 风格换行
- `mapping`、数组和 `new(..., field : value)` 结构化数据块布局
- `struct` / `class` 定义
- `switch` 范围标签
- 常见 `foreach` 头部
- heredoc、预处理行、复杂多行宏和行尾注释的保守处理

当前可用配置：

```json
{
  "lpc.format.indentSize": 4
}
```

## 编译管理

扩展支持本地和远程两种编译模式。

### 本地 `lpccp`

本地编译通过 `lpccp` 连接已经启动的开发驱动。`lpccp` 不是离线编译器，它需要连接与 `configHellPath` 对应的运行中 FluffOS driver。

示例：

```json
{
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": false,
      "lpccpPath": "tools/lpccp.exe",
      "compileMode": "reload-loaded"
    }
  }
}
```

`compileMode` 可选：

- `reload-loaded`：目标已加载时尝试销毁并重载
- `compile-only`：只验证编译，不替换已加载对象
- `fresh-required`：要求目标在当前 runtime 中未加载

更多 `lpccp` 说明见 [`docs/lpccp.md`](https://github.com/lude2001/lpc-support/blob/main/docs/lpccp.md)。

### 远程 HTTP

示例：

```json
{
  "compile": {
    "mode": "remote",
    "remote": {
      "activeServer": "本地开发服",
      "servers": [
        {
          "name": "本地开发服",
          "url": "http://127.0.0.1:8080",
          "description": "本机编译服务"
        }
      ]
    }
  }
}
```

## 常用命令

- 启动 MUD 驱动
- 显示所有 LPC 变量
- 扫描文件夹中未使用的变量
- 编译当前 LPC 文件
- 批量编译 LPC 文件
- 编译管理
- 查看模拟函数入口配置来源
- 显示函数文档面板
- 生成 Javadoc 注释
- 重建 LPC 工作区索引
- 刷新、清空、打开和复制错误诊断中心条目

## 快捷键

- `Ctrl+/`：行注释
- `Shift+Alt+A`：块注释
- `Ctrl+F5`：编译当前 LPC 文件
- `F12`：跳转到定义
- `Alt+F12`：查看定义

## Javadoc 注释

扩展识别常见 Javadoc 风格标签：

- `@brief`
- `@details`
- `@param`
- `@return`
- `@note`
- `@lpc-return-objects`

示例：

```c
/**
 * @brief 获取装备对象。
 * @param type 装备类型。
 * @return 装备对象。
 * @lpc-return-objects {"/obj/weapon", "/obj/armor"}
 */
object get_equipment(string type);
```

## 常见问题

### 宏或 include 无法识别

检查 `lpc-support.json` 的 `configHellPath` 是否指向真实 driver 配置文件，并确认该配置中的 include 目录可以找到对应头文件。

### simulated efun 文档未生效

检查 `config.hell` / `config.dev` 中的 simulated efun 文件配置。扩展会通过该配置解析模拟函数库文档。

### `this_player()` 或 `environment()` 无法跳转到对象方法

这些函数依赖运行时状态。若你的 mudlib 中它们有稳定对象类型，可以在 `instanceResolutionFunctions` 中显式配置候选对象，例如 `"this_player": ["/clone/user/user"]`。如果它们在不同场景会返回完全不同的对象，最好不要配置，或只配置你能接受的公共基类 / 共同接口对象。

### 类型检查有误报怎么办

请优先确认相关类型是否能从函数声明、文档、efun 文档或模拟函数库中证明。若代码依赖运行时动态值，可以关闭 `lpc.enableTypeChecking`，或提交 issue 说明可证明的类型来源。

### 编译失败

检查当前 `compile.mode`、远程服务器地址、`lpccp` 路径，以及 `configHellPath` 是否与运行中的开发 driver 使用同一个配置文件。

### 跳转或补全结果不准确

可以尝试重建 LPC 工作区索引、重新打开文件或重载 VS Code 窗口。如果问题稳定复现，欢迎提交 issue，并附上最小可复现代码和相关配置。

## 参考与开发范式

`lpc-support` 在推进 LPC 静态分析和语言服务能力时，参考过 [`jlchmura/lpc-language-server`](https://github.com/jlchmura/lpc-language-server) 项目的一些实现思路和问题建模，并继续围绕 VS Code 扩展、工作区配置、FluffOS 开发驱动、本地编译和保守诊断链路做集成。

关于这条路线背后的开发环境边界和 LPC 开发范式整理，可以阅读 [`docs/lpc-support-development-paradigm.md`](https://github.com/lude2001/lpc-support/blob/main/docs/lpc-support-development-paradigm.md)。

## 致谢

**核心开发**

- @easyCat
- 武侠黎明团队

**技术支持**

- ANTLR4
- 智谱AI (GLM-4)
- FluffOS 社区

**捐赠支持**

感谢涅槃、如月、血河车、店小二、旋转、缘分、幽若、顾青衣、天煞孤星、小桀骜、楚千秋、任翱翔、夏晨、穿穿的光、活着的僵尸等朋友的支持。

## 链接

- [GitHub](https://github.com/lude2001/lpc-support)
- [问题反馈](https://github.com/lude2001/lpc-support/issues)
- [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
- [FluffOS 文档](https://www.fluffos.info)

## 许可证

MIT License
