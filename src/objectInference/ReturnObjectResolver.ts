import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import { MacroManager } from '../macroManager';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ReceiverClassifier } from './ReceiverClassifier';
import { ScopedMethodResolver } from './ScopedMethodResolver';
import { ScopedMethodReturnResolver } from './ScopedMethodReturnResolver';
import { ClassifiedReceiver, ObjectCandidate, ObjectInferenceDiagnostic, ObjectInferenceReason } from './types';

export interface ObjectResolutionOutcome {
    candidates: ObjectCandidate[];
    reason?: ObjectInferenceReason;
    diagnostics?: ObjectInferenceDiagnostic[];
}

export class ReturnObjectResolver {
    private readonly classifier = new ReceiverClassifier();
    private readonly documentationService: FunctionDocumentationService;
    private readonly pathSupport: Pick<WorkspaceDocumentPathSupport, 'resolveObjectFilePath'>;
    private scopedMethodReturnResolver?: ScopedMethodReturnResolver;

    constructor(
        private readonly macroManager?: MacroManager,
        private readonly playerObjectPathOrProjectConfig?: string | LpcProjectConfigService,
        documentationService?: FunctionDocumentationService,
        private readonly scopedMethodResolver?: ScopedMethodResolver,
        pathSupport?: Pick<WorkspaceDocumentPathSupport, 'resolveObjectFilePath'>
    ) {
        this.documentationService = assertDocumentationService('ReturnObjectResolver', documentationService);
        if (!pathSupport) {
            throw new Error('ReturnObjectResolver requires an injected object path support');
        }
        this.pathSupport = pathSupport;
    }

    public attachScopedMethodReturnResolver(resolver: ScopedMethodReturnResolver): void {
        this.scopedMethodReturnResolver = resolver;
    }

    public async resolveExpression(
        document: vscode.TextDocument,
        expression: SyntaxNode
    ): Promise<ObjectCandidate[]> {
        return (await this.resolveExpressionOutcome(document, expression)).candidates;
    }

    public async resolveExpressionOutcome(
        document: vscode.TextDocument,
        expression: SyntaxNode
    ): Promise<ObjectResolutionOutcome> {
        if (expression.kind === SyntaxKind.ParenthesizedExpression && expression.children[0]) {
            return this.resolveExpressionOutcome(document, expression.children[0]);
        }

        if (expression.kind === SyntaxKind.NewExpression) {
            return this.resolveNewExpressionOutcome(document, expression);
        }

        if (expression.kind === SyntaxKind.CallExpression) {
            const scopedOutcome = await this.resolveScopedExpressionOutcome(document, expression);
            if (scopedOutcome) {
                return scopedOutcome;
            }
        }

        const classified = this.classifier.classify(expression);
        if (classified.kind === 'unsupported' || classified.kind === 'index') {
            return {
                candidates: [],
                reason: classified.reason
            };
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name) {
            if (!this.macroManager?.getMacro(expression.name)) {
                return { candidates: [] };
            }

            return {
                candidates: await this.resolvePathCandidate(document, expression.name, 'macro')
            };
        }

        if (expression.kind !== SyntaxKind.CallExpression) {
            return { candidates: [] };
        }

        const callee = expression.children[0];
        if (callee?.kind !== SyntaxKind.Identifier || !callee.name) {
            return { candidates: [] };
        }

        if (classified.kind !== 'call') {
            return { candidates: [] };
        }

        const builtinCandidates = await this.resolveCall(document, classified);
        if (builtinCandidates.length > 0 || this.isBuiltinCall(callee.name)) {
            return {
                candidates: builtinCandidates,
                reason: classified.unsupportedReason
            };
        }

        return {
            candidates: await this.resolveDocumentedReturnObjects(document, callee.name)
        };
    }

    public async resolveDocumentedReturnOutcome(
        document: vscode.TextDocument,
        functionName: string,
        options?: {
            contextLabel?: string;
            requireAnnotation?: boolean;
            diagnosticMethodName?: string;
        }
    ): Promise<ObjectResolutionOutcome> {
        const returnObjects = this.getDocumentedReturnObjects(
            document,
            functionName,
            options?.contextLabel ?? '当前文件'
        );
        if (!returnObjects || returnObjects.length === 0) {
            if (!options?.requireAnnotation) {
                return { candidates: [] };
            }

            return {
                candidates: [],
                diagnostics: [{
                    code: 'missing-return-annotation',
                    methodName: options.diagnosticMethodName ?? functionName
                }]
            };
        }

        return {
            candidates: await this.resolveDocumentedObjectCandidates(document, returnObjects)
        };
    }

    public async resolveCall(
        document: vscode.TextDocument,
        receiver: Extract<ClassifiedReceiver, { kind: 'call' }>
    ): Promise<ObjectCandidate[]> {
        if (receiver.calleeName === 'this_object') {
            if (receiver.argumentCount !== 0) {
                return [];
            }

            return [{ path: document.fileName, source: 'builtin-call' }];
        }

        if (receiver.calleeName === 'this_player') {
            if (receiver.argumentCount !== 0) {
                return [];
            }

            const resolvedPlayerPath = await this.resolveConfiguredPlayerObjectPath(document);
            if (!resolvedPlayerPath) {
                return [];
            }

            return [{ path: resolvedPlayerPath, source: 'builtin-call' }];
        }

        if (!['load_object', 'find_object', 'clone_object'].includes(receiver.calleeName)) {
            return [];
        }

        if (receiver.argumentCount !== 1 || !receiver.firstArgument) {
            return [];
        }

        const resolvedPath = this.pathSupport.resolveObjectFilePath(document, receiver.firstArgument);
        if (!resolvedPath) {
            return [];
        }

        return [{ path: resolvedPath, source: 'builtin-call' }];
    }

