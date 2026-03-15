import * as vscode from 'vscode';
import { FormattingService } from '../formatter/FormattingService';
import * as parsedDocumentModule from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

describe('FormattingService document formatting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('有语法错误时拒绝整文格式化', async () => {
        jest.spyOn(parsedDocumentModule, 'getGlobalParsedDocumentService').mockReturnValue({
            get: jest.fn().mockReturnValue({
                diagnostics: [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'err')]
            })
        } as any);

        const service = new FormattingService();
        const document = TestHelper.createMockDocument('void test(){}');

        await expect(service.formatDocument(document)).resolves.toEqual([]);
    });

    test('无语法错误时返回整文替换 edit 作为最小链路', async () => {
        jest.spyOn(parsedDocumentModule, 'getGlobalParsedDocumentService').mockReturnValue({
            get: jest.fn().mockReturnValue({
                diagnostics: []
            })
        } as any);

        const service = new FormattingService();
        const source = 'void test(){}';
        const document = TestHelper.createMockDocument(source);

        await expect(service.formatDocument(document)).resolves.toEqual([
            {
                range: new vscode.Range(0, 0, 0, source.length),
                newText: source
            }
        ]);
    });
});
