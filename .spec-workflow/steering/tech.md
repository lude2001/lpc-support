# Technology Stack

## Project Type

本项目是一个 **VS Code 桌面扩展**，运行在 VS Code Extension Host 中，而不是独立的 Language Server、Web 应用或 CLI 工具。

当前架构重点是：

- 基于 ANTLR 的 LPC 解析
- 基于 parser/syntax/semantic 分层的语言分析
- 基于 VS Code Provider 的编辑器能力接入
- 可选的远程编译、错误查看和文档增强集成

## Core Technologies

### Primary Language(s)

- **Language**: TypeScript
- **Compiler target**: ES2020
- **Runtime**: Node.js in VS Code Extension Host
- **Package manager**: npm
- **Language tooling**:
  - `typescript`
  - `esbuild`
  - `antlr4ts`
  - `antlr4ts-cli`

### Key Dependencies/Libraries

- **VS Code Extension API / `@types/vscode`**
  - 扩展宿主 API 与类型定义
- **`antlr4ts`**
  - LPC lexer/parser runtime
- **`antlr4ts-cli`**
  - 从 `grammar/*.g4` 生成 `src/antlr/*`
- **`axios`**
  - 远程编译、错误接口和外部 API 调用
- **`jest` + `ts-jest`**
  - 单元测试和集成测试
- **`@vscode/test-electron`**
  - 扩展测试运行支持
- **`rimraf`**
  - 构建产物清理
- **`cross-env`**
  - 跨平台环境变量设置

## Application Architecture

### Runtime architecture

项目采用 **单扩展进程 + 分层语言基础设施 + Provider 模式** 的架构。

主干层级如下：

1. **Entry / registration layer**
   - `src/extension.ts`
   - 统一注册命令、Provider 和扩展生命周期逻辑
2. **Provider layer**
   - `src/completionProvider.ts`
   - `src/definitionProvider.ts`
   - `src/referenceProvider.ts`
   - `src/renameProvider.ts`
   - `src/semanticTokensProvider.ts`
   - `src/symbolProvider.ts`
   - `src/foldingProvider.ts`
   - `src/diagnostics/DiagnosticsOrchestrator.ts`
3. **Parser layer**
   - `src/parser/ParsedDocumentService.ts`
   - `src/parser/TokenTriviaIndex.ts`
   - `src/parser/types.ts`
4. **Syntax layer**
   - `src/syntax/SyntaxBuilder.ts`
   - `src/syntax/syntaxNode.ts`
   - `src/syntax/types.ts`
   - `src/syntax/trivia.ts`
5. **Semantic layer**
   - `src/semantic/SemanticModelBuilder.ts`
   - `src/semantic/semanticSnapshot.ts`
   - 项目级摘要与补全索引：`src/completion/projectSymbolIndex.ts`

### Canonical language contracts

- **`ParsedDocument`**
  - parser 层正式输出
  - 包含文本、token、parse tree、diagnostics、trivia 访问能力和缓存元数据
- **`SyntaxDocument`**
  - syntax 层正式输出
  - 提供稳定的源码结构节点和 token-backed range
- **`SemanticSnapshot`**
  - semantic 层正式输出
  - 提供符号表、作用域、类型摘要、继承摘要与语义查询基础

### Transitional compatibility surface

当前仍存在部分兼容层，但它们不再是生产真源：

- `src/parseCache.ts`
  - legacy compatibility facade
- `src/core/ParseCache.ts`
  - legacy compatibility wrapper
- `src/ast/ASTManager.ts`
  - Provider 适配 facade，允许存在，但必须继续转发到新层级
- `src/ast/simpleAstManager.ts`
  - 仅限 legacy/demo/实验
- `src/parser/LPCParserUtil.ts`
  - 仅限 parse-tree 调试辅助

技术 steering 要求：

- 新的生产功能不得重新依赖上述 legacy 模块
- legacy 模块可以存在，但只能保持兼容壳层或调试角色

## Data Storage and Data Formats

### Primary storage

- **VS Code settings**
  - 存放用户配置，例如 `lpc.includePath`、`lpc.performance.*`、`lpc.glm4.*`
- **Extension global storage**
  - `src/config.ts` 使用 `context.globalStoragePath` 存放扩展侧配置
- **Repository config files**
  - `config/lpc-config.json`
  - `config/efun-docs.json`

### In-memory analysis state

- `ParsedDocumentService`
  - 文档级解析缓存
- `DocumentSemanticSnapshotService`
  - 文档级语义快照缓存和刷新调度
- `ProjectSymbolIndex`
  - 项目级继承与导出摘要索引

### Data formats

- JSON
  - 配置、文档数据、服务器配置
- ANTLR parse tree
  - 仅作为 parser 原始产物
