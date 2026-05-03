import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { CallableDoc } from '../../documentation/types';
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
            return simulatedDoc ? { ...simulatedDoc, sourceKind: 'simulEfun' } : undefined;
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
