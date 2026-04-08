import * as vscode from 'vscode';
import { FormattingService } from '../formatter/FormattingService';
import * as parsedDocumentModule from '../parser/ParsedDocumentService';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import * as rangeResolver from '../formatter/range/findFormatTarget';
import { getFormatterConfig } from '../formatter/config';
import { workspace } from '../../tests/mocks/MockVSCode';
import { TestHelper } from './utils/TestHelper';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_ROOT = path.resolve(__dirname, '../../test/lpc_code');

function fixturePath(name: string): string {
    return path.join(FIXTURE_ROOT, name);
}

function hasFixture(name: string): boolean {
    return fs.existsSync(fixturePath(name));
}

function applyEdit(document: ReturnType<typeof TestHelper.createMockDocument>, edit: vscode.TextEdit): string {
    const source = document.getText();
    const startOffset = document.offsetAt(edit.range.start);
    const endOffset = document.offsetAt(edit.range.end);

    return `${source.slice(0, startOffset)}${edit.newText}${source.slice(endOffset)}`;
}

function readFixture(name: string): string {
    return fs.readFileSync(fixturePath(name), 'utf8');
}

function normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n');
}

function normalizeSelection(
    document: ReturnType<typeof TestHelper.createMockDocument>,
    range: vscode.Range
): { text: string; baseIndent: string } {
    const rawText = document.getText(range);
    const firstContentIndex = rawText.search(/\S/);
    if (firstContentIndex === -1) {
        return { text: '', baseIndent: '' };
    }

    let lastContentIndex = rawText.length - 1;
    while (lastContentIndex >= 0 && /\s/.test(rawText[lastContentIndex])) {
        lastContentIndex -= 1;
    }

    const startOffset = document.offsetAt(range.start) + firstContentIndex;
    const endOffset = document.offsetAt(range.start) + lastContentIndex + 1;
    const normalizedRange = new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset));
    const text = document.getText(normalizedRange);
    const baseIndent = document.lineAt(normalizedRange.start.line).text.slice(0, normalizedRange.start.character);

    return { text, baseIndent };
}

function dedentSelectionText(text: string, baseIndent: string): string {
    return text
        .split('\n')
        .map((line) => line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line)
        .join('\n');
}

function reindentRangeLikeFormatter(text: string, baseIndent: string): string {
    if (!text.includes('\n') || !baseIndent) {
        return text;
    }

    const [firstLine, ...restLines] = text.split('\n');
    return [
        firstLine,
        ...restLines.map((line) => line.length > 0 ? `${baseIndent}${line}` : line)
    ].join('\n');
}

function reindentSnippetLikeFormatter(text: string, baseIndent: string): string {
    if (!baseIndent) {
        return text;
    }

    return text
        .split('\n')
        .map((line) => line.length > 0 ? `${baseIndent}${line}` : line)
        .join('\n');
}

function stripSyntheticIndent(text: string): string {
    const syntheticIndent = ' '.repeat(getFormatterConfig().indentSize);

    return text
        .split('\n')
        .map((line) => {
            if (!line.length || !syntheticIndent || !line.startsWith(syntheticIndent)) {
                return line;
            }

            return line.slice(syntheticIndent.length);
        })
        .join('\n');
}

async function formatDocumentText(source: string, fileName: string): Promise<string> {
    clearGlobalParsedDocumentService();
    const service = new FormattingService();
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const edits = await service.formatDocument(document);

    return edits[0]?.newText ?? source;
}

async function expectMeridiandRangeToMatchStandaloneDocument(
    range: vscode.Range,
    fileName: string
): Promise<{ document: ReturnType<typeof TestHelper.createMockDocument>; edits: vscode.TextEdit[] }> {
    const service = new FormattingService();
    const source = readFixture('meridiand.c');
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const standaloneFormatted = normalizeLineEndings(
        await formatDocumentText(document.getText(range), `${fileName}-standalone.c`)
    );
    const edits = await service.formatRange(document, range);

    expect(edits).toHaveLength(1);
    expect(normalizeLineEndings(edits[0].newText)).toBe(standaloneFormatted);

    return { document, edits };
}

