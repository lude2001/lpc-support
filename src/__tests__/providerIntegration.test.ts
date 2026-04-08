import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';
import { LPCCompletionItemProvider } from '../completionProvider';
import { LPCDefinitionProvider } from '../definitionProvider';
import * as parseCache from '../parseCache';
import { LPCSemanticTokensProvider } from '../semanticTokensProvider';

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position)),
        getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        })
    } as unknown as vscode.TextDocument;
}

describe('provider integration regression', () => {
    const efunDocsManager = {
        getAllFunctions: jest.fn(() => ['write']),
        getStandardDoc: jest.fn(() => undefined),
        getAllSimulatedFunctions: jest.fn(() => []),
        getSimulatedDoc: jest.fn(() => undefined)
    };
    const macroManager = {
        getMacro: jest.fn(),
        getAllMacros: jest.fn(() => []),
        getMacroHoverContent: jest.fn(),
        scanMacros: jest.fn(),
        getIncludePath: jest.fn(() => undefined),
        canResolveMacro: jest.fn(() => false)
    };

    let fixtureRoot: string;

    beforeEach(() => {
        jest.clearAllMocks();
        fixtureRoot = path.join(process.cwd(), '.tmp-provider-integration');
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
        fs.mkdirSync(path.join(fixtureRoot, 'lib'), { recursive: true });
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: fixtureRoot }
        });
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: fixtureRoot } }];
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });
    });

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        jest.restoreAllMocks();
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    });

    test('completion requests stay on semantic snapshots instead of legacy parseCache', async () => {
        const legacyGetParsedSpy = jest.spyOn(parseCache, 'getParsed').mockImplementation(() => {
            throw new Error('legacy parseCache should not be used by completion provider');
        });
        const provider = new LPCCompletionItemProvider(efunDocsManager as any, macroManager as any);
        const document = createDocument(
            path.join(fixtureRoot, 'completion.c'),
            [
                'int local_call(string message) {',
                '    return 1;',
                '}',
                '',
                'local_call();'
            ].join('\n')
        );

        const result = await provider.provideCompletionItems(
            document,
            new vscode.Position(4, 'loca'.length),
            { isCancellationRequested: false } as vscode.CancellationToken,
            { triggerKind: vscode.CompletionTriggerKind.Invoke } as vscode.CompletionContext
        ) as vscode.CompletionItem[];

        expect(result.map((item) => item.label)).toContain('local_call');
        expect(legacyGetParsedSpy).not.toHaveBeenCalled();
    });

    test('semantic tokens provider reuses ASTManager analysis without falling back to legacy parseCache', async () => {
        const legacyGetParsedSpy = jest.spyOn(parseCache, 'getParsed').mockImplementation(() => {
            throw new Error('legacy parseCache should not be used by semantic tokens provider');
        });
        const provider = new LPCSemanticTokensProvider();
        const document = createDocument(
            path.join(fixtureRoot, 'semantic.c'),
            ['class Payload {', '    int hp;', '}', '', 'void demo() {', '    class Payload payload;', '    payload->hp;', '}'].join('\n')
        );

        const result = await provider.provideDocumentSemanticTokens(
            document,
            { isCancellationRequested: false } as vscode.CancellationToken
        ) as any;

        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
        expect(legacyGetParsedSpy).not.toHaveBeenCalled();
    });

    test('diagnostics orchestration uses ASTManager analysis instead of direct legacy parseCache reads', async () => {
        const legacyGetParsedSpy = jest.spyOn(parseCache, 'getParsed').mockImplementation(() => {
            throw new Error('legacy parseCache should not be used by diagnostics orchestrator');
        });
        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            macroManager as any
        );
        (orchestrator as any).collectors = [];
        const document = createDocument(
            path.join(fixtureRoot, 'diagnostics.c'),
            ['int broken(', '{'].join('\n')
        );

        const diagnostics = await (orchestrator as any).collectDiagnostics(document);

        expect(Array.isArray(diagnostics)).toBe(true);
        expect(legacyGetParsedSpy).not.toHaveBeenCalled();
    });

    test('definition requests use a version-matching semantic snapshot after edits', async () => {
        const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
        const fileName = path.join(fixtureRoot, 'definition.c');
        const initialDocument = createDocument(
            fileName,
            [
                'int first_call() {',
                '    return 1;',
                '}',
                '',
                'void demo() {',
                '    first_call();',
                '}'
            ].join('\n'),
            1
        );

        ASTManager.getInstance().getSemanticSnapshot(initialDocument, false);

        const updatedDocument = createDocument(
            fileName,
            [
                'int renamed_call() {',
                '    return 2;',
                '}',
                '',
                'void demo() {',
                '    renamed_call();',
                '}'
            ].join('\n'),
            2
        );

        const definition = await provider.provideDefinition(
            updatedDocument,
            new vscode.Position(5, 8),
            { isCancellationRequested: false } as vscode.CancellationToken
        ) as any;

        expect(definition).toBeDefined();
        expect(definition.uri.fsPath).toBe(updatedDocument.uri.fsPath);
        expect(definition.range.line).toBe(0);
        expect(updatedDocument.lineAt(definition.range.line).text).toContain('renamed_call');
    });

    test('definition does not fall back to simul_efun when object method resolution fails', async () => {
        efunDocsManager.getSimulatedDoc.mockImplementation((name: string) => (
            name === 'write' ? { name: 'write' } : undefined
        ));
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string) => (key === 'lpc.simulatedEfunsPath' ? 'simul_efuns' : undefined))
        });

        const simulatedEfunFile = path.join(fixtureRoot, 'simul_efuns', 'write.c');
        fs.mkdirSync(path.dirname(simulatedEfunFile), { recursive: true });
        fs.writeFileSync(simulatedEfunFile, 'void write(string msg) {\n}\n');
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([vscode.Uri.file(simulatedEfunFile)]);
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
            if (uri.fsPath === simulatedEfunFile) {
                return createDocument(simulatedEfunFile, fs.readFileSync(simulatedEfunFile, 'utf8'));
            }

            return undefined;
        });

        const provider = new LPCDefinitionProvider(macroManager as any, efunDocsManager as any);
        const document = createDocument(
            path.join(fixtureRoot, 'object-method.c'),
            [
                'void demo() {',
                '    ghost->write();',
                '}'
            ].join('\n')
        );

        const definition = await provider.provideDefinition(
            document,
            new vscode.Position(1, 11),
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect(definition).toBeUndefined();
        expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
    });
});
