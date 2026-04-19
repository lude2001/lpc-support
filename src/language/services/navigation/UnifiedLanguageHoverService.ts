import * as vscode from 'vscode';
import type { MacroManager } from '../../../macroManager';
import type { LanguageHoverRequest, LanguageHoverResult, LanguageHoverService } from './LanguageHoverService';

interface UnifiedLanguageHoverServiceDependencies {
    efunHoverService: LanguageHoverService;
}

export class UnifiedLanguageHoverService implements LanguageHoverService {
    private readonly efunHoverService: LanguageHoverService;

    public constructor(
        private readonly objectHoverService: LanguageHoverService,
        private readonly macroManager: MacroManager,
        dependencies: UnifiedLanguageHoverServiceDependencies
    ) {
        if (!dependencies.efunHoverService) {
            throw new Error('UnifiedLanguageHoverService requires an injected efun hover service');
        }
        this.efunHoverService = dependencies.efunHoverService;
    }

    public async provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined> {
        const document = request.context.document as unknown as vscode.TextDocument;
        const position = new vscode.Position(request.position.line, request.position.character);

        const macroHover = await this.resolveMacroHover(document, position);
        if (macroHover) {
            return macroHover;
        }

        const objectHover = await this.objectHoverService.provideHover(request);
        if (objectHover) {
            return objectHover;
        }

        return this.efunHoverService.provideHover(request);
    }

    private async resolveMacroHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<LanguageHoverResult | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        if (!/^[A-Z][A-Z0-9_]*_D$/.test(word)) {
            return undefined;
        }

        const macro = this.macroManager.getMacro(word);
        if (macro) {
            return {
                contents: [toLanguageMarkdownContent(this.macroManager.getMacroHoverContent(macro))],
                range: toLanguageHoverRange(range)
            };
        }

        const canResolve = await this.macroManager.canResolveMacro(word);
        if (!canResolve) {
            return undefined;
        }

        return {
            contents: [
                {
                    kind: 'markdown',
                    value: `宏 \`${word}\` 已定义但无法获取具体值`
                }
            ],
            range: toLanguageHoverRange(range)
        };
    }
}

function toLanguageMarkdownContent(
    content: vscode.MarkdownString | string | { language: string; value: string }
): { kind: 'markdown'; value: string } {
    return {
        kind: 'markdown',
        value: typeof content === 'string'
            ? content
            : content.value
    };
}

function toLanguageHoverRange(range: vscode.Range) {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}
