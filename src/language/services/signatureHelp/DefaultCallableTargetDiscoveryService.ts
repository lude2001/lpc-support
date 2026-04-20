import * as vscode from 'vscode';
import type { EfunDoc } from '../../../efun/types';
import type { EfunDocsManager } from '../../../efun/EfunDocsManager';
import type { InferredObjectAccess } from '../../../objectInference/types';
import type { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import type { TargetMethodLookup } from '../../../targetMethodLookup';
import type {
    CallableDiscoveryRequest,
    CallableTargetDiscoveryService,
    ResolvedCallableTarget
} from './LanguageSignatureHelpService';
import { buildDeclarationKey, fromVsCodeRange } from './SignatureHelpPresentationSupport';

export class DefaultCallableTargetDiscoveryService implements CallableTargetDiscoveryService {
    public constructor(
        private readonly efunDocsManager?: EfunDocsManager,
        private readonly objectInferenceService?: ObjectInferenceService,
        private readonly targetMethodLookup?: TargetMethodLookup,
        private readonly scopedMethodResolver?: ScopedMethodResolver
    ) {}

    public async discoverLocalOrInheritedTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'objectMethod' || request.callKind === 'scopedMethod' || !this.efunDocsManager) {
            return [];
        }

        const targets: ResolvedCallableTarget[] = [];
        const currentFileDoc = await this.efunDocsManager.getCurrentFileDocForDocument(request.document, request.calleeName);
        const inheritedDoc = await this.efunDocsManager.getInheritedFileDocForDocument(
            request.document,
            request.calleeName,
            { forceFresh: true }
        );

        const localTarget = toSourceBackedTarget(currentFileDoc, request.calleeName, 'local', 'current-file', 1);
        if (localTarget) {
            targets.push(localTarget);
        }

        const inheritedTarget = toSourceBackedTarget(inheritedDoc, request.calleeName, 'inherit', 'inherited', 2);
        if (inheritedTarget) {
            targets.push(inheritedTarget);
        }

        return targets;
    }

    public async discoverIncludeTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'objectMethod' || request.callKind === 'scopedMethod' || !this.efunDocsManager) {
            return [];
        }

        const includeDoc = await this.efunDocsManager.getIncludedFileDoc(
            request.document,
            request.calleeName,
            { forceFresh: true }
        );
        const target = toSourceBackedTarget(includeDoc, request.calleeName, 'include', 'include', 3);
        return target ? [target] : [];
    }

    public async discoverObjectMethodTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'scopedMethod') {
            return [];
        }

        if (
            request.callKind !== 'objectMethod'
            || !this.objectInferenceService
            || !this.targetMethodLookup
        ) {
            return [];
        }

        const inferredAccess = await this.objectInferenceService.inferObjectAccess(
            request.document,
            request.calleeLookupPosition ?? request.callExpressionRange.start
        );
        if (!isResolvedObjectAccess(inferredAccess, request.calleeName)) {
            return [];
        }

        const targets: ResolvedCallableTarget[] = [];
        for (const candidate of inferredAccess.inference.candidates) {
            const resolvedMethod = await this.targetMethodLookup.findMethod(
                request.document,
                candidate.path,
                request.calleeName,
                { useFreshSnapshots: true }
            );
            if (!resolvedMethod) {
                continue;
            }
            const declarationKey = buildDeclarationKey(
                resolvedMethod.document.uri.toString(),
                fromVsCodeRange(resolvedMethod.declarationRange)
            );

            targets.push({
                kind: 'objectMethod',
                name: request.calleeName,
                targetKey: declarationKey,
                documentUri: resolvedMethod.document.uri.toString(),
                declarationKey,
                sourceLabel: 'object-method',
                priority: 4
            });
        }

        return targets;
    }

    public async discoverScopedMethodTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind !== 'scopedMethod' || !this.scopedMethodResolver) {
            return [];
        }

        const resolution = await this.scopedMethodResolver.resolveCallAt(
            request.document,
            request.calleeLookupPosition ?? request.callExpressionRange.start
        );
        if (!resolution || resolution.status === 'unknown' || resolution.status === 'unsupported') {
            return [];
        }

        return resolution.targets.map((target) => {
            const declarationKey = buildDeclarationKey(
                target.document.uri.toString(),
                fromVsCodeRange(target.declarationRange)
            );

            return {
                kind: 'scopedMethod' as const,
                name: request.calleeName,
                targetKey: declarationKey,
                documentUri: target.document.uri.toString(),
                declarationKey,
                sourceLabel: 'scoped-method',
                priority: 4
            };
        });
    }

    public async discoverEfunTargets(
        request: CallableDiscoveryRequest
    ): Promise<ResolvedCallableTarget[]> {
        if (request.callKind === 'objectMethod' || request.callKind === 'scopedMethod' || !this.efunDocsManager) {
            return [];
        }

        const targets: ResolvedCallableTarget[] = [];
        const simulatedDoc = this.efunDocsManager.getSimulatedDocAsync
            ? await this.efunDocsManager.getSimulatedDocAsync(request.calleeName)
            : this.efunDocsManager.getSimulatedDoc(request.calleeName);
        const simulatedTarget = toSourceBackedTarget(simulatedDoc, request.calleeName, 'simulEfun', 'simul_efun', 5)
            ?? (simulatedDoc
                ? {
                    kind: 'simulEfun' as const,
                    name: request.calleeName,
                    targetKey: `simulEfun:${request.calleeName}`,
                    sourceLabel: 'simul_efun',
                    priority: 5
                }
                : undefined);
        if (simulatedTarget) {
            targets.push(simulatedTarget);
        }

        const standardDoc = this.efunDocsManager.getStandardCallableDoc(request.calleeName);
        if (standardDoc) {
            targets.push({
                kind: 'efun',
                name: request.calleeName,
                targetKey: `efun:${request.calleeName}`,
                sourceLabel: 'efun',
                priority: 6
            });
        }

        return targets;
    }
}

function toSourceBackedTarget(
    doc: EfunDoc | undefined,
    name: string,
    kind: ResolvedCallableTarget['kind'],
    sourceLabel: string,
    priority: number
): ResolvedCallableTarget | undefined {
    if (!doc?.sourceFile || !doc.sourceRange) {
        return undefined;
    }

    const documentUri = vscode.Uri.file(doc.sourceFile).toString();
    const declarationKey = buildDeclarationKey(documentUri, doc.sourceRange);

    return {
        kind,
        name,
        targetKey: declarationKey,
        documentUri,
        declarationKey,
        sourceLabel,
        priority
    };
}

function isResolvedObjectAccess(
    inferredAccess: InferredObjectAccess | undefined,
    memberName: string
): inferredAccess is InferredObjectAccess {
    return Boolean(
        inferredAccess
        && inferredAccess.memberName === memberName
        && inferredAccess.inference.status !== 'unknown'
        && inferredAccess.inference.status !== 'unsupported'
    );
}
