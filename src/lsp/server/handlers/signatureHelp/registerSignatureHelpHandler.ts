import type { SignatureHelp, SignatureHelpParams } from 'vscode-languageserver/node';
import { toLspMarkupContent } from '../../../../language/adapters/lsp/conversions';
import type { LanguageSignatureHelpService } from '../../../../language/services/signatureHelp/LanguageSignatureHelpService';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type SignatureHelpConnection = {
    onSignatureHelp(handler: (params: SignatureHelpParams) => Promise<SignatureHelp | undefined>): unknown;
};

export interface SignatureHelpRegistrationContext {
    connection: SignatureHelpConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    signatureHelpService: LanguageSignatureHelpService;
}

export function registerSignatureHelpHandler(context: SignatureHelpRegistrationContext): void {
    const { connection, contextFactory, signatureHelpService } = context;

    connection.onSignatureHelp(async (params: SignatureHelpParams): Promise<SignatureHelp | undefined> => {
        const result = await signatureHelpService.provideSignatureHelp({
            context: contextFactory.createCapabilityContext(params.textDocument.uri),
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