async function expectMeridiandRangeToMatchWrappedStandaloneDocument(
    range: vscode.Range,
    fileName: string,
    wrapSelection: (selectionText: string) => string,
    extractFormattedSelection: (formattedWrapper: string) => string
): Promise<void> {
    const service = new FormattingService();
    const source = readFixture('meridiand.c');
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const { text, baseIndent } = normalizeSelection(document, range);
    const wrappedSource = wrapSelection(dedentSelectionText(text, baseIndent));
    const formattedWrapper = normalizeLineEndings(await formatDocumentText(wrappedSource, `${fileName}-wrapped.c`));
    const expected = reindentRangeLikeFormatter(
        stripSyntheticIndent(extractFormattedSelection(formattedWrapper)),
        baseIndent
    );
    const edits = await service.formatRange(document, range);

    expect(edits).toHaveLength(1);
    expect(normalizeLineEndings(edits[0].newText)).toBe(expected);
}

async function expectMeridiandRangeToMatchWrappedSnippetDocument(
    range: vscode.Range,
    fileName: string
): Promise<void> {
    const service = new FormattingService();
    const source = readFixture('meridiand.c');
    const document = TestHelper.createMockDocument(source, 'lpc', fileName);
    const { text, baseIndent } = normalizeSelection(document, range);
    const wrappedSource = wrapStatementSelection(dedentSelectionText(text, baseIndent));
    const formattedWrapper = normalizeLineEndings(await formatDocumentText(wrappedSource, `${fileName}-wrapped.c`));
    const expected = reindentSnippetLikeFormatter(
        stripSyntheticIndent(extractWrappedFunctionBody(formattedWrapper)),
        baseIndent
    );
    const edits = await service.formatRange(document, range);

    expect(edits).toHaveLength(1);
    expect(normalizeLineEndings(edits[0].newText)).toBe(expected);
}

function wrapStatementSelection(selectionText: string): string {
    return `void __range_test__()\n{\n${selectionText}\n}`;
}

function extractWrappedFunctionBody(formattedWrapper: string): string {
    const bodyStart = formattedWrapper.indexOf('{\n');
    const bodyEnd = formattedWrapper.lastIndexOf('\n}');
    return formattedWrapper.slice(bodyStart + 2, bodyEnd);
}

function wrapMappingEntrySelection(selectionText: string): string {
    return `mapping __range_test__ = ([\n${selectionText}\n]);`;
}

function extractWrappedMappingEntry(formattedWrapper: string): string {
    const bodyStart = formattedWrapper.indexOf('([\n');
    const bodyEnd = formattedWrapper.lastIndexOf('\n]);');
    return formattedWrapper.slice(bodyStart + 3, bodyEnd);
}

function findRangeInLine(
    document: ReturnType<typeof TestHelper.createMockDocument>,
    line: number,
    startText: string,
    endText: string
): vscode.Range {
    const text = document.lineAt(line).text;
    const start = text.indexOf(startText);
    const end = text.lastIndexOf(endText);

    if (start === -1 || end === -1) {
        throw new Error(`Unable to find "${startText}".."${endText}" in line ${line + 1}`);
    }

    return new vscode.Range(line, start, line, end + endText.length);
}

const MERIDIAND_TOP_LEVEL_CASES = [
    {
        name: '函数原型声明',
        fileName: 'range-meridiand-prototype.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(24, 0, 24, document.lineAt(24).text.length)
    },
    {
        name: '顶部 mapping 声明',
        fileName: 'range-meridiand-top-mapping.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(9, 0, 22, document.lineAt(22).text.length)
    },
    {
        name: 'query_xue 函数',
        fileName: 'range-meridiand-query-xue.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(26, 0, 35, document.lineAt(35).text.length)
    },
    {
        name: 'get_xue 函数',
        fileName: 'range-meridiand-get-xue.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(36, 0, 44, document.lineAt(44).text.length)
    },
    {
        name: 'do_score 函数',
        fileName: 'range-meridiand-do-score.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(45, 0, 138, document.lineAt(138).text.length)
    },
    {
        name: 'do_through 函数',
        fileName: 'range-meridiand-do-through.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(140, 0, 620, document.lineAt(620).text.length)
    },
    {
        name: 'query_meridian_count 函数',
        fileName: 'range-meridiand-count.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(624, 0, 652, document.lineAt(652).text.length)
    },
    {
        name: '含 Javadoc 的 is_meridian_completed 函数',
        fileName: 'range-meridiand-completed.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(654, 0, 679, document.lineAt(679).text.length)
    },
    {
        name: '含 Javadoc 和 foreach 的 get_completed_meridians 函数',
        fileName: 'range-meridiand-completed-list.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(681, 0, 708, document.lineAt(708).text.length)
    }
];

