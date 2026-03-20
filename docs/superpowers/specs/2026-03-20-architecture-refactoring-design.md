# LPC Support 架构重构设计

## 概述

对 LPC Support VS Code 扩展进行渐进式架构重构，目标：可维护性、可测试性、可扩展性。分 5 个 Phase 逐步推进，每个 Phase 独立完成、独立测试、独立提交，确保 376 个测试始终全绿。

项目完全自包含，无外部 API 消费者，可以自由重命名、移动文件、改变模块边界。

## 当前问题

| 问题 | 文件 | 行数 | 严重程度 |
|------|------|------|----------|
| FormatPrinter 巨型 switch | `FormatPrinter.ts` | 1,096 | 高 |
| SyntaxBuilder 过于庞大 | `SyntaxBuilder.ts` | 1,344 | 高 |
| EfunDocsManager 职责过多 | `efunDocs.ts` | 945 | 中高 |
| extension.ts 上帝对象 | `extension.ts` | 516 | 中高 |
| DiagnosticsOrchestrator 混合关注点 | `DiagnosticsOrchestrator.ts` | 637 | 中 |
| 多个独立缓存缺乏失效协调 | 多处 | - | 中 |

## 整体策略

**方案 A：逐层渐进式重构**。每个 Phase 之间项目完全可用，可以随时停下来处理紧急问题。对活跃开发的项目，稳定性优先于速度。

## Phase 1: ServiceRegistry + extension.ts 拆分

### 目标

建立轻量级服务注册基础设施，将 extension.ts 从 516 行的上帝对象拆分为 5 个模块。

### ServiceRegistry 设计

零外部依赖的类型安全容器（~60 行）。TypeScript Language Server、rust-analyzer VS Code 端、vscode-eslint 全部使用同一模式。

```typescript
// src/core/ServiceRegistry.ts
export class ServiceKey<T> {
    constructor(public readonly id: string) {}
}

export class ServiceRegistry implements vscode.Disposable {
    private services = new Map<string, unknown>();
    private disposables: vscode.Disposable[] = [];

    register<T>(key: ServiceKey<T>, instance: T): void;
    get<T>(key: ServiceKey<T>): T;  // 未注册时抛出 Error（服务缺失是编程错误）
    track(disposable: vscode.Disposable): void;
    dispose(): void;
}
```

### ServiceKeys 集中定义

```typescript
// src/core/ServiceKeys.ts
export const Services = {
    MacroManager:    new ServiceKey<MacroManager>('MacroManager'),
    EfunDocs:        new ServiceKey<EfunDocsManager>('EfunDocs'),
    ConfigManager:   new ServiceKey<LPCConfigManager>('ConfigManager'),
    Compiler:        new ServiceKey<LPCCompiler>('Compiler'),
    Diagnostics:     new ServiceKey<DiagnosticsOrchestrator>('Diagnostics'),
    Completion:      new ServiceKey<LPCCompletionItemProvider>('Completion'),
    ErrorTree:       new ServiceKey<ErrorTreeDataProvider>('ErrorTree'),
};
```

### 模块拆分

每个模块是一个纯函数 `registerXxx(registry, context)`，不是 class。

| 模块文件 | 来源（extension.ts 行号） | 职责 |
|---------|------------------------|------|
| `src/modules/coreModule.ts` | 35-41 | MacroManager、EfunDocs、ConfigManager、Compiler 实例化 |
| `src/modules/languageModule.ts` | 331-443 | 补全、定义、引用、重命名、语义标记、符号、折叠、格式化 Provider |
| `src/modules/commandModule.ts` | 44-329, 364-402, 489-502 | 所有 registerCommand 调用 |
| `src/modules/diagnosticsModule.ts` | 34-37, 71-91 | 诊断协调器 + 文档分析触发 |
| `src/modules/uiModule.ts` | 99-233, 448-487 | ErrorTree、StatusBar、FunctionDocPanel |

### 重构后的 extension.ts

```typescript
export function activate(context: vscode.ExtensionContext) {
    const registry = new ServiceRegistry();
    context.subscriptions.push(registry);

    registerCoreServices(registry, context);
    registerDiagnostics(registry, context);
    registerLanguageProviders(registry, context);
    registerCommands(registry, context);
    registerUI(registry, context);
}

export function deactivate() {
    disposeGlobalParsedDocumentService();
}
```

