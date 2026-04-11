# 开发贡献指南

## 当前语言架构

### 分层模型

当前语言基础设施采用明确分层，而不是把 parse tree、AST、语义快照混在一起：

1. `ParsedDocument`
   - 定义位置：`src/parser/types.ts`
   - 生产入口：`src/parser/ParsedDocumentService.ts`
   - 职责：统一封装文本、token、parse tree、parse diagnostics、trivia 访问器与解析缓存信息
2. `SyntaxDocument`
   - 定义位置：`src/syntax/types.ts`
   - 构建入口：`src/syntax/SyntaxBuilder.ts`
   - 职责：把 parse tree 转成稳定的源码结构模型，节点范围基于 token span，而不是文本搜索
3. `SemanticSnapshot`
   - 定义位置：`src/semantic/semanticSnapshot.ts`
   - 构建入口：`src/semantic/SemanticModelBuilder.ts`
   - 职责：在 syntax 层之上构建符号表、作用域、类型摘要、继承摘要和语义诊断输入
4. Provider / orchestration
   - 典型入口：`src/modules/languageModule.ts`、`src/lsp/server/bootstrap/registerCapabilities.ts`、`src/diagnostics/DiagnosticsOrchestrator.ts`
   - 职责：LSP server 与宿主侧装配只做能力接线，不再自建 parser、cache 或伪 AST 真源

### 当前主路径约束

- 生产主路径不得新增 `new LPCLexer(...)` / `new LPCParser(...)`
- 生产主路径不得重新引入任何 legacy parse cache facade
- 生产主路径不得新增 `document.getText().indexOf(...)` 一类范围反推逻辑
- 生产主路径不得依赖 `SimpleASTManager` 或 `LPCParserUtil`

允许的受控例外：

- 调试工具
- 手工实验或 legacy demo
- 测试夹具

## 模块职责

### `src/parser/`

- `ParsedDocumentService.ts`
  - 项目唯一可信解析入口
  - 统一维护解析缓存、版本感知和 parse diagnostics
- `TokenTriviaIndex.ts`
  - 提供 leading/trailing/intervening trivia 访问
- `types.ts`
  - `ParsedDocument`、`ParsedDocumentStats` 等正式契约

### `src/syntax/`

- `SyntaxBuilder.ts`
  - 负责把 parse tree 转成 syntax 节点
- `syntaxNode.ts` / `types.ts` / `trivia.ts`
  - 定义 syntax 节点、token range、trivia 契约

### `src/semantic/`

- `SemanticModelBuilder.ts`
  - 负责从 syntax 构建语义模型
- `semanticSnapshot.ts`
  - 定义 `SemanticSnapshot` 和向兼容快照的转换逻辑

### `src/ast/`

这是历史目录，不再代表“唯一语言结构层”。

- `ASTManager` 当前是 Provider 适配 facade
  - 可以继续作为主路径入口使用
  - 但它必须转发到 parser/syntax/semantic 服务，而不是维护第二真源
- `simpleAstManager.ts`
  - 已明确为 legacy 兼容/实验模块
  - 禁止新功能依赖

### 已移除的 legacy parse cache facade

- 历史上的 `src/parseCache.ts` 与 `src/core/ParseCache.ts` 已移除
- 不要以“临时兼容”名义重新恢复这两层 facade
- `src/parser/LPCParserUtil.ts`
  - 仅限 parse-tree 调试辅助

如果新增功能需要“快速拿到 parse tree”，优先做法是：

1. 先看能否从 `ASTManager.parseDocument()` 获取
2. 再看能否直接通过 `ParsedDocumentService` 获取
3. 不要重新引入任何 parse cache facade

## 命名约定

### 必须统一的术语

- `parse tree`
  - ANTLR 原始语法树
  - 只表示 parser 产物
- `ParsedDocument`
  - parse tree + token + diagnostics + trivia 访问能力的统一容器
- `syntax tree` / `SyntaxDocument`
  - 稳定的源码结构模型
- `SemanticSnapshot`
  - 以 syntax 为输入的语义摘要

### 应避免的含混命名

