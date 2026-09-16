import * as vscode from 'vscode';
import type { CallableDoc, CallableParameter, CallableSignature } from '../language/documentation/types';
import { BundledEfunLoader } from './BundledEfunLoader';
import type { StructuredEfunDoc, StructuredEfunParameter, StructuredEfunSignature } from './types';
import { materializeEfunNote } from './availability';

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
            console.error('加载内置 Efun 文档失败', error);
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

    public async configureSimulatedEfuns(): Promise<void> {
        await vscode.window.showInformationMessage(
            '模拟函数入口文件来自 config.hell 的 simulated efun file，请修改 lpc-support.json 的 configHellPath 或对应 driver 配置文件。'
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
        note: materializeEfunNote(structuredDoc),
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
