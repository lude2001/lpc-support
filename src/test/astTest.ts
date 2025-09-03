import * as vscode from 'vscode';
import { SimpleASTManager } from '../ast/simpleAstManager';
import { SymbolType } from '../ast/symbolTable';

export class ASTTestRunner {
    private astManager: SimpleASTManager;

    constructor() {
        this.astManager = SimpleASTManager.getInstance();
    }

    // 测试基本的AST解析功能
    public async testBasicParsing(): Promise<void> {
        // 创建测试代码
        const testCode = `
// 测试函数定义
int test_function(string name, int value) {
    int local_var = 10;
    string result = "test";
    return value + local_var;
}

// 测试结构体定义
struct Person {
    string name;
    int age;
    string *hobbies;
}

// 测试类定义
class Character {
    int hp;
    string race;
}

// 测试变量声明
private string global_var = "hello";
public int count;
`;

        // 创建临时文档
        const document = await vscode.workspace.openTextDocument({
            content: testCode,
            language: 'lpc'
        });

        try {
            console.log('开始测试AST解析...');
            
            // 解析文档
            const symbolTable = this.astManager.parseDocument(document);
            
            // 测试函数解析
            const functions = symbolTable.getSymbolsByType(SymbolType.FUNCTION);
            console.log(`解析到 ${functions.length} 个函数:`);
            functions.forEach(func => {
                console.log(`  - ${func.dataType} ${func.name}()`);
            });
            
            // 测试变量解析
            const variables = symbolTable.getSymbolsByType(SymbolType.VARIABLE);
            console.log(`解析到 ${variables.length} 个变量:`);
            variables.forEach(varSymbol => {
                console.log(`  - ${varSymbol.dataType} ${varSymbol.name}`);
            });
            
            // 测试结构体解析
            const structs = symbolTable.getSymbolsByType(SymbolType.STRUCT);
            console.log(`解析到 ${structs.length} 个结构体/类:`);
            structs.forEach(struct => {
                console.log(`  - ${struct.name} (${struct.members?.length || 0} 个成员)`);
                if (struct.members) {
                    struct.members.forEach(member => {
                        console.log(`    - ${member.dataType} ${member.name}`);
                    });
                }
            });
            
            // 测试补全功能
            const position = new vscode.Position(5, 10); // 在函数内部
            const completions = this.astManager.getCompletionItems(document, position);
            console.log(`在位置 (${position.line}, ${position.character}) 提供 ${completions.length} 个补全项`);
            
            // 测试结构体成员补全
            const testCode2 = testCode + '\nstruct Person person;\nperson->';
            const document2 = await vscode.workspace.openTextDocument({
                content: testCode2,
                language: 'lpc'
            });
            
            const memberCompletions = this.astManager.getStructMemberCompletions(
                document2, 
                new vscode.Position(20, 8), 
                'person'
            );
            console.log(`结构体成员补全提供 ${memberCompletions.length} 个项目:`);
            memberCompletions.forEach(member => {
                console.log(`  - ${member.label}: ${member.detail}`);
            });
            
            console.log('AST解析测试完成！');
            
        } catch (error) {
            console.error('AST解析测试失败:', error);
            throw error;
        }
    }

    // 运行性能测试
    public async testPerformance(): Promise<void> {
        const largeTestCode = this.generateLargeTestCode();
        
        const document = await vscode.workspace.openTextDocument({
            content: largeTestCode,
            language: 'lpc'
        });

        console.log('开始性能测试...');
        
        // 测试首次解析时间
        const start1 = Date.now();
        const symbolTable1 = this.astManager.parseDocument(document);
        const time1 = Date.now() - start1;
        console.log(`首次解析耗时: ${time1}ms`);
        
        // 测试缓存解析时间
        const start2 = Date.now();
        const symbolTable2 = this.astManager.parseDocument(document);
        const time2 = Date.now() - start2;
        console.log(`缓存解析耗时: ${time2}ms`);
        
        // 验证结果一致性
        const functions1 = symbolTable1.getSymbolsByType(SymbolType.FUNCTION);
        const functions2 = symbolTable2.getSymbolsByType(SymbolType.FUNCTION);
        
        if (functions1.length === functions2.length) {
            console.log(`✓ 缓存结果一致，解析了 ${functions1.length} 个函数`);
        } else {
            console.log(`✗ 缓存结果不一致: ${functions1.length} vs ${functions2.length}`);
        }
        
        console.log('性能测试完成！');
    }

    private generateLargeTestCode(): string {
        let code = '';
        
        // 生成大量函数
        for (let i = 0; i < 100; i++) {
            code += `
int function_${i}(string param1, int param2) {
    int local_var_${i} = ${i};
    string result = "test_" + param1;
    return param2 + local_var_${i};
}
`;
        }
        
        // 生成大量结构体
        for (let i = 0; i < 50; i++) {
            code += `
struct TestStruct_${i} {
    int id;
    string name_${i};
    float value_${i};
}
`;
        }
        
        return code;
    }
}

// 导出测试函数供外部调用
export async function runASTTests(): Promise<void> {
    const tester = new ASTTestRunner();
    
    try {
        await tester.testBasicParsing();
        await tester.testPerformance();
        console.log('所有AST测试通过！');
    } catch (error) {
        console.error('AST测试失败:', error);
        throw error;
    }
}