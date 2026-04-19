import * as vscode from 'vscode';
import { CallableDocRenderer } from '../../../documentation/CallableDocRenderer';
import { FunctionDocumentationService } from '../../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../../documentation/types';
import type { LanguageHoverResult } from '../LanguageHoverService';
import type { DocumentAnalysisService } from '../../../../semantic/documentAnalysisService';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
import { isOnScopedMethodIdentifier } from '../ScopedMethodIdentifierSupport';

type ScopedHoverAnalysisService = Pick<DocumentAnalysisService, 'getSyntaxDocument'>;
type ScopedIdentifierTester = (
    document: vscode.TextDocument,
    position: vscode.Position,
    methodName: string,
    analysisService: ScopedHoverAnalysisService
) => boolean;

interface ScopedHoverDependencies {
    scopedMethodResolver: Pick<ScopedMethodResolver, 'resolveCallAt'>;
    documentationService?: Pick<FunctionDocumentationService, 'getDocForDeclaration'>;
    renderer?: CallableDocRenderer;
    analysisService: ScopedHoverAnalysisService;
    isScopedIdentifier?: ScopedIdentifierTester;
}

export class ScopedMethodHoverResolver {
    private readonly documentationService: Pick<FunctionDocumentationService, 'getDocForDeclaration'>;
    private readonly renderer: CallableDocRenderer;
    private readonly isScopedIdentifier: ScopedIdentifierTester;

    public constructor(private readonly dependencies: ScopedHoverDependencies) {
        this.documentationService = dependencies.documentationService ?? new FunctionDocumentationService();
        this.renderer = dependencies.renderer ?? new CallableDocRenderer();
        this.isScopedIdentifier = dependencies.isScopedIdentifier ?? isOnScopedMethodIdentifier;
    }

    public async provideScopedHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<LanguageHoverResult | undefined> {
        const scopedResolution = await this.dependencies.scopedMethodResolver.resolveCallAt(document, position);
        if (!scopedResolution) {
            return undefined;
        }

        if (!this.isScopedIdentifier(
            document,
            position,
            scopedResolution.methodName,
            this.dependencies.analysisService
        )) {
            return undefined;
        }

        if (scopedResolution.status === 'unknown' || scopedResolution.status === 'unsupported') {
            return undefined;
        }

        const renderedDocs = scopedResolution.targets
            .map((target) => this.loadScopedMethodDoc(target.document, target.declarationRange))
            .filter((doc): doc is CallableDoc => Boolean(doc))
            .map((doc) => this.renderer.renderHover(doc));

        return renderedDocs.length > 0
            ? {
                contents: [{
                    kind: 'markdown',
                    value: renderedDocs.join('\n\n---\n\n')
                }]
            }
            : undefined;
    }

    private loadScopedMethodDoc(
        document: vscode.TextDocument,
        declarationRange: vscode.Range
    ): CallableDoc | undefined {
        const declarationKey = buildDeclarationKey(document.uri.toString(), declarationRange);
        const callableDoc = this.documentationService.getDocForDeclaration(document, declarationKey);
        return callableDoc
            ? {
                ...callableDoc,
                sourceKind: 'scopedMethod'
            }
            : undefined;
    }
}

function buildDeclarationKey(uri: string, range: vscode.Range): string {
    return `${uri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}
