# LPC Support

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

专业的 LPC (LPMud Creation Language) 语言开发工具，基于 ANTLR4 语法分析架构，为 FluffOS MUD 开发提供完整的 IDE 支持。

## ✨ 核心特性

### 🎯 语言支持
- **ANTLR4 语法分析**：完整的 LPC 语法解析和 AST 级代码理解
- **智能补全**：函数、变量、宏定义的上下文感知提示
- **定义跳转**：跨文件函数定义查找，支持 inherit/include 导航
- **语义高亮**：精确的语法着色

### ⚡ FluffOS 集成
- **远程编译**：一键编译到服务器，实时错误诊断
- **多服务器管理**：支持多环境配置和快速切换
- **Apply 函数验证**：驱动规范兼容性检查

### 🧠 代码分析
- **变量检测**：未使用变量和全局变量优化建议
- **继承链分析**：深度面向对象结构分析
- **宏定义支持**：自动扫描和智能补全

### 📚 文档与 AI
- **内置 Efun 文档**：FluffOS 函数中文文档库
- **JavaDoc 解析**：模拟函数库文档支持
- **AI 代码生成**：GLM-4 集成，自动生成注释

## 🚀 快速开始

### 安装
1. VS Code 扩展市场搜索 "LPC Support"
2. 点击安装
3. 或命令行：`code --install-extension ludexiang.lpc-support`

### 基础配置

```json
{
  "lpc.includePath": "include",
  "lpc.simulatedEfunsPath": "lib/simul_efun"
}
```

支持项目相对路径或绝对路径。

### 服务器配置
`Ctrl+Shift+P` → `LPC: 管理服务器` → 添加服务器地址

## 📖 主要功能

### 快捷键
- `Ctrl+F5`：编译当前文件
- `F12`：跳转到定义
- `Alt+F12`：查看定义

### Include 导航
- `#include <lib.h>`：全局路径（使用 includePath 配置）
- `include "path/file.h"`：相对路径
点击文件名即可跳转。

### 代码补全
- Efun 和自定义函数提示
- 变量和宏定义补全
- 跨文件 inherit/include 支持

## ⚙️ 配置项

### 核心配置
- `lpc.includePath`：Include 目录路径（支持相对路径）
- `lpc.simulatedEfunsPath`：模拟函数库路径
- `lpc.enableUnusedGlobalVarCheck`：启用全局变量检查（默认 true）

### 性能配置
- `lpc.performance.debounceDelay`：诊断防抖延迟（默认 300ms）
- `lpc.performance.maxCacheSize`：最大缓存文档数（默认 50）

### AI 配置
- `lpc.glm4.apiKey`：GLM-4 API 密钥
- `lpc.javadoc.enableAutoGeneration`：启用自动 JavaDoc 生成

## 🛠️ 服务器集成

FluffOS 服务器需实现 HTTP 接口：`POST /update_file`

## 📝 JavaDoc 格式

```c
/**
 * @brief 函数简要说明
 * @param type name 参数说明
 * @return type 返回值说明
 */
```

## 🔧 常见问题

- **宏定义无法识别**：检查 `lpc.includePath` 配置
- **编译失败**：验证服务器地址和 HTTP 接口
- **补全不工作**：确认文件扩展名（.c/.h/.lpc/.i）
- **导航问题**：验证路径，尝试清理缓存（`LPC: 清理缓存`）

## 🤝 致谢

**核心开发**
- @ludexiang - 项目创始人与主要开发者
- 武侠黎明团队 - 项目需求和测试环境

**技术支持**
- ANTLR4、智谱AI (GLM-4)、FluffOS 社区

**捐赠支持**
感谢涅槃、如月、血河车、店小二、旋转、缘分、幽若、顾青衣、天煞孤星、小桀骜、楚千秋、任翱翔、夏晨、穿穿的光、活着的僵尸等朋友的支持。

## 🔗 链接

- [GitHub](https://github.com/lude2001/lpc-support) | [问题反馈](https://github.com/lude2001/lpc-support/issues)
- [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
- [FluffOS 文档](https://www.fluffos.info)

## 📄 许可证

MIT License

---

**让 LPC 开发更简单！**