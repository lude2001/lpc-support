import * as vscode from 'vscode';
import type { CallableDoc, CallableParameter, CallableSignature } from '../language/documentation/types';
import { BundledEfunLoader } from './BundledEfunLoader';
import type { StructuredEfunDoc, StructuredEfunParameter, StructuredEfunSignature } from './types';

/** Static efun catalogue used by the TS presentation layer. No LPC source is parsed here. */
export class BundledEfunDocsProvider {
    public readonly bundledDocsReady: Promise<void>;
    private readonly loader = new BundledEfunLoader();
    private docs = new Map<string, CallableDoc>();

    public constructor(context: vscode.ExtensionContext) {
        this.bundledDocsReady = this.loader.load(context).then(() => {
            this.docs = new Map(
                this.loader.getAllNames()
                    .map((name): [string, CallableDoc] | undefined => {
                        const doc = this.loader.getStructuredDoc(name);
                        return doc ? [name, materializeCallableDoc(doc)] : undefined;
                    })
                    .filter((entry): entry is [string, CallableDoc] => Boolean(entry))
            );
        });
        void this.bundledDocsReady.catch((error) => {
            console.error(vscode.l10n.t('Failed to load bundled efun documentation'), error);
        });
    }

    public getAllFunctions(): string[] {
        return [...this.docs.keys()];
    }

    public getStandardCallableDoc(name: string): CallableDoc | undefined {
        return this.docs.get(name);
    }

    public getCategories(): Map<string, string[]> {
        return new Map(
            Array.from(this.loader.getCategories().entries(), ([category, names]) => [category, [...names]])
        );
    }

    public getCategoryLabel(categoryId: string): string {
        return this.loader.getCategoryLabel(categoryId);
    }

    public async configureSimulatedEfuns(): Promise<void> {
        await vscode.window.showInformationMessage(
            vscode.l10n.t('The simulated efun entry file comes from simulated efun file in config.hell. Update configHellPath in lpc-support.json or the corresponding driver configuration file.')
        );
    }
}

function materializeCallableDoc(structuredDoc: StructuredEfunDoc): CallableDoc {
    return {
        name: structuredDoc.name,
        declarationKey: `efun:${structuredDoc.name}`,
        signatures: structuredDoc.signatures.map(materializeCallableSignature),
        summary: structuredDoc.summary,
        details: structuredDoc.details,
        note: structuredDoc.note,
        sourceKind: 'efun'
    };
}

function materializeCallableSignature(signature: StructuredEfunSignature): CallableSignature {
    return {
        label: signature.label,
        returnType: signature.returnType,
        arity: signature.arity ? { ...signature.arity } : undefined,
        parameters: signature.parameters.map(materializeCallableParameter),
        isVariadic: signature.isVariadic,
        rawSyntax: signature.label
    };
}

function materializeCallableParameter(parameter: StructuredEfunParameter): CallableParameter {
    return {
        name: parameter.name,
        type: parameter.type,
        description: parameter.description,
        optional: parameter.optional,
        variadic: parameter.variadic
    };
}
