import type { SignatureHelp, SignatureHelpParams } from 'vscode-languageserver/node';
import { toLspMarkupContent } from '../../../../language/adapters/lsp/conversions';
import type { LanguageSignatureHelpService } from '../../../../language/services/signatureHelp/LanguageSignatureHelpService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from '../navigation/navigationHandlerContext';

type SignatureHelpConnection = {
    onSignatureHelp(handler: (params: SignatureHelpParams) => Promise<SignatureHelp | undefined>): unknown;
};

export interface SignatureHelpRegistrationContext {
    connection: SignatureHelpConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    signatureHelpService: LanguageSignatureHelpService;
}

export function registerSignatureHelpHandler(context: SignatureHelpRegistrationContext): void {
    const { connection, documentStore, workspaceSession, signatureHelpService } = context;

    connection.onSignatureHelp(async (params: SignatureHelpParams): Promise<SignatureHelp | undefined> => {
        const result = await signatureHelpService.provideSignatureHelp({
            context: createNavigationCapabilityContext(
                params.textDocument.uri,
                documentStore,
                workspaceSession
            ),
            position: {
                line: params.position.line,
                character: params.position.character
            }
        });

        if (!result) {
            return undefined;
        }

        return {
            signatures: result.signatures.map((signature) => ({
                label: signature.label,
                documentation: signature.documentation
                    ? toLspMarkupContent({
                        kind: 'markdown',
                        value: signature.documentation
                    })
                    : undefined,
                parameters: signature.parameters.map((parameter) => ({
                    label: parameter.label,
                    documentation: parameter.documentation
                        ? toLspMarkupContent({
                            kind: 'markdown',
                            value: parameter.documentation
                        })
                        : undefined
                }))
            })),
            activeSignature: result.activeSignature,
            activeParameter: result.activeParameter
        };
    });
}
