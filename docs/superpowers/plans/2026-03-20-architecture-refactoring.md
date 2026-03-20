# 架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LPC Support 扩展的核心大文件拆分为职责清晰的小模块，提升可维护性、可测试性和可扩展性。

**Architecture:** 分 5 个 Phase 渐进式重构。Phase 1 建立 ServiceRegistry 基础设施并拆分 extension.ts；Phase 2-4 分别拆分 FormatPrinter、EfunDocsManager、SyntaxBuilder；Phase 5 拆分 DiagnosticsOrchestrator 并引入缓存协调层。每个 Phase 独立完成、独立提交，376 个测试始终全绿。

**Tech Stack:** TypeScript, VS Code Extension API, ANTLR4

**Spec:** `docs/superpowers/specs/2026-03-20-architecture-refactoring-design.md`

**Test command:** `npm test`

**Validation rule:** 每个 Task 结束时必须跑 `npm test`，376 个测试全部通过才可提交。

---

## File Structure

### Phase 1 新建文件
- `src/core/ServiceRegistry.ts` — 类型安全服务容器
- `src/core/ServiceKeys.ts` — 服务 Key 集中定义
- `src/modules/coreModule.ts` — 核心服务实例化
- `src/modules/languageModule.ts` — 语言 Provider 注册
- `src/modules/commandModule.ts` — 命令注册
- `src/modules/diagnosticsModule.ts` — 诊断系统注册
- `src/modules/uiModule.ts` — UI 组件注册

### Phase 1 修改文件
- `src/extension.ts` — 瘦身为 ~50 行入口

### Phase 2 新建文件
- `src/formatter/printer/PrinterContext.ts` — 共享上下文接口
- `src/formatter/printer/printerUtils.ts` — 纯函数工具
- `src/formatter/printer/delegates/declarationPrinter.ts` — 声明打印
- `src/formatter/printer/delegates/statementPrinter.ts` — 语句打印
- `src/formatter/printer/delegates/expressionRenderer.ts` — 表达式渲染
- `src/formatter/printer/delegates/collectionPrinter.ts` — 集合打印

### Phase 2 修改文件
- `src/formatter/printer/FormatPrinter.ts` — 瘦身为 ~150-180 行入口

### Phase 3 新建文件
- `src/efun/types.ts` — EfunDoc 等接口定义
- `src/efun/docParser.ts` — 共享文档解析
- `src/efun/BundledEfunLoader.ts` — 内置文档加载
- `src/efun/RemoteEfunFetcher.ts` — mud.wiki 远程获取
- `src/efun/SimulatedEfunScanner.ts` — 模拟函数库扫描
- `src/efun/FileFunctionDocTracker.ts` — 文件函数文档跟踪
- `src/efun/EfunHoverProvider.ts` — hover 内容渲染

### Phase 3 修改文件
- `src/efunDocs.ts` — 移动到 `src/efun/EfunDocsManager.ts`，瘦身为门面

### Phase 4 新建文件
- `src/syntax/builders/statementBuilders.ts` — 语句构建
- `src/syntax/builders/declarationBuilders.ts` — 声明构建
- `src/syntax/builders/expressionBuilders.ts` — 表达式构建
- `src/syntax/builders/collectionBuilders.ts` — 集合构建

### Phase 4 修改文件
- `src/syntax/SyntaxBuilder.ts` — 瘦身为 ~180 行

### Phase 5 新建文件
- `src/diagnostics/VariableInspectorPanel.ts` — 变量检查面板
- `src/diagnostics/FolderScanner.ts` — 文件夹扫描
- `src/core/DocumentLifecycleService.ts` — 文档生命周期事件总线

### Phase 5 修改文件
- `src/diagnostics/DiagnosticsOrchestrator.ts` — 瘦身为 ~180 行

---

## Phase 1: ServiceRegistry + extension.ts 拆分

### Task 1: 创建 ServiceRegistry

**Files:**
- Create: `src/core/ServiceRegistry.ts`

- [ ] **Step 1: 创建 ServiceRegistry**

```typescript
// src/core/ServiceRegistry.ts
import * as vscode from 'vscode';

export class ServiceKey<T> {
    constructor(public readonly id: string) {}
}

export class ServiceRegistry implements vscode.Disposable {
    private services = new Map<string, unknown>();
    private disposables: vscode.Disposable[] = [];

    register<T>(key: ServiceKey<T>, instance: T): void {
        if (this.services.has(key.id)) {
            throw new Error(`Service "${key.id}" is already registered`);
        }
        this.services.set(key.id, instance);
    }

    get<T>(key: ServiceKey<T>): T {
        const service = this.services.get(key.id);
        if (service === undefined) {
            throw new Error(`Service "${key.id}" is not registered`);
        }
        return service as T;
    }

    track(disposable: vscode.Disposable): void {
        this.disposables.push(disposable);
    }

    dispose(): void {
        for (const disposable of this.disposables.reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
        this.services.clear();
    }
}
```

- [ ] **Step 2: 验证编译通过**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/core/ServiceRegistry.ts
git commit -m "feat: add ServiceRegistry for dependency management"
```

---

### Task 2: 创建 ServiceKeys + coreModule

**Files:**
- Create: `src/core/ServiceKeys.ts`
- Create: `src/modules/coreModule.ts`

- [ ] **Step 1: 创建 ServiceKeys**

```typescript
// src/core/ServiceKeys.ts
import { ServiceKey } from './ServiceRegistry';
import type { MacroManager } from '../macroManager';
import type { EfunDocsManager } from '../efunDocs';
import type { LPCConfigManager } from '../config';
import type { LPCCompiler } from '../compiler';
import type { DiagnosticsOrchestrator } from '../diagnostics';
import type { LPCCompletionItemProvider } from '../completionProvider';
import type { ErrorTreeDataProvider } from '../errorTreeDataProvider';
import type { CompletionInstrumentation } from '../completion/completionInstrumentation';

