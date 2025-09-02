# LPC Support - 中文环境下最强大的LPC语言插件

[![Version](https://img.shields.io/visual-studio-marketplace/v/ludexiang.lpc-support?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/ludexiang.lpc-support?color=success)](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)
[![License](https://img.shields.io/github/license/lude2001/lpc-support?color=orange)](https://github.com/lude2001/lpc-support/blob/main/LICENSE)

**LPC Support** 是专为 LPC (LPMud Creation Language) 语言打造的现代化 Visual Studio Code 扩展，采用先进的 ANTLR4 语法分析架构，为 FluffOS MUD 开发者提供完整的 IDE 体验。

## 🚀 核心特性

### 🎯 现代化语言支持
- **基于 ANTLR4 的完整语法分析**：精准解析 LPC 语法，支持所有现代 LPC 特性
- **智能语义着色**：比传统正则表达式更精确的语法高亮
- **跨文件函数跳转**：支持 inherit、include 文件的函数定义查找
- **AST 级别的代码分析**：提供深度的代码理解和诊断

### ⚡ FluffOS MUD 开发优化
- **一键远程编译**：直接编译代码到 FluffOS 服务器，支持批量操作
- **错误诊断中心**：实时显示编译错误并精确定位到源码位置  
- **服务器管理**：多服务器配置管理，快速切换开发环境
- **Apply 函数检查**：确保与 FluffOS 驱动完美兼容

### 🧠 智能代码分析
- **未使用变量检测**：遵循 FluffOS 逻辑，避免内存泄漏
- **全局变量分析**：优化代码结构，提升运行效率
- **继承链深度检索**：支持复杂面向对象结构的方法查找
- **宏定义智能补全**：自动扫描并提示项目中的宏定义

### 📚 中文本土化支持
- **完整中文文档**：内置 FluffOS Efun 函数中文文档
- **在线文档更新**：自动同步最新函数文档和示例
- **模拟函数库支持**：解析 JavaDoc 注释，提供详细函数说明
- **AI 代码生成**：集成智谱 GLM-4，智能生成标准化注释

> ⚠️ **兼容性说明**：本扩展针对 FluffOS 驱动优化，变量检查逻辑与驱动保持一致，确保开发体验的统一性。

## 🏗️ 技术架构

### 基于 ANTLR4 的现代化解析器
- **完整语法定义**：包含词法分析器 (LPCLexer.g4) 和语法分析器 (LPCParser.g4)
- **AST 遍历分析**：深度解析代码结构，提供精准的语义理解
- **性能优化**：解析缓存机制，防抖和节流优化，支持大型项目开发

### 模块化诊断收集器
- **可扩展架构**：采用 Collector 设计模式，易于添加新的代码检查规则
- **智能分析**：支持未使用变量、Apply 函数返回类型、全局变量等多维度检查
- **实时反馈**：异步诊断处理，提升用户体验

## 💎 独特优势

### 与其他 LPC 插件的差异化
1. **唯一使用 ANTLR4 的 LPC 插件**：提供工业级语法分析能力
2. **完整的 FluffOS 生态支持**：深度集成 FluffOS 特性和工作流
3. **中文优先的本土化**：专为中文 MUD 开发者优化
4. **AI 增强开发**：业界首个集成 AI 辅助的 LPC 开发工具

### 解决的核心痛点
- ✅ **告别手动编译**：一键远程编译，告别 FTP 上传的繁琐流程
- ✅ **精准错误定位**：编译错误直接定位到源码行，提升调试效率
- ✅ **智能代码检查**：减少运行时错误，提高代码质量
- ✅ **跨文件导航**：复杂继承关系一键跳转，理清代码结构


## 🚀 快速开始

### 系统要求
- **Visual Studio Code**: 1.80.0 或更高版本  
- **Node.js**: 16.x 或更高版本（开发环境）
- **FluffOS 服务器**: 支持 HTTP 编译接口

### 安装方式

#### 方法一：VSCode 扩展市场
1. 打开 VSCode 扩展市场
2. 搜索 "LPC Support" 或 "ludexiang"
3. 点击安装并重启 VSCode

#### 方法二：命令行安装
```bash
code --install-extension ludexiang.lpc-support
```

### 首次配置
安装完成后，建议进行以下基础配置：

1. **设置宏定义目录**：`Ctrl+Shift+P` → `LPC: 配置宏定义目录`
2. **配置服务器**：`Ctrl+Shift+P` → `LPC: 管理服务器`  
3. **更新 Efun 文档**：`Ctrl+Shift+P` → `LPC: 更新 Efun 文档`

## ⚙️ 配置指南

### 核心配置项

在 VSCode 设置中配置以下选项以获得最佳体验：

#### 1. 宏定义路径配置
```json
{
  "lpc.includePath": [
    "/mud/include",
    "/mud/include/std",
    "${workspaceFolder}/include"
  ]
}
```

#### 2. 模拟函数库配置  
```json
{
  "lpc.simulatedEfunsPath": "/mud/adm/simul_efun"
}
```

#### 3. AI 功能配置
```json
{
  "lpc.glm4.apiKey": "your-glm4-api-key",
  "lpc.glm4.model": "GLM-4-Flash-250414",
  "lpc.javadoc.enableAutoGeneration": true
}
```

### FluffOS 服务器配置

#### 添加编译服务器
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `LPC: 管理服务器`
3. 点击 "添加服务器" 配置：
   - **名称**: 本地测试服务器
   - **地址**: `http://127.0.0.1:8092`
   - **描述**: FluffOS 开发环境

#### 服务器接口要求
服务器需实现以下 HTTP 接口用于远程编译：

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

### 性能优化配置
```json
{
  "lpc.performance.debounceDelay": 300,
  "lpc.performance.maxCacheSize": 50,
  "lpc.performance.enableAsyncDiagnostics": true
}
```

## 🎯 核心功能使用

### 智能代码补全
- **Efun 函数**: 输入函数名自动显示签名和中文文档
- **宏定义**: 自动识别项目中的宏，支持跳转到定义  
- **自定义函数**: 跨文件函数补全，支持继承链查找
- **变量提示**: 作用域内变量智能提示

### 一键编译和调试
```
Ctrl+F5     # 编译当前文件
F12         # 跳转到定义  
Alt+F12     # 查看定义预览
Ctrl+/      # 行注释切换
```

### 错误诊断中心
- **实时检查**: 语法错误、未使用变量、类型不匹配
- **编译错误**: 服务器编译错误直接定位到源码
- **快速修复**: 提供智能修复建议

### AI 增强功能
1. 选中函数 → 右键 → `生成 Javadoc 注释`
2. 自动分析函数参数和返回值
3. 生成标准化中文注释

## ⌨️ 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+F5` | 编译当前文件 | 一键编译到活动服务器 |
| `F12` | 跳转到定义 | 支持跨文件跳转 |
| `Alt+F12` | 查看定义 | 预览窗口显示定义 |
| `Ctrl+/` | 行注释切换 | LPC 风格注释 |
| `Shift+Alt+A` | 块注释切换 | 多行注释 |

## 🔧 故障排除

### 常见问题解决

**Q: 宏定义无法识别？**
```
A: 检查 lpc.includePath 配置是否正确
   命令面板 → "LPC: 配置宏定义目录"
```

**Q: 编译失败或无响应？**  
```
A: 1. 确认服务器地址和端口正确
   2. 检查服务器 HTTP 接口是否实现
   3. 查看 VSCode 输出面板的详细错误
```

**Q: 代码补全不工作？**
```
A: 1. 确认文件扩展名为 .c/.h/.lpc/.i
   2. 等待语言服务初始化完成
   3. 重启 VSCode 或执行 "开发者: 重新加载窗口"
```

**Q: 跨文件跳转失败？**
```
A: 1. 检查 inherit/include 路径是否正确
   2. 确保目标文件存在且可访问
   3. 清理解析缓存: "LPC: 清理解析缓存"
```

## 🔗 相关资源

- **项目地址**: [GitHub Repository](https://github.com/lude2001/lpc-support)
- **问题反馈**: [Issues](https://github.com/lude2001/lpc-support/issues)  
- **LPC 文档**: [MUD Wiki](https://mud.wiki/LPC) - 本扩展自动同步的文档源
- **FluffOS 官方**: [FluffOS.info](https://www.fluffos.info) - 驱动文档参考

## 📋 版本历史

### [0.1.4] - 2025-01-15 (最新版)
**🔥 重大更新：跨文件函数跳转功能大幅增强**
- ✨ 增强 `.h` 头文件中函数原型声明解析支持  
- 🚀 改进 `include` 语句文件路径解析，支持相对/绝对路径
- ⚡ 添加头文件函数索引缓存机制，显著提升性能
- 🎯 支持从 `.c` 文件跳转到 `.h` 文件函数声明
- 🔧 支持 C 风格 `#include` 和 LPC 风格 `include` 语句

### [0.1.3] - 2025-01-15  
**📝 include 语法完整支持**
- 🆕 在 ANTLR4 语法中添加 `INCLUDE` 关键字和 `includeStatement` 规则
- 🔄 支持 `include "filename";` 和 `include expression;` 语法
- ⚡ 提升 LPC 语言特性完整性和兼容性

### [0.1.2] - 2025-08-26
**📋 错误管理功能增强**  
- 🆕 错误信息复制功能，支持右键复制完整错误详情
- 🎯 提升错误处理工作流程和可访问性

### [0.1.1] - 2025-08-25
**🎛️ 诊断系统优化**
- ❌ 移除函数参数使用检查，减少不必要的警告
- ⚡ 优化诊断系统性能，提升开发体验

### [0.0.4] - 2025-05-31
**🔍 文档和继承功能**
- 📚 模拟函数库文档支持扩充
- 🔗 深度继承链支持和方法文档检索  
- ⌨️ 新增 `Ctrl+F5` 快捷编译功能

### [0.0.3] - 2025-02-25  
**🧠 智能补全升级**
- 🎯 上下文变量和函数智能提示
- 📖 继承链 JavaDoc 文档智能提示
- 🔧 修复宏定义和诊断相关问题

### [0.0.2] - 2025-01-25
**🎉 初始发布版本**
- ✨ 基础功能实现：语法高亮、代码补全、诊断
- 🖥️ 服务器管理和 Efun 文档支持

## 📚 模拟函数库 JavaDoc 规范

为支持智能代码提示，请按照以下 JavaDoc 格式编写函数注释：

```c
/**
 * @brief 创建一个299类型的消息(用于特殊提示)
 * @param string title 消息标题  
 * @param string msg 消息内容
 * @return string JSON格式的消息字符串
 */
string msg299(string title, string msg) {
    mapping jsonData = ([]);
    jsonData["code"] = 299;
    jsonData["title"] = title; 
    jsonData["msg"] = replace_string(msg, "\n", ZJBR);
    return json_encode(jsonData) + "\n";
}
```

### 注释标签说明
- **`@brief`**: 函数功能简述
- **`@param 类型 参数名 描述`**: 参数说明  
- **`@return 类型 描述`**: 返回值说明

### 获得的好处  
✅ 智能代码补全时显示完整函数文档  
✅ 鼠标悬停显示详细参数和返回值信息  
✅ 支持继承链中的文档查找  
✅ 便于自动生成 API 文档

## 🤝 特别鸣谢

本项目的成功离不开以下个人和组织的支持与贡献：

### 🎯 核心开发团队
- **@ludexiang** - 项目创始人与主要开发者，ANTLR4 语法分析架构设计
- **武侠黎明团队** - 提供项目初始需求和测试环境

### 🔧 技术支持
- **ANTLR4 开源项目** - 提供强大的语法分析框架
- **智谱AI (GLM-4)** - 提供AI代码生成能力支持  
- **FluffOS 社区** - 提供驱动兼容性指导和测试

### 📚 文档与资源
- **MUD Wiki 社区** - 提供完整的LPC函数文档资源
- **FluffOS.info** - 提供官方驱动文档和技术支持
- **中文MUD开发者社区** - 提供宝贵的反馈和建议

### 🧪 开发资金捐赠支持
- 涅槃、如月、血河车、店小二、旋转、缘分、幽若、顾青衣、天煞孤星、小桀骜、楚千秋、任翱翔、夏晨、穿穿的光......等。


### 🌟 开源精神
特别感谢所有开源软件的贡献者们，正是因为开源社区的无私分享，才让我们能够构建出这样功能强大的开发工具。
感谢所有参与测试、提供Bug反馈和功能建议的开发者们，你们的贡献让这个插件变得更加完善。
---

## 🛠️ FluffOS 服务器接口集成

如需启用远程编译功能，FluffOS 服务器需实现 HTTP 编译接口：

```c
// POST /update_file  
mapping update_file(string file_name) {
    mapping result = ([]);
    result["code"] = "update_file";
    result["file_name"] = file_name;
    result["msg"] = compile_result_message; // 编译结果
    return result;
}
```

详细的服务器端集成指南请参考项目 Wiki 或联系开发团队。

---

## 📄 开源许可

本项目采用 [MIT 许可证](LICENSE) 开源，欢迎贡献代码和提出改进建议。

## 💌 联系我们

- **GitHub Issues**: [提交问题和功能请求](https://github.com/lude2001/lpc-support/issues)
- **项目主页**: [LPC Support on GitHub](https://github.com/lude2001/lpc-support)
- **VSCode 市场**: [扩展页面](https://marketplace.visualstudio.com/items?itemName=ludexiang.lpc-support)

---

<div align="center">

**🎉 让 LPC 开发更简单，让 MUD 世界更精彩！**

如果这个插件对您有帮助，请考虑给我们一个 ⭐ Star！

[⬆️ 回到顶部](#lpc-support---中文环境下最强大的lpc语言插件)

</div>

