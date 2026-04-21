# LPC Support

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

LPC Support 是一个面向 VS Code 的 LPC / FluffOS 开发扩展，当前版本为 `0.45.2`。
自 `0.40` 版本起的扩展暂不打包进入市场，它还在接收大量的实战检验，当前可查看源仓库查看进度。

它提供日常 LPC 开发常用的语言能力，包括补全、悬停、跳转、引用、重命名、诊断、语义高亮、格式化、函数文档和编译管理。

## 当前版本重点

- 语言能力已经统一到单一路径 LSP runtime
- 项目配置统一使用 `lpc-support.json`
- 支持对象方法推导、当前文件与继承链静态全局对象绑定、跨文件返回对象传播和更准确的成员补全/跳转
- 支持 `::method()` / `room::method()` 这类显式父对象与 inherit 分支调用的补全、定义跳转、悬停、签名帮助和返回对象传播
- 函数 `references` 只保留当前文件级 + 可证明继承链级；不再做工作区级名字扩散
- `rename` 当前只支持局部变量、函数参数、文件级全局变量；函数与 `struct/class` 定义不支持重命名
- 标准 efun 文档已经改为完全本地、结构化的内置数据，不再运行时请求 `mud.wiki`
- 函数文档、悬停、函数文档面板和签名帮助已经收敛到统一 callable-documentation 管线
- completion / hover / signature help / navigation / object inference / runtime document source 已完成 ownership normalization，主语言服务链统一回到显式 composition root
- 支持文档格式化与选区格式化
- 支持本地 `lpccp` 和远程 HTTP 两种编译模式

## 单一路径 LSP Runtime

当前版本已经完成单一路径 LSP 收束。主语言能力链、诊断与格式化都通过这条路径提供，补全、悬停、跳转、引用、重命名、语义高亮等能力也统一在同一条 LSP client/server 运行链路上。

同时，仍有少量宿主侧 affordances 保留在 VS Code 扩展宿主中，例如函数文档面板、错误树视图、编译管理与启动驱动命令。它们仍然可用，但不再构成独立运行模式。

## 主要能力

### 编辑器能力

- LPC 语法高亮
- 语义高亮
- 文档大纲
- 代码折叠
- 代码片段
- 文档格式化与选区格式化

### 代码智能

- 关键字、类型、修饰符补全
- 标准 efun 本地结构化文档、补全和悬停
- 模拟函数库文档解析与补全
- 当前文件、继承文件、include 文件中的函数悬停
- `::method()` / `room::method()` scoped 调用补全
- 当前文件、继承文件、include 文件、模拟函数库、标准 efun、对象方法调用，以及 `::method()` / `room::method()` scoped 调用的签名帮助
- 跳转到函数、变量、宏和 include 文件定义
- 引用查找（当前文件级 + 可证明继承链级）
- 符号重命名（局部变量、函数参数、文件级全局变量）
- 函数与 `struct/class` 定义不支持重命名

### 对象方法推导

扩展可以识别常见的 `obj->method()` 对象来源，并把结果用于补全、跳转和悬停。

当前支持：

- 字符串路径对象
- 宏路径对象
- `this_object()`
- `this_player()`（需配置 `playerObjectPath`）
- `load_object()` / `find_object()` / `clone_object()`
- 当前文件内声明点可静态证明的文件级 `object` 绑定
- 文件级全局 `object` 别名链
- 继承链中声明点可静态证明的文件级 `object` 绑定
- 继承链中的全局 `object` 别名链
- 当前函数内的简单变量赋值链
- `if / else` 分支合并
- 受限函数返回值自然推导，包括静态 registry / mapping、局部别名、简单分支、`new` / `load_object` / `find_object` 返回链
- `@lpc-return-objects` 标注的返回对象传播 fallback

### Scoped 方法解析

除 `obj->method()` 之外，扩展现在也支持显式父对象 / inherit 分支调用：

