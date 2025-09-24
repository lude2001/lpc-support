# Technology Stack: LPC Support Extension

## Project Type

**VS Code Language Extension** - 专业的集成开发环境扩展，为LPC编程语言提供现代化的开发工具支持，包括语法分析、智能补全、错误诊断、远程编译等完整IDE功能。

## Core Technologies

### Primary Language(s)
- **Language**: TypeScript 5.0+ (严格模式)
- **Runtime**: Node.js (VS Code Extension Host环境)
- **Build Tools**:
  - esbuild (高性能打包编译)
  - TypeScript Compiler (类型检查)
  - antlr4ts-cli (语法解析器生成)

### Key Dependencies/Libraries

#### 核心框架依赖
- **@types/vscode ^1.95.0**: VS Code扩展API类型定义
- **vscode Engine ^1.80.0**: VS Code扩展运行时最低版本要求

#### 语法解析引擎
- **antlr4ts ^0.5.0-alpha.4**: ANTLR4 TypeScript运行时，提供专业语法解析能力
- **antlr4ts-cli ^0.5.0-alpha.4**: ANTLR4语法生成器，从.g4文件生成TypeScript解析器

#### 网络与数据处理
- **axios ^1.12.1**: HTTP客户端，用于FluffOS服务器通信和在线文档获取
- **cheerio ^1.0.0-rc.12**: 服务器端DOM解析，用于在线文档内容提取和处理

#### 开发与测试工具
- **jest ^29.7.0**: 单元测试框架
- **ts-jest ^29.1.1**: Jest的TypeScript支持
- **@vscode/test-electron ^2.3.8**: VS Code扩展集成测试框架

### Application Architecture

**Language Server Protocol (LSP) 风格架构** + **Provider模式**：

- **Extension Host**: VS Code扩展主进程，负责生命周期管理和API注册
- **Provider Pattern**: 各功能模块实现VS Code标准Provider接口
- **AST-Driven Architecture**: 基于ANTLR4语法树的深度语言理解
- **Event-Driven**: 响应VS Code编辑器事件和用户交互
- **Modular Plugin System**: 功能模块化，支持独立开发和测试

### Data Storage
- **Primary Storage**:
  - VS Code Settings (用户配置持久化)
  - 文件系统缓存 (AST解析结果缓存)
  - 内存缓存 (符号表、解析树)
- **Caching Strategy**:
  - 解析结果LRU缓存 (提升大文件性能)
  - 符号索引增量更新
  - 配置热更新机制
- **Data Formats**:
  - JSON (配置文件、文档数据)
  - ANTLR4 ParseTree (语法树)
  - VS Code TextEdit (代码修改指令)

### External Integrations

#### FluffOS MUD服务器集成
- **Protocol**: HTTP/HTTPS RESTful API
- **Authentication**: 基于Token或Basic Auth的服务器认证
- **功能**: 远程编译、错误诊断、文件同步

#### 在线文档服务
- **APIs**: FluffOS官方文档API、GitHub Raw API
- **Protocol**: HTTPS GET请求
- **数据格式**: HTML解析、Markdown处理

#### AI服务集成
- **GLM-4 API**: 智能代码注释生成
- **Authentication**: API Key认证
- **Protocol**: HTTPS POST (JSON payload)

## Development Environment

### Build & Development Tools
- **Build System**:
  - npm scripts (任务编排)
  - esbuild (快速打包，支持增量编译)
  - TypeScript compiler (类型检查)
- **Package Management**: npm (Node.js标准包管理器)
- **Development Workflow**:
  - Watch模式开发 (文件变更自动重编译)
  - VS Code Extension Development Host (调试环境)
  - 热重载支持 (开发时扩展自动重载)

### Code Quality Tools
- **Static Analysis**:
  - TypeScript严格模式 (完整类型检查)
  - ESLint规则 (代码风格和质量检查)
- **Testing Framework**:
  - Jest (单元测试)
  - VS Code Test Runner (集成测试)
  - Coverage报告 (测试覆盖率)
- **Documentation**:
  - TSDoc注释 (API文档生成)
  - README.md (用户文档)
  - CHANGELOG.md (版本更新记录)

### Version Control & Collaboration
- **VCS**: Git
- **Branching Strategy**: GitHub Flow (feature branches + main)
- **Code Review Process**:
  - Pull Request工作流
  - 自动化CI检查 (测试、构建、类型检查)
  - Code Review必需审批

