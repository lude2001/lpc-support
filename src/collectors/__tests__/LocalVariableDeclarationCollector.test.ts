import * as vscode from 'vscode';
import { LocalVariableDeclarationCollector } from '../LocalVariableDeclarationCollector';
import { TestHelper } from '../../__tests__/utils/TestHelper';

type FakeStatement = {
    start: { startIndex: number };
    variableDecl: () => any;
    block: () => any;
    functionDef: () => any;
    ifStatement: () => any;
    whileStatement: () => any;
    doWhileStatement: () => any;
    forStatement: () => any;
    foreachStatement: () => any;
    switchStatement: () => any;
};

function createLeafStatement(startIndex: number, variableDecl?: any): FakeStatement {
    return {
        start: { startIndex },
        variableDecl: () => variableDecl,
        block: () => undefined,
        functionDef: () => undefined,
        ifStatement: () => undefined,
        whileStatement: () => undefined,
        doWhileStatement: () => undefined,
        forStatement: () => undefined,
        foreachStatement: () => undefined,
        switchStatement: () => undefined
    };
}

function createParsedDoc(blockStatements: FakeStatement): any;
function createParsedDoc(blockStatements: FakeStatement[]): any;
function createParsedDoc(blockStatements: FakeStatement | FakeStatement[]): any {
    const statements = Array.isArray(blockStatements) ? blockStatements : [blockStatements];
    const block = { statement: () => statements };
    const funcDef = { block: () => block };
    const topStmt = { functionDef: () => funcDef };
    return {
        tree: { statement: () => [topStmt] }
    };
}

describe('LocalVariableDeclarationCollector', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('配置关闭时应跳过“局部变量位置”检查', () => {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'enforceLocalVariableDeclarationAtBlockStart') {
                    return false;
                }
                return defaultValue;
            })
        });

        const content = `void test() {
    write("x");
    int later = 1;
}`;
        const doc = TestHelper.createMockDocument(content, 'lpc', 'rule-off.c');

        const execIdx = content.indexOf('write("x");');
        const declIdx = content.indexOf('int later = 1;');
        const varDecl = {
            start: { startIndex: declIdx },
            stop: { stopIndex: declIdx + 'int later = 1;'.length - 1 }
        };

        const parsed = createParsedDoc([
            createLeafStatement(execIdx),
            createLeafStatement(declIdx, varDecl)
        ]);

        const collector = new LocalVariableDeclarationCollector();
        const diagnostics = collector.collect(doc as any, parsed);

        expect(diagnostics).toHaveLength(0);
    });

    test('配置开启时应报告“局部变量位置”诊断', () => {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'enforceLocalVariableDeclarationAtBlockStart') {
                    return true;
                }
                return defaultValue;
            })
        });

        const content = `void test() {
    write("x");
    int later = 1;
}`;
        const doc = TestHelper.createMockDocument(content, 'lpc', 'rule-on.c');

        const execIdx = content.indexOf('write("x");');
        const declIdx = content.indexOf('int later = 1;');
        const varDecl = {
            start: { startIndex: declIdx },
            stop: { stopIndex: declIdx + 'int later = 1;'.length - 1 }
        };

        const parsed = createParsedDoc([
            createLeafStatement(execIdx),
            createLeafStatement(declIdx, varDecl)
        ]);

        const collector = new LocalVariableDeclarationCollector();
        const diagnostics = collector.collect(doc as any, parsed);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toBe('localVariableDeclarationPosition');
        expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Error);
    });
});
