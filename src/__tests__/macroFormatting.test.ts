import { FormattingService } from '../formatter/FormattingService';
import { clearGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { TestHelper } from './utils/TestHelper';

async function format(source: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const fileName = `macro-${Date.now()}-${Math.random().toString(16).slice(2)}.h`;
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

describe('macro formatting', () => {
    test('简单宏允许规范空格', async () => {
        await expect(format('#define FOO(x,y) ((x)+(y))')).resolves.toBe('#define FOO(x, y) ((x) + (y))');
    });

    test('复杂多行宏保持 token 顺序', async () => {
        const source = '#define FOO(x) \\\nif(x){ \\\nbar(x); \\\n}';

        expect(TestHelper.extractTokens(await format(source))).toEqual(TestHelper.extractTokens(source));
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