export const Services = {
    MacroManager: new ServiceKey<MacroManager>('MacroManager'),
    EfunDocs: new ServiceKey<EfunDocsManager>('EfunDocs'),
    ConfigManager: new ServiceKey<LPCConfigManager>('ConfigManager'),
    Compiler: new ServiceKey<LPCCompiler>('Compiler'),
    Diagnostics: new ServiceKey<DiagnosticsOrchestrator>('Diagnostics'),
    Completion: new ServiceKey<LPCCompletionItemProvider>('Completion'),
    ErrorTree: new ServiceKey<ErrorTreeDataProvider>('ErrorTree'),
    CompletionInstrumentation: new ServiceKey<CompletionInstrumentation>('CompletionInstrumentation'),
};
```

- [ ] **Step 2: 创建 coreModule**

将 `extension.ts:35-41` 的服务实例化搬到这里：

```typescript
// src/modules/coreModule.ts
import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { MacroManager } from '../macroManager';
import { EfunDocsManager } from '../efunDocs';
import { LPCConfigManager } from '../config';
import { LPCCompiler } from '../compiler';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';

export function registerCoreServices(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = new MacroManager();
    registry.register(Services.MacroManager, macroManager);
    context.subscriptions.push(macroManager);

    const efunDocsManager = new EfunDocsManager(context);
    registry.register(Services.EfunDocs, efunDocsManager);

    const completionInstrumentation = new CompletionInstrumentation();
    registry.register(Services.CompletionInstrumentation, completionInstrumentation);
    context.subscriptions.push(completionInstrumentation);

    const configManager = new LPCConfigManager(context);
    registry.register(Services.ConfigManager, configManager);

    const compiler = new LPCCompiler(configManager);
    registry.register(Services.Compiler, compiler);
}
```

- [ ] **Step 3: 验证编译通过**

Run: `npx tsc --noEmit`

- [ ] **Step 4: 提交**

```bash
git add src/core/ServiceKeys.ts src/modules/coreModule.ts
git commit -m "feat: add ServiceKeys and coreModule"
```

---

### Task 3: 创建 diagnosticsModule

**Files:**
- Create: `src/modules/diagnosticsModule.ts`

- [ ] **Step 1: 创建 diagnosticsModule**

将 `extension.ts:34-37, 71-91` 的诊断初始化搬到这里：

```typescript
// src/modules/diagnosticsModule.ts
import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator } from '../diagnostics';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const diagnostics = new DiagnosticsOrchestrator(context, macroManager);
    registry.register(Services.Diagnostics, diagnostics);

    // 分析当前打开的文档
    if (vscode.window.activeTextEditor) {
        diagnostics.analyzeDocument(vscode.window.activeTextEditor.document);
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add src/modules/diagnosticsModule.ts
git commit -m "feat: add diagnosticsModule"
```

---

### Task 4: 创建 languageModule

**Files:**
- Create: `src/modules/languageModule.ts`

- [ ] **Step 1: 创建 languageModule**

将 `extension.ts:331-443` 的 Provider 注册搬到这里：

```typescript
// src/modules/languageModule.ts
import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { LPCCompletionItemProvider } from '../completionProvider';
import { LPCDefinitionProvider } from '../definitionProvider';
import { LPCSemanticTokensProvider, LPCSemanticTokensLegend } from '../semanticTokensProvider';
import { LPCSymbolProvider } from '../symbolProvider';
import { LPCReferenceProvider } from '../referenceProvider';
import { LPCRenameProvider } from '../renameProvider';
import { LPCFoldingRangeProvider } from '../foldingProvider';
import { LPCFormattingProvider } from '../formatter/LPCFormattingProvider';
import { LPCCodeActionProvider } from '../codeActions';

export function registerLanguageProviders(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const efunDocsManager = registry.get(Services.EfunDocs);
    const macroManager = registry.get(Services.MacroManager);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);

    // 补全
    const completionProvider = new LPCCompletionItemProvider(efunDocsManager, macroManager, completionInstrumentation);
    registry.register(Services.Completion, completionProvider);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('lpc', completionProvider, '>', '#')
    );

    // 文档变更时清除补全缓存
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'lpc') {
                completionProvider.handleDocumentChange(event.document);
            }
        })
    );

    // 定义跳转
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('lpc', new LPCDefinitionProvider(macroManager, efunDocsManager))
    );

    // 格式化
    const formattingProvider = new LPCFormattingProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider('lpc', formattingProvider),
        vscode.languages.registerDocumentRangeFormattingEditProvider('lpc', formattingProvider)
    );

    // 语义标记
    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'lpc' },
            new LPCSemanticTokensProvider(),
            LPCSemanticTokensLegend
        )
    );

    // 文档符号（大纲）
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider({ language: 'lpc' }, new LPCSymbolProvider())
    );

    // 引用
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider('lpc', new LPCReferenceProvider())
    );

    // 重命名
    context.subscriptions.push(
        vscode.languages.registerRenameProvider('lpc', new LPCRenameProvider())
    );

    // 折叠
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider({ language: 'lpc' }, new LPCFoldingRangeProvider())
    );

    // 代码操作
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('lpc', new LPCCodeActionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add src/modules/languageModule.ts
git commit -m "feat: add languageModule"
```

---

### Task 5: 创建 commandModule

**Files:**
- Create: `src/modules/commandModule.ts`

- [ ] **Step 1: 创建 commandModule**

将 `extension.ts` 中所有 `registerCommand` 调用搬到这里。这是最大的模块，包含：
- efun 文档设置命令（44-62）
- 未使用变量检查（77-85）
- 文件夹扫描（88-91）
- 函数文档面板（94-97）
- 编译相关（236-270, 388-396）
- 解析树调试（273-329）
- 服务器管理（381-386）
- 宏管理（399-402）
- 继承关系扫描（366-374）
- 性能监控（490-502）

```typescript
// src/modules/commandModule.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { FunctionDocPanel } from '../functionDocPanel';
import { LPCCompiler } from '../compiler';
import { LPCConfigManager } from '../config';
import { getParseTreeString } from '../parser/ParseTreePrinter';
import { DebugErrorListener } from '../parser/DebugErrorListener';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../parser/ParsedDocumentService';

export function registerCommands(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const diagnostics = registry.get(Services.Diagnostics);
    const completionProvider = registry.get(Services.Completion);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);
    const configManager = registry.get(Services.ConfigManager);
    const compiler = registry.get(Services.Compiler);

    // efun 文档设置
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.efunDocsSettings', async () => {
            const items = [
                {
                    label: "配置模拟函数库目录",
                    description: "设置本地模拟函数库的目录路径",
                    command: 'lpc.configureSimulatedEfuns'
                }
            ];
            const selected = await vscode.window.showQuickPick(items, { placeHolder: 'efun文档设置' });
            if (selected) {
                vscode.commands.executeCommand(selected.command);
            }
        })
    );

    // 未使用变量检查
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc-support.checkUnusedVariables', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                diagnostics.analyzeDocument(editor.document, true);
                vscode.window.showInformationMessage('已完成未使用变量检查');
            }
        })
    );

    // 文件夹扫描
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.scanFolder', () => diagnostics.scanFolder())
    );

    // 函数文档面板
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showFunctionDoc', () => {
            FunctionDocPanel.createOrShow(context, macroManager);
        })
    );

    // 批量编译
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.compileFolder', async (uri?: vscode.Uri) => {
            let targetFolder: string;
            if (uri) {
                targetFolder = uri.fsPath;
            } else {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage('请先打开一个工作区');
                    return;
                }
                const folders = workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    uri: folder.uri
                }));
                if (folders.length === 1) {
                    targetFolder = folders[0].uri.fsPath;
                } else {
                    const selected = await vscode.window.showQuickPick(folders, { placeHolder: '选择要编译的文件夹' });
                    if (!selected) return;
                    targetFolder = selected.uri.fsPath;
                }
            }
            await new LPCCompiler(new LPCConfigManager(context)).compileFolder(targetFolder);
        })
    );

    // 显示解析树
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showParseTree', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'lpc') {
                vscode.window.showWarningMessage('请在 LPC 文件中使用此命令。');
                return;
            }
            try {
                const parseTreeStr = getParseTreeString(editor.document.getText());
                const output = vscode.window.createOutputChannel('LPC ParseTree');
                output.clear();
                output.appendLine(parseTreeStr);
                output.show(true);
            } catch (err: any) {
                vscode.window.showErrorMessage(`解析 LPC 代码时发生错误: ${err.message || err}`);
            }
        })
    );

    // 调试语法错误
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.debugParseErrors', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'lpc') {
                vscode.window.showWarningMessage('请在 LPC 文件中使用此命令');
                return;
            }
            const code = editor.document.getText();
            const input = CharStreams.fromString(code);
            const lexer = new LPCLexer(input);
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);
            const debugListener = new DebugErrorListener();
            parser.removeErrorListeners();
            parser.addErrorListener(debugListener);
            parser.sourceFile();
            const output = vscode.window.createOutputChannel('LPC Parse Debug');
            output.clear();
            if (debugListener.errors.length === 0) {
                output.appendLine('未发现 ANTLR 语法错误。');
            } else {
                debugListener.errors.forEach((err, idx) => {
                    output.appendLine(`错误 ${idx + 1}: 行 ${err.line}, 列 ${err.column}`);
                    output.appendLine(`  token: ${err.offendingToken}`);
                    output.appendLine(`  message: ${err.message}`);
                    if (err.ruleStack.length) {
                        output.appendLine(`  rule stack: ${err.ruleStack.join(' -> ')}`);
                    }
                    output.appendLine('');
                });
            }
            output.show(true);
        })
    );

    // 服务器管理
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.addServer', () => configManager.addServer()),
        vscode.commands.registerCommand('lpc.selectServer', () => configManager.selectServer()),
        vscode.commands.registerCommand('lpc.removeServer', () => configManager.removeServer()),
        vscode.commands.registerCommand('lpc.manageServers', () => configManager.showServerManager())
    );

    // 编译文件
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.compileFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                await compiler.compileFile(editor.document.fileName);
            }
        })
    );

    // 宏管理
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showMacros', () => macroManager.showMacrosList()),
        vscode.commands.registerCommand('lpc.configureMacroPath', () => macroManager.configurePath())
    );

    // 继承关系扫描
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.scanInheritance', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                completionProvider.scanInheritance(editor.document);
            } else {
                vscode.window.showWarningMessage('请在LPC文件中使用此命令');
            }
        })
    );

    // 性能监控
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showPerformanceStats', () => {
            const stats = getGlobalParsedDocumentService().getStats();
            completionInstrumentation.showReport(stats);
            vscode.window.showInformationMessage(completionInstrumentation.formatSummary(stats));
        }),
        vscode.commands.registerCommand('lpc.clearCache', () => {
            clearGlobalParsedDocumentService();
            completionProvider.clearCache();
            completionInstrumentation.clear();
            vscode.window.showInformationMessage('LPC 解析与补全缓存已清理');
        })
    );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add src/modules/commandModule.ts
