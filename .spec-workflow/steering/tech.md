# Technology Stack

## Project Type

本项目是一个 **VS Code 桌面扩展**，不是独立的语言服务器、Web 应用或 CLI 工具。

它运行在 VS Code Extension Host 中，围绕 LPC / FluffOS 的编辑器能力提供以下技术功能：

- 语法解析与 AST 分析
- 补全、跳转、引用、重命名、语义高亮、折叠、大纲等编辑器 Provider
- 静态诊断与远程错误查看
- 与 FluffOS 服务端接口和 GLM-4 API 的可选集成

## Core Technologies

### Primary Language(s)

- **Language**: TypeScript
- **Compiler target**: ES2020
- **Runtime**: Node.js in VS Code Extension Host
- **Package manager**: npm
- **Language-specific tools**:
  - `typescript`
  - `esbuild`
  - `antlr4ts`
  - `antlr4ts-cli`

### Key Dependencies/Libraries

- **VS Code Extension API / `@types/vscode`**: 扩展宿主 API 与类型定义
- **`antlr4ts`**: LPC 词法和语法解析运行时
- **`antlr4ts-cli`**: 从 `grammar/*.g4` 生成 `src/antlr/*`
- **`axios`**: 远程编译、错误树、GLM-4、在线文档回退查询的 HTTP 客户端
- **`cheerio`**: 已作为开发依赖存在，主要用于文档生成脚本与 HTML 处理
- **`jest` + `ts-jest`**: 单元测试与集成测试
- **`@vscode/test-electron`**: VS Code 扩展测试支持
- **`rimraf`**: 构建产物清理
- **`cross-env`**: 跨平台设置构建环境变量

### Application Architecture

项目采用 **单扩展进程 + Provider 模式 + 解析缓存 + 模块化服务** 的架构，而不是独立 LSP 进程。

- **Entry point**: `src/extension.ts` 统一注册命令、Provider 和视图
- **Provider layer**: completion / definition / reference / rename / semantic tokens / symbols / folding / code actions
- **Language analysis layer**:
  - `src/antlr/` 生成解析器
  - `src/parseCache.ts` 提供解析缓存
  - `src/ast/` 提供 AST、符号表和补全辅助
- **Diagnostics layer**:
  - `src/diagnostics/DiagnosticsOrchestrator.ts` 统一调度诊断
  - `src/collectors/` 与 `src/diagnostics/collectors/` 承载规则实现
- **Workflow integration layer**:
  - `src/compiler.ts` 负责远程编译
  - `src/errorTreeDataProvider.ts` 负责错误树
  - `src/efunDocs.ts` 负责 efun / simulated efun 文档
  - `src/functionDocPanel.ts` 负责函数文档面板
- **Utility/config layer**:
  - `src/config.ts`
  - `src/utils/`
  - `config/*.json`

### Data Storage

- **Primary storage**
  - VS Code settings：用户配置项，例如 `lpc.includePath`、`lpc.simulatedEfunsPath`、`lpc.glm4.*`
  - Extension global storage：`src/config.ts` 使用 `context.globalStoragePath` 保存编译服务器配置
  - Repository config files：`config/lpc-config.json`、`config/efun-docs.json`
- **Caching**
  - 内存中的解析缓存，带容量、TTL 和清理机制
  - 文档级补全缓存和继承解析缓存
- **Data formats**
  - JSON：配置、文档数据、服务器配置
  - ANTLR Parse Tree：语法树
  - VS Code `Diagnostic` / `CompletionItem` / `Hover` / `TextEdit`
  - HTML / Markdown：函数文档与 Webview 展示

### External Integrations

- **FluffOS compile server**
  - `POST /update_code/update_file`
  - 用于编译当前文件和批量编译
- **FluffOS error viewer endpoints**
  - `GET /error_info/get_compile_errors`
  - `GET /error_info/get_runtime_errors`
  - `GET /error_info/clear_all_errors`
- **Mud Wiki**
  - 当内置 efun 文档缺失时，按需回退查询 `https://mud.wiki`
- **GLM-4 API**
  - 用于生成 Javadoc 风格注释
  - 通过 `lpc.glm4.apiKey`、`lpc.glm4.baseUrl`、`lpc.glm4.model` 等配置驱动

### Monitoring & Dashboard Technologies (if applicable)

本项目当前没有独立的 Web dashboard。

“可见性”主要来自 VS Code 内部能力：

- Output Channel
- Tree View (`lpcErrorTree`)
- Webview Panel（函数文档）
- 编辑器内 Diagnostic / Hover / Completion 等原生 UI

## Development Environment

### Build & Development Tools

- **Build system**:
  - `npm run build`
  - `npm run generate-parser`
  - `node esbuild.mjs`
- **Bundling**:
  - esbuild 将 `src/extension.ts` 打包到 `dist/extension.js`
  - 构建后复制 `src/templates/functionDocPanel.html` 和 `src/templates/functionDocPanel.js` 到 `dist/templates/`
- **Development workflow**:
  - `npm run watch` 用于开发时持续构建
  - 使用 VS Code Extension Development Host 调试扩展

### Code Quality Tools

- **Static analysis**
  - TypeScript 编译检查
  - `tsconfig.json` 启用 `strict: true`
