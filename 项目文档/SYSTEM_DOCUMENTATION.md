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
- **版本**: 0.1.0
- **开发团队**: 武侠黎明团队
- **开发者**: ludexiang
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
- ✅ **服务器管理**: FluffOS 服务器配置和远程编译
- ✅ **文档系统**: Efun 文档和 Javadoc 注释生成
- ✅ **宏定义支持**: 宏定义识别和跳转
- ✅ **性能优化**: 缓存机制和异步处理

---

## 技术架构

### 技术栈
```
开发语言: TypeScript 5.0+
构建工具: esbuild
语法解析: ANTLR4 (antlr4ts)
目标平台: Visual Studio Code 1.80.0+
运行环境: Node.js 20.x
包管理器: npm
```

### 架构设计

#### 分层架构
```
┌─────────────────────────────────────┐
│           VSCode Extension API       │  ← 扩展接口层
├─────────────────────────────────────┤
│         Language Services           │  ← 语言服务层
├─────────────────────────────────────┤
│       Core Business Logic           │  ← 业务逻辑层
├─────────────────────────────────────┤
│         ANTLR Parser Engine         │  ← 语法解析层
├─────────────────────────────────────┤
│        External Services            │  ← 外部服务层
└─────────────────────────────────────┘
```

#### 模块依赖关系
```
extension.ts (主入口)
├── diagnostics.ts (诊断服务)
├── completionProvider.ts (补全服务)
├── compiler.ts (编译服务)
├── config.ts (配置管理)
├── macroManager.ts (宏管理)
├── efunDocs.ts (文档管理)
├── glm4Client.ts (AI 服务)
└── parser/ (解析器模块)
    ├── LPCParserUtil.ts
    ├── ParseTreePrinter.ts
    └── CollectingErrorListener.ts
```

### 数据流架构
```
用户输入 → VSCode API → 语言服务 → ANTLR 解析器 → AST → 业务逻辑 → 结果输出
```

---

## 核心功能模块

### 1. 语法解析模块 (ANTLR)

#### 文件结构
```
grammar/
├── LPCLexer.g4     # 词法分析器语法定义
└── LPCParser.g4    # 语法分析器语法定义

src/antlr/          # ANTLR 生成的解析器
├── LPCLexer.ts
├── LPCParser.ts
├── LPCParserVisitor.ts
└── LPCVisitor.ts
```

#### 核心特性
- **完整的 LPC 语法支持**: 支持所有 LPC 语言特性
- **错误恢复机制**: 语法错误时的智能恢复
- **访问者模式**: 使用访问者模式遍历 AST
- **性能优化**: 缓存解析结果，避免重复解析

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

#### 实现文件
- `src/diagnostics.ts` - 主诊断逻辑
- `src/collectors/` - 各种代码收集器

#### 诊断功能
```typescript
// 诊断类型
enum DiagnosticType {
    SyntaxError,           // 语法错误
    UnusedVariable,        // 未使用变量
    UnusedParameter,       // 未使用参数
    ApplyReturnMismatch,   // Apply 函数返回值不匹配
    FileNamingIssue        // 文件命名问题
}
```

#### 收集器架构
```
collectors/
├── UnusedVariableCollector.ts      # 未使用变量收集
├── GlobalVariableCollector.ts      # 全局变量收集
├── LocalVariableDeclarationCollector.ts # 局部变量声明收集
├── StringLiteralCollector.ts       # 字符串字面量收集
└── FileNamingCollector.ts          # 文件命名收集
```

### 3. 智能补全模块

#### 实现文件
- `src/completionProvider.ts` - 补全提供程序

#### 补全类型
```typescript
enum CompletionType {
    Efun,           // 系统函数
    Macro,          // 宏定义
    LocalFunction,  // 本地函数
    Variable,       // 变量
    Keyword,        // 关键字
    Snippet         // 代码片段
}
```

#### 补全触发条件
- `.` - 对象成员访问
- `->` - 对象方法调用
- `#` - 宏定义引用
- 字母输入 - 通用补全

### 4. 服务器管理模块

#### 实现文件
- `src/config.ts` - 配置管理器
- `src/compiler.ts` - 编译器

#### 服务器配置结构
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
- `src/efunDocs.ts` - Efun 文档管理
- `src/functionDocPanel.ts` - 函数文档面板
- `src/glm4Client.ts` - AI 文档生成

#### 文档来源
- **Efun 文档**: 从 mud.wiki 和 fluffos.info 获取
- **模拟函数文档**: 解析本地 Javadoc 注释
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

#### 实现文件
- `src/macroManager.ts` - 宏管理器

#### 宏定义结构
```typescript
interface MacroDefinition {
    name: string;        // 宏名称
    value: string;       // 宏值
    file: string;        // 定义文件
    line: number;        // 定义行号
    description?: string; // 描述信息
}
```

#### 宏定义扫描
- 扫描指定目录下的头文件
- 解析 `#define` 语句
- 提供宏定义跳转和补全

---

## 开发环境配置

### 环境要求
```
Node.js: 20.x+
npm: 9.x+
VSCode: 1.80.0+
TypeScript: 5.0+
```

### 安装步骤
```bash
# 1. 克隆项目
git clone https://github.com/lude2001/lpc-support.git
cd lpc-support

# 2. 安装依赖
npm install

# 3. 生成 ANTLR 解析器
npm run generate-parser

# 4. 构建项目
npm run build

# 5. 打包扩展
npm run package
```

