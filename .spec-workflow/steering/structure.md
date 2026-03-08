# Project Structure

## Directory Organization

```text
lpc-support/
├── .spec-workflow/              # steering、spec 模板与审批流程文件
├── config/                      # 扩展内置配置与文档数据
├── dist/                        # 打包输出目录
├── docs/                        # 补充文档
├── examples/                    # 示例代码与实验示例
├── grammar/                     # ANTLR 语法定义 (*.g4)
├── media/                       # 图标与 Webview / 扩展资源
├── scripts/                     # 构建和数据生成脚本
├── snippets/                    # VS Code 代码片段
├── src/                         # 扩展主源码
│   ├── __mocks__/               # 源码侧 mock
│   ├── __tests__/               # 源码侧测试
│   ├── antlr/                   # 由 grammar 生成的解析器代码，不手改
│   ├── ast/                     # AST、符号表、补全访问器
│   ├── collectors/              # 通用静态检查收集器
│   ├── core/                    # 缓存等基础能力的抽象 / 实验实现
│   ├── diagnostics/             # 诊断协调器、诊断类型、诊断专用收集器
│   ├── parser/                  # 解析工具、错误监听器、解析树输出
│   ├── templates/               # Webview 模板资源
│   ├── test/                    # 源码侧手工测试 / 调试辅助
│   ├── types/                   # 细分类型定义
│   ├── utils/                   # 工具函数与工具测试
│   └── *.ts                     # 扩展入口和主要 Provider / 服务
├── syntaxes/                    # TextMate 语法
├── test/                        # LPC 示例 / 测试输入文件
├── tests/                       # 测试基础设施、setup、MockVSCode
├── 项目文档/                    # 项目中文资料
├── language-configuration.json  # VS Code 语言配置
├── esbuild.mjs                  # 打包配置
├── jest.config.js               # Jest 配置
├── package.json                 # 扩展清单、命令、配置、脚本
└── tsconfig.json                # TypeScript 编译配置
```

### Source Structure Responsibilities

- `src/extension.ts`
  - 扩展唯一入口
  - 负责注册命令、Provider、Tree View、状态栏项和生命周期逻辑
- `src/diagnostics/`
  - 诊断调度层
  - 负责事件监听、批处理、防抖、Collector 编排
- `src/collectors/` 与 `src/diagnostics/collectors/`
  - 诊断规则实现层
  - 前者承载较早的通用收集器，后者承载诊断模块内的新收集器
- `src/ast/`
  - AST、符号表、类型解析和补全推断
- `src/parser/`
  - ANTLR 解析辅助工具，不直接承载业务规则
- `src/antlr/`
  - 生成代码
  - 只能通过 `npm run generate-parser` 更新
- `src/templates/`
  - 函数文档面板 HTML / JS 模板源文件
- `src/core/`
  - 缓存抽象与示例性基础设施
  - 当前不是主运行路径的唯一来源，新增基础能力前应先确认是否复用还是收敛

## Naming Conventions

### Files

- **入口与服务文件**: `camelCase.ts`
  - 例如 `extension.ts`、`completionProvider.ts`、`errorTreeDataProvider.ts`
- **Collector**: `PascalCaseCollector.ts`
  - 例如 `UnusedVariableCollector.ts`
- **Manager / helper classes**: 现有仓库同时存在两种风格
  - 目录小写文件名：`macroManager.ts`
  - 类名 PascalCase：`MacroManager`
- **Generated parser files**: 保持 ANTLR 生成命名
  - `LPCLexer.ts`
  - `LPCParser.ts`
- **Tests**:
  - `*.test.ts`
  - `*.spec.ts`
  - 仓库以内联测试目录为主，而不是严格按 `unit/`、`integration/` 分层目录组织

### Code

- **Classes / interfaces / types**: `PascalCase`
- **Functions / methods / variables**: `camelCase`
- **Constants**:
  - 类静态常量常见 `UPPER_SNAKE_CASE`
  - 模块级常量也有 `camelCase` 现象，新增代码优先使用清晰且与周围代码一致的命名
- **Private members**:
  - 当前仓库并不统一使用 `_` 前缀
  - 新代码不要把 `_privateField` 当成强制规范

### Naming Guidance

- 优先延续当前目录内的既有风格，而不是强行全仓统一命名改革
- 新增 Provider 文件继续使用当前主流模式：`camelCase` 文件名 + `LPC*Provider` 类名
- 新增 Collector 文件继续使用 `PascalCaseCollector.ts`
- 新增生成文件或第三方导入生成物不得手工改名

## Import Patterns

### Current Import Style

当前仓库以 **相对路径导入** 为主，没有配置 `baseUrl` 或路径别名作为主流实践。

常见顺序是：

1. Node 内置模块
2. 外部依赖
3. 同层 / 子目录内部模块
4. 跨目录相对路径模块

### Import Rules

- 在 `src/` 内新增代码时，优先继续使用相对导入
- 不要在单个文件里同时引入多套路径风格
- 只有在 TypeScript 明确支持且全仓准备迁移时，才考虑引入别名导入
- 类型导入目前不是全仓统一要求；新增代码可在合适时使用 `import type`，但要保持周边一致性

## Code Structure Patterns

### File Organization

典型文件结构通常是：

