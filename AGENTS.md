# Repository Guidelines

## 项目结构与模块组织
本仓库是 LPC 的 VS Code 扩展，当前已完成核心架构拆分。核心代码仍在 `src/`，但职责已经分层：

- `src/extension.ts`
  - 仅保留激活入口，负责创建 `ServiceRegistry` 并按顺序调用模块注册函数
- `src/core/`
  - 放服务注册与跨模块基础设施，如 `ServiceRegistry`、`ServiceKeys`、`DocumentLifecycleService`
- `src/modules/`
  - 放扩展装配层：`coreModule.ts`、`diagnosticsModule.ts`、`languageModule.ts`、`commandModule.ts`、`uiModule.ts`
- `src/parser/`
  - 统一解析入口与 token/trivia 能力，生产代码应优先走 `ParsedDocumentService`
- `src/syntax/`
  - 语法结构层；`SyntaxBuilder.ts` 为入口，具体构建逻辑已拆到 `src/syntax/builders/`
- `src/semantic/`
  - 语义摘要层，承接 syntax 输出
- `src/formatter/`
  - formatter 已正式落地；`FormattingService.ts` 是入口，`src/formatter/printer/` 下的 `FormatPrinter.ts` 与 `delegates/` 负责打印
- `src/efun/`
  - efun 文档系统已拆分为 `EfunDocsManager` 门面和多个子服务
- `src/diagnostics/`
  - 放诊断调度、变量检查面板、文件夹扫描等
- `src/antlr/`
  - ANTLR 生成文件，不要手改

编辑器资源位于 `syntaxes/`、`snippets/`、`media/` 和 `language-configuration.json`。  
测试代码在 `tests/` 与 `src/**/__tests__/`，样例 LPC 文件在 `test/`。构建产物输出到 `dist/`，VSIX 产物输出到仓库根目录。

### 当前主路径约束

- 不要在生产主路径新增 `new LPCLexer(...)` / `new LPCParser(...)`
- 不要让 Provider 或业务逻辑重新扫描全文做结构推断
- 不要让 `src/parseCache.ts`、`src/core/ParseCache.ts` 重新成为生产真源
- parser / syntax / semantic 的职责边界要保持明确，不要再把它们混成泛化的 “AST”
- 项目配置优先走工作区根目录的 `lpc-support.json` 与 `config.hell` 同步结果，不要在新代码里继续直接依赖旧 `lpc.includePath` / `lpc.simulatedEfunsPath` 作为首选来源

### formatter 相关约束

- formatter 的结构真源是 `SyntaxDocument`，不是文本正则
- `FormatPrinter` 的节点分派已经拆到 `declarationPrinter.ts`、`statementPrinter.ts`、`expressionRenderer.ts`、`collectionPrinter.ts`
- 修改格式化行为时，优先补或更新 `formatPrinter.test.ts`、`formatterIntegration.test.ts`、`rangeFormatting.test.ts`
- 真实样例回归重点覆盖 `test/lpc_code/` 下的样例，尤其是 `yifeng-jian.c`、`meridiand.c`

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run generate-parser`：根据 `grammar/*.g4` 重新生成 ANTLR 解析器。
- `npm run build`：生成解析器并打包扩展到 `dist/`。
- `npm run package`：生成 VSIX 安装包。
- `npm run watch`：开发模式增量构建。
- `npm test`：运行全部 Jest 测试。
- `npm run test:unit`、`npm run test:integration`、`npm run test:e2e`、`npm run test:performance`：按类型执行测试。
- `npm run test:coverage`：输出覆盖率报告到 `coverage/`。
- `npm run clean`：清理 `dist/` 与 `out/`。

### 当前常用验证命令

- `npx tsc --noEmit`
  - 检查类型与未使用符号
- `npx jest --runInBand src/__tests__/formatPrinter.test.ts src/__tests__/formatterIntegration.test.ts src/__tests__/rangeFormatting.test.ts src/__tests__/yifengDebug.test.ts`
  - formatter 回归集

### 打包注意事项

- `npm run build` / `npm run package` 在 `antlr4ts` 阶段可能受 JVM 默认内存影响
- 如遇构建内存问题，优先使用：
  - `JAVA_TOOL_OPTIONS=-Xms64m -Xmx512m`

## 代码风格与命名约定
项目使用 TypeScript（`tsconfig.json` 开启 `strict: true`）。保持现有风格：4 空格缩进、显式导入、语句结尾分号。  
命名规则：类与类型使用 `PascalCase`，函数和变量使用 `camelCase`，文件名按功能命名（如 `completionProvider.ts`）。  
命令 ID 使用 `lpc.*` 命名空间（如 `lpc.compileFile`）。

### 架构命名约定

- `ParsedDocument`
  - parser 层统一容器
- `SyntaxDocument` / `SyntaxNode`
  - 语法结构层
- `SemanticSnapshot`
  - 语义摘要层
- 不要把 parser/syntax/semantic 产物统称为新的 “AST”

## 测试规范
测试框架为 Jest + `ts-jest`（见 `jest.config.js`）。测试文件统一使用 `*.test.ts` 或 `*.spec.ts`。  
涉及 VS Code API 时，优先复用 `tests/mocks/MockVSCode.ts`。  
新增功能必须附带针对性测试，重点覆盖解析、语法构建、格式化、诊断与命令行为。

### 当前重点保护网

- `src/__tests__/parsedDocumentService.test.ts`
  - 锁定统一解析服务与 trivia 契约
- `src/__tests__/syntaxBuilder.test.ts`
  - 锁定 syntax 节点结构与 token-backed range
- `src/__tests__/semanticModelBuilder.test.ts`
  - 锁定语义摘要
- `src/__tests__/providerIntegration.test.ts`
  - 锁定生产主路径不回退到 legacy parse cache
- `src/__tests__/formatPrinter.test.ts`
  - 锁定 printer 规则
- `src/__tests__/formatterIntegration.test.ts`
  - 锁定真实文件格式化结果
- `src/__tests__/rangeFormatting.test.ts`
  - 锁定选区格式化规则
- `src/__tests__/yifengDebug.test.ts`
  - 锁定 `yifeng-jian.c` 的关键 formatter 回归

## 提交与 Pull Request 规范
提交信息遵循 Conventional Commits，并与仓库历史一致：`feat:`、`fix:`、`refactor:`、`docs:`、`chore:`，可选 scope（示例：`feat(diagnostics): ...`）。  
PR 至少包含：变更说明、动机、测试命令与结果、关联 Issue；涉及 UI/交互变更请附截图或 GIF。  
若有用户可感知变更，请同步更新 `CHANGELOG.md`。

## 安全与配置建议
不要提交 `.env`、API Key 或服务器敏感信息。  
服务地址与模型参数应通过 VS Code 配置项（`lpc.*`）管理，避免硬编码到源码。
