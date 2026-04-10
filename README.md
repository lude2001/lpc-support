# LPC Support

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

LPC Support 是一个面向 VS Code 的 LPC / FluffOS 开发扩展，覆盖日常开发中常用的编辑、导航、诊断、函数文档和编译能力。

当前版本基于 ANTLR4 解析链路实现，生产主路径按 `ParsedDocument`、`SyntaxDocument` 和 `SemanticSnapshot` 分层组织，重点支持 FluffOS 项目中的 `.c`、`.h`、`.lpc`、`.i` 文件。

如果你想先理解这个项目背后的设计目标、开发范式和作者判断，可以先看：

- 中文版：[`docs/lpc-support-development-paradigm.md`](D:/code/lpc-support/docs/lpc-support-development-paradigm.md)
- English: [`docs/lpc-support-development-paradigm.en.md`](D:/code/lpc-support/docs/lpc-support-development-paradigm.en.md)

## 主要能力

### 语言支持

- LPC 语法高亮
- 语义标记
- 文档大纲
- 代码折叠
- 代码片段
- 文档格式化与选区格式化

### 补全与文档

- 关键字、类型、修饰符补全
- 标准 efun 补全和悬停文档
- 模拟函数库文档解析与补全
- 当前文件、继承文件、include 文件中的函数文档悬停
- 结构体成员补全和链式成员访问补全
- 函数文档面板

### 跳转与重构

- 跳转到函数定义
- 跳转到变量声明
- 跳转到宏定义
- include 文件跳转
- 引用查找
- 当前文件范围内的符号重命名

### 诊断与分析

- ANTLR 语法错误诊断
- 未使用局部变量检查
- 未使用参数检查
- 未使用全局变量检查
- 局部变量声明位置检查
- 宏使用检查
- 对象访问相关检查
- 继承关系扫描
- 文件夹批量扫描
- 变量列表查看

### 编译与运行辅助

- 编译当前 LPC 文件
- 批量编译目录中的 `.c` 文件
- 编译管理（本地 `lpccp` / 远程 HTTP）
- 错误诊断中心视图
- 启动开发驱动（通过 `lpcprj config`）

### 注释生成

- 函数签名解析
- Javadoc 风格注释生成
- 支持通过 GLM-4 生成注释内容

## 安装

可以通过以下方式安装：

1. 在 VS Code 扩展市场搜索 `LPC[FluffOS]` 或 `ludexiang.lpc-support`
2. 命令行安装：`code --install-extension ludexiang.lpc-support`
3. 使用本地 `.vsix` 文件安装

## 开发环境支持

本项目不仅提供 VS Code 扩展本体，也提供围绕 LPC / FluffOS 开发环境的一整套配套资源：

- `external_system_package/`
  - 提供可安装到 Mudlib 根目录的 external system package
  - 包内的 [`package_install.md`](D:/code/lpc-support/external_system_package/package_install.md) 约定了 Claude Code、Codex、Cursor 等 AI 助手如何根据工作区的 `lpc-support.json` 与 `version.json` 自动完成安装
