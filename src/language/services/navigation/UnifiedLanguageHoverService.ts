import * as vscode from 'vscode';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type {
    FileGlobalSummary,
    FunctionSummary,
    MacroDefinitionSummary,
    TypeDefinitionSummary
} from '../../../semantic/documentSemanticTypes';
import type { HeaderOwnerContextService } from '../../shared/HeaderOwnerContextService';
import type { LanguageHoverRequest, LanguageHoverResult, LanguageHoverService } from './LanguageHoverService';

interface UnifiedLanguageHoverServiceDependencies {
    efunHoverService: LanguageHoverService;
    analysisService?: DocumentAnalysisService;
    headerOwnerContextService?: Pick<HeaderOwnerContextService, 'resolveOwnerContext'>;
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

        const ownerContextHover = await this.resolveHeaderOwnerContextHover(document, position);
        if (ownerContextHover) {
            return ownerContextHover;
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

    private async resolveHeaderOwnerContextHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<LanguageHoverResult | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const context = await this.dependencies.headerOwnerContextService?.resolveOwnerContext(document);
        if (!context || context.isAmbiguous) {
            return undefined;
        }

        const macro = context.macros.find((definition) => definition.name === word);
        if (macro) {
            return {
                contents: [this.renderFrontendMacroHover(macro)],
                range: toLanguageHoverRange(range)
            };
        }

        const func = context.functions.find((definition) => definition.name === word);
        if (func) {
            return {
                contents: [this.renderFunctionHover(func)],
                range: toLanguageHoverRange(range)
            };
        }

        const fileGlobal = context.fileGlobals.find((definition) => definition.name === word);
        if (fileGlobal) {
            return {
                contents: [this.renderFileGlobalHover(fileGlobal)],
                range: toLanguageHoverRange(range)
            };
        }

        const type = context.types.find((definition) => definition.name === word);
        if (type) {
            return {
                contents: [this.renderTypeHover(type)],
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

    private renderFunctionHover(summary: FunctionSummary): { kind: 'markdown'; value: string } {
        const parameters = summary.parameters.map((parameter) => {
            const suffix = parameter.isVariadic ? '...' : '';
            return `${parameter.dataType} ${parameter.name}${suffix}`;
        }).join(', ');
        return {
            kind: 'markdown',
            value: [
                '```lpc',
                `${summary.returnType} ${summary.name}(${parameters})`,
                '```'
            ].join('\n')
        };
    }

    private renderFileGlobalHover(summary: FileGlobalSummary): { kind: 'markdown'; value: string } {
        return {
            kind: 'markdown',
            value: [
                '```lpc',
                `${summary.dataType} ${summary.name}`,
                '```'
            ].join('\n')
        };
    }

    private renderTypeHover(summary: TypeDefinitionSummary): { kind: 'markdown'; value: string } {
        return {
            kind: 'markdown',
            value: [
                '```lpc',
                `${summary.kind} ${summary.name}`,
                '```'
            ].join('\n')
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