git commit -m "feat: add commandModule"
```

---

### Task 6: 创建 uiModule

**Files:**
- Create: `src/modules/uiModule.ts`

- [ ] **Step 1: 创建 uiModule**

将 `extension.ts:99-233, 448-487` 的 ErrorTree 和 StatusBar 注册搬到这里：

```typescript
// src/modules/uiModule.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { ErrorTreeDataProvider, ErrorServerConfig } from '../errorTreeDataProvider';

export function registerUI(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    registerErrorTree(registry, context);
    registerDriverStatusBar(context);
    registerConfigWatcher(registry);
}

function registerErrorTree(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const errorTreeProvider = new ErrorTreeDataProvider();
    registry.register(Services.ErrorTree, errorTreeProvider);
    vscode.window.createTreeView('lpcErrorTree', { treeDataProvider: errorTreeProvider });

    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.errorTree.refresh', () => errorTreeProvider.refresh()),
        vscode.commands.registerCommand('lpc.errorTree.clear', () => errorTreeProvider.clearErrors()),

        vscode.commands.registerCommand('lpc.errorTree.addServer', async () => {
            const name = await vscode.window.showInputBox({ prompt: '输入服务器名称' });
            if (!name) return;
            const address = await vscode.window.showInputBox({ prompt: '输入服务器地址 (例如 http://127.0.0.1:8092)' });
            if (!address) return;
            const config = vscode.workspace.getConfiguration('lpc.errorViewer');
            const servers = config.get<ErrorServerConfig[]>('servers') || [];
            servers.push({ name, address });
            await config.update('servers', servers, vscode.ConfigurationTarget.Global);
            errorTreeProvider.refresh();
        }),

        vscode.commands.registerCommand('lpc.errorTree.removeServer', async () => {
            const servers = errorTreeProvider.getServers();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('没有配置的服务器。');
                return;
            }
            const serverToRemove = await vscode.window.showQuickPick(servers.map(s => s.name), { placeHolder: '选择要移除的服务器' });
            if (serverToRemove) {
                const updatedServers = servers.filter(s => s.name !== serverToRemove);
                await vscode.workspace.getConfiguration('lpc.errorViewer').update('servers', updatedServers, vscode.ConfigurationTarget.Global);
                errorTreeProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('lpc.errorTree.manageServers', async () => {
            const items = [
                { label: "添加新服务器", command: 'lpc.errorTree.addServer' },
                { label: "移除服务器", command: 'lpc.errorTree.removeServer' },
                { label: "手动编辑 settings.json", command: 'openSettings' }
            ];
            const selected = await vscode.window.showQuickPick(items, { placeHolder: '管理错误查看器服务器' });
            if (selected) {
                if (selected.command === 'openSettings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.errorViewer.servers');
                } else {
                    vscode.commands.executeCommand(selected.command);
                }
            }
        }),

        vscode.commands.registerCommand('lpc.errorTree.selectServer', async () => {
            const servers = errorTreeProvider.getServers();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('没有可用的服务器，请先添加。', '添加服务器').then(selection => {
                    if (selection === '添加服务器') {
                        vscode.commands.executeCommand('lpc.errorTree.addServer');
                    }
                });
                return;
            }
            const selected = await vscode.window.showQuickPick(servers.map(s => s.name), { placeHolder: "选择一个活动的错误服务器" });
            if (selected) {
                const server = servers.find(s => s.name === selected);
                if (server) {
                    errorTreeProvider.setActiveServer(server);
                }
            }
        }),

        vscode.commands.registerCommand('lpc.errorTree.openErrorLocation', async (errorItem: any) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("请先打开一个工作区");
                return;
            }
            const rootPath = workspaceFolders[0].uri.fsPath;
            const filePath = path.join(rootPath, errorItem.file);
            const fileUri = vscode.Uri.file(filePath);
            try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const editor = await vscode.window.showTextDocument(doc);
                const line = errorItem.line - 1;
                const range = new vscode.Range(line, 0, line, 100);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.end);
            } catch (e) {
                vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
            }
        }),

        vscode.commands.registerCommand('lpc.errorTree.copyError', async (errorItem: any) => {
            if (!errorItem || !errorItem.fullError) {
                vscode.window.showErrorMessage('无法复制错误信息：错误项无效');
                return;
            }
            try {
                const errorInfo = `文件: ${errorItem.file}\n行号: ${errorItem.line}\n错误类型: ${errorItem.type === 'compile' ? '编译错误' : '运行时错误'}\n错误信息: ${errorItem.fullError}`;
                await vscode.env.clipboard.writeText(errorInfo);
                vscode.window.showInformationMessage('错误信息已复制到剪贴板');
            } catch (error) {
                vscode.window.showErrorMessage('复制错误信息失败');
            }
        })
    );
}