### 迁移策略

逐个模块搬移，每搬一个跑全量测试。先搬 coreModule（纯实例化，风险最低），最后搬 commandModule（代码最多但逻辑最简单）。

---

## Phase 2: FormatPrinter 拆分

### 目标

将 1,096 行的 FormatPrinter 按节点类别拆分为 delegate 子模块。

### 拆分策略：委托模式（Delegate Map）

用 `Map<SyntaxKind, PrintDelegate>` 做分派，不用继承、不用 visitor 接口。

原因：
- FormatPrinter 的 switch 本质就是分派表，Map 是最自然的替代
- 各子 printer 通过共享 `PrinterContext` 接口互相调用，不需要抽象基类
- 新增节点类型只需加一个文件 + 注册一行

### 文件结构

```
src/formatter/printer/
  ├── FormatPrinter.ts         (~150-180行) 入口 + 分派 + trivia 处理 + 框架方法
  ├── PrinterContext.ts         (~30行)  共享上下文接口
  ├── PrintContext.ts           (不变)   缩进上下文
  ├── delegates/
  │   ├── declarationPrinter.ts (~150行) 函数声明、变量声明、struct/class、字段
  │   ├── statementPrinter.ts   (~200行) if/while/do-while/for/foreach/switch/return/expression stmt
  │   ├── expressionRenderer.ts (~200行) 所有 renderExpression 分支
  │   └── collectionPrinter.ts  (~120行) mapping/array literal、new expression
```

### PrinterContext 接口

```typescript
export interface PrinterContext {
    printNode(node: FormatNode, context: PrintContext): string;
    renderExpression(node: FormatNode, context: PrintContext): string;
    renderInlineExpression(node: FormatNode, context: PrintContext): string;
    renderStructuredValue(node: FormatNode, context: PrintContext): string;
    printAttachedStatement(node: FormatNode | undefined, context: PrintContext): string;
    printBlock(node: FormatNode, context: PrintContext): string;
    printParameterList(node: FormatNode | undefined): string;
}
```

### Delegate 注册模式

```typescript
// delegates/statementPrinter.ts
export function registerStatementPrinters(
    delegates: Map<SyntaxKind, PrintDelegate>,
    ctx: PrinterContext
): void {
    delegates.set(SyntaxKind.IfStatement, (node, pc) => printIfStatement(node, pc, ctx));
    delegates.set(SyntaxKind.WhileStatement, (node, pc) => printWhileStatement(node, pc, ctx));
}

function printIfStatement(node: FormatNode, context: PrintContext, ctx: PrinterContext): string {
    // 原有逻辑不变，this.xxx 改为 ctx.xxx
}
```

### 不用 Visitor 模式的原因

FormatPrinter 不是遍历 AST 做聚合，而是递归下降打印，每个节点直接返回 string。Visitor 模式引入不必要的 accept/visit 间接层，delegate map 是最薄的一层间接。

### 方法分类原则

- **PrinterContext 接口方法**：有状态的（依赖 config 或需要递归分派的），如 `printNode`、`renderExpression`、`printBlock`、`printHeaderWithBlock`
- **printerUtils.ts**：无状态纯函数，如 `normalizeInlineText`、`appendToLastLine`、`trimTrailingWhitespace`
- **FormatPrinter 本体保留**：trivia 处理方法（`attachPreservableTrivia`、`renderStandaloneTrivia`、`attachTrailingTrivia`）和 block spacing 逻辑（`needsBlankLineBetweenTopLevelNodes`、`needsBlankLineBetweenBlockNodes`）——这些是跨节点类型的通用框架逻辑

### 迁移策略

1. 建骨架（FormatPrinter 重构 + PrinterContext 接口 + 空 delegate 文件）
2. 逐个 delegate 文件搬移方法，每搬一个跑 formatter 全量测试（87+ 测试）
3. 最后清理 FormatPrinter 中已搬走的 private 方法

---

## Phase 3: EfunDocsManager 拆分

### 目标

将 945 行、6 个 Map、5 个职责的 EfunDocsManager 拆为门面 + 独立子服务。

### 文件结构