const MERIDIAND_STATEMENT_CASES = [
    {
        name: 'query_xue 的首个参数检查',
        fileName: 'range-meridiand-query-xue-if.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(28, 0, 29, document.lineAt(29).text.length)
    },
    {
        name: 'query_xue 的成员检查',
        fileName: 'range-meridiand-query-xue-member-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(31, 0, 32, document.lineAt(32).text.length)
    },
    {
        name: 'get_xue 的首个边界检查',
        fileName: 'range-meridiand-get-xue-first-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(39, 0, 40, document.lineAt(40).text.length)
    },
    {
        name: 'get_xue 的第二个边界检查',
        fileName: 'range-meridiand-get-xue-second-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(41, 0, 42, document.lineAt(42).text.length)
    },
    {
        name: 'do_score 的参数缺失分支',
        fileName: 'range-meridiand-do-score-arg-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(52, 0, 61, document.lineAt(61).text.length)
    },
    {
        name: 'do_score 的单行空映射保护',
        fileName: 'range-meridiand-do-score-empty-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(63, 0, 63, document.lineAt(63).text.length)
    },
    {
        name: 'do_score 的 for 循环',
        fileName: 'range-meridiand-do-score-loop.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(74, 0, 93, document.lineAt(93).text.length)
    },
    {
        name: 'do_score 的零进度返回',
        fileName: 'range-meridiand-do-score-zero-return.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(98, 0, 99, document.lineAt(99).text.length)
    },
    {
        name: 'do_score 的 else-if 链',
        fileName: 'range-meridiand-do-score-else-chain.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(101, 0, 136, document.lineAt(136).text.length)
    },
    {
        name: 'do_through 的空对象保护',
        fileName: 'range-meridiand-do-through-null-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(146, 0, 147, document.lineAt(147).text.length)
    },
    {
        name: 'do_through 的临时经脉保护',
        fileName: 'range-meridiand-do-through-temp-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(149, 0, 153, document.lineAt(153).text.length)
    },
    {
        name: 'do_through 的物品存在检查',
        fileName: 'range-meridiand-do-through-item-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(170, 0, 174, document.lineAt(174).text.length)
    },
    {
        name: 'do_through 的奇经总脉等级保护',
        fileName: 'range-meridiand-do-through-legend-level-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(187, 0, 191, document.lineAt(191).text.length)
    },
    {
        name: 'do_through 的奇经总脉前置条件保护',
        fileName: 'range-meridiand-do-through-legend-prereq-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(194, 0, 197, document.lineAt(197).text.length)
    },
    {
        name: 'do_through 的类型分派链',
        fileName: 'range-meridiand-do-through-type-chain.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(221, 0, 254, document.lineAt(254).text.length)
    },
    {
        name: 'do_through 的失败处理分支',
        fileName: 'range-meridiand-do-through-failure-branch.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(266, 0, 284, document.lineAt(284).text.length)
    },
    {
        name: 'do_through 的完整奖励 if-else',
        fileName: 'range-meridiand-do-through-reward-if-else.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(291, 0, 579, document.lineAt(579).text.length)
    },
    {
        name: 'do_through 的八脉完成奖励',
        fileName: 'range-meridiand-do-through-eight-complete.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(583, 0, 598, document.lineAt(598).text.length)
    },
    {
        name: 'do_through 的十脉完成奖励',
        fileName: 'range-meridiand-do-through-ten-complete.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(601, 0, 617, document.lineAt(617).text.length)
    },
    {
        name: 'query_meridian_count 的空经脉保护',
        fileName: 'range-meridiand-count-empty-guard.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(630, 0, 633, document.lineAt(633).text.length)
    },
    {
        name: 'query_meridian_count 的 for 循环',
        fileName: 'range-meridiand-count-loop.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(637, 0, 650, document.lineAt(650).text.length)
    },
    {
        name: 'is_meridian_completed 的参数检查',
        fileName: 'range-meridiand-is-completed-arg-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(664, 0, 666, document.lineAt(666).text.length)
    },
    {
        name: 'is_meridian_completed 的存在性检查',
        fileName: 'range-meridiand-is-completed-presence-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(669, 0, 671, document.lineAt(671).text.length)
    },
    {
        name: 'is_meridian_completed 的完成判定',
        fileName: 'range-meridiand-is-completed-finished-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(674, 0, 676, document.lineAt(676).text.length)
    },
    {
        name: 'get_completed_meridians 的参数检查',
        fileName: 'range-meridiand-completed-list-arg-check.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(693, 0, 695, document.lineAt(695).text.length)
    },
    {
        name: 'get_completed_meridians 的 foreach 块',
        fileName: 'range-meridiand-completed-foreach.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(701, 0, 705, document.lineAt(705).text.length)
    }
];