function registerDriverStatusBar(context: vscode.ExtensionContext): void {
    const startDriverCommandId = 'lpc.startDriver';
    const driverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    driverStatusBarItem.command = startDriverCommandId;
    driverStatusBarItem.text = `$(play) 启动驱动`;
    driverStatusBarItem.tooltip = "启动 MUD 驱动程序";
    driverStatusBarItem.show();
    context.subscriptions.push(driverStatusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand(startDriverCommandId, () => {
            const config = vscode.workspace.getConfiguration('lpc');
            const driverCommand = config.get<string>('driver.command');
            if (!driverCommand) {
                vscode.window.showWarningMessage('未配置驱动启动命令。请在设置中配置 `lpc.driver.command`。', '打开设置').then(selection => {
                    if (selection === '打开设置') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.driver.command');
                    }
                });
                return;
            }
            let cwd: string | undefined;
            if (path.isAbsolute(driverCommand)) {
                cwd = path.dirname(driverCommand);
            } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            const terminal = vscode.window.createTerminal({ name: `MUD Driver`, cwd });
            terminal.sendText(driverCommand);
            terminal.show();
        })
    );
}

function registerConfigWatcher(registry: ServiceRegistry): void {
    const errorTreeProvider = registry.get(Services.ErrorTree);
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('lpc.errorViewer.servers')) {
            errorTreeProvider.refresh();
        }
    });
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`

- [ ] **Step 3: 提交**

```bash
git add src/modules/uiModule.ts
git commit -m "feat: add uiModule"
```

---

### Task 7: 重构 extension.ts 使用模块

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: 替换 extension.ts 内容**

用以下内容完全替换 `src/extension.ts`：

```typescript
import * as vscode from 'vscode';
import { ServiceRegistry } from './core/ServiceRegistry';
import { registerCoreServices } from './modules/coreModule';
import { registerDiagnostics } from './modules/diagnosticsModule';
import { registerLanguageProviders } from './modules/languageModule';
import { registerCommands } from './modules/commandModule';
import { registerUI } from './modules/uiModule';
import { disposeGlobalParsedDocumentService } from './parser/ParsedDocumentService';

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

- [ ] **Step 2: 运行全量测试**

Run: `npm test`
Expected: 376 tests passing, 0 failures

- [ ] **Step 3: 验证构建产出**

Run: `npm run build`
Expected: 构建成功，dist/extension.js 生成

- [ ] **Step 4: 提交**

```bash
git add src/extension.ts
git commit -m "refactor: slim extension.ts to use modular registration"
```

---

## Phase 2: FormatPrinter 拆分

### Task 8: 创建 PrinterContext 接口 + printerUtils

**Files:**
- Create: `src/formatter/printer/PrinterContext.ts`
- Create: `src/formatter/printer/printerUtils.ts`

- [ ] **Step 1: 创建 PrinterContext 接口**

```typescript
// src/formatter/printer/PrinterContext.ts
import { FormatNode } from '../model/formatNodes';
import { PrintContext } from './PrintContext';

export type PrintDelegate = (node: FormatNode, context: PrintContext) => string;

export interface PrinterContext {
    printNode(node: FormatNode, context: PrintContext): string;
    renderExpression(node: FormatNode, context: PrintContext): string;
    renderInlineExpression(node: FormatNode, context: PrintContext): string;
    renderStructuredValue(node: FormatNode, context: PrintContext): string;
    printAttachedStatement(node: FormatNode | undefined, context: PrintContext): string;
    printBlock(node: FormatNode, context: PrintContext): string;
    printParameterList(node: FormatNode | undefined): string;
    printHeaderWithBlock(header: string, body: FormatNode | undefined, context: PrintContext): string;
}
```

