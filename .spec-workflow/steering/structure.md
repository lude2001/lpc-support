# Project Structure: LPC Support Extension

## Directory Organization

```
lpc-support/                        # VS Code扩展根目录
├── .spec-workflow/                 # 规范工作流文档 (新增)
│   ├── templates/                  # 文档模板
│   ├── specs/                      # 功能规范文档
│   │   └── lpc-code-formatter/     # 格式化功能规范
│   └── steering/                   # 项目指导文档
│       ├── product.md              # 产品愿景
│       ├── tech.md                 # 技术架构
│       └── structure.md            # 项目结构
├── src/                            # TypeScript源代码
│   ├── antlr/                      # ANTLR4生成的解析器
│   ├── ast/                        # 抽象语法树管理
│   ├── collectors/                 # 代码分析收集器
│   ├── parser/                     # 解析器工具
│   ├── types/                      # 类型定义
│   ├── utils/                      # 通用工具函数
│   ├── test/                       # 测试相关文件
│   └── *.ts                        # 核心功能模块
├── grammar/                        # ANTLR4语法定义
│   ├── LPCLexer.g4                 # 词法分析器语法
│   └── LPCParser.g4                # 语法分析器语法
├── tests/                          # 测试套件
├── syntaxes/                       # TextMate语法高亮
├── snippets/                       # 代码片段
├── config/                         # 配置文件
├── media/                          # 图标和媒体资源
├── 项目文档/                       # 中文项目文档
├── dist/                           # 构建输出目录
├── node_modules/                   # 依赖包
├── package.json                    # 扩展清单
├── tsconfig.json                   # TypeScript配置
├── jest.config.js                  # 测试配置
├── esbuild.mjs                     # 构建配置
├── CLAUDE.md                       # Claude使用指南
└── README.md                       # 项目文档
```

## Naming Conventions

### Files
- **Provider模块**: `PascalCase` + `Provider` 后缀 (例: `CompletionProvider.ts`)
- **Manager类**: `PascalCase` + `Manager` 后缀 (例: `ASTManager.ts`, `MacroManager.ts`)
- **Collector类**: `PascalCase` + `Collector` 后缀 (例: `UnusedVariableCollector.ts`)
- **Utility模块**: `camelCase` + 功能描述 (例: `javaDocProcessor.ts`, `functionUtils.ts`)
- **Core功能**: `camelCase` 描述性名称 (例: `diagnostics.ts`, `extension.ts`)
- **Test文件**: `[filename].test.ts` 或 `[filename].spec.ts`

### Code
- **Classes/Interfaces**: `PascalCase` (例: `LPCDiagnostics`, `SymbolTable`, `FormattingOptions`)
- **Functions/Methods**: `camelCase` (例: `analyzeDocument`, `getParseTree`, `formatCode`)
- **Constants**: `UPPER_SNAKE_CASE` (例: `DEFAULT_CONFIG`, `MAX_CACHE_SIZE`)
- **Variables**: `camelCase` (例: `documentUri`, `parseResult`, `configManager`)
- **Private Members**: `_` 前缀 + `camelCase` (例: `_parseCache`, `_errorListener`)

## Import Patterns

### Import Order
```typescript
// 1. Node.js内置模块
import * as path from 'path';
import * as fs from 'fs';

// 2. 外部依赖
import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import axios from 'axios';

// 3. 项目内部模块 (按层级分组)
import { LPCLexer } from './antlr/LPCLexer';
import { ASTManager } from './ast/astManager';
import { MacroManager } from './macroManager';

// 4. 相对路径导入
import { DebugErrorListener } from '../parser/DebugErrorListener';
import { FormattingUtils } from './FormattingUtils';

// 5. 类型导入 (单独分组)
import type { SymbolType } from './types';
import type { ParseResult } from './ast/astManager';
```

### Module Organization
- **绝对导入**: 从`src`根目录开始的绝对路径 (配置baseUrl)
- **相对导入**: 同目录或相近模块间使用相对路径
- **类型导入**: 使用`type`关键字明确标识类型导入
- **命名导入**: 优先使用具名导入而非默认导入

## Code Structure Patterns

### Module/Class Organization
```typescript
// 1. 导入声明
import statements...

// 2. 类型定义和接口
interface LocalInterface { ... }
type LocalType = ...

// 3. 常量和配置
const DEFAULT_OPTIONS = { ... };
const MAX_RETRIES = 3;

// 4. 主要类实现
export class MainClass {
    // 私有字段
    private _field: Type;

    // 构造函数
    constructor() { ... }

    // 公共方法 (按功能分组)
    public publicMethod(): ReturnType { ... }

    // 私有方法
    private _privateMethod(): void { ... }
}

// 5. 辅助函数
function helperFunction(): void { ... }

// 6. 导出声明
export { HelperClass, utilityFunction };
```

### Function/Method Organization
```typescript
function exampleMethod(param: Type): ReturnType {
    // 1. 输入验证
    if (!param) {
        throw new Error('Invalid parameter');
    }

    // 2. 变量声明
    let result: ReturnType;
    const config = getConfig();

    // 3. 核心逻辑
    try {
        result = processData(param, config);
        return result;
    } catch (error) {
        // 4. 错误处理
        handleError(error);
        throw error;
    }
}
```

