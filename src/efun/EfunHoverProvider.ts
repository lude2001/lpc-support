import * as vscode from 'vscode';
import { buildEfunHoverMarkdown, createEfunHover } from './EfunHoverContent';
import type { EfunDocsManager } from './EfunDocsManager';
import type { EfunDoc } from './types';
import type { LanguageHoverResult } from '../language/services/navigation/LanguageHoverService';
import { EfunLanguageHoverService } from '../language/services/navigation/EfunLanguageHoverService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';

export class EfunHoverProvider implements vscode.HoverProvider {
    private readonly hoverService: EfunLanguageHoverService;

    public constructor(
        efunDocsManager: EfunDocsManager,
        analysisService: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
    ) {
        this.hoverService = new EfunLanguageHoverService(efunDocsManager, analysisService);
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        const hover = await this.hoverService.provideHover({
            context: {
                document: document as any,
                workspace: {
                    workspaceRoot: ''
                },
                mode: 'lsp'
            },
            position: {
                line: position.line,
                character: position.character
            }
        });
        if (!hover) {
            return undefined;
        }

        return this.toVscodeHover(hover);
    }

    public createHoverContent(doc: EfunDoc): vscode.Hover {
        return createEfunHover(buildEfunHoverMarkdown(doc));
    }

    private toVscodeHover(hover: LanguageHoverResult): vscode.Hover {
        const range = hover.range
            ? new vscode.Range(
                hover.range.start.line,
                hover.range.start.character,
                hover.range.end.line,
                hover.range.end.character
            )
            : undefined;

        return createEfunHover(
            hover.contents.map((item) => item.value).join('\n\n'),
            range
        );
    }
}
