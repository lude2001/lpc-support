# LPC Support Extension

一个用于支持 LPC (LPMud Creation) 语言开发的 VSCode 扩展。
A VSCode extension for LPC (LPMud Creation) language development support.

## 功能特性 Features

- 语法高亮 Syntax highlighting
- 代码补全 Code completion
- 代码诊断 Code diagnostics 
- 变量检查 Variable checking
- 宏定义支持 Macro definition support
- 服务器管理 Server management
- 代码格式化 Code formatting

## 安装要求 Requirements

- VSCode 1.95.0 或更高版本 / VSCode 1.95.0 or higher
- Node.js 16.x 或更高版本 / Node.js 16.x or higher

## 扩展设置 Extension Settings

本扩展提供以下设置:
This extension contributes the following settings:

* `lpc.macroPath`: 宏定义文件目录路径 / Macro definition files directory path
* `lpc.servers`: FluffOS 服务器配置 / FluffOS server configurations

## 使用方法 Usage

### 代码补全 Code Completion

提供了大量 LPC 内置函数(efun)的代码补全,包括:
Provides code completion for many LPC built-in functions (efuns), including:

- 缓冲区操作 Buffer operations
- 数组操作 Array operations  
- 字符串处理 String manipulation
- 文件操作 File operations
- 数据库操作 Database operations
- 系统调用 System calls

### 诊断功能 Diagnostics

- 检查未使用的变量 Check unused variables
- 分析函数调用 Analyze function calls
- 检查语法规范 Check syntax conventions
- 验证文件命名 Validate file naming

### 服务器管理 Server Management

- 添加/删除服务器 Add/Remove servers
- 编辑服务器配置 Edit server configurations  
- 切换活动服务器 Switch active server
- 编译文件到服务器 Compile files to server

### 宏定义支持 Macro Support

- 扫描宏定义文件 Scan macro definition files
- 提供宏定义补全 Provide macro completion
- 显示宏定义信息 Show macro information
- 跳转到宏定义 Jump to macro definition

## 已知问题 Known Issues

请在 GitHub 仓库提交问题:
Please submit issues on GitHub repository:

[Issues](https://github.com/your-repo/lpc-support/issues)

## 发布说明 Release Notes

### 0.0.1

- 初始版本发布 Initial release
- 基础功能实现 Basic features implementation

## 更多信息 For More Information

* [LPC 语言文档](https://mud.wiki/LPC)
* [FluffOS 文档](https://www.fluffos.info)
* [扩展源码](https://github.com/your-repo/lpc-support)

**尽情享用!** **Enjoy!**
