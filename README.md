# LPC Support - 专业的 LPC 语言开发工具

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

**LPC Support** 是专为 LPC (LPMud Creation Language) 语言设计的现代化 Visual Studio Code 扩展。基于先进的 ANTLR4 语法分析架构，为 FluffOS MUD 开发者提供完整的集成开发环境。

## ✨ 核心特性

### 🎯 现代化语言支持
- **ANTLR4 语法分析器**：完整的 LPC 语法解析，支持 AST 级别的代码理解
- **智能语义高亮**：精确的语法着色，超越传统正则表达式匹配
- **跨文件定义跳转**：支持 inherit、include 文件间的函数定义查找
- **Include 文件导航**：点击 include 语句直接跳转到目标文件
- **智能代码补全**：上下文感知的函数、变量和宏定义提示

### ⚡ FluffOS 集成
- **远程编译**：一键编译到 FluffOS 服务器，支持批量操作
- **错误诊断中心**：实时编译错误报告，精确定位源码位置
- **多服务器管理**：支持多个开发环境配置和快速切换
- **Apply 函数验证**：确保与 FluffOS 驱动规范的完全兼容

### 🧠 智能代码分析
- **未使用变量检测**：基于 FluffOS 逻辑的变量使用分析
- **全局变量优化**：识别和优化全局变量使用模式
- **继承链分析**：深度分析复杂的面向对象结构
- **宏定义支持**：自动扫描和智能补全项目宏定义

### 📚 文档与 AI 功能
- **内置 Efun 文档**：完整的 FluffOS 函数中文文档库
- **在线文档同步**：自动更新函数参考和示例
- **JavaDoc 解析**：提取和显示模拟函数库文档
- **AI 代码生成**：集成 GLM-4 AI，自动生成标准化注释

## 🚀 安装与配置

### 系统要求
- Visual Studio Code 1.80.0 或更高版本
- FluffOS 服务器（用于远程编译功能）

### 安装方法

#### 通过 VS Code 扩展市场
1. 打开 VS Code 扩展面板（`Ctrl+Shift+X`）
2. 搜索 "LPC Support" 或 "ludexiang"
3. 点击安装并重启 VS Code

#### 通过命令行
```bash
code --install-extension ludexiang.lpc-support
```

### 基础配置

在 VS Code 设置中配置以下选项：

```json
{
  "lpc.includePath": "include",
  "lpc.simulatedEfunsPath": "lib/simul_efun",
  "lpc.performance.debounceDelay": 300,
  "lpc.performance.maxCacheSize": 50
}
```

### 路径配置说明

扩展支持灵活的路径配置方式：

- **项目相对路径**：`"include"` - 相对于工作区根目录
- **绝对路径**：`"/usr/local/mud/include"` - 系统绝对路径

### FluffOS 服务器配置

1. 打开命令面板（`Ctrl+Shift+P`）
2. 运行 `LPC: 管理服务器`
3. 添加服务器配置：
   - **名称**：开发服务器
   - **地址**：`http://127.0.0.1:8092`

## 📖 使用指南

### 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+F5` | 编译文件 | 编译当前文件到活动服务器 |
| `F12` | 跳转到定义 | 跨文件函数定义导航 |
| `Alt+F12` | 查看定义 | 在弹出窗口中预览定义 |
| `Ctrl+/` | 行注释切换 | 添加/移除行注释 |
| `Shift+Alt+A` | 块注释切换 | 添加/移除块注释 |

### Include 文件导航

扩展支持两种 include 语法的文件跳转：

1. **全局 include**：`#include <lib.h>` - 使用配置的 `lpc.includePath`
2. **局部 include**：`include "path/file.h"` - 相对于当前文件或项目根目录

点击 include 语句中的文件名即可跳转到目标文件。

### 代码补全功能

- **函数补全**：所有 efun 和自定义函数的智能提示
- **变量补全**：上下文相关的变量建议
- **宏补全**：项目宏定义的自动补全
- **跨文件支持**：支持 inherit 和 include 边界的补全

### 诊断功能

- **语法错误**：实时语法验证
- **未使用变量**：检测未使用的局部和全局变量
- **类型不匹配**：识别类型相关的问题
- **Apply 函数验证**：确保正确的 apply 函数签名

## ⚙️ 配置参考

### 核心配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `lpc.includePath` | string | `""` | LPC include 目录路径（支持相对路径） |
| `lpc.simulatedEfunsPath` | string | `""` | 模拟函数库路径（支持相对路径） |
| `lpc.enableUnusedGlobalVarCheck` | boolean | `true` | 启用未使用全局变量检查 |