- [ ] **Step 2: 创建 printerUtils**

从 `FormatPrinter.ts:923-1097` 提取所有模块级纯函数（`normalizeInlineText`、`appendToLastLine`、`repeatPointer`、`trimTrailingWhitespace`、`ensureStatementTerminator`、`prefixMultiline`、`trimLeadingIndent`、`extractPreservableTrivia`、`hasPreservableTrivia`、`containsCommentSyntax`、`indentTrivia`、`normalizeClosureBody`、`classifyBlockSpacingGroup`、`shouldPreserveTerminalNewline`）到 `printerUtils.ts`。

这些函数原封不动搬移，不改逻辑。在 `printerUtils.ts` 头部加上必要的 import：

```typescript
// src/formatter/printer/printerUtils.ts
import { FormatNode } from '../model/formatNodes';
import { SyntaxKind } from '../../syntax/types';
import { normalizeLeadingCommentBlock } from '../comments/commentFormatter';

// 以下从 FormatPrinter.ts 第 923-1097 行原封不动搬入
export function normalizeInlineText(text: string): string { ... }
export function appendToLastLine(text: string, suffix: string): string { ... }
export function repeatPointer(count: number): string { ... }
export function trimTrailingWhitespace(text: string): string { ... }
export function ensureStatementTerminator(text: string): string { ... }
export function prefixMultiline(prefix: string, value: string, indent: string): string { ... }
export function trimLeadingIndent(text: string, indent: string): string { ... }
export function extractPreservableTrivia(trivia: readonly string[]): string[] { ... }
export function hasPreservableTrivia(node: FormatNode): boolean { ... }
export function containsCommentSyntax(text: string): boolean { ... }
export function indentTrivia(entry: string, indent: string): string { ... }
export function normalizeClosureBody(text: string): string { ... }
export function classifyBlockSpacingGroup(node: FormatNode): 'declaration' | 'control' | 'other' { ... }
export function shouldPreserveTerminalNewline(text: string): boolean { ... }
```

- [ ] **Step 3: 更新 FormatPrinter.ts 的 import**

在 `FormatPrinter.ts` 顶部添加 `import { ... } from './printerUtils';` 并删除文件底部搬走的函数。确保 FormatPrinter 类内的方法调用这些函数时不需要改名（它们在原文件中本来就是模块级函数调用）。

- [ ] **Step 4: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add src/formatter/printer/PrinterContext.ts src/formatter/printer/printerUtils.ts src/formatter/printer/FormatPrinter.ts
git commit -m "refactor: extract PrinterContext interface and printer utils"
```

---

### Task 9: 创建 declarationPrinter delegate

**Files:**
- Create: `src/formatter/printer/delegates/declarationPrinter.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`

- [ ] **Step 1: 创建 declarationPrinter**

从 `FormatPrinter` 类中提取以下方法为独立函数：
- `printFunctionDeclaration`（125-146）
- `printVariableDeclaration`（148-162）
- `printVariableDeclarator`（190-201）
- `printStructLike`（164-176）
- `printFieldDeclaration`（178-188）
- `printAnonymousFunction`（203-208）
- `renderParameterDeclaration`（748-767）
- `renderForeachBinding`（737-746）

每个方法签名从 `private xxx(node, context)` 变为 `function xxx(node, context, ctx: PrinterContext)`。方法体中 `this.xxx` 改为 `ctx.xxx`，调用 `normalizeInlineText` 等纯函数改为从 `printerUtils` 导入。

最后 export 一个注册函数：

```typescript
export function registerDeclarationPrinters(
    delegates: Map<SyntaxKind, PrintDelegate>,
    ctx: PrinterContext
): void {
    delegates.set(SyntaxKind.FunctionDeclaration, (node, pc) => printFunctionDeclaration(node, pc, ctx));
    delegates.set(SyntaxKind.VariableDeclaration, (node, pc) => printVariableDeclaration(node, pc, ctx));
    delegates.set(SyntaxKind.StructDeclaration, (node, pc) => printStructLike(node, pc, ctx, 'struct'));
    delegates.set(SyntaxKind.ClassDeclaration, (node, pc) => printStructLike(node, pc, ctx, 'class'));
    delegates.set(SyntaxKind.FieldDeclaration, (node, pc) => printFieldDeclaration(node, pc, ctx));
}
```

- [ ] **Step 2: 更新 FormatPrinter**

在 `FormatPrinter` 构造函数中调用 `registerDeclarationPrinters`。从 `printNode` 的 switch 中移除已注册的 case（由 delegate map 处理）。删除已搬走的 private 方法。

- [ ] **Step 3: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/formatter/printer/delegates/declarationPrinter.ts src/formatter/printer/FormatPrinter.ts
git commit -m "refactor: extract declaration printer delegate"
```

---

### Task 10: 创建 statementPrinter delegate

**Files:**
- Create: `src/formatter/printer/delegates/statementPrinter.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`

- [ ] **Step 1: 创建 statementPrinter**

提取以下方法：
- `printIfStatement`（210-230）
- `printWhileStatement`（232-239）
- `printDoWhileStatement`（241-249）
- `printForStatement`（251-284）
- `printForeachStatement`（322-332）
- `printSwitchStatement`（286-296）
- `printSwitchClause`（298-311）
- `printDefaultClause`（313-320）
- `printExpressionStatement`（384-388）
- `printReturnStatement`（390-397）

注册 delegate map entries。

- [ ] **Step 2: 更新 FormatPrinter，删除搬走的方法**

- [ ] **Step 3: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/formatter/printer/delegates/statementPrinter.ts src/formatter/printer/FormatPrinter.ts
git commit -m "refactor: extract statement printer delegate"
```

---

### Task 11: 创建 collectionPrinter delegate

**Files:**
- Create: `src/formatter/printer/delegates/collectionPrinter.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`

- [ ] **Step 1: 创建 collectionPrinter**

提取以下方法：
- `printMappingLiteral`（457-464）
- `printMappingEntryLine`（466-468）
- `printMappingEntry`（470-474）
- `printArrayLiteral`（476-482）
- `printArrayItem`（484-489）
- `printNewExpression`（491-506）
- `printStructInitializer`（508-512）
- `tryRenderCompactArrayLiteral`（416-427）
- `canRenderCompactArrayLiteral`（429-435）
- `canRenderCompactArrayItem`（437-451）
- `getArrayItems`（453-455）
- `wrapCollection`（523-533）

注册 delegate map entries（`MappingLiteralExpression`、`MappingEntry`、`ArrayLiteralExpression`、`NewExpression`）。

- [ ] **Step 2: 更新 FormatPrinter**

- [ ] **Step 3: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/formatter/printer/delegates/collectionPrinter.ts src/formatter/printer/FormatPrinter.ts
git commit -m "refactor: extract collection printer delegate"
```