### 开发脚本
```json
{
  "scripts": {
    "build": "npm run generate-parser && node esbuild.mjs",
    "build:dev": "cross-env NODE_ENV=development npm run build",
    "watch": "cross-env NODE_ENV=development node esbuild.mjs --watch",
    "generate-parser": "antlr4ts -visitor -no-listener -o src/antlr grammar/LPCLexer.g4 grammar/LPCParser.g4",
    "package": "npm run clean && npm run build && vsce package",
    "clean": "rimraf dist out",
    "analyze": "cross-env NODE_ENV=development npm run build -- --analyze"
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
```typescript
// 补全提供程序
vscode.languages.registerCompletionItemProvider(
    'lpc',
    completionProvider,
    '.', '->', '#'
);

// 诊断提供程序
vscode.languages.createDiagnosticCollection('lpc');

// 定义跳转提供程序
vscode.languages.registerDefinitionProvider(
    'lpc',
    definitionProvider
);
```

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

#### 基础配置
```json
{
    "lpc.includePath": "宏定义包含目录路径",
    "lpc.simulatedEfunsPath": "模拟函数库目录路径",
    "lpc.driver.command": "MUD驱动启动命令"
}
```

#### 诊断配置
```json
{
    "lpc.enableUnusedParameterCheck": true,
    "lpc.enableUnusedGlobalVarCheck": true
}
```

#### 性能配置
```json
{
    "lpc.performance.debounceDelay": 300,
    "lpc.performance.maxCacheSize": 50,
    "lpc.performance.maxCacheMemory": 5000000,
    "lpc.performance.enableAsyncDiagnostics": true,
    "lpc.performance.batchSize": 50
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

#### 配置文件位置
```
~/.vscode/extensions/ludexiang.lpc-support-0.1.0/
└── globalStorage/
    └── lpc-servers.json
```

#### 配置文件格式
```json
{
    "servers": [
        {
            "name": "本地服务器",
            "url": "http://127.0.0.1:8080",
            "description": "本地开发服务器",
            "active": true
        }
    ],
    "defaultServer": "本地服务器"
}
```

---

## 性能优化

### 缓存机制

#### 解析缓存
```typescript
interface ParseCacheEntry {
    document: vscode.TextDocument;
    parseTree: ParseTree;
    timestamp: number;
    memorySize: number;
}
```

#### 缓存策略
- **LRU 淘汰**: 最近最少使用的缓存项优先淘汰
- **内存限制**: 限制缓存总内存使用量
- **时间过期**: 缓存项超时自动失效

### 异步处理

#### 防抖机制
```typescript
// 防抖延迟配置
const debounceDelay = vscode.workspace
    .getConfiguration('lpc.performance')
    .get<number>('debounceDelay', 300);
```

#### 批量处理
```typescript
// 批量处理大小配置
const batchSize = vscode.workspace
    .getConfiguration('lpc.performance')
    .get<number>('batchSize', 50);
```

### 内存管理

#### 内存监控
```typescript
interface CacheStats {
    size: number;      // 缓存项数量
    memory: number;    // 内存使用量（字节）
    hitRate: number;   // 缓存命中率
}
```

#### 资源清理
```typescript
// 扩展停用时清理资源
export function deactivate() {
    disposeParseCache();
}
```

---

## 故障排除

### 常见问题

#### 1. 语法解析错误
**症状**: 代码高亮异常，补全不工作
**原因**: ANTLR 解析器无法解析代码
**解决方案**:
```bash
# 查看解析错误详情
Ctrl+Shift+P → "LPC: 调试：解析错误详情"

# 查看解析树
Ctrl+Shift+P → "LPC: 调试：显示 LPC 解析树"
```

#### 2. 编译服务器连接失败
**症状**: 编译命令无响应或报错
**原因**: 服务器配置错误或服务器离线
**解决方案**:
```bash
# 检查服务器配置
Ctrl+Shift+P → "LPC: 管理编译服务器"

# 测试服务器连接
curl -X POST http://server:port/update_file \
     -d "file_name=/test/file.c"
```

#### 3. 宏定义不生效
**症状**: 宏定义补全不工作，跳转失败
**原因**: 宏定义路径配置错误
**解决方案**:
```bash
# 配置宏定义路径
Ctrl+Shift+P → "LPC: 配置宏定义目录"

# 重新扫描宏定义
Ctrl+Shift+P → "LPC: 显示所有宏定义"
```

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

#### 性能监控
```bash
# 查看性能统计
Ctrl+Shift+P → "LPC: 显示性能统计"

# 清理缓存
Ctrl+Shift+P → "LPC: 清理解析缓存"
```

#### 日志查看
```bash
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
        "@types/cheerio": "^0.22.35",    // HTML 解析类型定义
        "@types/vscode": "^1.95.0",      // VSCode API 类型定义
        "antlr4ts": "^0.5.0-alpha.4",    // ANTLR TypeScript 运行时
        "axios": "^1.7.7",               // HTTP 客户端
        "cheerio": "^1.0.0-rc.12"        // HTML 解析库
    },
    "devDependencies": {
        "@types/jest": "^29.5.14",       // Jest 测试框架类型
        "@types/node": "^20.x",          // Node.js 类型定义
        "antlr4ts-cli": "^0.5.0-alpha.4", // ANTLR 命令行工具
        "cross-env": "^7.0.3",           // 跨平台环境变量
        "esbuild": "^0.25.5",            // 构建工具
        "rimraf": "^5.0.10",             // 文件删除工具
        "typescript": "^5.0.0"           // TypeScript 编译器
    }
}
```

### 文件扩展名支持
```json
{
    "extensions": [".c", ".h", ".lpc", ".i"]
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

**文档版本**: 1.0.0  
**最后更新**: 2024年12月  
**维护者**: ludexiang  
**联系方式**: https://github.com/lude2001/lpc-support