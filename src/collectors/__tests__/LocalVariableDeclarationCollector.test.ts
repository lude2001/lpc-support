import * as vscode from 'vscode';
import { LocalVariableDeclarationCollector } from '../LocalVariableDeclarationCollector';
import { TestHelper } from '../../__tests__/utils/TestHelper';
import { DiagnosticContext } from '../../diagnostics/types';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';

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
        const { parsed, context } = analyze(doc);

        const collector = new LocalVariableDeclarationCollector();
        const diagnostics = collector.collect(doc as any, parsed, context);

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
        const { parsed, context } = analyze(doc);

        const collector = new LocalVariableDeclarationCollector();
        const diagnostics = collector.collect(doc as any, parsed, context);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toBe('localVariableDeclarationPosition');
        expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Error);
    });

    test('预处理分支边界来自 frontend directive facts 而不是重新扫描文本', () => {
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
    #ifdef HAS_LATER
    int later = 1;
    #endif
}`;
        const doc = TestHelper.createMockDocument(content, 'lpc', 'branch.c');
        const { parsed, context } = analyze(doc);

        const collector = new LocalVariableDeclarationCollector();
        const diagnostics = collector.collect(doc as any, parsed, context);

        expect(diagnostics).toHaveLength(0);
    });
});

function analyze(document: vscode.TextDocument): { parsed: any; context: DiagnosticContext } {
    const analysis = DocumentSemanticSnapshotService.getInstance().parseDocument(document, false);
    return {
        parsed: analysis.parsed!,
        context: {
            parsed: analysis.parsed!,
            syntax: analysis.syntax,
            semantic: analysis.semantic
        }
    };
}
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