---

### Task 12: 创建 expressionRenderer delegate

**Files:**
- Create: `src/formatter/printer/delegates/expressionRenderer.ts`
- Modify: `src/formatter/printer/FormatPrinter.ts`

- [ ] **Step 1: 创建 expressionRenderer**

提取 `renderExpression`（535-580）及其所有子方法：
- `renderIdentifier`（582-588）
- `renderLiteral`（590-592）
- `renderUnaryExpression`（594-615）
- `renderBinaryExpression`（617-633）
- `renderAssignmentExpression`（635-643）
- `renderConditionalExpression`（645-658）
- `printCallExpression`（660-672）
- `renderMemberAccessExpression`（674-682）
- `renderIndexExpression`（684-691）
- `renderPostfixExpression`（693-701）
- `renderClosureExpression`（703-714）
- `renderExpressionList`（716-735）

Export 一个 `renderExpression` 函数供 FormatPrinter 调用（不走 delegate map，因为表达式渲染从多处调用，不走 `printNode` 分派）。

```typescript
export function renderExpression(node: FormatNode, context: PrintContext, ctx: PrinterContext): string {
    switch (node.syntaxKind) {
        case SyntaxKind.Identifier: return renderIdentifier(node);
        // ... 原有 switch 分支
    }
}
```

- [ ] **Step 2: 更新 FormatPrinter**

`FormatPrinter.renderExpression` 变为：

```typescript
public renderExpression(node: FormatNode, context: PrintContext): string {
    return renderExpression(node, context, this);
}
```

删除搬走的所有 render 方法。

- [ ] **Step 3: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/formatter/printer/delegates/expressionRenderer.ts src/formatter/printer/FormatPrinter.ts
git commit -m "refactor: extract expression renderer delegate"
```

---

## Phase 3: EfunDocsManager 拆分

### Task 13: 创建 efun/types.ts + docParser.ts

**Files:**
- Create: `src/efun/types.ts`
- Create: `src/efun/docParser.ts`

- [ ] **Step 1: 创建 types.ts**

从 `src/efunDocs.ts:6-43` 提取所有接口定义：`EfunDoc`、`BundledEfunDoc`、`BundledEfunDocBundle`、`LegacyEfunConfigEntry`、`LegacyEfunConfig`。

- [ ] **Step 2: 创建 docParser.ts**

统一 `parseSimulatedEfunDocs`（448-526）和 `parseFunctionDocs`（558-628）为一个共享函数。同时提取 `extractTagBlock`（438-446）。

```typescript
// src/efun/docParser.ts
import { EfunDoc } from './types';

export function extractTagBlock(docComment: string, tag: string): string | undefined { ... }

export function parseFunctionDocs(content: string, category: string): Map<string, EfunDoc> {
    // 合并后的统一实现
}
```

- [ ] **Step 3: 更新 efunDocs.ts 使用新模块**

将 `efunDocs.ts` 中的 import 改为从 `./efun/types` 和 `./efun/docParser` 导入，删除内联的重复实现。

- [ ] **Step 4: 运行全量测试**

Run: `npm test`
Expected: 全部通过（特别关注 `efunDocs.test.ts`）

- [ ] **Step 5: 提交**

```bash
git add src/efun/types.ts src/efun/docParser.ts src/efunDocs.ts
git commit -m "refactor: extract efun types and shared doc parser"
```

---

### Task 14: 提取 BundledEfunLoader + RemoteEfunFetcher

**Files:**
- Create: `src/efun/BundledEfunLoader.ts`
- Create: `src/efun/RemoteEfunFetcher.ts`
- Modify: `src/efunDocs.ts`

- [ ] **Step 1: 创建 BundledEfunLoader**

从 `efunDocs.ts` 提取：`loadBundledDocs`（104-125）、`loadLegacyBundledDocs`（127-168）、`getConfigSearchRoots`（170-177）、`normalizeSnippet`（179-189）、`cleanText`（191-194）、`extractReturnType`（196-227）。

公开接口：`get(name)`, `getAllNames()`, `getCategories()`.

- [ ] **Step 2: 创建 RemoteEfunFetcher**

从 `efunDocs.ts` 提取：`fetchMissingMudWikiDoc`（242-261）、`fetchMudWikiDoc`（263-277）、`getMudWikiTitleCandidates`（279-287）、`parseMudWikiDocHtml`（289-356）、`stripHtmlTags`（358-363）、`decodeHtmlEntities`（365-374）。

公开接口：`fetchDoc(name): Promise<EfunDoc | undefined>`.

- [ ] **Step 3: 更新 efunDocs.ts**

用 BundledEfunLoader 和 RemoteEfunFetcher 替换内联实现。

- [ ] **Step 4: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add src/efun/BundledEfunLoader.ts src/efun/RemoteEfunFetcher.ts src/efunDocs.ts
git commit -m "refactor: extract BundledEfunLoader and RemoteEfunFetcher"
```

---

### Task 15: 提取 SimulatedEfunScanner + FileFunctionDocTracker + EfunHoverProvider

**Files:**
- Create: `src/efun/SimulatedEfunScanner.ts`
- Create: `src/efun/FileFunctionDocTracker.ts`
- Create: `src/efun/EfunHoverProvider.ts`
- Modify: `src/efunDocs.ts` → 移动到 `src/efun/EfunDocsManager.ts`

- [ ] **Step 1: 创建 SimulatedEfunScanner**

从 `efunDocs.ts` 提取：`configureSimulatedEfuns`（376-394）、`loadSimulatedEfuns`（396-433）、`resolveProjectPath`（936-944）。使用 `docParser.parseFunctionDocs` 替换 `parseSimulatedEfunDocs`。

