import * as vscode from 'vscode';
import { composeLpcType } from '../../ast/typeNormalization';
import { getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { DocCommentTagParser, type ParsedParamTag } from './DocCommentTagParser';
import type {
    CallableDoc,
    CallableParameter,
    CallableSignature,
    DocumentCallableDocs,
    DocumentRange
} from './types';

interface CallableDocEntry {
    declarationKey: string;
    callableDoc: CallableDoc;
    hasBody: boolean;
    order: number;
}

export interface CallableDocDocumentBuilderOptions {
    parsedDocumentService?: Pick<ReturnType<typeof getGlobalParsedDocumentService>, 'get'>;
    tagParser?: Pick<DocCommentTagParser, 'parse'>;
}

export class CallableDocDocumentBuilder {
    private readonly parsedDocumentService: Pick<ReturnType<typeof getGlobalParsedDocumentService>, 'get'>;
    private readonly tagParser: Pick<DocCommentTagParser, 'parse'>;

    public constructor(options: CallableDocDocumentBuilderOptions = {}) {
        this.parsedDocumentService = options.parsedDocumentService ?? getGlobalParsedDocumentService();
        this.tagParser = options.tagParser ?? new DocCommentTagParser();
    }

    public build(document: vscode.TextDocument): DocumentCallableDocs {
        const uri = document.uri.toString();
        const byDeclaration = new Map<string, CallableDoc>();
        const byName = new Map<string, string[]>();
        const entriesByName = new Map<string, CallableDocEntry[]>();
        const parsed = this.parsedDocumentService.get(document);
        const syntax = new SyntaxBuilder(parsed).build();
        const functionNodes = syntax.nodes
            .filter((node): node is SyntaxNode => node.kind === SyntaxKind.FunctionDeclaration)
            .sort(compareSyntaxNodeOrder);

        for (const [order, functionNode] of functionNodes.entries()) {
            const declarationKey = buildDeclarationKey(uri, functionNode.range);
            const callableDoc = this.buildCallableDoc(document, functionNode, declarationKey);
            const hasBody = this.hasFunctionBody(functionNode);

            byDeclaration.set(declarationKey, callableDoc);

            const existingEntries = entriesByName.get(callableDoc.name) ?? [];
            existingEntries.push({
                declarationKey,
                callableDoc,
                hasBody,
                order
            });
            entriesByName.set(callableDoc.name, existingEntries);
        }

        for (const [name, entries] of entriesByName.entries()) {
            const orderedKeys = [...entries]
                .sort(compareCallableDocEntries)
                .map((entry) => entry.declarationKey);
            byName.set(name, orderedKeys);
        }

        return {
            uri,
            declarationOrder: Array.from(byDeclaration.keys()),
            byDeclaration,
            byName
        };
    }

    private buildCallableDoc(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        declarationKey: string
    ): CallableDoc {
        const signature = this.buildSignature(document, functionNode);
        const parsedDocTags = this.tagParser.parse(functionNode.attachedDocComment, signature.returnType);

        return {
            name: functionNode.name ?? inferCallableName(functionNode) ?? signature.label,
            declarationKey,
            signatures: [applyParamDescriptions(signature, parsedDocTags.params)],
            summary: parsedDocTags.summary,
            details: parsedDocTags.details,
            note: parsedDocTags.note,
            returns: parsedDocTags.returns,
            returnObjects: parsedDocTags.returnObjects,
            sourceKind: 'local',
            sourcePath: document.fileName,
            sourceRange: toDocumentRange(functionNode.range)
        };
    }

    private buildSignature(document: vscode.TextDocument, functionNode: SyntaxNode): CallableSignature {
        const parametersNode = functionNode.children.find((child) => child.kind === SyntaxKind.ParameterList);
        const typeReferenceNode = functionNode.children.find((child) => child.kind === SyntaxKind.TypeReference);
        const pointerCount = readNumericMetadata(functionNode, 'pointerCount');
        const returnType = typeReferenceNode
            ? composeLpcType(readTypeText(typeReferenceNode), pointerCount)
            : undefined;
        const parameters = buildCallableParameters(parametersNode);
        const rawSyntax = extractSignatureSyntax(document, functionNode);

        return {
            label: rawSyntax,
            returnType,
            parameters,
            isVariadic: parameters.some((parameter) => parameter.variadic === true),
            rawSyntax
        };
    }

    private hasFunctionBody(functionNode: SyntaxNode): boolean {
        return functionNode.metadata?.hasBody === true
            || functionNode.children.some((child) => child.kind === SyntaxKind.Block);
    }
}

function buildDeclarationKey(uri: string, range: vscode.Range): string {
    return `${uri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

function buildCallableParameters(parametersNode: SyntaxNode | undefined): CallableParameter[] {
    if (!parametersNode) {
        return [];
    }

    return parametersNode.children
        .filter((child) => child.kind === SyntaxKind.ParameterDeclaration)
        .map((parameterNode, index) => {
            const typeReferenceNode = parameterNode.children.find((child) => child.kind === SyntaxKind.TypeReference);
            const type = typeReferenceNode
                ? composeLpcType(readTypeText(typeReferenceNode), readNumericMetadata(parameterNode, 'pointerCount'))
                : undefined;
            const name = parameterNode.name?.trim() || `arg${index + 1}`;

            return {
                name,
                type,
                variadic: readBooleanMetadata(parameterNode, 'isVariadic') || undefined
            };
        });
}

function extractSignatureSyntax(document: vscode.TextDocument, functionNode: SyntaxNode): string {
    const blockNode = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
    const signatureRange = blockNode
        ? new vscode.Range(functionNode.range.start, blockNode.range.start)
        : functionNode.range;

    return document.getText(signatureRange).trim().replace(/\s+/g, ' ');
}

function applyParamDescriptions(
    signature: CallableSignature,
    parsedParams: ParsedParamTag[]
): CallableSignature {
    if (parsedParams.length === 0) {
        return signature;
    }

    const parameters = signature.parameters.map((parameter) => ({ ...parameter }));

    for (const parsedParam of parsedParams) {
        const matchingParameter = parameters.find((parameter) => parameter.name === parsedParam.name);
        if (!matchingParameter) {
            continue;
        }

        if (!matchingParameter.type) {
            matchingParameter.type = parsedParam.type;
        }
        matchingParameter.description = parsedParam.description;
    }

    return {
        ...signature,
        parameters
    };
}

function inferCallableName(functionNode: SyntaxNode): string | undefined {
    return functionNode.children.find((child) => child.kind === SyntaxKind.Identifier)?.name;
}

function readTypeText(typeReferenceNode: SyntaxNode): string {
    const metadataText = typeReferenceNode.metadata?.text;
    if (typeof metadataText === 'string' && metadataText.trim()) {
        return metadataText.trim();
    }

    return typeReferenceNode.name?.trim() || 'mixed';
}

function readNumericMetadata(node: SyntaxNode, key: string): number {
    const value = node.metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readBooleanMetadata(node: SyntaxNode, key: string): boolean {
    return node.metadata?.[key] === true;
}

function toDocumentRange(range: vscode.Range): DocumentRange {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

function compareSyntaxNodeOrder(left: SyntaxNode, right: SyntaxNode): number {
    if (left.range.start.line !== right.range.start.line) {
        return left.range.start.line - right.range.start.line;
    }

    if (left.range.start.character !== right.range.start.character) {
        return left.range.start.character - right.range.start.character;
    }

    if (left.range.end.line !== right.range.end.line) {
        return left.range.end.line - right.range.end.line;
    }

    return left.range.end.character - right.range.end.character;
}

function compareCallableDocEntries(left: CallableDocEntry, right: CallableDocEntry): number {
    if (left.hasBody !== right.hasBody) {
        return left.hasBody ? -1 : 1;
    }

    return left.order - right.order;
}