- 裸 `::method()` 会沿 direct inherit 图做 inherit-only 查找
- `room::method()` 会先把 `room` 唯一映射到 direct inherit 分支，再只在该分支内解析方法
- `::method()` / `room::method()` 现在可以参与补全、定义跳转、悬停和签名帮助
- `::factory()` / `room::factory()` 现在可以继续传播 `@lpc-return-objects`，让后续 `ob->method()` 沿真实返回对象继续跳转
- 当 qualifier 歧义、inherit 图不完整或存在未解析 inherit 时，解析会保守降级为 `unknown`，相关 scoped 补全也会返回空候选，不会错误回退到普通函数、模拟函数或 efun

### 引用与重命名边界

- 函数 `references` 当前只提供当前文件级与可证明继承链级结果，不再做工作区级名字扩散
- 文件级全局变量的 `references / rename` 只会沿静态可解析且可证明的 `inherit` 链扩展
- 局部变量和函数参数的 `rename` 保持当前文件内精确重命名
- 函数与 `struct/class` 定义不支持 `rename`
- 旧的工作区级 `Workspace*` relation 栈已退场，不再是当前生产导航架构的一部分
- 当继承链出现遮蔽、分支歧义或未解析 `inherit` 时，导航会保守降级而不是按同名猜测扩散

### 诊断与分析

- ANTLR 语法错误诊断
- 未使用局部变量检查
- 未使用参数检查
- 未使用全局变量检查
- 局部变量声明位置检查
- 宏使用检查
- 对象访问相关检查
- 文件夹批量扫描
- 变量列表查看

### 编译与运行辅助

- 编译当前 LPC 文件
- 批量编译目录中的 `.c` 文件
- 编译管理（本地 `lpccp` / 远程 HTTP）
- 错误诊断中心
- 启动开发驱动（通过 `lpcprj config`）

### 函数文档与注释

- 标准 efun 完全本地的结构化离线文档
- 模拟函数库文档扫描
- 函数文档面板
- 统一 callable-documentation 管线驱动的悬停、签名帮助，以及基于共享文档服务的函数文档面板
- Javadoc 风格注释生成
- 支持通过 GLM-4 生成注释内容

## 安装

你可以通过以下方式安装：

1. 在 VS Code 扩展市场搜索 `LPC[FluffOS]`
2. 命令行安装：`code --install-extension ludexiang.lpc-support`
3. 使用本地 `.vsix` 文件安装

## 开发环境支持

本项目不仅提供 VS Code 扩展，也提供围绕 LPC / FluffOS 开发环境的配套资源：

- `external_system_package/`
  - 提供可安装到 Mudlib 根目录的 external system package
  - 包内的 [`package_install.md`](D:/code/lpc-support/external_system_package/package_install.md) 说明了如何根据 `lpc-support.json` 与 `version.json` 自动完成安装