公开接口：`get(name)`, `getAllNames()`, `configure()`, `load()`.

- [ ] **Step 2: 创建 FileFunctionDocTracker**

从 `efunDocs.ts` 提取：`updateCurrentFileDocs`（532-549）、`parseInheritStatements`（635-646）、`loadInheritedFileDocs`（651-692）、`findFunctionDocInIncludes`（861-885）、`getIncludeFiles`（890-930）。使用 `docParser.parseFunctionDocs`。

公开接口：`getDoc(name): EfunDoc | undefined`, `update(document)`.

- [ ] **Step 3: 创建 EfunHoverProvider**

从 `efunDocs.ts` 提取：`provideHover`（694-745）、`createHoverContent`（747-840）。

实现 `vscode.HoverProvider`，构造函数接收 EfunDocsManager 引用。

- [ ] **Step 4: 将 efunDocs.ts 移动为 EfunDocsManager 门面**

创建 `src/efun/EfunDocsManager.ts`，持有各子服务引用，提供统一查询接口。更新所有外部 import 路径（`completionProvider.ts`、`definitionProvider.ts`、`functionDocPanel.ts`、`extension.ts`/`coreModule.ts`、`ServiceKeys.ts`）。

保留 `src/efunDocs.ts` 作为 re-export 文件以简化迁移：
```typescript
export { EfunDocsManager } from './efun/EfunDocsManager';
export type { EfunDoc } from './efun/types';
```

- [ ] **Step 5: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add src/efun/ src/efunDocs.ts src/core/ServiceKeys.ts src/modules/coreModule.ts
git commit -m "refactor: decompose EfunDocsManager into facade + sub-services"
```

---

## Phase 4: SyntaxBuilder 拆分

### Task 16: 暴露 SyntaxBuilder 基础设施方法

**Files:**
- Modify: `src/syntax/SyntaxBuilder.ts`

- [ ] **Step 1: 将外部 builder 需要的方法改为 public**

将以下方法从 `private` 改为 `public`：
- `createNode`（1092）
- `createNodeBetween`（1102）
- `createNodeFromTokens`（1114）
- `createOpaqueNode`（1140）
- `createMissingNode`（1147）
- `buildIdentifierNode`（1155）
- `getRuleBoundaryTokens`（1172）
- `getBoundaryStopToken`（1178）
- `normalizeStartToken`（1198）
- `normalizeStopToken`（1206）
- `resolveTokenByIndex`（1216）
- `createRange`（1220）
- `getTokenStartOffset`（1231）
- `getTokenEndOffset`（1239）
- `getNodeText`（1247）
- `countExplicitPointerTokens`（1260）
- `collectTokenTexts`（1264）
- `getChildren`（1268）
- `isTerminal`（1281）
- `isRuleContext`（1285）
- `collectPlacementTrivia`（1289）
- `collectNodes`（1293）
- `asArray`（1297）
- `buildBinaryLayer`（1064）
- `buildLeftAssociativeBinaryChain`（1072）

同时暴露分派方法：
- `buildStatement`（129）
- `buildExpression`（538）

- [ ] **Step 2: 运行全量测试**

Run: `npm test`
Expected: 全部通过（只是 visibility 变更，不影响行为）

- [ ] **Step 3: 提交**

```bash
git add src/syntax/SyntaxBuilder.ts
git commit -m "refactor: expose SyntaxBuilder infrastructure methods for extraction"
```

---

### Task 17: 提取 collectionBuilders + declarationBuilders

**Files:**
- Create: `src/syntax/builders/collectionBuilders.ts`
- Create: `src/syntax/builders/declarationBuilders.ts`
- Modify: `src/syntax/SyntaxBuilder.ts`

- [ ] **Step 1: 创建 collectionBuilders**

提取：`buildMappingLiteral`（893）、`buildMappingPair`（901）、`buildArrayLiteral`（906）、`buildArrayDelimiterLiteral`（912）、`buildArrayDelimiterElement`（920）、`buildNewExpression`（930）、`buildStructInitializerList`（953）、`buildStructInitializer`（961）、`buildStringConcatenation`（975）、`buildConcatItem`（984）、`buildArgumentList`（1011）、`buildExpressionList`（1028）、`buildSpreadElement`（1036）、`buildSliceExpression`（1045）。

每个方法签名：`export function buildXxx(b: SyntaxBuilder, ctx: XxxContext): SyntaxNode`

- [ ] **Step 2: 创建 declarationBuilders**

提取：`buildFunctionDeclaration`（212）、`buildPrototypeDeclaration`（243）、`buildVariableDeclaration`（247）、`buildVariableDeclarator`（267）、`buildStructDeclaration`（284）、`buildClassDeclaration`（295）、`buildStructMembers`（306）、`buildDirectiveNode`（325）、`buildParameterList`（473）、`buildParameter`（481）、`buildModifierList`（502）、`buildTypeReference`（521）。

- [ ] **Step 3: 更新 SyntaxBuilder 分派方法**

在 `buildStatement` 和相关分派方法中调用外部函数，删除搬走的 private 方法。

- [ ] **Step 4: 运行全量测试**

Run: `npm test`
Expected: 全部通过（特别关注 `syntaxBuilder.test.ts`、`formatterIntegration.test.ts`）

- [ ] **Step 5: 提交**

```bash
git add src/syntax/builders/ src/syntax/SyntaxBuilder.ts
git commit -m "refactor: extract collection and declaration builders"
```

---

### Task 18: 提取 statementBuilders + expressionBuilders

**Files:**
- Create: `src/syntax/builders/statementBuilders.ts`
- Create: `src/syntax/builders/expressionBuilders.ts`
- Modify: `src/syntax/SyntaxBuilder.ts`

- [ ] **Step 1: 创建 statementBuilders**

提取：`buildBlock`（330）、`buildExpressionStatement`（335）、`buildIfStatement`（340）、`buildLoopStatement`（356）、`buildDoWhileStatement`（360）、`buildForStatement`（364）、`buildForeachStatement`（386）、`buildForeachBinding`（396）、`buildSwitchStatement`（414）、`buildSwitchSection`（424）、`buildSwitchClause`（452）、`buildReturnStatement`（464）、`buildLeafNode`（469）。

- [ ] **Step 2: 创建 expressionBuilders**

提取整条优先级链（10 个 buildXxxExpression 方法）+ `buildAssignmentExpression`（552）、`buildConditionalExpression`（574）、`buildUnaryExpression`（670）、`buildCastExpression`（712）、`buildPostfixExpression`（726）、`buildPrimary`（799）、`buildMacroInvokeExpression`（869）、`buildClosureExpression`（883）。

- [ ] **Step 3: 更新 SyntaxBuilder**

将 `buildStatement` 和 `buildExpression` 的分派改为调用外部函数。SyntaxBuilder 只保留 `build()`、分派入口、基础设施方法。

- [ ] **Step 4: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5: 提交**

```bash
git add src/syntax/builders/ src/syntax/SyntaxBuilder.ts
git commit -m "refactor: extract statement and expression builders"
```

---

## Phase 5: DiagnosticsOrchestrator 分离 + 缓存协调

### Task 19: 提取 VariableInspectorPanel + FolderScanner

**Files:**
- Create: `src/diagnostics/VariableInspectorPanel.ts`
- Create: `src/diagnostics/FolderScanner.ts`
- Modify: `src/diagnostics/DiagnosticsOrchestrator.ts`

- [ ] **Step 1: 创建 VariableInspectorPanel**

从 `DiagnosticsOrchestrator.ts` 提取：`showAllVariables`（365-395）、`getVariablesHtml`（400-459）。

```typescript
// src/diagnostics/VariableInspectorPanel.ts
import * as vscode from 'vscode';
import { VariableAnalyzer, VariableInfo } from './analyzers/VariableAnalyzer';

