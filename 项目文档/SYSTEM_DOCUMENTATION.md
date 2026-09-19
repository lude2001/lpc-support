# LPC Support 扩展系统文档

## 📋 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [核心功能模块](#核心功能模块)
4. [开发环境配置](#开发环境配置)
5. [构建和部署](#构建和部署)
6. [API 接口文档](#api-接口文档)
7. [配置管理](#配置管理)
8. [性能优化](#性能优化)
9. [故障排除](#故障排除)
10. [开发指南](#开发指南)

---

## 项目概述

### 基本信息
- **项目名称**: LPC Support
- **版本**: 0.52.13
- **开发团队**: 武侠黎明团队
- **开发者**: easyCat
- **项目类型**: Visual Studio Code 扩展
- **目标语言**: LPC (LPMud Creation Language)
- **兼容驱动**: FluffOS

### 项目定位
LPC Support 是一个专为 LPC 语言开发的 VSCode 扩展，提供完整的语言服务支持，包括语法高亮、智能补全、实时诊断、代码格式化、服务器管理等功能。该扩展旨在为 LPC 开发者提供现代化的开发体验。

### 核心特性
- ✅ **语法高亮**: 完整的 LPC 语法高亮支持
- ✅ **智能补全**: Efun、宏定义、自定义函数补全
- ✅ **实时诊断**: 语法错误、未使用变量检测
- ✅ **代码格式化**: 符合团队规范的代码格式化
- ✅ **编译管理**: 本地 `lpccp` 与远程 HTTP 编译
- ✅ **文档系统**: Efun 文档和 Javadoc 注释生成
- ✅ **宏定义支持**: 宏定义识别和跳转
- ✅ **性能优化**: 缓存机制和异步处理

---

## 技术架构

### 技术栈
```
开发语言: TypeScript 5.0+（VS Code 扩展宿主）+ Rust（语言服务器 sidecar）
构建工具: esbuild（TypeScript 打包）+ Cargo（Rust 构建）
语法解析: Tree-sitter（Rust sidecar 内置 LPC grammar）
目标平台: Visual Studio Code 1.82.0+
运行环境: Node.js 20.x + 原生 Rust 二进制
包管理器: npm + Cargo
```

> 历史：2026-09 起旧 TypeScript LSP/分析栈（ANTLR4 `antlr4ts`、`src/antlr/`、`dist/lsp/server.js`）已退役删除，Rust sidecar（`dist/bin/lpc-language-server[.exe]`）是唯一语言服务器入口。

### 架构设计

#### 分层架构
```
┌─────────────────────────────────────┐
│        VSCode Extension API         │  ← 扩展接口层
├─────────────────────────────────────┤
│      TypeScript Host (src/)         │  ← 激活、配置、命令、UI 装配
├─────────────────────────────────────┤
│      LSP Client over stdio          │  ← src/lsp/client/
├─────────────────────────────────────┤
│   Rust Language Server sidecar      │  ← 预处理 / Tree-sitter CST / 语义与索引
├─────────────────────────────────────┤
│        External Services            │  ← 编译服务（lpccp / HTTP）、GLM-4 AI
└─────────────────────────────────────┘
```

#### 模块依赖关系
```
extension.ts (主入口)
├── modules/ (扩展装配层: core / diagnostics / command / ui)
├── lsp/client/ (Rust sidecar 的 LSP 客户端与工作区索引控制)
├── projectConfig/ (lpc-support.json 与 config.hell 同步)
├── compiler.ts + compilation/ (编译链: 本地 lpccp / 远程 HTTP)
├── functionDocPanel.ts + functionDocs/ + efun/ (函数文档中心)
├── diagnostics/RustDiagnosticsCommands.ts + errorTreeDataProvider.ts (诊断命令与错误树)
├── glm4Client.ts + codeActions.ts (AI 服务)
└── rust/crates/lpc-language-server (语言服务器 sidecar:
    预处理、Tree-sitter CST、语义与工作区索引、诊断、补全、跳转、格式化)
```

### 数据流架构
```
用户输入 → VSCode API → LSP 客户端 → Rust sidecar（Tree-sitter CST + 语义/工作区索引）→ LSP 响应 → 编辑器呈现
```

---

## 核心功能模块

### 1. 语法解析模块 (Rust Tree-sitter)

#### 文件结构
```
rust/grammar/lpc/                 # Tree-sitter LPC grammar（生成产物不手改）
rust/crates/lpc-preprocessor/     # 预处理：宏、条件编译、include 与源码映射
rust/crates/lpc-language-server/  # LSP 入口、增量文档同步与调度
```

#### 核心特性
- **增量 CST**: 文档编辑采用增量解析，无需整篇重析
- **错误恢复**: 不完整编辑状态下稳定恢复并产生可定位错误
- **源码映射**: 宏展开与 include 保留原始源码坐标
- **版本化快照**: 诊断、补全、跳转等共享同一份版本化分析状态

#### 语法特性支持
```lpc
// 支持的语法特性示例
inherit "/std/object";                    // 继承语句
#define MACRO_NAME "value"               // 宏定义
int *array = ({ 1, 2, 3 });            // 数组声明
mapping map = ([ "key": "value" ]);     // 映射声明
function f = (: function_name :);        // 函数指针
foreach (mixed item in array) { }       // foreach 循环
```

### 2. 代码诊断模块

#### 实现位置
- `rust/crates/lpc-language-server/` - 诊断由 Rust sidecar 通过 `textDocument/publishDiagnostics` 推送
- `src/diagnostics/RustDiagnosticsCommands.ts` - 消费 Rust 快照的“显示所有 LPC 变量”“扫描文件夹中未使用的变量”命令
- `src/errorTreeDataProvider.ts` - 错误诊断中心视图

#### 诊断功能
诊断类型（由 Rust 分析快照派生）：
- 语法错误
- 未使用变量 / 未使用参数（后者默认关闭，可经 `lpc.enableUnusedParameterCheck` 开启）
- 类型不匹配（可经 `lpc.enableTypeChecking` 关闭）
- 函数参数数量不匹配
- 未定义函数与未定义符号（依赖不完整时保守静默）
- 空 heredoc 多行字符串与文件命名问题

诊断遵守保守策略：include / inherit / 模拟 efun 依赖未完整解析时不产生否定性诊断，减少误报。

### 3. 智能补全模块

#### 实现位置
- `rust/crates/lpc-language-server/` - 补全由 Rust sidecar 通过 `textDocument/completion` 提供

#### 补全类型
- Efun（驱动内置函数，来自本地内置文档 bundle）
- Simulated efun（模拟函数）
- 宏定义、本地 / 继承函数、局部变量与参数
- 关键字与声明修饰符、snippet（含函数参数模板）
- struct/class 字段、预处理指令与 include/inherit 路径

#### 补全触发条件
- `.` / `->` - 对象成员访问
- `::` - 父类与命名继承作用域
- `#` - 预处理指令
- 引号、`<`、`/` - include / inherit 路径
- 字母输入 - 通用补全

### 4. 编译管理模块

#### 实现文件
- `src/compiler.ts`、`src/compilation/` - 编译链（本地 `lpccp` 与远程 HTTP 编译后端）
- `src/projectConfig/` - `lpc-support.json` 项目配置与 `config.hell` 同步

#### 远程编译服务器配置结构（保存在 `lpc-support.json`）
```typescript
interface FluffOSServer {
    name: string;           // 服务器名称
    url: string;            // 服务器 URL
    description?: string;   // 描述信息
    active?: boolean;       // 是否为活动服务器
}
```

#### 编译接口
```typescript
// 编译请求格式
POST /update_file
Content-Type: application/x-www-form-urlencoded
file_name=<encoded_file_path>

// 响应格式
{
    "code": "update_file",
    "file_name": "文件路径",
    "msg": "编译结果信息"
}
```

### 5. 文档管理模块

#### 实现文件
- `src/efun/BundledEfunDocsProvider.ts`、`src/efun/BundledEfunLoader.ts` - 内置 efun 文档展示
- `src/functionDocPanel.ts`、`src/functionDocs/` - 函数文档中心
- `src/language/documentation/DocCommentTagParser.ts` - Javadoc 标签解析
- `src/glm4Client.ts` - AI 文档生成

#### 文档来源
- **Efun 文档**: 随扩展离线打包的本地结构化 bundle（`config/efun-docs/`），运行时不请求 mud.wiki
- **模拟函数与项目函数文档**: 由 Rust 工作区索引解析本地 Javadoc 注释
- **AI 生成文档**: 使用 GLM-4 生成 Javadoc 注释

#### Javadoc 格式
```lpc
/**
 * @brief 函数简要描述
 * @param type param_name 参数描述
 * @return type 返回值描述
 * @details 详细说明
 */
```

### 6. 宏定义管理模块

#### 实现位置
- `rust/crates/lpc-preprocessor/` - 宏定义、条件编译、跨 include 宏环境与源码映射

#### 能力
- 宏的语义高亮、悬浮、定义跳转、查找引用与重命名
- 函数式宏 snippet 补全；整行函数式宏生成的声明进入文档符号
- 宏有效性遵守条件编译、重定义和 `#undef` 的源码顺序
- driver 内建但配置无法推导的宏可经 `lpc-support.json` 的 `preprocessorDefines` 声明

---

## 开发环境配置

### 环境要求
```
Node.js: 20.x+
npm: 9.x+
Rust: 稳定版工具链（见 rust-toolchain.toml）
VSCode: 1.82.0+
TypeScript: 5.0+
```

### 安装步骤
```bash
# 1. 克隆项目
git clone https://github.com/lude2001/lpc-support.git
cd lpc-support

# 2. 安装依赖
npm install

# 3. 构建 Rust 语言服务器
npm run build:rust

# 4. 构建扩展
npm run build

# 5. 打包扩展
npm run package
```

### 开发脚本
```json
{
  "scripts": {
    "build": "node esbuild.mjs",
    "build:rust": "node scripts/build-rust-lsp.mjs",
    "build:dev": "cross-env NODE_ENV=development npm run build",
    "watch": "cross-env NODE_ENV=development node esbuild.mjs --watch",
    "package": "npm run clean && node scripts/package-extension.mjs",
    "clean": "rimraf dist out",
    "check": "tsc -p tsconfig.build.json --noEmit",
    "test": "jest",
    "test:rust": "node scripts/run-cargo.mjs test --manifest-path rust/Cargo.toml --workspace",
    "test:rust-smoke": "node scripts/rust-lsp-smoke.mjs",
    "probe:lsp": "node scripts/lsp-probe.mjs"
  }
}
```

### 调试配置
```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
            "outFiles": ["${workspaceFolder}/dist/**/*.js"]
        }
    ]
}
```

> 源码调试前需要先执行 `npm run build:rust`，否则 sidecar 二进制（`dist/bin/lpc-language-server[.exe]`）缺失会导致语言功能不可用。

---

## 构建和部署

### 构建系统 (esbuild)

#### 构建配置
```javascript
// esbuild.mjs
{
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node16',
  external: ['vscode'],
  format: 'cjs',
  sourcemap: process.env.NODE_ENV === 'development',
  minify: process.env.NODE_ENV === 'production',
  treeShaking: true
}
```

#### 构建优化
- **Tree Shaking**: 移除未使用的代码
- **Bundle 分析**: 分析打包结果
- **外部依赖**: 仅排除 VSCode API
- **源码映射**: 开发模式启用源码映射

#### Rust sidecar 构建
- `npm run build:rust` 通过 Cargo 构建当前平台 `lpc-language-server` 二进制到 `dist/bin/`
- `npm run package` 经 `vscode:prepublish` 自动执行 TS 构建、Rust 构建与原生产物整理
- 构建不再生成任何 TypeScript 语言服务器产物（旧 `dist/lsp/server.js` 构建路径已删除）

### 部署流程

#### 本地部署
```bash
# 1. 构建扩展
npm run build

# 2. 打包 VSIX
npm run package

# 3. 安装扩展
code --install-extension lpc-support-0.1.0.vsix
```

#### 发布到市场
```bash
# 1. 安装 vsce
npm install -g vsce

# 2. 登录发布者账号
vsce login <publisher>

# 3. 发布扩展
vsce publish
```

---

## API 接口文档

### VSCode 扩展 API

#### 语言服务接口
语言功能统一由 Rust sidecar 通过 LSP 提供，TypeScript 宿主通过 `vscode-languageclient` 连接：

- 补全、跳转定义、引用、重命名、悬浮、签名帮助
- 诊断推送（`textDocument/publishDiagnostics`）
- 语义高亮（semantic tokens）、文档符号、折叠、全文与选区格式化
- quick fix（code action）
- 自定义请求：工作区索引状态、函数文档查询等（协议见 `src/lsp/shared/protocol/`）

#### 命令注册
```typescript
// 注册命令
vscode.commands.registerCommand('lpc.compileFile', handler);

// 注册菜单项
"menus": {
    "editor/context": [
        {
            "when": "resourceLangId == lpc",
            "command": "lpc.compileFile",
            "group": "LPC"
        }
    ]
}
```

### 外部服务 API

#### FluffOS 编译接口
```http
POST /update_file HTTP/1.1
Host: server.example.com
Content-Type: application/x-www-form-urlencoded

file_name=%2Fpath%2Fto%2Ffile.c
```

#### GLM-4 AI 接口
```typescript
interface GLM4Request {
    model: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
}
```

---

## 配置管理

### 扩展配置

#### 项目配置
项目事实来自 mudlib 根目录的 `lpc-support.json`（与 `config.hell` 同步），不再使用旧 `lpc.includePath` / `lpc.simulatedEfunsPath` 等 VS Code 设置：
```json
{
    "configHellPath": "config.hell",
    "preprocessorDefines": ["__PACKAGE_DB__"]
}
```

#### 诊断与格式化配置
```json
{
    "lpc.enableUnusedGlobalVarCheck": false,
    "lpc.enableUnusedParameterCheck": false,
    "lpc.enableTypeChecking": true,
    "lpc.searchEfunDefinitionInInheritanceChain": false,
    "lpc.format.indentSize": 4
}
```

#### AI 配置
```json
{
    "lpc.glm4.apiKey": "智谱AI API密钥",
    "lpc.glm4.model": "GLM-4-Flash-250414",
    "lpc.glm4.baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "lpc.glm4.timeout": 30000,
    "lpc.javadoc.enableAutoGeneration": true
}
```

### 服务器配置

#### 配置来源
编译管理（本地 `lpccp` 与远程 HTTP）配置统一保存在 mudlib 根目录的 `lpc-support.json`，由 `src/compiler.ts` 与 `src/compilation/` 消费；不再使用独立的全局 `lpc-servers.json`。

---

## 性能优化

### 分析快照与索引（Rust sidecar）

- **版本化分析快照**: 一个文件版本只产生一个快照，诊断、语义高亮、补全、跳转等从同一快照派生，避免查询时重复解析
- **常驻工作区索引**: include/inherit 依赖图与符号索引持久驻留，文件变化只增量失效自身及反向依赖
- **跨启动缓存**: 索引缓存按扩展版本、项目配置与文件元数据校验；头文件或配置变化保守全量重建
- **后台让出调度**: 冷索引使用单后台线程并在文件间让出执行预算，前台请求优先，索引可取消

### 宿主侧缓存

TypeScript 宿主只保留 `src/core/CacheManager.ts`、`src/core/DocumentCache.ts` 等轻量缓存，用于扩展自身的服务状态；不再缓存解析树，也没有独立于 Rust 的第二套分析缓存。

> 旧 `lpc.performance.*` 配置项已随 TypeScript 分析栈退役移除。

---

## 故障排除

### 常见问题

#### 1. 诊断或语言功能异常
**症状**: 代码高亮异常，补全、跳转或诊断不工作
**原因**: Rust sidecar 未启动、二进制缺失或项目配置不完整
**解决方案**:
打开“输出”面板选择 `LPC LSP` 查看 sidecar 日志；若提示缺少 `dist/bin/lpc-language-server`（Windows 为 `.exe`），重新安装与当前平台匹配的 VSIX；确认 mudlib 根目录有 `lpc-support.json`；必要时执行“LPC: 重建 LPC 工作区索引”后重新加载窗口。

#### 2. 编译服务器连接失败
**症状**: 编译命令无响应或报错
**原因**: 服务器配置错误或服务器离线
**解决方案**:
```bash
# 打开编译管理配置
Ctrl+Shift+P → "LPC: 编译管理"

# 测试服务器连接
curl -X POST http://server:port/update_file \
     -d "file_name=/test/file.c"
```

#### 3. 宏定义不生效
**症状**: 宏补全、跳转或高亮缺失
**原因**: 宏来源未被项目配置覆盖
**解决方案**:
在 mudlib 根目录 `lpc-support.json` 的 `preprocessorDefines` 中显式列出 driver 已启用但配置文件无法推导的宏名，保存后执行“LPC: 重建 LPC 工作区索引”。

#### 4. AI 文档生成失败
**症状**: Javadoc 生成命令报错
**原因**: API 密钥未配置或网络问题
**解决方案**:
```json
// 配置 API 密钥
{
    "lpc.glm4.apiKey": "your-api-key-here"
}
```

### 调试工具

#### 性能与语言能力探针
```bash
# 在真实项目上静态探查诊断、跳转、悬浮、补全等能力与耗时
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --position <line:column>
npm run probe:lsp -- --project <mudlib-root> --file <mudlib-path> --perf --perf-iterations 30
```

#### 日志查看
```bash
# 查看 LSP 日志
VS Code “输出”面板 → 选择 "LPC LSP"

# 查看扩展日志
Ctrl+Shift+P → "Developer: Show Logs" → "Extension Host"
```

---

## 开发指南

### 代码规范

#### TypeScript 规范
```typescript
// 使用严格模式
"strict": true

// 接口命名使用 PascalCase
interface FluffOSServer {
    name: string;
}

// 类命名使用 PascalCase
class LPCDiagnostics {
    // 私有成员使用 private
    private diagnosticCollection: vscode.DiagnosticCollection;
}

// 函数命名使用 camelCase
function analyzeDocument(document: vscode.TextDocument): void {
    // 实现逻辑
}
```

#### 错误处理
```typescript
// 使用 try-catch 处理异常
try {
    const result = await apiCall();
    return result;
} catch (error) {
    vscode.window.showErrorMessage(
        `操作失败: ${error instanceof Error ? error.message : '未知错误'}`
    );
    return null;
}
```

### 测试策略

#### 单元测试
```typescript
// 测试文件命名: *.test.ts
describe('LPCDiagnostics', () => {
    it('should detect unused variables', () => {
        const code = 'int unused_var;';
        const diagnostics = analyzer.analyze(code);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain('未使用的变量');
    });
});
```

#### 集成测试
```typescript
// 测试扩展激活
suite('Extension Test Suite', () => {
    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('ludexiang.lpc-support');
        await ext?.activate();
        assert.ok(ext?.isActive);
    });
});
```

#### Rust 测试与 stdio smoke
```bash
# Rust workspace 单元测试
npm run test:rust

# 原生 sidecar stdio smoke（诊断、补全、签名帮助、宏生命周期、
# 格式化，以及 quickfix 与 range formatting 场景）
npm run test:rust-smoke
```

### 贡献指南

#### 提交规范
```bash
# 提交消息格式
<type>(<scope>): <description>

# 示例
feat(completion): 添加 efun 函数补全支持
fix(diagnostics): 修复未使用变量检测bug
docs(readme): 更新安装说明
```

#### 分支管理
```bash
# 主分支
main        # 稳定版本
develop     # 开发版本

# 功能分支
feature/completion-enhancement
feature/ai-documentation
bugfix/parser-error-handling
```

#### Pull Request 流程
1. Fork 项目到个人仓库
2. 创建功能分支
3. 实现功能并添加测试
4. 提交 Pull Request
5. 代码审查和合并

---

## 附录

### 依赖包说明
```json
{
    "dependencies": {
        "axios": "^1.16.0",                          // HTTP 客户端（GLM-4、远程编译）
        "vscode-languageclient": "^9.0.1",           // LSP 客户端
        "vscode-languageserver-protocol": "^3.17.5"  // LSP 协议类型（自定义协议共享）
    },
    "devDependencies": {
        "@types/jest": "^29.5.14",       // Jest 测试框架类型
        "@types/node": "^20.x",          // Node.js 类型定义
        "@types/vscode": "^1.82.0",      // VSCode API 类型定义
        "@vscode/test-electron": "^2.3.8", // VS Code 扩展生命周期测试
        "@vscode/vsce": "^3.9.2",        // VSIX 打包工具
        "cross-env": "^7.0.3",           // 跨平台环境变量
        "esbuild": "^0.25.5",            // 构建工具
        "jest": "^29.7.0",               // 测试框架
        "rimraf": "^5.0.10",             // 文件删除工具
        "tree-sitter-cli": "^0.27.0",    // Tree-sitter grammar 生成
        "ts-jest": "^29.1.1",            // Jest TypeScript 转换
        "typescript": "^5.0.0"           // TypeScript 编译器
    }
}
```

Rust 侧依赖由 `rust/Cargo.toml` 管理（Tree-sitter、LSP server 等 crate），不进入 npm 依赖。

### 文件扩展名支持
```json
{
    "extensions": [".c", ".h", ".lpc"]
}
```

### 快捷键映射
```json
{
    "keybindings": [
        {
            "command": "lpc.compileFile",
            "key": "ctrl+f5",
            "when": "editorTextFocus && editorLangId == 'lpc'"
        }
    ]
}
```

---

**文档版本**: 2.0.0  
**最后更新**: 2026年9月  
**维护者**: easyCat
**联系方式**: https://github.com/lude2001/lpc-support
