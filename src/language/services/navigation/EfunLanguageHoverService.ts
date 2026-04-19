import * as vscode from 'vscode';
import type { EfunDocsManager } from '../../../efunDocs';
import type { EfunDoc } from '../../../efun/types';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import type { CallableDoc, CallableSignature } from '../../documentation/types';
import { SyntaxKind, type SyntaxDocument, type SyntaxNode } from '../../../syntax/types';
import type { LanguageHoverRequest, LanguageHoverResult, LanguageHoverService } from './LanguageHoverService';

type EfunHoverAnalysisService = Pick<DocumentAnalysisService, 'getSyntaxDocument'>;

export class EfunLanguageHoverService implements LanguageHoverService {
    private readonly analysisService: EfunHoverAnalysisService;
    private readonly renderer = new CallableDocRenderer();

    public constructor(
        private readonly efunDocsManager: EfunDocsManager,
        analysisService: EfunHoverAnalysisService
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
        if (this.isArrowMemberAccess(document, position, word)) {
            return undefined;
        }

        const currentDoc = await this.efunDocsManager.getCurrentFileDocForDocument(document, word);
        if (currentDoc) {
            return this.renderer.renderHover(materializeCallableDoc(currentDoc, 'local'));
        }

        const inheritedDoc = await this.efunDocsManager.getInheritedFileDocForDocument(
            document,
            word,
            { forceFresh: true }
        );
        if (inheritedDoc) {
            return this.renderer.renderHover(materializeCallableDoc(inheritedDoc, 'inherit'));
        }

        const includeDoc = await this.efunDocsManager.getIncludedFileDoc(document, word);
        if (includeDoc) {
            return this.renderer.renderHover(materializeCallableDoc(includeDoc, 'include'));
        }

        const simulatedDoc = this.efunDocsManager.getSimulatedDoc(word);
        if (simulatedDoc) {
            return this.renderer.renderHover(materializeCallableDoc(simulatedDoc, 'simulEfun'));
        }

        const standardCallableDoc = this.efunDocsManager.getStandardCallableDoc(word);
        if (standardCallableDoc) {
            return this.renderer.renderHover(standardCallableDoc, { sourceLabel: '标准 Efun' });
        }

        const standardDoc = await this.efunDocsManager.getEfunDoc(word);
        return standardDoc ? this.renderer.renderHover(materializeCallableDoc(standardDoc, 'efun')) : undefined;
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
        if (!node || node.kind !== SyntaxKind.MemberAccessExpression || node.children.length < 2) {
            return false;
        }

        const memberNode = node.children[1];
        return memberNode.kind === SyntaxKind.Identifier && memberNode.name === word;
    }
}

function materializeCallableDoc(doc: EfunDoc, sourceKind: CallableDoc['sourceKind']): CallableDoc {
    const signatures = doc.signatures?.length
        ? doc.signatures.map((signature): CallableSignature => ({
            label: signature.label,
            returnType: signature.returnType,
            parameters: signature.parameters.map((parameter) => ({
                name: parameter.name,
                type: parameter.type,
                description: parameter.description,
                optional: parameter.optional,
                variadic: parameter.variadic
            })),
            isVariadic: signature.isVariadic,
            rawSyntax: signature.label
        }))
        : [{
            label: doc.syntax || `${doc.name}()`,
            returnType: doc.returnType,
            parameters: [],
            isVariadic: false,
            rawSyntax: doc.syntax || `${doc.name}()`
        }];

    return {
        name: doc.name,
        declarationKey: `${sourceKind}:${doc.name}`,
        signatures,
        summary: doc.description || undefined,
        details: doc.details,
        note: doc.note,
        returns: doc.returnValue
            ? {
                type: doc.returnType,
                description: doc.returnValue
            }
            : undefined,
        returnObjects: doc.returnObjects ? [...doc.returnObjects] : undefined,
        sourceKind,
        sourcePath: doc.sourceFile,
        sourceRange: doc.sourceRange
    };
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
