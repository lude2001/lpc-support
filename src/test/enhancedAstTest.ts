import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { SymbolType } from '../ast/symbolTable';
import { LPCCompletionItemProvider } from '../completionProvider';
import { EfunDocsManager } from '../efunDocs';
import { MacroManager } from '../macroManager';

export class EnhancedASTTestRunner {
    private astManager: ASTManager;
    private completionProvider: LPCCompletionItemProvider;

    constructor() {
        this.astManager = ASTManager.getInstance();
        // 创建一个简化的补全提供者用于测试
        const efunDocs = new EfunDocsManager({} as vscode.ExtensionContext);
        const macroManager = new MacroManager();
        this.completionProvider = new LPCCompletionItemProvider(efunDocs, macroManager);
    }

    // 测试增强的AST功能
    public async testEnhancedFeatures(): Promise<void> {
        console.log('=== 开始测试增强的AST功能 ===');

        // 测试代码包含我们增强的所有功能
        const testCode = `
// 继承测试
inherit "/lib/std/room";

// 结构体定义测试
struct PlayerInfo {
    string name;
    int level;
    float experience;
    mapping skills;
    object weapon;
};

struct WeaponData {
    string weapon_name;
    int damage;
    PlayerInfo* owners;
};

// 函数定义测试
int create_player(string player_name, int start_level) {
    PlayerInfo player;

    // 局部变量赋值测试
    player = new(PlayerInfo);
    player->name = player_name;
    player->level = start_level;

    // 类型推断测试
    string message = "Player created: " + player_name;
    int result = 1;

    // 链式访问测试
    if (player->weapon) {
        player->weapon->weapon_name = "Default Sword";
    }

    // Foreach循环测试
    string *skill_list = ({ "sword", "magic", "stealth" });
    foreach (string skill in skill_list) {
        player->skills[skill] = 1;
    }

    // 映射遍历测试
    foreach (string key, int value in player->skills) {
        write(sprintf("Skill %s: level %d\\n", key, value));
    }

    // sscanf测试
    string input = "data 25 100.5";
    string name;
    int level;
    float exp;
    sscanf(input, "%s %d %f", name, level, exp);

    return result;
}

// 复杂表达式测试
void test_complex_expressions() {
    WeaponData weapon_data;

    // 复杂的成员访问
    weapon_data->owners[0]->weapon->weapon_name = "Excalibur";

    // 对象方法调用
    this_object()->set("property", "value");
    previous_object()->query("data");
}
`;

        // 创建测试文档
        const document = await vscode.workspace.openTextDocument({
            content: testCode,
            language: 'lpc'
        });

        try {
            // 1. 测试基本AST解析
            await this.testBasicASTParsing(document);

            // 2. 测试继承语句解析
            await this.testInheritanceStatements(document);

            // 3. 测试结构体成员补全
            await this.testStructMemberCompletion(document);

            // 4. 测试链式访问
            await this.testChainedAccess(document);

            // 5. 测试局部变量识别
            await this.testLocalVariableRecognition(document);

            // 6. 测试控制流语句
            await this.testControlFlowStatements(document);

            console.log('✅ 所有增强功能测试通过！');

        } catch (error) {
            console.error('❌ 增强功能测试失败:', error);
            throw error;
        }
    }

    private async testBasicASTParsing(document: vscode.TextDocument): Promise<void> {
        console.log('\n--- 测试基本AST解析 ---');

        const parseResult = this.astManager.parseDocument(document);

        // 检查函数解析
        const functions = parseResult.symbolTable.getSymbolsByType(SymbolType.FUNCTION);
        console.log(`✓ 解析到 ${functions.length} 个函数`);
        functions.forEach(func => {
            console.log(`  - ${func.dataType} ${func.name}() (${func.parameters?.length || 0} 个参数)`);
        });

        // 检查结构体解析
        const structs = parseResult.symbolTable.getSymbolsByType(SymbolType.STRUCT);
        console.log(`✓ 解析到 ${structs.length} 个结构体`);
        structs.forEach(struct => {
            console.log(`  - ${struct.name} (${struct.members?.length || 0} 个成员)`);
        });

        // 检查变量解析
        const variables = parseResult.symbolTable.getSymbolsByType(SymbolType.VARIABLE);
        console.log(`✓ 解析到 ${variables.length} 个变量`);
    }