### 性能配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `lpc.performance.debounceDelay` | number | `300` | 诊断防抖延迟（毫秒） |
| `lpc.performance.maxCacheSize` | number | `50` | 最大缓存文档数 |
| `lpc.performance.enableAsyncDiagnostics` | boolean | `true` | 启用异步诊断 |

### AI 集成配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `lpc.glm4.apiKey` | string | `""` | GLM-4 API 密钥 |
| `lpc.glm4.model` | string | `"GLM-4-Flash-250414"` | GLM-4 模型选择 |
| `lpc.javadoc.enableAutoGeneration` | boolean | `true` | 启用自动 JavaDoc 生成 |

## 🛠️ 服务器集成

为启用远程编译功能，FluffOS 服务器需要实现以下 HTTP 接口：

```c
// POST /update_file
mapping update_file(string file_name) {
    mapping result = ([]);
    result["code"] = "update_file";
    result["file_name"] = file_name;
    result["msg"] = compile_result_message;
    return result;
}
```

## 📝 JavaDoc 文档格式

为获得最佳文档支持，请按以下格式编写模拟函数注释：

```c
/**
 * @brief 创建特殊通知消息
 * @param string title 消息标题
 * @param string msg 消息内容
 * @return string JSON 格式的消息字符串
 */
string msg299(string title, string msg) {
    mapping jsonData = ([]);
    jsonData["code"] = 299;
    jsonData["title"] = title;
    jsonData["msg"] = replace_string(msg, "\n", ZJBR);
    return json_encode(jsonData) + "\n";
}
```

## 🏗️ 技术架构

### ANTLR4 解析器
- **完整语法定义**：包含词法分析器（LPCLexer.g4）和语法分析器（LPCParser.g4）
- **AST 遍历**：深度结构分析，提供精确的代码理解
- **性能优化**：缓存机制和防抖处理

### 模块化诊断
- **收集器模式**：可扩展的架构，便于添加新的诊断规则
- **多维度分析**：变量使用、类型检查和代码质量指标
- **异步处理**：非阻塞诊断，提升用户体验

## 🔧 故障排除

### 常见问题

**宏定义无法识别**
- 验证 `lpc.includePath` 配置
- 确保 include 目录存在且包含头文件
- 使用命令面板：`LPC: 配置宏定义目录`

**编译失败**
- 检查服务器地址和端口配置
- 验证 FluffOS HTTP 接口实现
- 查看 VS Code 输出面板的详细错误

**代码补全不工作**
- 确认文件扩展名为 `.c`、`.h`、`.lpc` 或 `.i`
- 等待语言服务初始化
- 尝试 `开发者: 重新加载窗口` 命令

**跨文件导航问题**
- 验证 inherit/include 路径正确
- 确保目标文件存在且可访问
- 清除解析缓存：`LPC: 清理缓存`

## 🤝 特别鸣谢

### 核心开发团队
- **@ludexiang** - 项目创始人与主要开发者，ANTLR4 语法分析架构设计
- **武侠黎明团队** - 提供项目初始需求和测试环境

### 技术支持
- **ANTLR4 开源项目** - 提供强大的语法分析框架
- **智谱AI (GLM-4)** - 提供 AI 代码生成能力支持
- **FluffOS 社区** - 提供驱动兼容性指导和测试

### 文档与资源
- **MUD Wiki 社区** - 提供完整的 LPC 函数文档资源
- **FluffOS.info** - 提供官方驱动文档和技术支持
- **中文 MUD 开发者社区** - 提供宝贵的反馈和建议

### 开发资金捐赠支持
感谢涅槃、如月、血河车、店小二、旋转、缘分、幽若、顾青衣、天煞孤星、小桀骜、楚千秋、任翱翔、夏晨、穿穿的光、活着的僵尸...等朋友的慷慨捐赠。

### 开源精神
特别感谢所有开源软件的贡献者们，正是因为开源社区的无私分享，才让我们能够构建出这样功能强大的开发工具。感谢所有参与测试、提供 Bug 反馈和功能建议的开发者们，你们的贡献让这个插件变得更加完善。

## 🔗 相关链接

- **GitHub 仓库**：[https://github.com/lude2001/lpc-support](https://github.com/lude2001/lpc-support)
- **问题跟踪**：[https://github.com/lude2001/lpc-support/issues](https://github.com/lude2001/lpc-support/issues)
- **VS Code 市场**：[LPC Support 扩展](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
- **FluffOS 文档**：[https://www.fluffos.info](https://www.fluffos.info)

## 🤝 贡献

欢迎为 LPC Support 的改进做出贡献：

1. Fork 仓库
2. 创建功能分支
3. 提交带有详细描述的 Pull Request

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

---

**让 LPC 开发更简单，让 MUD 世界更精彩！**