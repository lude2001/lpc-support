# LPC Support 项目 - Claude 规则配置

## 基础环境约束
1. 由于你处于 WSL 环境下，无法进行独立的测试，所以如果你想进行任何测试，在脑海中模拟即可。

## 基础行为准则
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one  
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User
- 使用中文和用户沟通

## 专用子代理系统

本项目使用专门的 Claude Code 子代理来处理不同领域的任务。每个子代理都有特定的专业领域和职责范围。

### 可用的子代理

1. **lpc-ast-agent** - 代码解析与AST处理
   - ANTLR4 语法解析器相关代码修改
   - AST 遍历和语法树操作
   - 语义分析和符号表处理
   - 解析缓存机制优化

2. **lpc-language-service-agent** - 语言服务功能开发
   - 代码补全、定义跳转、引用查找
   - 语义高亮和符号提供器
   - 重命名和格式化功能
   - 跨文件分析和继承关系处理

3. **lpc-diagnostics-agent** - 诊断与代码质量
   - 错误检测和诊断收集器
   - 未使用变量分析
   - Apply 函数验证
   - 代码质量检查规则

4. **lpc-compiler-agent** - FluffOS 集成与编译
   - 远程编译功能
   - 服务器管理和配置
   - 错误报告和诊断中心
   - HTTP 接口集成

5. **lpc-ai-docs-agent** - AI 集成与文档生成
   - GLM-4 客户端集成
   - JavaDoc 自动生成
   - 函数文档面板
   - AI 代码注释生成

6. **lpc-config-performance-agent** - 配置管理与性能优化
   - 扩展配置管理
   - 性能统计和缓存优化
   - 宏定义管理
   - 路径配置和工作区设置

### 子代理使用方式

子代理会根据任务内容自动选择，或者可以通过 `/agents` 命令查看和手动选择特定的子代理。

## 通用开发准则

### 代码质量要求：
- 遵循 TypeScript 严格模式
- 使用现有的工具函数和实用程序
- 保持代码的模块化和可测试性
- 添加适当的错误处理和日志记录

### 性能考虑：
- 使用防抖机制处理高频操作
- 实现适当的缓存策略
- 异步处理大型文件和批量操作
- 监控内存使用和解析性能

### 用户体验：
- 提供清晰的进度指示和错误信息
- 支持配置化的功能开关
- 确保操作的可逆性和安全性
- 遵循 VS Code UX 指南

### 兼容性要求：
- 支持 VS Code 1.80.0+ 版本
- 兼容不同操作系统 (Windows/Linux/macOS)
- 保持与 FluffOS 驱动的兼容性
- 支持各种 LPC 方言和项目结构

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.