const MERIDIAND_SNIPPET_CASES = [
    {
        name: 'do_through 的全脉奖励分支片段',
        fileName: 'range-meridiand-do-through-full-reward-snippet.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(291, 0, 354, document.lineAt(354).text.length)
    }
];

const MERIDIAND_MAPPING_ENTRY_CASES = [
    { name: '带脉', fileName: 'range-meridiand-belt-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(10, 0, 10, document.lineAt(10).text.length) },
    { name: '冲脉', fileName: 'range-meridiand-chong-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(11, 0, 11, document.lineAt(11).text.length) },
    { name: '阴维脉', fileName: 'range-meridiand-yinwei-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(12, 0, 12, document.lineAt(12).text.length) },
    { name: '阳维脉', fileName: 'range-meridiand-yangwei-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(13, 0, 13, document.lineAt(13).text.length) },
    { name: '阴跷脉', fileName: 'range-meridiand-yinqiao-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(14, 0, 14, document.lineAt(14).text.length) },
    { name: '阳跷脉', fileName: 'range-meridiand-yangqiao-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(15, 0, 15, document.lineAt(15).text.length) },
    { name: '手三阳经', fileName: 'range-meridiand-hand-yang-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(16, 0, 16, document.lineAt(16).text.length) },
    { name: '手三阴经', fileName: 'range-meridiand-hand-yin-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(17, 0, 17, document.lineAt(17).text.length) },
    { name: '足三阳经', fileName: 'range-meridiand-foot-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(18, 0, 20, document.lineAt(20).text.length) },
    { name: '奇经总脉', fileName: 'range-meridiand-all-entry.c', rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(21, 0, 21, document.lineAt(21).text.length) }
];

const MERIDIAND_ARRAY_LITERAL_CASES = [
    {
        name: '带脉数组值',
        fileName: 'range-meridiand-belt-array.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => findRangeInLine(document, 10, '({', '})')
    },
    {
        name: '手三阳经数组值',
        fileName: 'range-meridiand-hand-yang-array.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => findRangeInLine(document, 16, '({', '})')
    },
    {
        name: '足三阳经数组值',
        fileName: 'range-meridiand-foot-array.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => findRangeInLine(document, 20, '({', '})')
    },
    {
        name: '奇经总脉数组值',
        fileName: 'range-meridiand-all-array.c',
        rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => findRangeInLine(document, 21, '({', '})')
    }
];

describe('FormattingService range formatting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('选区不覆盖完整节点时拒绝格式化', async () => {
        jest.spyOn(parsedDocumentModule, 'getGlobalParsedDocumentService').mockReturnValue({
            get: jest.fn().mockReturnValue({
                diagnostics: []
            })
        } as any);
        jest.spyOn(rangeResolver, 'findFormatTarget').mockReturnValue(null);

        const service = new FormattingService();
        const document = TestHelper.createMockDocument('void test(){}');

        await expect(service.formatRange(document, new vscode.Range(0, 2, 0, 6))).resolves.toEqual([]);
    });

    test('选区覆盖完整节点时返回目标范围的原文替换 edit', async () => {
        jest.spyOn(parsedDocumentModule, 'getGlobalParsedDocumentService').mockReturnValue({
            get: jest.fn().mockReturnValue({
                diagnostics: []
            })
        } as any);

        const targetRange = new vscode.Range(0, 0, 0, 13);
        jest.spyOn(rangeResolver, 'findFormatTarget').mockReturnValue({
            kind: 'node',
            range: targetRange
        });

        const service = new FormattingService();
        const source = 'void test(){}';
        const document = TestHelper.createMockDocument(source);

        await expect(service.formatRange(document, new vscode.Range(0, 0, 0, 13))).resolves.toEqual([
            {
                range: targetRange,
                newText: source
            }
        ]);
    });

    test('局部选中 heredoc 正文时直接拒绝格式化', async () => {
        const service = new FormattingService();
        const document = TestHelper.createMockDocument('string msg = @TEXT\nhello\nTEXT;');

        await expect(service.formatRange(document, new vscode.Range(1, 0, 1, 5))).resolves.toEqual([]);
    });

    test('完整节点选区会返回格式化后的文本而不是原文', async () => {
        const service = new FormattingService();
        const source = 'void test(){if(x){foo();}}';
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-format.c');
        const range = new vscode.Range(0, 0, 0, source.length);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('if (x)');
        expect(edits[0].newText).not.toBe(source);
    });

    test('整行选区包含尾随换行时仍能命中函数节点', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    if(x){foo();}',
            '}',
            ''
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-lines.c');
        const range = new vscode.Range(0, 0, 4, 0);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('if (x)');
    });

    test('整行选区包含行尾注释时不会退回 snippet 格式化', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    foo(); // keep',
            '    bar();',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-inline-comment.c');
        const range = new vscode.Range(2, 0, 3, 0);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(applyEdit(document, edits[0])).toBe(source);
    });

    test('多行 mapping 语句的真实选区仍能格式化', async () => {
        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '\tset("exits", ([',
            '\t\t"east"      : __DIR__"kedian",',
            '\t\t     "west"      : __DIR__"majiu",',
            '\t\t"north"     : __DIR__"beidajie2",',
            '\t\t   "south"     : __DIR__"canlangting",',
            '\t\t"southwest" : __DIR__"xiyuan",',
            '\t]));',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-mapping.c');
        const range = new vscode.Range(2, 0, 8, 5);
        clearGlobalParsedDocumentService();
        const parsed = getGlobalParsedDocumentService().get(document);
        const edits = await service.formatRange(document, range);

        expect(parsed.diagnostics).toHaveLength(0);
        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('"west" : __DIR__"majiu"');
        expect(edits[0].newText).toContain('"southwest" : __DIR__"xiyuan"');
    });

    test('多行 mapping 选区格式化与整文一致地保留条目前注释和块状数组值', async () => {
        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '    mapping data = ([',
            '        // keep these names',
            '        // keep first 25 entries',
            '        "foot" : ({ "a", "b" }),',
            '        "hand" : ({ "c", "d" })',
            '    ]);',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-mapping-comments.c');
        const range = new vscode.Range(2, 4, 7, 7);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('// keep these names');
        expect(edits[0].newText).toContain('// keep first 25 entries');
        expect(edits[0].newText).toContain('"foot" : ({\n');
        expect(edits[0].newText).toContain('            "a",\n');
        expect(edits[0].newText).toContain('"hand" : ({\n');
        expect(edits[0].newText).toContain('            "c",\n');
    });

    (hasFixture('meridiand.c') ? test : test.skip)('真实 meridiand 的足三阳经选区格式化保留说明注释和块状数组值', async () => {
        const service = new FormattingService();
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-meridiand-foot.c');
        const range = new vscode.Range(18, 0, 20, document.lineAt(20).text.length);
        const edits = await service.formatRange(document, range);
        const output = normalizeLineEndings(edits[0].newText);

        expect(edits).toHaveLength(1);
        expect(output).toContain('//瞳子髎、听会、上关、颔厌');
        expect(output).toContain('//保留前25个穴位');
        expect(output).toContain('"足三阳经" : ({\n');
        expect(output).toContain('"瞳子髎",\n');
    });

    (hasFixture('meridiand.c') ? test : test.skip)('真实 meridiand 的 mapping 选区格式化不会把文件头注释混进结果', async () => {
        const service = new FormattingService();
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-meridiand-mapping.c');
        const range = new vscode.Range(9, 0, 22, document.lineAt(22).text.length);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('mapping xuewei = ([');
        expect(edits[0].newText).not.toContain('//meridiand.c');
        expect(edits[0].newText).not.toContain('meridian/belt');
        expect(edits[0].newText).not.toContain('//by luoyun 2016.6.27');
    });

    (hasFixture('meridiand.c') ? test.each(MERIDIAND_TOP_LEVEL_CASES) : test.skip.each(MERIDIAND_TOP_LEVEL_CASES))('真实 meridiand 的$name选区格式化后与整文结果一致', async ({ fileName, rangeFactory }) => {
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', fileName);

        await expectMeridiandRangeToMatchStandaloneDocument(rangeFactory(document), fileName);
    });

    (hasFixture('meridiand.c') ? test.each(MERIDIAND_STATEMENT_CASES) : test.skip.each(MERIDIAND_STATEMENT_CASES))('真实 meridiand 的$name节点选区格式化后与包装格式化一致', async ({ fileName, rangeFactory }) => {
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', fileName);

        await expectMeridiandRangeToMatchWrappedStandaloneDocument(
            rangeFactory(document),
            fileName,
            wrapStatementSelection,
            extractWrappedFunctionBody
        );
    });

    (hasFixture('meridiand.c') ? test.each(MERIDIAND_SNIPPET_CASES) : test.skip.each(MERIDIAND_SNIPPET_CASES))('真实 meridiand 的$name选区格式化后与 snippet fallback 一致', async ({ fileName, rangeFactory }) => {
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', fileName);

        await expectMeridiandRangeToMatchWrappedSnippetDocument(rangeFactory(document), fileName);
    });

    (hasFixture('meridiand.c') ? test.each(MERIDIAND_MAPPING_ENTRY_CASES) : test.skip.each(MERIDIAND_MAPPING_ENTRY_CASES))('真实 meridiand 的$name条目选区格式化后与包装 mapping 格式化一致', async ({ fileName, rangeFactory }) => {
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', fileName);

        await expectMeridiandRangeToMatchWrappedStandaloneDocument(
            rangeFactory(document),
            fileName,
            wrapMappingEntrySelection,
            extractWrappedMappingEntry
        );
    });

    (hasFixture('meridiand.c') ? test.each(MERIDIAND_ARRAY_LITERAL_CASES) : test.skip.each(MERIDIAND_ARRAY_LITERAL_CASES))('真实 meridiand 的$name直接选区格式化会展开为稳定的多行数组', async ({ fileName, rangeFactory }) => {
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', fileName);
        const edits = await new FormattingService().formatRange(document, rangeFactory(document));

        expect(edits).toHaveLength(1);
        expect(normalizeLineEndings(edits[0].newText)).toContain('({\n');
        expect(normalizeLineEndings(edits[0].newText)).not.toContain(', }');
        expect(normalizeLineEndings(edits[0].newText)).toContain('\n\t})');
    });

    (hasFixture('meridiand.c') ? test : test.skip)('真实 meridiand 的不完整 mapping 片段选区会被拒绝', async () => {
        const service = new FormattingService();
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-meridiand-partial-mapping.c');
        const range = new vscode.Range(10, 0, 15, document.lineAt(15).text.length);

        await expect(service.formatRange(document, range)).resolves.toEqual([]);
    });

    (hasFixture('meridiand.c') ? test.each : test.skip.each)([
        {
            name: '注释说明块',
            fileName: 'range-meridiand-comment-only.c',
            rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(18, 0, 19, document.lineAt(19).text.length)
        },
        {
            name: '半截 else-if 链',
            fileName: 'range-meridiand-partial-else-chain.c',
            rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(105, 0, 124, document.lineAt(124).text.length)
        },
        {
            name: 'do_score 中的 for 循环体片段',
            fileName: 'range-meridiand-partial-loop-body.c',
            rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(77, 0, 88, document.lineAt(88).text.length)
        },
        {
            name: 'do_through 中的半截奖励分支',
            fileName: 'range-meridiand-partial-reward-branch.c',
            rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(295, 0, 323, document.lineAt(323).text.length)
        },
        {
            name: 'do_through 的单穴奖励 else 分支',
            fileName: 'range-meridiand-single-reward-else.c',
            rangeFactory: (document: ReturnType<typeof TestHelper.createMockDocument>) => new vscode.Range(355, 0, 579, document.lineAt(579).text.length)
        }
    ])('真实 meridiand 的$name选区会被拒绝', async ({ fileName, rangeFactory }) => {
        const service = new FormattingService();
        const source = readFixture('meridiand.c');
        const document = TestHelper.createMockDocument(source, 'lpc', fileName);

        await expect(service.formatRange(document, rangeFactory(document))).resolves.toEqual([]);
    });

    test('多条语句选区在 fallback 中保持 block 语义并保留 heredoc 正文', async () => {
        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '\tset("short", "北大街");',
            '\t set("long", @LONG',
            '你走在一条繁忙的街道上，看着操着南腔北调的人们行色',
            '匆匆，许多人都往南边走去，那里有一个热闹的亭子。西南面',
            '是一家戏园子，不时传来叫好声，来自各地的人们进进出出。',
            '在东面是一个客店。西面是一个马厩。',
            'LONG );',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-heredoc-snippet.c');
        const range = new vscode.Range(2, 0, 8, 7);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('set("short", "北大街");\n\tset("long", @LONG');
        expect(edits[0].newText).toContain('你走在一条繁忙的街道上');
        expect(edits[0].newText).toContain('\nLONG );');
        expect(edits[0].newText).not.toContain('set("short", "北大街");\n\n\tset("long"');
        expect(edits[0].newText).not.toContain('@LONG\n\t);');
    });

    test('包含 return heredoc 的完整函数选区保留正文', async () => {
        const service = new FormattingService();
        const source = [
            'string help(object me)',
            '{',
            '    return @TEXT',
            'line one',
            'line two',
            'TEXT;',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-return-heredoc.c');
        const range = new vscode.Range(0, 0, 6, 1);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('return @TEXT\nline one\nline two\nTEXT;');
        expect(edits[0].newText).not.toContain('return @TEXT\n;');
    });

    test('包含 heredoc 的完整节点在安全格式化失败时保持原文', async () => {
        const service = new FormattingService();
        const source = [
            'string test()',
            '{',
            '    return "prefix" + @TEXT',
            'TEXT should stay body text',
            'line two',
            'TEXT;',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-heredoc-failsafe.c');
        const range = new vscode.Range(0, 0, 6, 1);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toBe(source);
    });

    test('fallback range formatting 会遵守 indentSize 配置', async () => {
        const originalGetConfiguration = workspace.getConfiguration();
        (workspace.getConfiguration as jest.Mock).mockReturnValue({
            ...originalGetConfiguration,
            get: jest.fn((key: string, defaultValue?: unknown) => (
                key === 'lpc.format.indentSize' ? 2 : defaultValue
            ))
        });

        const service = new FormattingService();
        const source = [
            'void create()',
            '{',
            '  if(x){foo();}',
            '  bar();',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-indent-two.c');
        const range = new vscode.Range(2, 0, 3, 8);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(edits[0].newText).toContain('  if (x)\n  {');
        expect(edits[0].newText).toContain('\n    foo();');
        expect(edits[0].newText).not.toContain('\n      foo();');

        (workspace.getConfiguration as jest.Mock).mockReturnValue(originalGetConfiguration);
    });

    test('块内 if 语句选区格式化后保持原始缩进层级', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    if(x){foo();}',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-nested-if.c');
        const range = new vscode.Range(2, 4, 2, 17);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(applyEdit(document, edits[0])).toBe([
            'void test()',
            '{',
            '    if (x)',
            '    {',
            '        foo();',
            '    }',
            '}'
        ].join('\n'));
    });

    test('仅有 foreach(ref) 误报时选区格式化仍可工作', async () => {
        const service = new FormattingService();
        const source = [
            'void test()',
            '{',
            '    foreach(ref mixed item in arr) {',
            '        foo(item);',
            '    }',
            '    if(x){bar();}',
            '}'
        ].join('\n');
        const document = TestHelper.createMockDocument(source, 'lpc', 'range-foreach-ref.c');
        const range = new vscode.Range(5, 4, 5, 17);
        const edits = await service.formatRange(document, range);

        expect(edits).toHaveLength(1);
        expect(applyEdit(document, edits[0])).toBe([
            'void test()',
            '{',
            '    foreach(ref mixed item in arr) {',
            '        foo(item);',
            '    }',
            '    if (x)',
            '    {',
            '        bar();',
            '    }',
            '}'
        ].join('\n'));
    });
});