- **Formatting**
  - 当前仓库没有已配置的 ESLint / Prettier / biome / dprint
  - 风格约束主要依赖现有代码风格、TypeScript 编译器和评审约定
- **Testing framework**
  - Jest
  - ts-jest
  - VS Code mock (`tests/mocks/MockVSCode.ts`)
- **Documentation**
  - `README.md`
  - `CHANGELOG.md`
  - `.spec-workflow/steering/*`
  - `项目文档/`

### Version Control & Collaboration

- **VCS**: Git
- **Repository host**: GitHub（由 `package.json` 中的 repository / bugs / homepage 可见）
- **Branching / review**
  - 仓库中未显式定义正式 branching strategy 文档
  - 当前可确认的是 Conventional Commits 风格和基于 Pull Request 的协作预期
- **Automation**
  - 当前仓库未看到 `.github/` 工作流目录，因此不要假设已经存在 CI/CD

### Dashboard Development (if applicable)

不适用。当前产品没有独立 dashboard 子系统。

## Deployment & Distribution

- **Target platform(s)**
  - VS Code Desktop
  - 依赖 Node 侧扩展宿主，因此当前定位不是纯 Web 扩展
- **Distribution method**
  - VS Code Marketplace
  - `.vsix` 打包分发
- **Packaging**
  - `npm run package` 构建并通过 `vsce` 打包
- **Installation requirements**
  - VS Code `^1.80.0`
- **Update mechanism**
  - 通过 VS Code 扩展更新机制和重新安装 `.vsix`

## Technical Requirements & Constraints

### Performance Requirements

- 编辑器补全、跳转和悬停必须保持可交互，不应因为常规文件解析明显卡住编辑
- 诊断应在文档变更后快速刷新，但通过防抖和批处理控制开销
- 解析缓存需要限制条目数、内存占用和存活时间
- 大型 MUD 项目是重要目标场景，因此跨文件扫描必须优先考虑缓存和增量行为

### Compatibility Requirements

- **VS Code**: `^1.80.0`
- **Node target in bundle**: `node16`
- **TypeScript output target**: `ES2020`
- **Language scope**
  - 当前主要面向 FluffOS 风格 LPC
  - 其他 LPC 方言可兼容部分语法，但不是当前 steering 中承诺的正式支持范围

### Security & Compliance

- **Secrets handling**
  - GLM-4 API Key 通过 VS Code 配置保存
  - 当前实现没有专门的密钥保险库抽象
- **Network exposure**
  - 远程编译、错误接口和在线文档抓取都依赖网络
  - 所有网络能力都应视为可选增强，不能阻塞本地基础语言功能
- **Trust model**
  - 扩展默认信任用户配置的服务器地址和文档来源
  - 对返回内容的健壮性处理仍需继续加强

### Scalability & Reliability

- 当前架构适合单工作区、单扩展宿主内的中小到较大 LPC 项目
- 对超大工程的可靠性主要依赖缓存、批处理和避免重复解析
- 因为没有独立 worker / language server 进程，重型分析仍可能影响扩展宿主响应
- 远程接口不可用时，本地语言能力应尽可能继续工作

## Technical Decisions & Rationale

### Decision Log

1. **ANTLR4 parser instead of regex-only language support**
   - 选择原因：需要比 TextMate 语法高亮更深的语义理解，支撑 AST、符号表、诊断和复杂补全
   - 代价：生成代码和语法维护成本更高

2. **Single extension-host architecture instead of separate LSP server**
   - 选择原因：实现成本更低，直接接入 VS Code Provider API，适合当前项目规模
   - 代价：重型分析和缓存都在扩展宿主中完成，隔离性和并发能力有限

3. **esbuild as the bundler**
   - 选择原因：配置简单、构建速度快，足以覆盖当前扩展打包需求
   - 代价：需要手动处理模板文件复制等构建后动作

4. **In-memory parse cache with TTL / size limits**
   - 选择原因：降低重复解析成本，提升编辑时反馈速度
   - 代价：缓存失效和一致性管理更复杂

5. **Provider-oriented module split**
   - 选择原因：贴合 VS Code 扩展模型，能按功能增量扩展
   - 代价：跨 Provider 的共享能力需要通过额外服务层维护，容易形成重复逻辑

6. **Local docs first, remote docs as fallback**
   - 选择原因：保证离线和低延迟体验，减少外部依赖
   - 代价：内置文档需要额外维护，远程回退解析也存在不确定性

7. **Remote compilation as HTTP integration rather than embedded runtime**
   - 选择原因：符合 LPC / FluffOS 项目常见部署方式，避免在扩展中承载驱动逻辑
   - 代价：接口约定依赖项目后端，兼容性和错误处理需要持续适配

## Known Limitations

- 当前不是独立 Language Server，复杂分析可能影响扩展宿主性能
- `src/antlr/` 为生成文件，语法调整成本较高，调试门槛也较高
- 文档、编译、错误树都依赖外部接口或外部站点时，健壮性受网络影响
- 当前没有正式配置的 lint / format 工具链，代码风格依赖人工维持
- 当前没有可见的 CI 工作流，不应假设测试和打包在远端自动执行
- Provider、AST、文档解析之间存在一定耦合，后续继续扩展时需要警惕重复逻辑和隐式依赖
- 目前对 FluffOS 之外的 LPC 方言支持仍属机会性兼容，不应在产品层面过度承诺
