import * as vscode from 'vscode';
import { ASTManager } from '../../../ast/astManager';
import { buildEfunHoverMarkdown } from '../../../efun/EfunHoverContent';
import type { EfunDocsManager } from '../../../efunDocs';
import type { EfunDoc } from '../../../efun/types';
import { SyntaxKind, type SyntaxDocument, type SyntaxNode } from '../../../syntax/types';
import type { LanguageHoverRequest, LanguageHoverResult, LanguageHoverService } from './LanguageHoverService';

export class EfunLanguageHoverService implements LanguageHoverService {
    private readonly astManager = ASTManager.getInstance();

    public constructor(private readonly efunDocsManager: EfunDocsManager) {}

    public async provideHover(request: LanguageHoverRequest): Promise<LanguageHoverResult | undefined> {
        const document = request.context.document as unknown as vscode.TextDocument;
        const position = new vscode.Position(request.position.line, request.position.character);
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const hoverDoc = await this.resolveHoverDoc(document, position, word);
        return hoverDoc ? createHoverResult(wordRange, buildEfunHoverMarkdown(hoverDoc)) : undefined;
    }

    private async resolveHoverDoc(
        document: vscode.TextDocument,
        position: vscode.Position,
        word: string
    ): Promise<EfunDoc | undefined> {
        await this.efunDocsManager.prepareHoverLookup(document);

        const currentDoc = this.efunDocsManager.getCurrentFileDoc(word);
        if (currentDoc) {
            return currentDoc;
        }

        const inheritedDoc = this.efunDocsManager.getInheritedFileDoc(word);
        if (inheritedDoc) {
            return inheritedDoc;
        }

        const includeDoc = await this.efunDocsManager.getIncludedFileDoc(document, word);
        if (includeDoc) {
            return includeDoc;
        }

        if (this.isArrowMemberAccess(document, position, word)) {
            return undefined;
        }

        const simulatedDoc = this.efunDocsManager.getSimulatedDoc(word);
        if (simulatedDoc) {
            return simulatedDoc;
        }

        return this.efunDocsManager.getEfunDoc(word);
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
        return this.astManager.getSyntaxDocument(document, false)
            ?? this.astManager.getSyntaxDocument(document, true);
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
        if (!node || node.kind !== SyntaxKind.MemberAccessExpression || node.children.length < 2) {
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
