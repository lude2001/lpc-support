import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

async function format(source: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const fileName = `comment-${Date.now()}-${Math.random().toString(16).slice(2)}.c`;
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

describe('comment formatting', () => {
    test('多行展开时将行尾注释提升成独立注释', async () => {
        const source = 'mapping data = ([ "name":"sword" ]); // weapon data';
        const output = await format(source);

        expect(output).toContain('// weapon data\nmapping data = ([');
    });

    test('函数前独立注释跟随函数节点移动', async () => {
        const source = '// demo\nvoid test(){return;}';
        const output = await format(source);

        expect(output.startsWith('// demo\nvoid test()')).toBe(true);
    });

    test('Javadoc 只规范化星号对齐', async () => {
        const source = '/**\n* @brief demo\n*/\nvoid test(){}';
        const output = await format(source);

        expect(output).toContain(' * @brief demo');
    });
});