```
src/efun/
  ├── EfunDocsManager.ts       (~100行) 门面：统一查询接口
  ├── BundledEfunLoader.ts     (~120行) 加载 efun-docs.json / lpc-config.json
  ├── RemoteEfunFetcher.ts     (~100行) mud.wiki 抓取 + HTML 解析 + 去重请求
  ├── SimulatedEfunScanner.ts  (~130行) 扫描模拟函数库目录
  ├── FileFunctionDocTracker.ts(~180行) 跟踪当前文件 + 继承文件 + include 文件的函数文档（含 findFunctionDocInIncludes、getIncludeFiles）
  ├── EfunHoverProvider.ts     (~100行) hover 内容渲染（createHoverContent）
  ├── types.ts                 (~40行)  EfunDoc、BundledEfunDoc 等接口定义
  └── docParser.ts             (~80行)  共享文档解析（extractTagBlock、parseFunctionDocs）
```

### 关键设计决策

1. **docParser 提取**：`parseSimulatedEfunDocs` 和 `parseFunctionDocs` 逻辑高度重复，统一为 `parseFunctionDocs(content, category)` 共享函数。

2. **EfunDocsManager 变为门面**：
   - 持有各 loader 引用，提供统一查询接口
   - 暴露给外部消费者（completionProvider、definitionProvider、functionDocPanel）的公开方法不变
   - hover 查询优先级保持不变：当前文件 → 继承文件 → include 文件 → 模拟函数库 → 标准 efun → 远程 wiki

3. **HTML 解析留在 RemoteEfunFetcher 内部**：`parseMudWikiDocHtml`、`stripHtmlTags`、`decodeHtmlEntities` 是纯粹的 wiki 解析逻辑，只有远程获取用到。

### 迁移策略

1. 建 `src/efun/types.ts`，搬移接口定义
2. 提取 `docParser.ts`，统一两份重复的解析逻辑
3. 逐个提取 loader/scanner/fetcher/tracker
4. 最后提取 HoverProvider
5. EfunDocsManager 瘦身为门面

---

## Phase 4: SyntaxBuilder 拆分

### 目标

将 1,344 行的 SyntaxBuilder 按语法类别拆为多个 builder 文件。

### 拆分策略：方法外提

与 FormatPrinter 的 delegate map 不同，SyntaxBuilder 的方法形成深度调用链，且大量依赖基础设施方法（`createNode`、`createNodeBetween`、token 处理）。使用 delegate map 需要传递太多参数。

正确做法：按语法类别拆为独立函数文件，SyntaxBuilder 保持单个 class 但方法实现分布在多个文件中。

### 文件结构

```
src/syntax/
  ├── SyntaxBuilder.ts            (~180行) class 定义 + 基础设施方法 + build() 入口
  ├── builders/
  │   ├── statementBuilders.ts    (~200行) if/while/for/foreach/switch/return/break/continue
  │   ├── declarationBuilders.ts  (~180行) function/variable/struct/class/parameter/directive
  │   ├── expressionBuilders.ts   (~350行) 优先级链 + unary/cast/postfix/primary
  │   └── collectionBuilders.ts   (~120行) mapping/array/new/structInitializer/stringConcat
```

### 实现方式

```typescript
// builders/statementBuilders.ts
export function buildIfStatement(b: SyntaxBuilder, ctx: IfStatementContext): SyntaxNode {
    // 原来的 this.xxx 改为 b.xxx
}

// SyntaxBuilder.ts
import { buildIfStatement, ... } from './builders/statementBuilders';

export class SyntaxBuilder {
    // 基础设施方法改为 public（仅暴露外部 builder 实际需要调用的方法，
    // 纯内部计算如 positionAt、offsetFromLineAndCharacter 可通过高层方法间接使用）
    // 分派方法调用外部函数
    buildStatement(ctx: StatementContext): SyntaxNode {
        if (ctx.ifStatement()) return buildIfStatement(this, ctx.ifStatement()!);
    }
}
```

### 接口变更

基础设施方法（`createNode`、`createNodeBetween` 等 ~20 个）需改为 `public`。项目完全自包含，无外部影响。

### 二元表达式链处理