- FluffOS 开发环境 fork
  - 本项目同时维护了用于开发环境的 FluffOS fork：[`https://github.com/lude2001/fluffos`](https://github.com/lude2001/fluffos)
  - 如果你不想和 FluffOS 官方主分支互相干扰，可以直接基于这个 fork 自行再 fork 并编译开发驱动
- 开发驱动环境安装包（预览版）
  - 请前往 [GitHub Releases](https://github.com/lude2001/lpc-support/releases) 获取开发驱动环境安装包
  - 安装完成后可将 `lpcprj` 与 `lpccp` 暴露为全局命令，供扩展的“启动驱动”和本地 `lpccp` 编译模式直接使用

如果你希望自己编译开发驱动，推荐流程是：

1. fork [`https://github.com/lude2001/fluffos`](https://github.com/lude2001/fluffos)
2. 在你自己的 fork 中编译开发环境 driver
3. 再通过 `lpc-support.json -> compile.local` 把 `lpccp` 与对应 config 接到当前工作区

## 快速开始

从 `0.3.0` 开始，推荐在项目根目录使用 `lpc-support.json` 作为项目级配置入口，而不是手工维护 `lpc.includePath`、`lpc.simulatedEfunsPath` 等旧版设置。

### 推荐方式：项目级配置

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
- `compile` 用于统一管理本地 `lpccp` 编译与远程 HTTP 编译
- `resolved` 由扩展自动根据 `config.hell` 同步和回写，一般不需要手工维护
- `lastSyncedAt` 也会由扩展自动更新
- 如果项目中仍在使用旧版 `lpc.*` 设置，扩展会提示迁移到 `lpc-support.json`

### 旧版配置兼容

旧配置在当前版本仍可继续工作，但更适合作为兼容层；新项目建议优先使用 `lpc-support.json`：

```json
{
  "lpc.includePath": "include",
  "lpc.simulatedEfunsPath": "lib/simul_efun",
  "lpc.enforceLocalVariableDeclarationAtBlockStart": false
}
```

如果项目之前使用旧的全局编译服务器配置，扩展会在首次打开“编译管理”或首次编译时，将远程服务器迁移到当前工作区的 `lpc-support.json`。

### 编译管理

扩展现在统一使用“编译管理”入口来管理编译后端：

- 远程编译：继续使用原有 HTTP 编译接口
- 本地编译：通过 `lpccp` 连接已启动的 driver
- 首次进入编译管理或首次执行编译时，会自动尝试把旧的全局远程服务器配置迁移到当前工作区

本地 `lpccp` 模式支持两种配置方式：

1. 勾选“使用系统命令”，直接调用环境变量中的 `lpccp`
2. 显式设置 `lpccp` 可执行文件路径

本地模式不需要单独配置 `driver config` 路径。扩展会自动使用工作区内 `lpc-support.json` 的 `configHellPath`，并拼出实际传给 `lpccp` 的配置文件路径。

例如：

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

### 启动驱动

扩展的“启动 MUD 驱动”命令现在固定通过系统命令 `lpcprj config` 启动开发驱动。

- 你的系统需要先安装开发驱动环境（预览版），并保证 `lpcprj` 可直接从命令行调用
- 如果未检测到 `lpcprj`，扩展只会弹出提示，并要求你前往 GitHub 获取安装包
- 扩展不再支持通过 `lpc.driver.command` 自定义旧版启动命令

## 常用命令

扩展注册了以下主要命令：

- 启动 MUD 驱动（调用 `lpcprj config`）
- 显示所有 LPC 变量
- 扫描文件夹中未使用的变量
- 编译 LPC 文件
- 批量编译 LPC 文件
- 编译管理
- 添加远程编译服务器
- 选择活动远程编译服务器
- 删除远程编译服务器
- 兼容入口 `lpc.manageServers`（转发到“编译管理”）
- 配置宏定义目录
- 配置模拟函数库目录
- 迁移项目配置到 `lpc-support.json`
- 显示函数文档面板
- 生成 Javadoc 注释

此外还提供错误树相关命令，包括刷新、清空错误、打开错误位置和复制错误信息。

## 编辑器行为

### 格式化

扩展提供 LPC 文档格式化和选区格式化，当前版本重点覆盖：

- 函数、`if/else`、循环和匿名函数的 Allman 风格换行
- `mapping`、数组和 `new(..., field : value)` 结构化数据块布局
- `struct/class` 定义、`switch` 范围标签和常见 `foreach` 头部整理
- heredoc、复杂多行宏等高风险结构的保守处理

当前可用的格式化配置：

- `lpc.format.indentSize`：控制缩进宽度，默认值为 `4`

### 补全

补全数据主要来自以下几类来源：

- LPC 关键字、类型和修饰符
- 标准 efun 离线文档
- 模拟函数库扫描结果
- 当前文件语义快照（由 parser / syntax / semantic 链路生成）
- 继承文件中的函数
- 结构体成员和对象常用方法
- 对象推导器提供的真实方法补全（详见"对象推导器"章节）
- 预处理指令片段

### 悬停

悬停文档的优先级大致如下：

1. 当前文件函数文档
2. 继承文件函数文档
3. include 文件函数文档
4. 模拟函数库文档
5. 标准 efun 文档

标准 efun 文档以扩展内置离线数据为主，缺失项会按需回退到 `mud.wiki`。

### 对象推导器

当你在 LPC 代码中写出 `obj->method()` 时，扩展可以推导 `obj` 实际指向的对象文件，从而启用以下能力：

- **跳转到定义**：在 `method()` 上按 F12，可以直接跳转到被推导对象（含继承链）中的实际实现
- **成员补全**：输入 `obj->` 后，被推导对象的真实方法会出现在补全列表中；当存在多个候选对象时，共享方法会排在前面
- **悬停提示**：鼠标悬停在 `method()` 上，会显示来自被推导对象的方法签名和文档；当存在多个实际实现时，会按实现分别显示独立的悬停块

#### 支持的推导规则

| 写法 | 推导结果 | 示例 |
|------|---------|------|
| 字符串字面量 `"/path/obj"->method()` | 直接解析路径 | `"/obj/user"->query_name()` |
| 宏标识符 `COMBAT_D->method()` | 通过宏展开解析路径 | 当 `COMBAT_D` 被定义为 `"/adm/daemons/combat_d"` 时 |
| `this_object()->method()` | 当前文件路径 | |
| `this_player()->method()` | 配置的 `playerObjectPath` | 需要在 `lpc-support.json` 中配置 |
| `load_object(path)->method()` | 解析参数路径 | `load_object("/obj/npc")` |
| `find_object(path)->method()` | 同 `load_object` | |
| `clone_object(path)->method()` | 同 `load_object` | |
| 变量追踪 | 沿赋值链推导 | `ob = load_object("/obj/npc"); ob->method()` |
| `if/else` 合并 | 多候选 | 不同分支赋不同对象时合并为多候选 |
| `@lpc-return-objects` | 自定义函数返回对象 | 支持跨文件 `c = B->method(); c->query_xxx()` 继续传播 |

#### 当前版本未覆盖的场景

- `arr[i]->method()` — 数组下标访问（标记为 `unsupported`）
- 动态拼接路径 — 如 `load_object("/obj/" + name)`
- 跨函数变量追踪 — 仅限当前函数内

#### 配置 `this_player()` 推导

在 `lpc-support.json` 中添加 `playerObjectPath`：

```json
{
  "version": 1,
  "configHellPath": "config.hell",
  "playerObjectPath": "/obj/user"
}
```

此配置告诉扩展 `this_player()` 返回的是 `/obj/user.c` 的实例。扩展会按当前文档所在 workspace 读取对应的 `playerObjectPath`；未配置时，`this_player()->method()` 不会触发对象推导。

#### `@lpc-return-objects` 注解

你可以为返回对象实例的自定义函数添加注解：

```c
/**
 * @lpc-return-objects {"/obj/weapon", "/obj/armor"}
 */
object get_equipment(string type) {
    // ...
}
```

此后 `get_equipment("sword")->query_damage()` 会解析到 `/obj/weapon.c` 和 `/obj/armor.c` 的方法。

`@lpc-return-objects` 也支持跨文件对象方法返回传播：当 `B->method()` 的实际实现已经通过注释标注返回对象时，`c = B->method(); c->query_xxx()` 会继续沿返回对象候选做补全、跳转和悬停。

当接收者存在多个候选对象时，扩展会分别分派到每个候选对象中的实际实现，并合并这些实现声明的返回对象候选。

如果其中任一实际实现缺少 `@lpc-return-objects`，扩展会保守降级为 unknown，避免把不完整信息误当成确定结论；悬停中也会明确说明是哪一类实现缺少返回对象标注。

### 定义跳转

定义跳转支持：

- 当前文件函数和变量
- 继承文件函数
- include 头文件
- 宏定义
- 模拟函数库函数
- `OBJECT->method`、宏路径和字符串路径形式的跨文件方法解析
- 基于对象推导器的跨文件方法解析（详见"对象推导器"章节）

### 重命名与快速修复

扩展提供：

- 当前文件标识符重命名
- 未使用变量删除
- 未使用变量注释
- 将变量标记为全局变量
- 蛇形 / 驼峰重命名建议
- 将局部变量声明移动到代码块或函数开头

## 函数文档系统

函数文档系统由两部分组成：

- 标准 efun 文档：内置离线数据，发布时随扩展打包
- 模拟函数库文档：从本地目录中的 `.c` / `.h` 文件和 Javadoc 注释解析生成

文档展示位置包括：

- 补全文档
- 编辑器悬停
- 函数文档面板

函数文档面板会读取当前文件、继承文件和 include 文件中的函数定义，并支持跳转到定义或直接触发 Javadoc 生成。

## 诊断与错误查看

扩展内部包含两类与错误相关的能力：

- 编辑器内静态诊断
- 远程错误诊断中心

静态诊断依赖本地解析结果，覆盖语法错误、变量问题和部分语义问题。

错误诊断中心会从远程 FluffOS 服务拉取编译错误和运行时错误，并在 Activity Bar 的 LPC 视图中展示。

## 编译服务器与接口

编译和错误查看依赖服务端接口。

### 编译接口

编译当前文件时使用：

- `POST /update_code/update_file`

请求体中会携带基于工作区相对路径转换得到的 MUD 路径。

### 错误诊断中心接口

错误树会访问：

- `GET /error_info/get_compile_errors`
- `GET /error_info/get_runtime_errors`
- `GET /error_info/clear_all_errors`

如果你的服务端接口命名不同，需要自行做兼容适配。

## 配置项

### 项目与兼容配置

- `lpc-support.json`
- `lpc-support.json -> configHellPath`
- `lpc-support.json -> resolved.includeDirectories`
- `lpc-support.json -> resolved.simulatedEfunFile`
- `lpc-support.json -> playerObjectPath`
- `lpc.includePath`
- `lpc.simulatedEfunsPath`

### 编译管理

- `lpc-support.json -> compile.mode`
- `lpc-support.json -> compile.local.useSystemCommand`
- `lpc-support.json -> compile.local.lpccpPath`
- `lpc-support.json -> compile.remote.activeServer`
- `lpc-support.json -> compile.remote.servers`

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

- 宏定义无法识别：优先检查 `lpc-support.json -> resolved.includeDirectories`；尚未迁移旧项目时再检查 `lpc.includePath`
- 模拟函数库文档未生效：优先检查 `lpc-support.json -> resolved.simulatedEfunFile`；尚未迁移旧项目时再检查 `lpc.simulatedEfunsPath`
- 标准 efun 文档缺项：扩展会优先用内置文档，缺失时才按需回退查询 `mud.wiki`
- 编译失败：先确认当前 `compile.mode` 是 `local` 还是 `remote`；远程模式检查服务器地址和接口路径，本地模式检查 `lpccp` 与目标 driver 是否已启动且使用同一个 `config.hell`
- 启动驱动提示缺少 `lpcprj`：请前往 [GitHub Releases](https://github.com/lude2001/lpc-support/releases) 安装开发驱动环境（预览版），并确认安装后可在终端中直接执行 `lpcprj`
- 错误诊断中心为空：检查 `lpc-support.json -> compile.remote.servers`、`compile.remote.activeServer` 以及服务端错误接口是否可用
- 跳转或补全不准确：先尝试重新打开文件或重新加载窗口
- 局部变量位置提示与 FluffOS 代码习惯不一致：将 `lpc.enforceLocalVariableDeclarationAtBlockStart` 保持为默认 `false`

## 致谢

**核心开发**
- @ludexiang - 项目创始人与主要开发者
- 武侠黎明团队 - 项目需求和测试环境

**技术支持**
- ANTLR4、智谱AI (GLM-4)、FluffOS 社区

**捐赠支持**
感谢涅槃、如月、血河车、店小二、旋转、缘分、幽若、顾青衣、天煞孤星、小桀骜、楚千秋、任翱翔、夏晨、穿穿的光、活着的僵尸等朋友的支持。

## 链接

- [GitHub](https://github.com/lude2001/lpc-support)
- [问题反馈](https://github.com/lude2001/lpc-support/issues)
- [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
- [FluffOS 文档](https://www.fluffos.info)

## 许可证

MIT License
