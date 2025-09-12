# LPC Support 项目 - Claude 规则配置

## 官方api查看
对于复杂情况，请酌情 use context7查找最佳实践api和文档。

## 基础行为准则
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one  
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User
- 使用中文和用户沟通

## 专用子代理系统

本项目使用专门的 Claude Code 子代理来处理不同领域的任务。基于最佳实践，我们重新设计了三个核心子代理，各自专注于特定的专业领域。

### 可用的子代理

#### 1. **lpc-architect** - 系统架构设计专家
- **职责范围**: 系统架构设计、模块规划、性能优化策略
- **核心能力**:
  - 设计扩展的整体架构和模块划分
  - 制定LSP实现架构和ANTLR4集成方案
  - 规划缓存机制和性能优化策略
  - 设计可插拔的功能模块架构
- **使用场景**: 需要设计新功能模块、重构现有架构、解决性能瓶颈、规划技术路线图
- **输出**: 架构图、模块设计文档、性能优化方案、技术规范

#### 2. **lpc-developer** - 开发实现专家  
- **职责范围**: 代码实现、功能开发、技术集成、问题解决
- **核心能力**:
  - 精通TypeScript/JavaScript和VS Code扩展开发
  - 熟练ANTLR4语法解析和AST处理
  - 掌握LSP协议和语言服务功能实现
  - 深入理解LPC语言特性和方言差异
- **使用场景**: 实现新功能、修复Bug、代码重构、集成第三方库
- **输出**: 高质量的TypeScript代码、功能实现、API集成、技术文档

#### 3. **lpc-tester** - 测试质量保证专家
- **职责范围**: 测试策略、质量保证、代码审查、自动化测试
- **核心能力**:
  - 设计全面的测试计划和策略
  - 编写单元测试、集成测试、E2E测试
  - 建立CI/CD自动化测试流水线
  - 进行代码质量审查和静态分析
- **使用场景**: 编写测试用例、质量审查、性能测试、发布验证
- **输出**: 测试套件、质量报告、测试策略、CI/CD配置

### 子代理协作模式

三个子代理按照软件开发的标准流程协作：

1. **架构设计阶段**: `@lpc-architect` 负责整体设计和技术方案
2. **开发实现阶段**: `@lpc-developer` 负责具体功能实现和编码
3. **测试验证阶段**: `@lpc-tester` 负责质量保证和测试验证

### 子代理使用方式

- **自动选择**: 子代理会根据任务内容自动选择最合适的专家
- **手动调用**: 使用 `@agent-name` 语法直接调用特定子代理
- **浏览选择**: 通过 `/agents` 命令查看所有可用子代理并选择

### 使用示例

```bash
# 架构设计
@lpc-architect 设计一个新的代码格式化模块的架构

# 功能开发  
@lpc-developer 实现LPC函数的智能代码补全功能

# 测试验证
@lpc-tester 为语法解析器编写全面的测试套件
```

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