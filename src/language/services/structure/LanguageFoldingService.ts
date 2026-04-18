import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { SyntaxKind, SyntaxNode } from '../../../syntax/types';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type {
    LanguageSemanticTokensRequest,
    LanguageSemanticTokensResult
} from './LanguageSemanticTokensService';

export interface LanguageFoldingRange {
    startLine: number;
    endLine: number;
    startCharacter?: number;
    endCharacter?: number;
    kind?: 'comment' | 'imports' | 'region';
}

export interface LanguageFoldingRequest {
    context: LanguageCapabilityContext;
}

export interface LanguageFoldingService {
    provideFoldingRanges(request: LanguageFoldingRequest): Promise<LanguageFoldingRange[]>;
}

export interface LanguageStructureService {
    provideFoldingRanges(request: LanguageFoldingRequest): Promise<LanguageFoldingRange[]>;
    provideSemanticTokens(
        request: LanguageSemanticTokensRequest
    ): Promise<LanguageSemanticTokensResult>;
}

interface HostPosition {
    line: number;
    character: number;
}

interface HostRange {
    start: HostPosition;
    end: HostPosition;
}

export class DefaultLanguageFoldingService implements LanguageFoldingService {
    public constructor(
        private readonly analysisService?: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
    ) {}

    public async provideFoldingRanges(request: LanguageFoldingRequest): Promise<LanguageFoldingRange[]> {
        const document = request.context.document;
        const foldingRanges: LanguageFoldingRange[] = [];
        const seen = new Set<string>();
        const syntax = requireLanguageFoldingAnalysisService(this.analysisService).getSyntaxDocument(document as any);

        if (!syntax) {
            return foldingRanges;
        }

        this.collectTriviaFolding(syntax.parsed.tokenTriviaIndex.getAllTrivia(), foldingRanges, seen);
        this.collectSyntaxFolding(syntax.root, foldingRanges, seen);

        return foldingRanges;
    }

    private collectTriviaFolding(
        triviaItems: ReadonlyArray<{ kind: string; range: HostRange }>,
        ranges: LanguageFoldingRange[],
        seen: Set<string>
    ): void {
        for (const trivia of triviaItems) {
            if (trivia.kind !== 'block-comment' && trivia.kind !== 'directive') {
                continue;
            }

            this.pushRange(
                ranges,
                seen,
                trivia.range,
                trivia.kind === 'block-comment' ? 'comment' : 'region'
            );
        }
    }

    private collectSyntaxFolding(node: SyntaxNode, ranges: LanguageFoldingRange[], seen: Set<string>): void {
        if (this.isFoldableNode(node.kind)) {
            this.pushRange(ranges, seen, node.range, 'region');
        }

        for (const child of node.children) {
            this.collectSyntaxFolding(child, ranges, seen);
        }
    }

    private isFoldableNode(kind: SyntaxKind): boolean {
        return kind === SyntaxKind.FunctionDeclaration
            || kind === SyntaxKind.StructDeclaration
            || kind === SyntaxKind.ClassDeclaration
            || kind === SyntaxKind.Block
            || kind === SyntaxKind.IfStatement
            || kind === SyntaxKind.ForStatement
            || kind === SyntaxKind.ForeachStatement
            || kind === SyntaxKind.WhileStatement
            || kind === SyntaxKind.DoWhileStatement
            || kind === SyntaxKind.SwitchStatement;
    }

    private pushRange(
        ranges: LanguageFoldingRange[],
        seen: Set<string>,
        range: HostRange,
        kind: LanguageFoldingRange['kind']
    ): void {
        if (!kind || range.end.line <= range.start.line) {
            return;
        }

        const key = `${range.start.line}:${range.end.line}:${kind}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        ranges.push({
            startLine: range.start.line,
            endLine: range.end.line,
            startCharacter: range.start.character,
            endCharacter: range.end.character,
            kind
        });
    }
}

function requireLanguageFoldingAnalysisService(
    service?: Pick<DocumentAnalysisService, 'getSyntaxDocument'>
): Pick<DocumentAnalysisService, 'getSyntaxDocument'> {
    if (!service) {
        throw new Error('Language folding analysis service has not been configured');
    }

    return service;
}