- `ParsedDocument`
  - 统一 parser 契约
- `SyntaxDocument`
  - 统一源码结构契约
- `SemanticSnapshot`
  - 统一语义摘要契约
- VS Code `Diagnostic` / `CompletionItem` / `Location` / `TextEdit`
  - Provider 输出对象
- HTML / Markdown
  - 文档面板与说明内容

## External Integrations

- **FluffOS compile server**
  - `POST /update_code/update_file`
- **FluffOS error viewer endpoints**
  - `GET /error_info/get_compile_errors`
  - `GET /error_info/get_runtime_errors`
  - `GET /error_info/clear_all_errors`
- **Mud Wiki**
  - 内置 efun 文档缺失时的可选回退
- **GLM-4 API**
  - 用于生成注释和文档增强

这些网络能力都属于增强项，不能成为本地语言基础设施可用性的前提。

## Development Environment

### Build & Development Tools

- `npm run generate-parser`
  - 根据 `grammar/*.g4` 生成 `src/antlr/*`
- `npm run build`
  - 生成 parser 并通过 `esbuild` 打包
- `npm run watch`
  - 增量构建
- `npm test`
  - 运行测试

### Code Quality Tools

- TypeScript 编译检查
- Jest / ts-jest
- `tests/mocks/MockVSCode.ts`
- `.spec-workflow/steering/*`
- `docs/CONTRIBUTING.md`

当前仓库没有正式配置 ESLint / Prettier，因此代码与架构一致性更多依赖：

- 统一服务边界
- 有针对性的回归测试
- 文档化的命名与 legacy 退出规则

## Technical Requirements & Constraints

### Performance requirements

- 常规编辑场景下的补全、跳转、语义高亮和诊断必须保持可交互
- 大型工程分析必须优先通过缓存和项目级摘要减少重复解析
- provider 不应各自维护第二套解析或语义真源

### Architecture constraints

- 生产主路径不得直接创建 parser
- 生产主路径不得新增第二套 parse cache、syntax cache 或 semantic 真源
- 范围计算必须基于 token/span，而不是文本搜索
- formatter 如后续接入，必须复用 parser/syntax/trivia 基础设施

### Compatibility requirements

- **VS Code**: `^1.80.0`
- **Bundle target**: `node16`
- **TypeScript output target**: `ES2020`
- **Language scope**: 以 FluffOS 风格 LPC 为主

## Technical Decisions & Rationale

### Decision Log

1. **ANTLR as the only grammar truth source**
   - 原因：需要稳定的解析入口支撑 syntax 和 semantic 分层
   - 含义：regex-only 路线不能再承担生产真源职责

2. **Layered parser -> syntax -> semantic model**
   - 原因：避免 parse tree、AST 和语义快照概念继续混用
   - 含义：新功能先选层，再接 Provider，而不是直接在 Provider 内解析

3. **Single parsed-document truth source**
   - 原因：过去 `parseCache`、`core/ParseCache`、零散 parser 入口重复
   - 含义：`ParsedDocumentService` 成为统一解析服务；legacy facade 只做兼容

4. **Token-backed ranges and trivia**
   - 原因：文本搜索式范围推断在重复文本和嵌套结构下不稳定
   - 含义：syntax 节点范围和 trivia 模型都必须以 token 信息为基础

5. **Provider-oriented adaptation over shared services**
   - 原因：VS Code 扩展天然以 Provider 为 UI 接入点
   - 含义：Provider 只负责查询和组装，不负责自建语言真源

6. **Legacy retirement by demotion, not silent coexistence**
   - 原因：历史模块会天然诱导新功能继续走旧路径
   - 含义：legacy 模块必须带明确 allowed/forbidden/removal 注释，并退出生产真源角色

## Known Limitations

- 当前仍运行在单扩展宿主中，不具备独立 LSP/worker 级隔离
- `ASTManager` 仍是过渡期 facade，命名上带有历史包袱
- `DocumentSemanticSnapshot` 仍存在兼容角色，与 `SemanticSnapshot` 并存
- 一些调试/兼容模块仍保留在仓库内，需要继续避免误用
- 当前没有正式 lint 工具链，结构一致性主要依赖测试和评审
- 外部网络接口仍受服务可用性与配置正确性影响

## Architecture Guardrails

以下规则属于长期 steering：

1. 不得为生产路径再引入第二个 parser 真源
2. 不得把 legacy facade 重新升级为生产实现
3. 不得新增对 `SimpleASTManager`、`LPCParserUtil` 的生产依赖
4. 不得把 `AST` 再作为 parse tree、syntax tree、semantic snapshot 的统称
5. 新的结构化编辑能力应优先复用 `ParsedDocument`、`SyntaxDocument`、`SemanticSnapshot`
