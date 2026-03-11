import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { CompletionContextAnalyzer } from '../completion/completionContextAnalyzer';
import { CompletionQueryEngine } from '../completion/completionQueryEngine';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn(() => content),
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
        })
    } as unknown as vscode.TextDocument;
}

describe('Completion engine regression coverage', () => {
    let root: string;

    beforeEach(() => {
        root = path.join(process.cwd(), '.tmp-completion-engine');
        fs.rmSync(root, { recursive: true, force: true });
        fs.mkdirSync(path.join(root, 'lib'), { recursive: true });

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockImplementation(() => ({
            uri: { fsPath: root }
        }));
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: root } }];
    });

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        fs.rmSync(root, { recursive: true, force: true });
        jest.clearAllMocks();
    });

    test('resolves inherited completions through macro inherit targets', () => {
        const basePath = path.join(root, 'lib', 'base.c');
        const childPath = path.join(root, 'room.c');
        const baseContent = 'int inherited_call() { return 1; }';
        const childContent = ['inherit BASE_D;', '', 'inherited_call();'].join('\n');

        fs.writeFileSync(basePath, baseContent, 'utf8');
        fs.writeFileSync(childPath, childContent, 'utf8');

        const astManager = ASTManager.getInstance();
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver({
            getMacro: (name: string) => name === 'BASE_D' ? { value: '"/lib/base"' } as any : undefined,
            getIncludePath: () => undefined
        } as any, [root]));
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer()
        });

        const baseDocument = createDocument(basePath, baseContent);
        const childDocument = createDocument(childPath, childContent);
        projectSymbolIndex.updateFromSemanticSnapshot(astManager.getSemanticSnapshot(baseDocument, false));

        const result = engine.query(
            childDocument,
            new vscode.Position(2, 'inhe'.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect(result.context.kind).toBe('identifier');
        expect(result.candidates.map(candidate => candidate.label)).toContain('inherited_call');
    });

    test('keeps member completion working for compound class pointer types', () => {
        const filePath = path.join(root, 'payload.c');
        const content = [
            'class Payload {',
            '    int hp;',
            '}',
            '',
            'void demo() {',
            '    class Payload *payloads;',
            '    payloads->h',
            '}'
        ].join('\n');

        fs.writeFileSync(filePath, content, 'utf8');

        const astManager = ASTManager.getInstance();
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined, [root]));
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer()
        });
        const document = createDocument(filePath, content);

        const result = engine.query(
            document,
            new vscode.Position(6, '    payloads->h'.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect(result.context.kind).toBe('member');
        expect(result.candidates.map(candidate => candidate.label)).toContain('hp');
    });

    test('returns an empty result when cancellation is requested early', () => {
        const filePath = path.join(root, 'cancel.c');
        const content = 'write';
        const document = createDocument(filePath, content);
        const astManager = ASTManager.getInstance();
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined, [root]));
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer(),
            efunProvider: {
                getAllFunctions: () => ['write'],
                getAllSimulatedFunctions: () => []
            }
        });

        const result = engine.query(
            document,
            new vscode.Position(0, content.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: true } as vscode.CancellationToken
        );

        expect(result.candidates).toEqual([]);
        expect(result.isIncomplete).toBe(false);
    });
});