- 不要再把 `AST` 当成 parse tree、syntax tree、semantic snapshot 的统称
- 新代码不要把新的 parser/syntax/semantic 输出命名为泛化的 `ast`
- `DocumentSemanticSnapshot`
  - 当前仍存在，主要用于兼容现有 completion/index 边界
  - 新基础设施命名优先使用 `SemanticSnapshot`

### 文件与类型命名

- 服务和 Provider 文件继续使用 `camelCase.ts`
- 类名、接口名、类型名使用 `PascalCase`
- 生成文件维持 ANTLR 默认命名，不手改
- 测试文件统一使用 `*.test.ts` 或 `*.spec.ts`

## 新功能接入建议

### 添加新的语言能力时

1. 先判断需要的是 parser、syntax 还是 semantic 层信息
2. 优先复用已有统一服务
3. 仅在 Provider 层组装 VS Code 对象
4. 为主路径变更补针对性测试

推荐判断方式：

- 只需要 token、parse diagnostics、trivia：用 `ParsedDocument`
- 需要稳定声明结构、块结构、token-backed range：用 `SyntaxDocument`
- 需要符号、作用域、类型、继承：用 `SemanticSnapshot`

### 不推荐的做法

- 在 Provider 内直接创建 parser
- 在业务逻辑里重新扫描全文做结构推断
- 在旧 facade 上继续叠加新缓存或新解析逻辑
- 让 legacy 模块重新承担生产真源职责

## 诊断与 Provider 规则

### 诊断

- `DiagnosticsOrchestrator` 统一复用 `ASTManager.parseDocument()`
- parser errors 来源于 `ParsedDocument` / snapshot parse diagnostics
- 新诊断规则优先作为 collector 接入，不要散落在 `extension.ts`

### Provider

- completion / definition / reference / rename / semantic tokens / symbol / folding 应统一消费 parser/syntax/semantic 服务
- 若某个 Provider 需要临时兼容层，兼容层只能转发，不能再生一套真源

## 测试约定

当前重构保护网的重点测试包括：

- `src/__tests__/parsedDocumentService.test.ts`
  - 锁定统一解析服务与 trivia 契约
- `src/__tests__/syntaxBuilder.test.ts`
  - 锁定 syntax 节点结构与 token-backed range
- `src/__tests__/semanticModelBuilder.test.ts`
  - 锁定 symbol / scope / type / inherit 摘要
- `src/__tests__/providerIntegration.test.ts`
  - 锁定生产主路径不回退到 legacy parse cache 思路
- `src/lsp/__tests__/singlePathCutover.test.ts`
  - 锁定公开运行面不再暴露 classic / hybrid 多模式入口

新增语言基础设施或 Provider 变更时，至少覆盖下面之一：

- parser/trivia 契约
- syntax range 稳定性
- semantic 摘要正确性
- 生产主路径不回退 legacy 入口

## formatter 接入边界

本仓库 formatter 已经落在正式主路径上，后续修改时应遵守：

- 结构来源以 `SyntaxDocument` 为主
- 注释、空白、换行和指令来源以 `TokenTriviaIndex` / trivia 模型为主
- 不要为 formatter 再造一套 parser 或文本切片结构层
- 如需语义辅助，应把 `SemanticSnapshot` 视为可选增强，而不是格式化主结构真源

## 快速开始

```bash
npm install
npm run build
npm test
```

开发扩展时可使用：

```bash
npm run watch
```

然后在 VS Code 中按 `F5` 启动 Extension Development Host。

## 提交流程

1. 在当前架构规则下实现变更
2. 为语言主路径补测试
3. 运行相关测试或构建
4. 更新 `CHANGELOG.md` 或相关文档（如果有用户可见变化）
5. 使用 Conventional Commits 提交

## 参考文档

- [README](../README.md)
- [.spec-workflow/steering/tech.md](../.spec-workflow/steering/tech.md)
- [.spec-workflow/steering/structure.md](../.spec-workflow/steering/structure.md)
- [.spec-workflow/specs/parser-syntax-foundation-refactor/design.md](../.spec-workflow/specs/parser-syntax-foundation-refactor/design.md)