    private async resolveNewExpressionOutcome(
        document: vscode.TextDocument,
        expression: SyntaxNode
    ): Promise<ObjectResolutionOutcome> {
        const targetNode = expression.children[0];
        if (!targetNode) {
            return { candidates: [] };
        }

        const targetExpression = this.getNewTargetExpression(targetNode);
        if (!targetExpression) {
            return { candidates: [] };
        }

        const source: ObjectCandidate['source'] = this.isStringLiteral(targetExpression) ? 'literal' : 'macro';
        return {
            candidates: await this.resolvePathCandidate(document, targetExpression, source)
        };
    }

    private async resolveDocumentedReturnObjects(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<ObjectCandidate[]> {
        return (await this.resolveDocumentedReturnOutcome(document, functionName)).candidates;
    }

    private async resolveScopedExpressionOutcome(
        document: vscode.TextDocument,
        expression: SyntaxNode
    ): Promise<ObjectResolutionOutcome | undefined> {
        if (!this.scopedMethodResolver || expression.kind !== SyntaxKind.CallExpression) {
            return undefined;
        }

        const scopedResolution = await this.scopedMethodResolver.resolveCallAt(document, expression.range.start);
        if (!scopedResolution) {
            return undefined;
        }

        if (scopedResolution.status === 'unsupported') {
            return {
                candidates: [],
                reason: 'unsupported-expression'
            };
        }

        if (scopedResolution.status === 'unknown') {
            return { candidates: [] };
        }

        if (!this.scopedMethodReturnResolver) {
            return { candidates: [] };
        }

        return this.scopedMethodReturnResolver.resolveScopedMethodReturnOutcome(
            document,
            scopedResolution.targets
        );
    }

    private async resolvePathCandidate(
        document: vscode.TextDocument,
        expression: string,
        source: ObjectCandidate['source']
    ): Promise<ObjectCandidate[]> {
        const resolvedPath = this.pathSupport.resolveObjectFilePath(document, expression);
        if (!resolvedPath) {
            return [];
        }

        return [{ path: resolvedPath, source }];
    }

    private getDocumentedReturnObjects(
        document: vscode.TextDocument,
        functionName: string,
        _contextLabel: string
    ): string[] | undefined {
        return this.documentationService.getDocsByName(document, functionName)[0]?.returnObjects;
    }

    private async resolveDocumentedObjectCandidates(
        document: vscode.TextDocument,
        returnObjects: readonly string[]
    ): Promise<ObjectCandidate[]> {
        const candidates: ObjectCandidate[] = [];
        for (const objectPath of returnObjects) {
            const resolvedPath = this.pathSupport.resolveObjectFilePath(
                document,
                this.toObjectPathExpression(objectPath)
            );
            if (resolvedPath) {
                candidates.push({ path: resolvedPath, source: 'doc' });
            }
        }

        return candidates;
    }

    private isBuiltinCall(name: string): boolean {
        return ['this_object', 'this_player', 'load_object', 'find_object', 'clone_object'].includes(name);
    }

    private getNewTargetExpression(node: SyntaxNode): string | undefined {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.getNewTargetExpression(node.children[0]);
        }

        if (node.kind === SyntaxKind.Identifier && node.name) {
            return node.name;
        }

        if (node.kind === SyntaxKind.Literal) {
            return typeof node.metadata?.text === 'string' ? node.metadata.text : undefined;
        }

        if (node.kind === SyntaxKind.TypeReference) {
            if (node.name) {
                return node.name;
            }

            return typeof node.metadata?.text === 'string'
                ? node.metadata.text.trim()
                : undefined;
        }

        return undefined;
    }

    private isStringLiteral(value: string): boolean {
        return value.length >= 2 && value.startsWith('"') && value.endsWith('"');
    }

    private async resolveConfiguredPlayerObjectPath(document: vscode.TextDocument): Promise<string | undefined> {
        let playerObjectPath: string | undefined;

        if (typeof this.playerObjectPathOrProjectConfig === 'string') {
            playerObjectPath = this.playerObjectPathOrProjectConfig;
        } else if (this.playerObjectPathOrProjectConfig) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return undefined;
            }

            const projectConfig = await this.playerObjectPathOrProjectConfig.loadForWorkspace(workspaceFolder.uri.fsPath);
            playerObjectPath = projectConfig?.playerObjectPath;
        }

        if (!playerObjectPath) {
            return undefined;
        }

        return this.pathSupport.resolveObjectFilePath(
            document,
            this.toObjectPathExpression(playerObjectPath)
        );
    }

    private toObjectPathExpression(objectPath: string): string {
        if (this.macroManager?.getMacro(objectPath)) {
            return objectPath;
        }

        return this.isStringLiteral(objectPath)
            ? objectPath
            : `"${objectPath}"`;
    }
}