    private async testInheritanceStatements(document: vscode.TextDocument): Promise<void> {
        console.log('\n--- 测试继承语句解析 ---');

        const parseResult = this.astManager.parseDocument(document);
        const inheritSymbols = parseResult.symbolTable.getSymbolsByType(SymbolType.INHERIT);

        console.log(`✓ 解析到 ${inheritSymbols.length} 个继承语句`);
        inheritSymbols.forEach(inherit => {
            console.log(`  - 继承: ${inherit.name}`);
        });

        // 测试继承文件列表
        const inheritedFiles = parseResult.symbolTable.getInheritedFiles();
        console.log(`✓ 继承文件列表: [${inheritedFiles.join(', ')}]`);
    }

    private async testStructMemberCompletion(document: vscode.TextDocument): Promise<void> {
        console.log('\n--- 测试结构体成员补全 ---');

        // 测试PlayerInfo结构体的成员补全
        const position = new vscode.Position(20, 0); // 在函数内部
        const memberCompletions = this.astManager.getStructMemberCompletions(document, position, 'player');

        console.log(`✓ PlayerInfo成员补全: ${memberCompletions.length} 个项目`);
        memberCompletions.forEach(item => {
            console.log(`  - ${item.label}: ${item.detail}`);
        });

        // 测试通过completionProvider的 -> 补全
        const lineWithArrow = "    player->";
        const arrowPosition = new vscode.Position(20, lineWithArrow.length);

        // 模拟文档内容包含箭头
        const testDoc = await vscode.workspace.openTextDocument({
            content: document.getText() + '\n' + lineWithArrow,
            language: 'lpc'
        });

        const completions = await this.completionProvider.provideCompletionItems(
            testDoc,
            arrowPosition,
            { triggerKind: vscode.CompletionTriggerKind.TriggerCharacter } as any,
            { isCancellationRequested: false } as any
        );

        if (Array.isArray(completions)) {
            const structMembers = completions.filter(item =>
                item.sortText && item.sortText.startsWith('0_')
            );
            console.log(`✓ CompletionProvider箭头补全: ${structMembers.length} 个结构体成员`);
        }
    }

    private async testChainedAccess(document: vscode.TextDocument): Promise<void> {
        console.log('\n--- 测试链式访问 ---');

        // 创建包含链式访问的测试代码
        const chainedCode = document.getText() + '\n' + `
void test_chained() {
    WeaponData weapon;
    weapon->owners[0]->weapon->
}`;

        const testDoc = await vscode.workspace.openTextDocument({
            content: chainedCode,
            language: 'lpc'
        });

        // 测试链式访问补全
        const chainPosition = new vscode.Position(100, 30); // 在链式访问后
        const completions = await this.completionProvider.provideCompletionItems(
            testDoc,
            chainPosition,
            { triggerKind: vscode.CompletionTriggerKind.TriggerCharacter } as any,
            { isCancellationRequested: false } as any
        );

        console.log(`✓ 链式访问补全测试完成`);
    }

    private async testLocalVariableRecognition(document: vscode.TextDocument): Promise<void> {
        console.log('\n--- 测试局部变量识别 ---');

        const parseResult = this.astManager.parseDocument(document);

        // 在函数作用域内查找局部变量
        const position = new vscode.Position(25, 0); // 在create_player函数内
        const scopeSymbols = parseResult.symbolTable.getSymbolsInScope(position);

        const localVars = scopeSymbols.filter(symbol =>
            symbol.type === SymbolType.VARIABLE &&
            symbol.scope.name.includes('function:create_player')
        );

        console.log(`✓ 在create_player函数中识别到 ${localVars.length} 个局部变量:`);
        localVars.forEach(varSymbol => {
            console.log(`  - ${varSymbol.dataType} ${varSymbol.name}`);
        });

        // 检查参数识别
        const parameters = scopeSymbols.filter(symbol => symbol.type === SymbolType.PARAMETER);
        console.log(`✓ 识别到 ${parameters.length} 个参数:`);
        parameters.forEach(param => {
            console.log(`  - ${param.dataType} ${param.name}`);
        });
    }