1. imports
2. 本地类型 / 接口
3. 常量
4. 主类或主函数实现
5. 辅助函数
6. 导出

但该仓库并非所有文件都严格按同一模板组织。新增代码应遵循“更清晰、更贴近当前文件”的原则，不做机械统一。

### Common Implementation Patterns

- `extension.ts` 负责集中注册 VS Code 能力
- Provider 类通常一个文件一个类
- 复杂工作流使用 manager / service 类封装
- 诊断逻辑通过 orchestrator + collectors 组合
- 解析相关能力通过 parse cache + AST manager 复用
- Webview UI 与模板文件分离，模板存放在 `src/templates/`

### File Organization Principles

- 单文件只承载一个主要职责
- VS Code API 适配层与底层解析 / 规则逻辑尽量分开
- 生成文件和手写文件必须保持明确边界
- 如果已有模块已承担职责，不要平行再造一套近似实现

## Code Organization Principles

1. **Entry-point centralization**
   - 扩展激活和注册逻辑集中在 `src/extension.ts`
   - 新命令或 Provider 的接入点默认放在这里

2. **Parser-driven language features**
   - 语言能力优先复用 `parseCache`、`antlr`、`ast`、`symbolTable`
   - 不要为了单点功能重复造一套正则解析逻辑，除非有明确性能或兼容性理由

3. **Collector-based diagnostics**
   - 新诊断规则优先实现为独立 collector
   - 由 `DiagnosticsOrchestrator` 统一调度，而不是在入口里散落逻辑

4. **Local-first editor UX**
   - 文档、补全、跳转等能力优先基于本地数据和缓存
   - 网络能力应作为增强，而不是基础依赖

5. **Generated code isolation**
   - `src/antlr/` 视为派生产物
   - 所有语法修改都从 `grammar/` 出发

## Module Boundaries

### Dependency Direction

建议并遵循以下方向：

- `extension.ts` 可以依赖所有运行时模块
- Provider / workflow 模块可以依赖：
  - `ast/`
  - `parser/`
  - `diagnostics/`
  - `utils/`
  - `types/`
- `diagnostics/` 可以依赖：
  - `collectors/`
  - `parser/`
  - `parseCache.ts`
  - `utils/`
- `ast/` 和 `parser/` 不应依赖具体 UI 视图或 Webview 实现
- `utils/` 和 `types/` 不应依赖 VS Code UI 工作流

### Practical Boundaries

- **UI boundary**
  - Tree View、Webview、StatusBar、Command 注册属于 VS Code UI 层
- **Language boundary**
  - 语法树、符号表、补全推断、路径解析属于语言理解层
- **Integration boundary**
  - 远程编译、错误接口、GLM-4、Mud Wiki 访问属于外部集成层
- **Generated boundary**
  - `grammar/` 是源，`src/antlr/` 是产物

### Areas Requiring Care

- 当前仓库同时存在 `src/parseCache.ts` 和 `src/core/ParseCache.ts`
- 当前仓库同时存在根级 `src/types.ts` 和 `src/types/`
- 当前仓库测试散布在 `tests/`、`src/__tests__/`、`src/utils/__tests__/`、`src/collectors/__tests__/`

这些都说明仓库存在一定历史演化痕迹。新增实现时应先判断复用哪一侧，避免继续加剧重复结构。

## Code Size Guidelines

以下是 steering 级建议，不是硬性 lint 规则：

- **入口文件**
  - `src/extension.ts` 已经较大
  - 新增大块注册逻辑时，优先抽取辅助函数或独立服务
- **Provider / manager / collector**
  - 单文件优先控制在“仍可人工快速理解”的范围内
  - 当文件同时承担注册、解析、缓存、UI 组装多项职责时，应拆分
- **Functions / methods**
  - 如果一个方法同时处理输入解析、业务逻辑、错误恢复和 UI 输出，优先拆出辅助方法
- **Nesting**
  - 深层条件嵌套优先通过早返回、辅助函数和局部对象拆分控制复杂度

## Testing Structure

### Current Layout

```text
tests/
├── mocks/                  # VS Code mock 与测试替身
├── setup/                  # Jest 各类环境 setup
├── utils/                  # 测试辅助
└── run-all-tests.ts

src/__tests__/              # 针对源码模块的直接测试
src/collectors/__tests__/   # collector 测试
src/utils/__tests__/        # utils 测试
src/utils/regexPatterns.test.ts
```

### Testing Guidance

- 新测试优先放在被测模块附近，延续当前内联测试布局
- 涉及 VS Code API 时优先复用 `tests/mocks/MockVSCode.ts`
- 涉及解析、诊断、命令行为的改动应附带针对性测试
- 如果新增目录级测试约定，应先统一后再推广，不要局部发明新层级

## Documentation Standards

- `README.md` 面向用户，描述功能、配置和使用方式
- `CHANGELOG.md` 记录用户可见变更
- `.spec-workflow/steering/*` 记录长期 steering 约束
- `项目文档/` 保存中文参考资料与补充说明

### Documentation Guidance

- 公共行为复杂、容易误解或受 LPC / FluffOS 约束影响的代码，应补充简洁注释
- 不要在明显代码上堆砌注释
- 生成文件不添加手工说明性修改
- 若模块有特殊约束，例如“只能从 grammar 生成”或“依赖特定接口路径”，应在靠近实现处写明
