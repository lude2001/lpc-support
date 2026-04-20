import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../documentation/types';
import type { EfunDoc } from '../../../efun/types';
import type { EfunDocsManager } from '../../../efun/EfunDocsManager';
import type {
    CallableDocResolver,
    ResolvedCallableTarget,
    SignatureHelpDocumentHost
} from './LanguageSignatureHelpService';

export class DefaultCallableDocResolver implements CallableDocResolver {
    public constructor(
        private readonly documentationService: FunctionDocumentationService,
        private readonly efunDocsManager: EfunDocsManager | undefined,
        private readonly host: SignatureHelpDocumentHost
    ) {}

    public async resolveFromTarget(target: ResolvedCallableTarget): Promise<CallableDoc | undefined> {
        if (target.kind === 'efun') {
            return this.efunDocsManager?.getStandardCallableDoc(target.name);
        }

        if (target.kind === 'simulEfun' && (!target.documentUri || !target.declarationKey)) {
            const simulatedDoc = this.efunDocsManager
                ? this.efunDocsManager.getSimulatedDocAsync
                    ? await this.efunDocsManager.getSimulatedDocAsync(target.name)
                    : this.efunDocsManager.getSimulatedDoc(target.name)
                : undefined;
            return simulatedDoc ? materializeCompatCallableDoc(simulatedDoc, 'simulEfun') : undefined;
        }

        if (!target.documentUri || !target.declarationKey) {
            return undefined;
        }

        const document = await this.host.openTextDocument(vscode.Uri.parse(target.documentUri));
        this.documentationService.invalidate(target.documentUri);
        const callableDoc = this.documentationService.getDocForDeclaration(document, target.declarationKey);
        return callableDoc
            ? {
                ...callableDoc,
                sourceKind: target.kind
            }
            : undefined;
    }
}

function materializeCompatCallableDoc(doc: EfunDoc, sourceKind: CallableDoc['sourceKind']): CallableDoc {
    const signatures = doc.signatures?.length
        ? doc.signatures.map((signature) => ({
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
