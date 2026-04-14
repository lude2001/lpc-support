import * as vscode from 'vscode';
import { composeLpcType } from '../../ast/typeNormalization';
import { getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type {
    AttachedDocComment,
    CallableDoc,
    CallableParameter,
    CallableReturnDoc,
    CallableReturnObjects,
    CallableSignature,
    DocumentCallableDocs,
    DocumentRange
} from './types';

type SupportedTag = 'brief' | 'details' | 'note' | 'param' | 'return' | 'lpc-return-objects';

interface ParsedParamTag {
    type: string;
    name: string;
    description?: string;
}

interface ParsedDocTags {
    summary?: string;
    details?: string;
    note?: string;
    params: ParsedParamTag[];
    returns?: CallableReturnDoc;
    returnObjects?: CallableReturnObjects;
}

interface PendingTag {
    tag: SupportedTag | 'unknown';
    lines: string[];
    paramType?: string;
    paramName?: string;
}

interface CachedDocumentDocsEntry {
    version: number;
    docs: DocumentCallableDocs;
}

export class FunctionDocumentationService {
    private readonly documentCache = new Map<string, CachedDocumentDocsEntry>();

    public getDocumentDocs(document: vscode.TextDocument): DocumentCallableDocs {
        return cloneDocumentCallableDocs(this.getOrBuildDocumentDocs(document));
    }

    public getDocForDeclaration(document: vscode.TextDocument, declarationKey: string): CallableDoc | undefined {
        const cachedDoc = this.getOrBuildDocumentDocs(document).byDeclaration.get(declarationKey);
        return cachedDoc ? cloneCallableDoc(cachedDoc) : undefined;
    }

    public getDocsByName(document: vscode.TextDocument, name: string): CallableDoc[] {
        const documentDocs = this.getOrBuildDocumentDocs(document);
        const declarationKeys = documentDocs.byName.get(name) ?? [];
        return declarationKeys
            .map((declarationKey) => documentDocs.byDeclaration.get(declarationKey))
            .filter((callableDoc): callableDoc is CallableDoc => Boolean(callableDoc))
            .map((callableDoc) => cloneCallableDoc(callableDoc));
    }

    public invalidate(uri: string): void {
        this.documentCache.delete(uri);
        getGlobalParsedDocumentService().invalidate({ toString: () => uri } as vscode.Uri);
    }

    public clear(): void {
        this.documentCache.clear();
    }

    private getOrBuildDocumentDocs(document: vscode.TextDocument): DocumentCallableDocs {
        const uri = document.uri.toString();
        const cachedEntry = this.documentCache.get(uri);

        if (cachedEntry && cachedEntry.version === document.version) {
            return cachedEntry.docs;
        }

        const builtDocs = this.buildDocumentDocs(document);
        this.documentCache.set(uri, {
            version: document.version,
            docs: builtDocs
        });
        return builtDocs;
    }

    private buildDocumentDocs(document: vscode.TextDocument): DocumentCallableDocs {
        const uri = document.uri.toString();
        const byDeclaration = new Map<string, CallableDoc>();
        const byName = new Map<string, string[]>();
        const parsed = getGlobalParsedDocumentService().get(document);
        const syntax = new SyntaxBuilder(parsed).build();
        const functionNodes = syntax.nodes
            .filter((node): node is SyntaxNode => node.kind === SyntaxKind.FunctionDeclaration)
            .sort(compareSyntaxNodeOrder);

        for (const functionNode of functionNodes) {
            const declarationKey = buildDeclarationKey(uri, functionNode.range);
            const callableDoc = this.buildCallableDoc(document, functionNode, declarationKey);

            byDeclaration.set(declarationKey, callableDoc);

            const existingKeys = byName.get(callableDoc.name) ?? [];
            existingKeys.push(declarationKey);
            byName.set(callableDoc.name, existingKeys);
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
        const parsedDocTags = parseAttachedDocComment(functionNode.attachedDocComment, signature.returnType);

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

function parseAttachedDocComment(
    attachedDocComment: AttachedDocComment | undefined,
    returnType: string | undefined
): ParsedDocTags {
    if (!attachedDocComment) {
        return {
            params: []
        };
    }

    const lines = normalizeDocCommentLines(attachedDocComment.text);
    const parsedDocTags: ParsedDocTags = {
        params: []
    };
    let pendingTag: PendingTag | undefined;

    const finalizePendingTag = (): void => {
        if (!pendingTag) {
            return;
        }

        const normalizedText = normalizeTagText(pendingTag.lines);

        switch (pendingTag.tag) {
            case 'brief':
                if (parsedDocTags.summary === undefined && normalizedText) {
                    parsedDocTags.summary = normalizedText;
                }
                break;
            case 'details':
                if (normalizedText) {
                    parsedDocTags.details = appendDocBlock(parsedDocTags.details, normalizedText);
                }
                break;
            case 'note':
                if (normalizedText) {
                    parsedDocTags.note = appendDocBlock(parsedDocTags.note, normalizedText);
                }
                break;
            case 'return':
                if (parsedDocTags.returns === undefined && normalizedText) {
                    parsedDocTags.returns = {
                        type: returnType,
                        description: normalizedText
                    };
                }
                break;
            case 'param':
                if (pendingTag.paramType && pendingTag.paramName) {
                    parsedDocTags.params.push({
                        type: pendingTag.paramType,
                        name: pendingTag.paramName,
                        description: normalizedText
                    });
                }
                break;
            case 'lpc-return-objects':
                parsedDocTags.returnObjects = parseReturnObjectsLiteral(normalizedText);
                break;
            case 'unknown':
                break;
            default:
                assertNever(pendingTag.tag);
        }

        pendingTag = undefined;
    };

    for (const rawLine of lines) {
        const trimmedLine = rawLine.trim();
        const tagMatch = trimmedLine.match(/^@([A-Za-z][A-Za-z0-9-]*)(?:\s+(.*))?$/u);

        if (tagMatch) {
            finalizePendingTag();

            const [, tagName, remainder = ''] = tagMatch;
            if (isSupportedTag(tagName)) {
                if (tagName === 'param') {
                    const paramMatch = remainder.match(/^(\S+)\s+(\S+)(?:\s+([\s\S]*))?$/u);
                    if (paramMatch) {
                        pendingTag = {
                            tag: 'param',
                            paramType: paramMatch[1],
                            paramName: paramMatch[2],
                            lines: paramMatch[3] ? [paramMatch[3]] : []
                        };
                    } else {
                        pendingTag = {
                            tag: 'unknown',
                            lines: []
                        };
                    }
                } else {
                    pendingTag = {
                        tag: tagName,
                        lines: remainder ? [remainder] : []
                    };
                }
            } else {
                pendingTag = {
                    tag: 'unknown',
                    lines: []
                };
            }

            continue;
        }

        if (pendingTag) {
            pendingTag.lines.push(trimmedLine);
        }
    }

    finalizePendingTag();
    return parsedDocTags;
}

function normalizeDocCommentLines(commentText: string): string[] {
    return commentText
        .replace(/\r\n/g, '\n')
        .replace(/^\/\*\*\s?/u, '')
        .replace(/\s*\*\/$/u, '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/u, ''));
}

function normalizeTagText(lines: string[]): string | undefined {
    const normalizedLines = collapseBlankLines(lines.map((line) => line.trim()));

    while (normalizedLines.length > 0 && normalizedLines[0] === '') {
        normalizedLines.shift();
    }

    while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
        normalizedLines.pop();
    }

    if (normalizedLines.length === 0) {
        return undefined;
    }

    return normalizedLines.join('\n');
}

function collapseBlankLines(lines: string[]): string[] {
    const collapsed: string[] = [];
    let previousWasBlank = false;

    for (const line of lines) {
        const isBlank = line.length === 0;
        if (isBlank && previousWasBlank) {
            continue;
        }

        collapsed.push(line);
        previousWasBlank = isBlank;
    }

    return collapsed;
}

function appendDocBlock(existing: string | undefined, next: string): string {
    if (!existing) {
        return next;
    }

    return `${existing}\n\n${next}`;
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

function parseReturnObjectsLiteral(value: string | undefined): CallableReturnObjects | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(`[${trimmed.slice(1, -1)}]`);
        return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
            ? parsed
            : undefined;
    } catch {
        return undefined;
    }
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

function cloneDocumentCallableDocs(documentDocs: DocumentCallableDocs): DocumentCallableDocs {
    return {
        uri: documentDocs.uri,
        declarationOrder: [...documentDocs.declarationOrder],
        byDeclaration: new Map(
            Array.from(documentDocs.byDeclaration.entries(), ([declarationKey, callableDoc]) => [
                declarationKey,
                cloneCallableDoc(callableDoc)
            ])
        ),
        byName: new Map(
            Array.from(documentDocs.byName.entries(), ([name, declarationKeys]) => [
                name,
                [...declarationKeys]
            ])
        )
    };
}

function cloneCallableDoc(callableDoc: CallableDoc): CallableDoc {
    return {
        ...callableDoc,
        signatures: callableDoc.signatures.map((signature) => ({
            ...signature,
            parameters: signature.parameters.map((parameter) => ({ ...parameter }))
        })),
        returns: callableDoc.returns ? { ...callableDoc.returns } : undefined,
        returnObjects: callableDoc.returnObjects ? [...callableDoc.returnObjects] : undefined,
        sourceRange: callableDoc.sourceRange ? cloneDocumentRange(callableDoc.sourceRange) : undefined
    };
}

function cloneDocumentRange(range: DocumentRange): DocumentRange {
    return {
        start: { ...range.start },
        end: { ...range.end }
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

function isSupportedTag(tagName: string): tagName is SupportedTag {
    return (
        tagName === 'brief'
        || tagName === 'details'
        || tagName === 'note'
        || tagName === 'param'
        || tagName === 'return'
        || tagName === 'lpc-return-objects'
    );
}

function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${String(value)}`);
}
