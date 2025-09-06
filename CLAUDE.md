# LPC Support 项目 - Claude 规则配置

## 基础环境约束
1. 由于你处于 WSL 环境下，无法进行独立的测试，所以如果你想进行任何测试，在脑海中模拟即可。

## 基础行为准则
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one  
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User

## 项目级别子规则声明

### 何时使用专门的子规则：

1. **代码解析与AST处理** - 使用 `lpc-ast-agent`
   - 涉及 ANTLR4 语法解析器相关代码修改
   - AST 遍历和语法树操作
   - 语义分析和符号表处理
   - 解析缓存机制优化

2. **语言服务功能开发** - 使用 `lpc-language-service-agent`
   - 代码补全、定义跳转、引用查找
   - 语义高亮和符号提供器
   - 重命名和格式化功能
   - 跨文件分析和继承关系处理

3. **诊断与代码质量** - 使用 `lpc-diagnostics-agent`
   - 错误检测和诊断收集器
   - 未使用变量分析
   - Apply 函数验证
   - 代码质量检查规则

4. **FluffOS 集成与编译** - 使用 `lpc-compiler-agent`
   - 远程编译功能
   - 服务器管理和配置
   - 错误报告和诊断中心
   - HTTP 接口集成

5. **AI 集成与文档生成** - 使用 `lpc-ai-docs-agent`
   - GLM-4 客户端集成
   - JavaDoc 自动生成
   - 函数文档面板
   - AI 代码注释生成

6. **配置管理与性能优化** - 使用 `lpc-config-performance-agent`
   - 扩展配置管理
   - 性能统计和缓存优化
   - 宏定义管理
   - 路径配置和工作区设置

## 子规则定义

### lpc-ast-agent 规则
专门处理 ANTLR4 解析器、AST 操作和语法分析相关任务。

**使用场景：**
- 修改或扩展 `/src/antlr/` 中的 ANTLR4 生成文件
- 编辑 `/grammar/` 中的语法定义文件 (.g4)
- 涉及 `/src/ast/` 目录下的 AST 管理器和符号表
- 解析缓存机制 (`/src/parseCache.ts`) 的优化
- 语法树遍历和访问器模式的实现

**技术约束：**
- 熟悉 ANTLR4 语法和 Visitor 模式
- 理解 LPC 语言的语法结构和语义规则
- 考虑解析性能和内存占用
- 保持与现有 AST 结构的兼容性

### lpc-language-service-agent 规则
专门处理 VS Code 语言服务功能开发。

**使用场景：**
- 代码补全功能 (`/src/completionProvider.ts`)
- 定义跳转和引用查找 (`/src/definitionProvider.ts`, `/src/referenceProvider.ts`)
- 语义高亮 (`/src/semanticTokensProvider.ts`)
- 符号提供器 (`/src/symbolProvider.ts`)
- 重命名功能 (`/src/renameProvider.ts`)
- 跨文件分析和 include/inherit 处理

**技术约束：**
- 遵循 VS Code 语言服务 API 规范
- 确保功能的响应性能和用户体验
- 处理大型项目时的内存和性能优化
- 支持 LPC 特有的语言特性（inherit, include 等）

### lpc-diagnostics-agent 规则
专门处理代码诊断、错误检测和代码质量分析。

**使用场景：**
- 诊断系统核心 (`/src/diagnostics.ts`)
- 各类收集器 (`/src/collectors/` 目录)
- 未使用变量分析和全局变量检查
- Apply 函数返回类型验证
- 代码质量检查规则开发

**技术约束：**
- 确保诊断的准确性，避免误报
- 考虑 FluffOS 特有的语言规则和约定
- 实现异步诊断以提升性能
- 支持配置化的检查规则

### lpc-compiler-agent 规则
专门处理 FluffOS 服务器集成、远程编译和错误报告功能。

**使用场景：**
- 编译器接口 (`/src/compiler.ts`)
- 服务器管理和错误树 (`/src/errorTreeDataProvider.ts`)
- HTTP 通信和远程编译功能
- 批量编译和错误诊断中心

**技术约束：**
- 处理网络通信的错误和超时情况
- 确保与 FluffOS HTTP 接口的兼容性
- 支持多服务器环境的管理
- 提供清晰的编译结果和错误信息展示

### lpc-ai-docs-agent 规则
专门处理 AI 集成、文档生成和智能注释功能。

**使用场景：**
- GLM-4 客户端 (`/src/glm4Client.ts`)
- JavaDoc 处理器 (`/src/utils/javaDocProcessor.ts`)
- 函数文档面板 (`/src/functionDocPanel.ts`)
- 自动注释生成和函数文档解析

**技术约束：**
- 确保 API 调用的安全性和错误处理
- 支持用户自定义的 AI 模型配置
- 处理文档格式的标准化和一致性
- 提供优雅的用户交互界面

### lpc-config-performance-agent 规则
专门处理配置管理、性能优化和工作区设置。

**使用场景：**
- 配置管理 (`/src/config.ts`)
- 宏定义管理 (`/src/macroManager.ts`)
- 性能统计和缓存优化
- 路径解析和工作区配置

**技术约束：**
- 确保配置的向后兼容性
- 实现高效的配置缓存和更新机制
- 支持项目级和用户级配置
- 提供清晰的配置验证和错误提示

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