export class VariableInspectorPanel {
    constructor(private readonly variableAnalyzer: VariableAnalyzer) {}

    public async show(document: vscode.TextDocument): Promise<void> { ... }
    private getVariablesHtml(...): string { ... }
}
```

- [ ] **Step 2: 创建 FolderScanner**

从 `DiagnosticsOrchestrator.ts` 提取：`scanFolder`（464-542）、`findLPCFiles`（547-582）。

```typescript
// src/diagnostics/FolderScanner.ts
import * as vscode from 'vscode';
import { DiagnosticsOrchestrator } from './DiagnosticsOrchestrator';

export class FolderScanner {
    constructor(private readonly orchestrator: DiagnosticsOrchestrator) {}

    public async scanFolder(): Promise<void> { ... }
    private async findLPCFiles(folderPath: string): Promise<string[]> { ... }
}
```

- [ ] **Step 3: 更新 DiagnosticsOrchestrator**

删除搬走的方法。`scanFolder()` 变为委托调用：
```typescript
public async scanFolder(): Promise<void> {
    return this.folderScanner.scanFolder();
}
```

`showAllVariables` 的命令注册保留在 `registerCommandsAndEvents` 中，但调用 `this.variableInspector.show(doc)`。

- [ ] **Step 4: 搬移宏 hover provider**

将 `DiagnosticsOrchestrator.registerCommandsAndEvents` 中的宏 hover provider（134-154 行）移到 `src/modules/languageModule.ts`。

- [ ] **Step 5: 运行全量测试**

Run: `npm test`
Expected: 全部通过（特别关注 `diagnosticsOrchestrator.test.ts`）

- [ ] **Step 6: 提交**

```bash
git add src/diagnostics/VariableInspectorPanel.ts src/diagnostics/FolderScanner.ts src/diagnostics/DiagnosticsOrchestrator.ts src/modules/languageModule.ts
git commit -m "refactor: extract VariableInspectorPanel and FolderScanner from orchestrator"
```

---

### Task 20: 创建 DocumentLifecycleService

**Files:**
- Create: `src/core/DocumentLifecycleService.ts`
- Modify: `src/modules/coreModule.ts`
- Modify: `src/diagnostics/DiagnosticsOrchestrator.ts`

- [ ] **Step 1: 创建 DocumentLifecycleService**

```typescript
// src/core/DocumentLifecycleService.ts
import * as vscode from 'vscode';

type InvalidateHandler = (uri: vscode.Uri) => void;

export class DocumentLifecycleService implements vscode.Disposable {
    private handlers: InvalidateHandler[] = [];
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(doc => this.invalidate(doc.uri)),
            vscode.workspace.onDidDeleteFiles(e => e.files.forEach(uri => this.invalidate(uri)))
        );
    }

    onInvalidate(handler: InvalidateHandler): void {
        this.handlers.push(handler);
    }

    private invalidate(uri: vscode.Uri): void {
        for (const handler of this.handlers) {
            handler(uri);
        }
    }

    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.handlers = [];
    }
}
```

- [ ] **Step 2: 在 ServiceKeys 中注册**

在 `ServiceKeys.ts` 中添加：
```typescript
Lifecycle: new ServiceKey<DocumentLifecycleService>('Lifecycle'),
```

- [ ] **Step 3: 在 coreModule 中初始化并注册各模块的失效逻辑**

```typescript
import { DocumentLifecycleService } from '../core/DocumentLifecycleService';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { ASTManager } from '../ast/astManager';

// 在 registerCoreServices 中：
const lifecycle = new DocumentLifecycleService();
registry.register(Services.Lifecycle, lifecycle);
context.subscriptions.push(lifecycle);

lifecycle.onInvalidate(uri => {
    getGlobalParsedDocumentService().invalidate(uri);
    ASTManager.getInstance().clearCache(uri.toString());
});
```

- [ ] **Step 4: 从 DiagnosticsOrchestrator 中移除重复的事件订阅**

删除 `onDidCloseTextDocument` 和 `onDidDeleteFiles` 中对 ParsedDocumentService 和 ASTManager 的清理逻辑（已由 DocumentLifecycleService 统一处理）。仅保留 orchestrator 自身状态的清理（`isAnalyzing`、`lastAnalysisVersion`）。

- [ ] **Step 5: 运行全量测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add src/core/DocumentLifecycleService.ts src/core/ServiceKeys.ts src/modules/coreModule.ts src/diagnostics/DiagnosticsOrchestrator.ts
git commit -m "feat: add DocumentLifecycleService for unified cache invalidation"
```

---

## 最终验证

### Task 21: 最终验证 + 清理

- [ ] **Step 1: 运行全量测试**

Run: `npm test`
Expected: 376 tests passing

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 检查无遗留的未使用 import**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 验证 bundle 大小**

Run: `ls -la dist/extension.js`
Expected: 大小与重构前相近（±10%）