### File Organization Principles
- **单一职责**: 每个文件专注一个核心功能或类
- **Provider模式**: VS Code功能提供者独立文件
- **Manager模式**: 复杂功能的管理器单独文件
- **分层架构**: 按功能层次组织目录结构

## Code Organization Principles

1. **Single Responsibility**: 每个文件、类、函数都有明确的单一职责
   - `diagnostics.ts` 专注错误诊断
   - `completionProvider.ts` 专注代码补全
   - `astManager.ts` 专注AST管理

2. **Modularity**: 代码按功能模块化组织，支持独立开发和测试
   - `collectors/` 目录包含各种代码分析收集器
   - `parser/` 目录包含解析相关工具
   - `utils/` 目录包含通用工具函数

3. **Testability**: 结构设计便于单元测试和集成测试
   - 依赖注入模式 (Manager通过构造函数接收依赖)
   - 接口抽象 (Provider实现VS Code接口)
   - 纯函数工具类 (utils中的函数无副作用)

4. **Consistency**: 遵循项目既定模式和VS Code扩展最佳实践
   - 统一的Provider注册模式
   - 一致的错误处理方式
   - 标准的配置管理模式

## Module Boundaries

### 核心架构层次
```
┌─────────────────────────────────────┐
│        VS Code Extension API        │  # VS Code集成层
├─────────────────────────────────────┤
│         Provider Layer              │  # 功能提供者层
│  (Completion, Diagnostics, etc.)    │
├─────────────────────────────────────┤
│         Business Logic Layer        │  # 业务逻辑层
│   (AST Manager, Collectors, etc.)   │
├─────────────────────────────────────┤
│         Parser Layer               │  # 解析器层
│      (ANTLR4, Symbol Table)        │
├─────────────────────────────────────┤
│         Utility Layer              │  # 工具层
│    (Utils, Types, Configuration)   │
└─────────────────────────────────────┘
```

### 依赖规则
- **向下依赖**: 上层可以依赖下层，下层不能依赖上层
- **水平隔离**: 同层模块间通过接口交互，避免直接依赖
- **Provider隔离**: 各Provider相互独立，通过共享服务交互
- **工具无状态**: Utils层函数保持无状态，可被任意层安全调用

### 边界定义
- **VS Code API vs 内部实现**: 仅在Provider层访问VS Code API
- **核心功能 vs 扩展功能**: 核心解析功能与可选功能分离
- **同步 vs 异步**: 明确异步边界，避免阻塞操作
- **缓存 vs 实时**: 缓存层与实时计算层分离

## Code Size Guidelines

### 文件大小限制
- **Provider文件**: 建议 < 500行 (复杂Provider可达800行)
- **Manager文件**: 建议 < 400行
- **Utility文件**: 建议 < 300行
- **类型定义文件**: 建议 < 200行

### 函数/方法大小
- **公共方法**: 建议 < 50行，最大不超过100行
- **私有方法**: 建议 < 30行
- **工具函数**: 建议 < 20行
- **复杂逻辑**: 超过限制时应拆分为多个辅助函数

### 类/接口复杂度
- **类的方法数**: 建议 < 20个公共方法
- **接口属性数**: 建议 < 15个属性
- **参数个数**: 函数参数建议 < 5个，超过时使用配置对象
- **嵌套深度**: 最大嵌套级别 < 4层

## Extension-Specific Structure

### Provider Registration Pattern
```typescript
// extension.ts - 统一注册模式
export function activate(context: vscode.ExtensionContext) {
    // 初始化核心服务
    const astManager = ASTManager.getInstance();
    const configManager = new LPCConfigManager();

    // 注册Provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'lpc',
            new LPCCompletionItemProvider(astManager),
            '.'
        )
    );
}
```

### Configuration Management
```typescript
// 配置分层管理
├── package.json             # VS Code配置声明
├── config/lpc-config.json   # 默认配置文件
└── src/config.ts            # 配置管理器
```

### Testing Structure
```
tests/
├── unit/                    # 单元测试
│   ├── ast/                 # AST相关测试
│   ├── collectors/          # 收集器测试
│   └── utils/               # 工具函数测试
├── integration/             # 集成测试
│   ├── providers/           # Provider集成测试
│   └── workflows/           # 完整工作流测试
└── fixtures/                # 测试数据
    ├── lpc-samples/         # 示例LPC文件
    └── expected-outputs/    # 预期输出
```

## Documentation Standards

### 代码文档要求
- **所有公共API**: 必须有TSDoc注释
- **复杂算法**: 内联注释解释关键步骤
- **Provider实现**: 注释说明VS Code集成要点
- **配置选项**: 详细说明每个配置项的作用

### 文档组织
- **README.md**: 用户使用指南和功能介绍
- **CHANGELOG.md**: 版本更新记录
- **CLAUDE.md**: 开发指南和项目规则
- **项目文档/**: 中文详细技术文档
- **JSDoc**: API文档自动生成

### 注释风格
```typescript
/**
 * 解析LPC文档并构建符号表
 * @param document VS Code文档对象
 * @param options 解析选项配置
 * @returns 解析结果包含AST和符号表
 * @throws {ParseError} 当语法错误无法恢复时抛出
 */
public parseDocument(document: vscode.TextDocument, options?: ParseOptions): ParseResult {
    // 实现细节...
}
```

这种结构设计确保了代码的可维护性、可测试性和可扩展性，同时与VS Code扩展的最佳实践保持一致。