import * as vscode from 'vscode';
import type { EfunDocsManager } from '../../../efunDocs';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import { SyntaxKind, type SyntaxDocument, type SyntaxNode } from '../../../syntax/types';
import type { LanguageHoverRequest, LanguageHoverResult, LanguageHoverService } from './LanguageHoverService';

type EfunHoverAnalysisService = Pick<DocumentAnalysisService, 'getSyntaxDocument'>;

export class EfunLanguageHoverService implements LanguageHoverService {
    private readonly analysisService: EfunHoverAnalysisService;

    public constructor(
        private readonly efunDocsManager: EfunDocsManager,
        analysisService: EfunHoverAnalysisService,
        private readonly renderer: Pick<CallableDocRenderer, 'renderHover'>
    ) {
        this.analysisService = assertAnalysisService('EfunLanguageHoverService', analysisService);
    }

    public async provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined> {
        const document = request.context.document as unknown as vscode.TextDocument;
        const position = new vscode.Position(request.position.line, request.position.character);
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const hoverMarkdown = await this.resolveHoverMarkdown(document, position, word);
        return hoverMarkdown ? createHoverResult(wordRange, hoverMarkdown) : undefined;
    }

    private async resolveHoverMarkdown(
        document: vscode.TextDocument,
        position: vscode.Position,
        word: string
    ): Promise<string | undefined> {
        if (this.isScopedMethodAccess(document, position, word)) {
            return undefined;
        }

        if (this.isArrowMemberAccess(document, position, word)) {
            return undefined;
        }

        const currentDoc = await this.efunDocsManager.getCurrentFileDocForDocument(document, word);
        if (currentDoc) {
            return this.renderer.renderHover({ ...currentDoc, sourceKind: 'local' });
        }

        const inheritedDoc = await this.efunDocsManager.getInheritedFileDocForDocument(
            document,
            word,
            { forceFresh: true }
        );
        if (inheritedDoc) {
            return this.renderer.renderHover({ ...inheritedDoc, sourceKind: 'inherit' });
        }

        const includeDoc = await this.efunDocsManager.getIncludedFileDoc(document, word);
        if (includeDoc) {
            return this.renderer.renderHover({ ...includeDoc, sourceKind: 'include' });
        }

        const simulatedDoc = await this.efunDocsManager.getSimulatedDocAsync(word);
        if (simulatedDoc) {
            return this.renderer.renderHover({ ...simulatedDoc, sourceKind: 'simulEfun' });
        }

        const standardCallableDoc = this.efunDocsManager.getStandardCallableDoc(word);
        if (standardCallableDoc) {
            return this.renderer.renderHover(standardCallableDoc, { sourceLabel: '标准 Efun' });
        }

        return undefined;
    }

    private isScopedMethodAccess(document: vscode.TextDocument, position: vscode.Position, word: string): boolean {
        const syntax = this.getSyntaxDocument(document);
        if (!syntax) {
            return false;
        }

        const candidates = this.getContainingSyntaxNodes(syntax, position);

        for (const node of candidates) {
            if (node.kind === SyntaxKind.CallExpression && this.isMatchingScopedMethod(node.children[0], word)) {
                return true;
            }
        }

        return candidates.some((node) => this.isMatchingScopedMethod(node, word));
    }

    private isArrowMemberAccess(document: vscode.TextDocument, position: vscode.Position, word: string): boolean {
        const syntax = this.getSyntaxDocument(document);
        if (!syntax) {
            return false;
        }

        const candidates = this.getContainingSyntaxNodes(syntax, position);

        for (const node of candidates) {
            if (node.kind === SyntaxKind.CallExpression && this.isMatchingArrowMember(node.children[0], word)) {
                return true;
            }
        }

        return candidates.some((node) => this.isMatchingArrowMember(node, word));
    }

    private getSyntaxDocument(document: vscode.TextDocument): SyntaxDocument | undefined {
        return this.analysisService.getSyntaxDocument(document, false)
            ?? this.analysisService.getSyntaxDocument(document, true);
    }

    private getContainingSyntaxNodes(syntax: SyntaxDocument, position: vscode.Position): SyntaxNode[] {
        return [...syntax.nodes]
            .filter((node) => node.range.contains(position))
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range));
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }

    private isMatchingArrowMember(node: SyntaxNode | undefined, word: string): boolean {
        if (
            !node
            || node.kind !== SyntaxKind.MemberAccessExpression
            || node.metadata?.operator !== '->'
            || node.children.length < 2
        ) {
            return false;
        }

        const memberNode = node.children[1];
        return memberNode.kind === SyntaxKind.Identifier && memberNode.name === word;
    }

    private isMatchingScopedMethod(node: SyntaxNode | undefined, word: string): boolean {
        if (!node) {
            return false;
        }

        if (node.kind === SyntaxKind.Identifier) {
            return node.metadata?.scopeQualifier === '::' && node.name === word;
        }

        if (node.kind !== SyntaxKind.MemberAccessExpression || node.metadata?.operator !== '::' || node.children.length < 2) {
            return false;
        }

        const memberNode = node.children[1];
        return memberNode.kind === SyntaxKind.Identifier && memberNode.name === word;
    }
}

function createHoverResult(range: vscode.Range, value: string): LanguageHoverResult {
    return {
        contents: [
            {
                kind: 'markdown',
                value
            }
        ],
        range: {
            start: {
                line: range.start.line,
                character: range.start.character
            },
            end: {
                line: range.end.line,
                character: range.end.character
            }
        }
    };
}