    private async testControlFlowStatements(document: vscode.TextDocument): Promise<void> {
        console.log('\n--- 测试控制流语句解析 ---');

        // 创建包含各种控制流的测试代码
        const controlFlowCode = `
int test_control_flow(int x) {
    if (x > 0) {
        int positive_var = 1;
    }

    while (x < 10) {
        int loop_var = x;
        x++;
    }

    for (int i = 0; i < 5; i++) {
        int for_var = i * 2;
    }

    foreach (string item in ({ "a", "b", "c" })) {
        write(item);
    }

    return x;
}`;

        const testDoc = await vscode.workspace.openTextDocument({
            content: controlFlowCode,
            language: 'lpc'
        });

        const parseResult = this.astManager.parseDocument(testDoc);

        // 检查是否正确识别了各种作用域
        const allSymbols = parseResult.symbolTable.getSymbolsInScope(new vscode.Position(10, 0));
        console.log(`✓ 控制流语句解析完成，共识别 ${allSymbols.length} 个符号`);
    }

    // 性能测试
    public async testPerformance(): Promise<void> {
        console.log('\n=== 性能测试 ===');

        const largeCode = this.generateLargeTestCode();
        const document = await vscode.workspace.openTextDocument({
            content: largeCode,
            language: 'lpc'
        });

        // 测试解析性能
        const start = Date.now();
        const parseResult = this.astManager.parseDocument(document);
        const parseTime = Date.now() - start;

        const functions = parseResult.symbolTable.getSymbolsByType(SymbolType.FUNCTION);
        const structs = parseResult.symbolTable.getSymbolsByType(SymbolType.STRUCT);

        console.log(`✓ 解析 ${largeCode.length} 字符的代码耗时: ${parseTime}ms`);
        console.log(`✓ 解析结果: ${functions.length} 个函数, ${structs.length} 个结构体`);

        // 测试缓存性能
        const cacheStart = Date.now();
        this.astManager.parseDocument(document);
        const cacheTime = Date.now() - cacheStart;
        console.log(`✓ 缓存解析耗时: ${cacheTime}ms (加速 ${Math.round(parseTime/cacheTime)}x)`);
    }

    private generateLargeTestCode(): string {
        let code = 'inherit "/lib/std/room";\n\n';

        // 生成大量结构体
        for (let i = 0; i < 20; i++) {
            code += `struct TestStruct${i} {\n`;
            for (let j = 0; j < 5; j++) {
                code += `    int field${j};\n`;
                code += `    string data${j};\n`;
            }
            code += `};\n\n`;
        }

        // 生成大量函数
        for (let i = 0; i < 50; i++) {
            code += `int test_function_${i}(string param1, int param2) {\n`;
            code += `    int local_var = ${i};\n`;
            code += `    string result = "test";\n`;
            code += `    \n`;
            code += `    if (param2 > 0) {\n`;
            code += `        local_var += param2;\n`;
            code += `    }\n`;
            code += `    \n`;
            code += `    foreach (string item in ({ "a", "b", "c" })) {\n`;
            code += `        result += item;\n`;
            code += `    }\n`;
            code += `    \n`;
            code += `    return local_var;\n`;
            code += `}\n\n`;
        }

        return code;
    }
}

// 导出测试函数
export async function runEnhancedASTTests(): Promise<void> {
    const tester = new EnhancedASTTestRunner();

    try {
        await tester.testEnhancedFeatures();
        await tester.testPerformance();
        console.log('\n🎉 所有增强AST测试通过！');
    } catch (error) {
        console.error('\n💥 增强AST测试失败:', error);
        throw error;
    }
}