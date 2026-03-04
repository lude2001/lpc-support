# Repository Guidelines

## 项目结构与模块组织
本仓库是 LPC 的 VS Code 扩展。核心代码位于 `src/`：`src/extension.ts` 为扩展入口，`src/diagnostics/` 放诊断协调器与收集器，`src/parser/` 与 `grammar/` 维护语法，`src/antlr/` 为 ANTLR 生成文件（不要手改）。  
编辑器资源位于 `syntaxes/`、`snippets/`、`media/` 和 `language-configuration.json`。  
测试代码在 `tests/` 与 `src/**/__tests__/`，样例 LPC 文件在 `test/`。构建产物输出到 `dist/`。

## 构建、测试与开发命令
- `npm install`：安装依赖。
- `npm run generate-parser`：根据 `grammar/*.g4` 重新生成 ANTLR 解析器。
- `npm run build`：生成解析器并打包扩展到 `dist/`。
- `npm run watch`：开发模式增量构建。
- `npm test`：运行全部 Jest 测试。
- `npm run test:unit`、`npm run test:integration`、`npm run test:e2e`、`npm run test:performance`：按类型执行测试。
- `npm run test:coverage`：输出覆盖率报告到 `coverage/`。
- `npm run clean`：清理 `dist/` 与 `out/`。

## 代码风格与命名约定
项目使用 TypeScript（`tsconfig.json` 开启 `strict: true`）。保持现有风格：4 空格缩进、显式导入、语句结尾分号。  
命名规则：类与类型使用 `PascalCase`，函数和变量使用 `camelCase`，文件名按功能命名（如 `completionProvider.ts`）。  
命令 ID 使用 `lpc.*` 命名空间（如 `lpc.compileFile`）。

## 测试规范
测试框架为 Jest + `ts-jest`（见 `jest.config.js`）。测试文件统一使用 `*.test.ts` 或 `*.spec.ts`。  
涉及 VS Code API 时，优先复用 `tests/mocks/MockVSCode.ts`。  
新增功能必须附带针对性测试，重点覆盖解析、诊断与命令行为。

## 提交与 Pull Request 规范
提交信息遵循 Conventional Commits，并与仓库历史一致：`feat:`、`fix:`、`refactor:`、`docs:`、`chore:`，可选 scope（示例：`feat(diagnostics): ...`）。  
PR 至少包含：变更说明、动机、测试命令与结果、关联 Issue；涉及 UI/交互变更请附截图或 GIF。  
若有用户可感知变更，请同步更新 `CHANGELOG.md`。

## 安全与配置建议
不要提交 `.env`、API Key 或服务器敏感信息。  
服务地址与模型参数应通过 VS Code 配置项（`lpc.*`）管理，避免硬编码到源码。