- FluffOS 开发环境 fork
  - 项目同时维护了用于开发环境的 FluffOS fork：[`https://github.com/lude2001/fluffos`](https://github.com/lude2001/fluffos)
- 开发驱动环境安装包（预览版）
  - 请前往 [GitHub Releases](https://github.com/lude2001/lpc-support/releases) 获取安装包
  - 安装完成后可将 `lpcprj` 与 `lpccp` 暴露为全局命令，供扩展直接调用

如果你希望自己编译开发驱动，推荐流程是：

1. fork [`https://github.com/lude2001/fluffos`](https://github.com/lude2001/fluffos)
2. 在你自己的 fork 中编译开发环境 driver
3. 再通过 `lpc-support.json -> compile.local` 把 `lpccp` 与对应配置接到当前工作区

## 快速开始

扩展现在以项目根目录的 `lpc-support.json` 作为配置入口。

在 Mudlib 根目录创建：

```json
{
  "version": 1,
  "configHellPath": "config.hell",
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": true
    },
    "remote": {
      "activeServer": "本地开发服",
      "servers": [
        {
          "name": "本地开发服",
          "url": "http://127.0.0.1:8080"
        }
      ]
    }
  },
  "resolved": {
    "includeDirectories": [
      "/include"
    ],
    "simulatedEfunFile": "/adm/single/simul_efun"
  }
}
```

说明：

- `configHellPath` 指向项目中的 `config.hell`
- `compile` 管理编译方式
- `resolved` 由扩展根据 `config.hell` 自动同步，一般不需要手工修改

## 编译管理

扩展提供统一的“编译管理”入口。

支持两种模式：

- 远程编译：通过 HTTP 服务编译
- 本地编译：通过 `lpccp` 连接已启动的开发驱动

本地 `lpccp` 模式支持两种写法：

1. 直接使用系统环境变量中的 `lpccp`
2. 在 `lpc-support.json` 中显式指定 `lpccpPath`

示例：

```json
{
  "compile": {
    "mode": "local",
    "local": {
      "useSystemCommand": false,
      "lpccpPath": "tools/lpccp.exe"
    }
  }
}
```

如果你的 `lpccp` 已经注册到系统环境变量，推荐直接开启 `useSystemCommand`；如果团队内使用固定工具目录，则更适合把 `lpccpPath` 作为项目相对路径写入 `lpc-support.json`。

`lpccp` 的参数、返回格式和退出码可参考：

- [`docs/lpccp.md`](D:/code/lpc-support/docs/lpccp.md)

## 启动驱动

“启动 MUD 驱动”命令会通过 `lpcprj config` 启动开发驱动。

请确保：

- 你的系统已经安装开发驱动环境
- `lpcprj` 可以直接从终端执行

如果未检测到 `lpcprj`，扩展会提示你先安装对应环境。

## 对象方法推导配置

如果你希望支持 `this_player()->method()` 的对象推导，可以在 `lpc-support.json` 中增加：

```json
{
  "playerObjectPath": "/obj/user"
}
```

扩展会优先尝试自然语义推导函数返回值。比如静态 registry / mapping factory、局部变量别名、简单 `if / else` 分支，以及 `new(...)`、`load_object(...)`、`find_object(...)` 这类返回对象来源，都可以在受限白区内自然传播：

```c
object model_get(string model_name) {
    mapping registry = query_model_registry();
    mapping info = registry[model_name];

    if (info["mode"] == "new") {
        return new(info["path"]);
    }

    return load_object(info["path"]);
}

PROTOCOL_D->model_get("login")->error_result("ban");
```

当自然语义推导无法证明结果时，你仍然可以用 `@lpc-return-objects` 标注自定义函数返回对象实例：

```c
/**
 * @lpc-return-objects {"/obj/weapon", "/obj/armor"}
 */
object get_equipment(string type);
```

这会帮助扩展继续推导：

```c
object ob = get_equipment("sword");
ob->query_damage();
```

`@lpc-return-objects` 现在是 fallback-only 提示：只在自然语义推导和环境语义 provider 都无法给出非 unknown 结果时才会接管。若自然推导已经得到确定结果，则以自然推导为准。

### 当前支持的推导来源

| 写法 | 推导结果 | 示例 |
|------|---------|------|
| 字符串字面量 `"/path/obj"->method()` | 直接解析路径 | `"/obj/user"->query_name()` |
| 宏标识符 `COMBAT_D->method()` | 通过宏展开解析路径 | `COMBAT_D->query_name()` |
| `this_object()->method()` | 当前文件路径 | |
| `this_player()->method()` | 配置的 `playerObjectPath` | |
| `load_object(path)->method()` | 解析参数路径 | `load_object("/obj/npc")` |
| `find_object(path)->method()` | 同 `load_object` | |
| `clone_object(path)->method()` | 同 `load_object` | |
| 当前文件文件级全局 `object` | 解析声明点静态可证明的 initializer | `object COMBAT_D = load_object("/adm/daemons/combat_d");` |
| 当前文件文件级全局 `object` 别名 | 沿全局别名链继续解析 | `object ALIAS_D = COMBAT_D;` |
| 继承链文件级全局 `object` | 按继承顺序解析父对象中的静态全局绑定 | `inherit "/std/room"; COMBAT_D->query_name();` |
| 继承链全局 `object` 别名 | 沿父对象中的全局别名链继续解析 | `inherit "/std/room"; ALIAS_D->start();` |
| 变量追踪 | 沿赋值链推导 | `ob = load_object("/obj/npc"); ob->method()` |
| `if/else` 合并 | 多候选 | 不同分支赋不同对象时合并为多候选 |
| 受限自然返回推导 | 静态可证明的函数返回对象 | `PROTOCOL_D->model_get("login")->error_result(...)` |
| 环境语义 provider | 配置驱动候选或运行时黑区分类 | `this_player()`、`previous_object(...)` |
| `@lpc-return-objects` | 自定义函数返回对象 fallback | 自然推导未知时继续传播 |

### 当前未覆盖的场景

- `arr[i]->method()`
- 动态拼接路径，例如 `load_object("/obj/" + name)`
- 动态 inherit 路径或运行时才能确定的 inherit 目标
- 运行时全局赋值，例如 `create()` / `setup()` / `reset()`
- 任意跨函数数据流、复杂循环、动态容器构造和不可静态闭包的运行时调用栈来源

## 常用命令

- 启动 MUD 驱动
- 显示所有 LPC 变量
- 扫描文件夹中未使用的变量
- 编译当前 LPC 文件
- 批量编译 LPC 文件
- 编译管理
- 添加远程编译服务器
- 选择活动远程编译服务器
- 删除远程编译服务器
- 配置宏定义目录到 `lpc-support.json`
- 配置模拟函数入口文件到 `lpc-support.json`
- 显示函数文档面板
- 生成 Javadoc 注释

此外还提供错误树相关命令，包括刷新、清空错误、打开错误位置和复制错误信息。

## 编辑器行为

### 格式化

扩展提供 LPC 文档格式化和选区格式化，当前重点覆盖：

- 函数、`if/else`、循环和匿名函数的 Allman 风格换行
- `mapping`、数组和 `new(..., field : value)` 结构化数据块布局
- `struct/class` 定义、`switch` 范围标签和常见 `foreach` 头部整理
- heredoc、复杂多行宏等高风险结构的保守处理

当前可用的格式化配置：

- `lpc.format.indentSize`

### 补全

补全数据主要来自以下来源：

- LPC 关键字、类型和修饰符
- 标准 efun 离线文档
- 模拟函数库扫描结果
- 当前文件语义快照
- 继承文件中的函数
- 结构体成员和对象常用方法
- 对象推导器提供的真实方法补全
- 预处理指令片段

### 悬停

悬停文档的优先级大致如下：

1. 当前文件函数文档
2. 继承文件函数文档
3. include 文件函数文档
4. 对象方法文档
5. 模拟函数库文档
6. 标准 efun 文档

标准 efun 文档现在完全来自扩展内置的结构化离线数据，运行时不再回退到 `mud.wiki`。

### 签名帮助

签名帮助与悬停共用同一条 callable-documentation 管线，当前支持：

- 当前文件函数
- 继承文件函数
- include 文件函数
- 模拟函数库函数
- 标准 efun
- `obj->method()` 对象方法调用
- `::method()` / `room::method()` scoped 调用

### 定义跳转

定义跳转支持：

- 当前文件函数和变量
- 继承文件函数
- include 头文件
- 宏定义
- 模拟函数库函数
- 基于对象推导的跨文件方法解析
- `::method()` / `room::method()` scoped 父方法与 inherit 分支方法解析

### 重命名与快速修复

扩展提供：

- 当前文件标识符重命名
- 未使用变量删除
- 未使用变量注释
- 将变量标记为全局变量
- 蛇形 / 驼峰重命名建议
- 将局部变量声明移动到代码块或函数开头

## 函数文档系统

函数文档系统现在统一走 callable-documentation 管线，来源包括：

- 当前文件函数、继承文件函数和 include 文件函数：从本地源码和 Javadoc 注释结构化生成
- 对象方法：先由对象推导定位目标声明，再进入同一条文档管线
- scoped 方法调用：先由 `ScopedMethodResolver` 定位父对象或指定 inherit 分支实现，再进入同一条文档管线
- 标准 efun 文档：内置结构化离线数据，随扩展打包，运行时不再请求远端站点
- 模拟函数库文档：从本地 `.c` / `.h` 文件和 Javadoc 注释解析生成

文档展示位置包括：

- 补全文档
- 编辑器悬停
- 函数文档面板
- 签名帮助

这些入口现在都复用统一的 callable-documentation 管线和共享文档服务：悬停与签名帮助会在当前文件、继承文件、include 文件、对象方法、模拟函数库和标准 efun 等来源之间做统一解析；函数文档面板则基于同一份结构化文档服务展示当前文件、继承文件和 include 文件中的函数文档。

函数文档面板会读取当前文件、继承文件和 include 文件中的函数定义，并支持跳转到定义或直接触发 Javadoc 生成。

## 诊断与错误查看

扩展内部包含两类与错误相关的能力：

- 编辑器内静态诊断
- 远程错误诊断中心

静态诊断依赖本地解析结果，覆盖语法错误、变量问题和部分语义问题。

错误诊断中心会从远程 FluffOS 服务拉取编译错误和运行时错误，并在 Activity Bar 的 LPC 视图中展示。

## 编译服务器与接口

如果你在维护配套服务端接口，可以参考下面的默认约定。

### 编译接口

编译当前文件时使用：

- `POST /update_code/update_file`

### 错误诊断中心接口

错误树会访问：

- `GET /error_info/get_compile_errors`
- `GET /error_info/get_runtime_errors`
- `GET /error_info/clear_all_errors`

如果你的服务端接口命名不同，需要自行做兼容适配。

## 配置项

### 项目配置

- `lpc-support.json`
- `configHellPath`
- `resolved.includeDirectories`
- `resolved.simulatedEfunFile`
- `playerObjectPath`

### 编译

- `compile.mode`
- `compile.local.useSystemCommand`
- `compile.local.lpccpPath`
- `compile.remote.activeServer`
- `compile.remote.servers`

### 诊断

- `lpc.enableUnusedGlobalVarCheck`
- `lpc.enforceLocalVariableDeclarationAtBlockStart`

### 性能

- `lpc.performance.debounceDelay`
- `lpc.performance.maxCacheSize`
- `lpc.performance.maxCacheMemory`
- `lpc.performance.enableMonitoring`
- `lpc.performance.completionMetricHistorySize`
- `lpc.performance.enableAsyncDiagnostics`
- `lpc.performance.batchSize`

### 格式化

- `lpc.format.indentSize`

### Javadoc / GLM-4

- `lpc.javadoc.enableAutoGeneration`
- `lpc.glm4.apiKey`
- `lpc.glm4.model`
- `lpc.glm4.allowCustomModel`
- `lpc.glm4.baseUrl`
- `lpc.glm4.timeout`
- `lpc.glm4.alwaysShowModelSelector`
- `lpc.glm4.rememberLastModel`
- `lpc.glm4.lastSelectedModel`
- `lpc.glm4.customModels`

## 快捷键

- `Ctrl+/`：行注释
- `Shift+Alt+A`：块注释
- `Ctrl+F5`：编译当前 LPC 文件
- `F12`：跳转到定义
- `Alt+F12`：查看定义

## Javadoc 注释格式

扩展识别的注释标签包括：

- `@brief`
- `@details`
- `@param`
- `@return`
- `@note`

示例：

```c
/**
 * @brief 函数简要说明
 * @param type name 参数说明
 * @return type 返回值说明
 * @note 补充说明
 */
```

## 常见问题

- 宏定义无法识别：检查 `resolved.includeDirectories`
- 模拟函数库文档未生效：检查 `resolved.simulatedEfunFile`
- `this_player()` 无法推导：检查 `playerObjectPath`
- 编译失败：检查当前 `compile.mode`、服务器地址或 `lpccp` 路径
- 启动驱动失败：确认 `lpcprj` 已安装并可从终端执行
- 跳转或补全结果不准确：尝试重新打开文件或重载 VS Code 窗口

## 致谢

**核心开发**

- @ludexiang
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