### Extension Development Specifics
- **Debug Configuration**: VS Code launch.json配置
- **Extension Packaging**: vsce (Visual Studio Code Extension manager)
- **Market Distribution**: VS Code Marketplace自动发布
- **Version Management**: 语义化版本控制 (semantic versioning)

## Deployment & Distribution

### Target Platform(s)
- **Primary**: VS Code Desktop (Windows, macOS, Linux)
- **Secondary**: VS Code Web (有限功能支持)
- **Architecture Support**: x64, ARM64 (跟随VS Code支持)

### Distribution Method
- **主要渠道**: VS Code Marketplace (官方扩展商店)
- **安装方式**:
  - GUI: VS Code扩展面板搜索安装
  - CLI: `code --install-extension ludexiang.lpc-support`
  - 手动: .vsix文件本地安装

### Installation Requirements
- **必需**: VS Code 1.80.0或更高版本
- **推荐**: Node.js 16+ (用于开发和高级功能)
- **可选**: FluffOS MUD服务器 (远程编译功能)

### Update Mechanism
- **自动更新**: VS Code扩展自动更新机制
- **版本策略**: 主版本.次版本.补丁版本
- **发布频率**: 月度功能更新 + 及时bug修复

## Technical Requirements & Constraints

### Performance Requirements
- **启动时间**: 扩展激活时间 < 2秒
- **响应时间**:
  - 代码补全响应 < 100ms
  - 语法高亮更新 < 50ms
  - 错误诊断更新 < 500ms
- **内存使用**:
  - 基础功能 < 50MB
  - 大型项目缓存 < 200MB
- **文件处理**: 支持10MB+的大型LPC文件

### Compatibility Requirements
- **VS Code版本**: 1.80.0+ (保持向前兼容)
- **Node.js版本**: 16+ (Extension Host要求)
- **操作系统**: Windows 10+, macOS 10.15+, Linux (主流发行版)
- **LPC方言支持**: FluffOS (主要), LDMudlib (计划), MudOS (兼容)

### Security & Compliance
- **数据隐私**:
  - 用户代码不上传至第三方服务
  - 配置数据本地存储
  - 远程编译仅传输必要代码片段
- **Network Security**:
  - HTTPS强制加密通信
  - 服务器证书验证
  - 用户Token安全存储

### Scalability & Reliability
- **项目规模**: 支持1000+文件的大型MUD项目
- **并发处理**: 多文件并行解析和分析
- **错误恢复**: 语法错误不影响其他功能正常运行
- **缓存策略**: 智能缓存管理，避免内存泄漏

## Technical Decisions & Rationale

### Decision Log

1. **ANTLR4 vs 正则表达式语法分析**
   - **选择**: ANTLR4语法解析器
   - **理由**: 提供精确的语法树，支持复杂语言特性分析，可扩展性强
   - **权衡**: 增加了复杂度但获得了专业级语言支持能力

2. **TypeScript严格模式**
   - **选择**: 启用strict模式
   - **理由**: 确保类型安全，减少运行时错误，提升代码质量
   - **权衡**: 开发时间略增但长期维护成本显著降低

3. **esbuild vs Webpack打包**
   - **选择**: esbuild作为主要打包工具
   - **理由**: 编译速度快10-100倍，配置简单，满足扩展打包需求
   - **权衡**: 生态相对较新但性能优势明显

4. **Provider模式架构**
   - **选择**: 采用VS Code标准Provider接口
   - **理由**: 与VS Code生态完美集成，功能模块化，便于测试和维护
   - **权衡**: 需要理解VS Code API但获得了标准化的扩展架构

5. **缓存策略设计**
   - **选择**: 多层缓存 (内存+文件系统)
   - **理由**: 平衡性能和资源消耗，支持大型项目
   - **权衡**: 缓存管理复杂度增加但用户体验显著提升

## Known Limitations

- **WebAssembly支持**: ANTLR4 TypeScript版本尚不支持WASM，无法在VS Code Web版本中完整运行
- **多线程解析**: 受Node.js单线程限制，超大项目解析可能阻塞UI线程
- **内存优化**: 大型项目的符号表和AST缓存可能占用较多内存
- **方言兼容性**: 目前主要针对FluffOS，其他LPC方言支持有待完善
- **离线功能**: 部分功能（在线文档、AI助手）需要网络连接

### 技术债务和改进计划
- **性能优化**: 计划引入Worker线程处理大文件解析
- **内存管理**: 实现更智能的缓存淘汰策略
- **Web支持**: 探索ANTLR4 Web版本或替代方案
- **多语言支持**: 扩展支持更多LPC方言和相关语言