10 个几乎相同的 `buildXxxExpression` 方法保持各自独立函数，不做进一步抽象。每个函数签名绑定特定 ANTLR context 类型，合并需要泛型体操，收益不值得。

### 迁移策略

1. 基础设施方法改为 public
2. 逐组搬移：collection → declaration → statement → expression
3. 每搬一组跑全量 formatter + completion 测试
4. expression 最后搬（方法最多、调用最密集）

---

## Phase 5: DiagnosticsOrchestrator 分离 + 缓存协调

### 目标

拆分 DiagnosticsOrchestrator 的混合职责，建立文档生命周期事件的统一协调。

### DiagnosticsOrchestrator 拆分

```
src/diagnostics/
  ├── DiagnosticsOrchestrator.ts  (~180行) 核心：collector 管理 + 分析调度 + 去抖
  ├── VariableInspectorPanel.ts   (~100行) showAllVariables + getVariablesHtml
  ├── FolderScanner.ts            (~120行) scanFolder + findLPCFiles
```

### 提取内容

1. **VariableInspectorPanel** — WebView 面板功能，和诊断收集无关。命令注册移到 commandModule。
2. **FolderScanner** — 批量扫描功能，通过构造函数接收 orchestrator 引用。
3. **宏 hover provider**（134-154 行）— 与诊断无关，是 MacroManager 的 hover 逻辑。搬到 languageModule。

### 缓存协调：DocumentLifecycleService

解决文档变更/关闭时多个模块缓存失效不协调的问题。

DocumentLifecycleService **替代**当前分散在各模块中的独立事件订阅（DiagnosticsOrchestrator 的 onDidCloseTextDocument/onDidDeleteFiles、DocumentCache 的 setupAutoInvalidation 中的相应订阅），统一为单一订阅点。各模块不再自行订阅文档生命周期事件，而是通过 `onInvalidate` 注册回调。

```typescript
// src/core/DocumentLifecycleService.ts (~60行)
type InvalidateHandler = (uri: vscode.Uri) => void;

export class DocumentLifecycleService implements vscode.Disposable {
    private handlers: InvalidateHandler[] = [];

    constructor() {
        // 订阅一次 VS Code 事件
        vscode.workspace.onDidCloseTextDocument(doc => this.invalidate(doc.uri));
        vscode.workspace.onDidDeleteFiles(e => e.files.forEach(uri => this.invalidate(uri)));
    }

    onInvalidate(handler: InvalidateHandler): void {
        this.handlers.push(handler);
    }

    private invalidate(uri: vscode.Uri): void {
        for (const handler of this.handlers) {
            handler(uri);
        }
    }
}
```

各模块注册各自的清理逻辑：

```typescript
lifecycle.onInvalidate(uri => {
    getGlobalParsedDocumentService().invalidate(uri);
    astManager.clearCache(uri.toString());
});

lifecycle.onInvalidate(uri => {
    completionProvider.invalidateCache(uri);
});
```

### 不做的事

- 不建通用缓存框架——各模块的缓存策略差异大，强行统一收益不大
- 不合并各模块缓存——缓存内容不同（parse tree、symbol index、completion 结果）
- 只解决失效协调问题

### 迁移策略

1. 提取 VariableInspectorPanel 和 FolderScanner
2. 宏 hover provider 搬到 languageModule
3. 瘦身后的 Orchestrator 验证全量诊断测试
4. 引入 DocumentLifecycleService，逐个模块接入

---

## 预期成果

| Phase | 改什么 | 核心产出 | 风险 |
|-------|--------|---------|------|
| 1 | extension.ts | ServiceRegistry + 5 个模块 | 低 |
| 2 | FormatPrinter | Delegate Map + 4 个子 printer | 中 |
| 3 | EfunDocsManager | 门面 + 5 个子服务 + docParser 去重 | 低 |
| 4 | SyntaxBuilder | 方法外提 + 4 个 builder 文件 | 低 |
| 5 | DiagnosticsOrchestrator + 缓存 | 3 个提取 + DocumentLifecycleService | 低 |

全部完成后，最大文件从 1,344 行降到 ~350 行，平均模块体积下降 60%。

## 约束

- 每个 Phase 独立完成、独立提交，376 个测试始终全绿
- 不引入外部依赖
- 不改变现有功能行为
- 不做假设性的未来设计
