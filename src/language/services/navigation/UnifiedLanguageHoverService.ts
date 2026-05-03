import * as vscode from 'vscode';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { MacroDefinitionSummary } from '../../../semantic/documentSemanticTypes';
import type { LanguageHoverRequest, LanguageHoverResult, LanguageHoverService } from './LanguageHoverService';

interface UnifiedLanguageHoverServiceDependencies {
    efunHoverService: LanguageHoverService;
    analysisService?: DocumentAnalysisService;
}

export class UnifiedLanguageHoverService implements LanguageHoverService {
    private readonly efunHoverService: LanguageHoverService;

    public constructor(
        private readonly objectHoverService: LanguageHoverService,
        private readonly dependencies: UnifiedLanguageHoverServiceDependencies
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
        const localMacro = this.findFrontendMacro(document, word);
        if (localMacro) {
            return {
                contents: [this.renderFrontendMacroHover(localMacro)],
                range: toLanguageHoverRange(range)
            };
        }

        return undefined;
    }

    private findFrontendMacro(document: vscode.TextDocument, word: string): MacroDefinitionSummary | undefined {
        const snapshot = this.getFrontendSnapshot(document);
        return snapshot?.macroDefinitions?.find((macro) => macro.name === word);
    }

    private getFrontendSnapshot(document: vscode.TextDocument) {
        try {
            return this.dependencies.analysisService?.getBestAvailableSnapshot(document);
        } catch {
            return undefined;
        }
    }

    private renderFrontendMacroHover(macro: MacroDefinitionSummary): { kind: 'markdown'; value: string } {
        const parameters = macro.parameters ? `(${macro.parameters.join(', ')})` : '';
        const value = [
            '```lpc',
            `#define ${macro.name}${parameters}${macro.value ? ` ${macro.value}` : ''}`,
            '```'
        ].join('\n');

        return {
            kind: 'markdown',
            value
        };
    }
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
