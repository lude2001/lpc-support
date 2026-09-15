import * as path from 'path';
import * as vscode from 'vscode';
import type { EfunDocsManager } from '../../efun/EfunDocsManager';
import type { FunctionDocLookup, FunctionDocSourceGroup } from '../../efun/FunctionDocLookupTypes';
import { DocCommentTagParser } from '../../language/documentation/DocCommentTagParser';
import type {
    CallableDoc,
    CallableParameter,
    CallableSignature,
    DocumentRange
} from '../../language/documentation/types';
import type { LspClientManager } from '../../lsp/client/LspClientManager';
import type { FunctionDocumentationLookupProvider } from './FunctionDocumentationSnapshotService';

interface RustFunctionDocumentationEntry {
    name: string;
    signature: string;
    parameters: string[];
    documentation?: string;
    documentationRange?: DocumentRange;
    returnObjects: string[];
    range: DocumentRange;
    selectionRange: DocumentRange;
    hasBody: boolean;
}

interface RustFunctionDocumentationGroup {
    uri: string;
    sourceKind: 'local' | 'inherit' | 'include';
    depth: number;
    parentUri?: string;
    entries: RustFunctionDocumentationEntry[];
}

interface RustFunctionDocumentationLookup {
    currentFile: RustFunctionDocumentationGroup;
    inheritedGroups: RustFunctionDocumentationGroup[];
    includeGroups: RustFunctionDocumentationGroup[];
}

/**
 * Bridges the Rust semantic snapshot into the existing documentation webview model.
 * This adapter only shapes already-parsed data; it never reparses LPC source in TS.
 */
export class RustFunctionDocumentationLookupProvider implements FunctionDocumentationLookupProvider {
    private readonly tagParser = new DocCommentTagParser();

    public constructor(
        private readonly manager: LspClientManager,
        private readonly bundledEfuns: Pick<EfunDocsManager, 'getAllFunctions' | 'getStandardCallableDoc'>
    ) {}

    public async getFunctionDocLookupForDocument(document: vscode.TextDocument): Promise<FunctionDocLookup> {
        const lookup = await this.manager.sendRequest<RustFunctionDocumentationLookup>(
            'lpc/functionDocumentation',
            { textDocument: { uri: document.uri.toString() } }
        );
        if (!lookup) {
            throw new Error('Rust language server did not return function documentation data');
        }
        return {
            currentFile: this.materializeGroup(lookup.currentFile),
            inheritedGroups: lookup.inheritedGroups.map((group) => this.materializeGroup(group)),
            includeGroups: lookup.includeGroups.map((group) => this.materializeGroup(group))
        };
    }

    public getAllFunctions(): string[] {
        return this.bundledEfuns.getAllFunctions();
    }

    public getStandardCallableDoc(name: string): CallableDoc | undefined {
        return this.bundledEfuns.getStandardCallableDoc(name);
    }

    private materializeGroup(group: RustFunctionDocumentationGroup): FunctionDocSourceGroup {
        const filePath = vscode.Uri.parse(group.uri).fsPath;
        const entries = group.entries.map((entry) => this.materializeEntry(group, filePath, entry));
        return {
            source: path.basename(filePath),
            filePath,
            sourceKind: group.sourceKind,
            entries,
            docs: new Map(entries.map((entry) => [entry.name, entry])),
            depth: group.depth,
            parentFilePath: group.parentUri ? vscode.Uri.parse(group.parentUri).fsPath : undefined
        };
    }

    private materializeEntry(
        group: RustFunctionDocumentationGroup,
        filePath: string,
        entry: RustFunctionDocumentationEntry
    ): CallableDoc {
        const returnType = extractReturnType(entry.signature, entry.name);
        const parsedTags = this.tagParser.parse(
            entry.documentation && entry.documentationRange
                ? { kind: 'javadoc', text: entry.documentation, range: entry.documentationRange }
                : undefined,
            returnType
        );
        const signature = materializeSignature(entry, returnType, parsedTags.params);
        return {
            name: entry.name,
            declarationKey: `${group.uri}#${entry.range.start.line}:${entry.range.start.character}-${entry.range.end.line}:${entry.range.end.character}`,
            signatures: [signature],
            summary: parsedTags.summary,
            details: parsedTags.details,
            note: parsedTags.note,
            returns: parsedTags.returns,
            returnObjects: parsedTags.returnObjects ?? entry.returnObjects,
            sourceKind: group.sourceKind,
            sourcePath: filePath,
            sourceRange: entry.range,
            selectionRange: entry.selectionRange,
            attachedCommentRange: entry.documentationRange,
            declarationKind: entry.hasBody ? 'implementation' : 'prototype',
            modifiers: extractModifiers(entry.signature),
            documentationIssues: buildDocumentationIssues(signature, parsedTags)
        };
    }
}

function materializeSignature(
    entry: RustFunctionDocumentationEntry,
    returnType: string | undefined,
    documentedParameters: Array<{ name: string; type: string; description?: string }>
): CallableSignature {
    const parameters = entry.parameters.map((parameter, index) => parseParameter(parameter, index));
    for (const documented of documentedParameters) {
        const parameter = parameters.find((candidate) => candidate.name === documented.name);
        if (parameter) {
            parameter.type ??= documented.type;
            parameter.description = documented.description;
        }
    }
    const isFunctionVarargs = extractModifiers(entry.signature).includes('varargs');
    const isVariadic = parameters.some((parameter) => parameter.variadic === true);
    return {
        label: entry.signature,
        returnType,
        parameters,
        isVariadic,
        arity: isFunctionVarargs
            ? { min: 0, max: isVariadic ? null : parameters.length }
            : undefined,
        rawSyntax: entry.signature
    };
}

function parseParameter(source: string, index: number): CallableParameter {
    const withoutDefault = source.replace(/\s*=\s*[\s\S]*$/u, '').trim();
    const variadic = /\.\.\./u.test(withoutDefault);
    const normalized = withoutDefault.replace(/\.\.\./gu, '').trim();
    const nameMatch = normalized.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/u);
    const name = nameMatch?.[1] ?? `arg${index + 1}`;
    const type = nameMatch
        ? normalized.slice(0, nameMatch.index).trim().replace(/\s+/gu, ' ') || undefined
        : undefined;
    return {
        name,
        type,
        optional: withoutDefault !== source.trim() || undefined,
        variadic: variadic || undefined
    };
}

function extractReturnType(signature: string, functionName: string): string | undefined {
    const nameIndex = signature.search(new RegExp(`\\b${escapeRegExp(functionName)}\\s*\\(`, 'u'));
    if (nameIndex < 0) {
        return undefined;
    }
    const modifiers = new Set(['private', 'protected', 'public', 'static', 'nomask', 'varargs', 'nosave']);
    const tokens = signature.slice(0, nameIndex).trim().split(/\s+/u);
    while (tokens.length > 0 && modifiers.has(tokens[0])) {
        tokens.shift();
    }
    return tokens.join(' ') || undefined;
}

function extractModifiers(signature: string): string[] {
    const supported = new Set(['private', 'protected', 'public', 'static', 'nomask', 'varargs', 'nosave']);
    return signature.trim().split(/\s+/u).filter((token) => supported.has(token));
}

function buildDocumentationIssues(
    signature: CallableSignature,
    parsed: ReturnType<DocCommentTagParser['parse']>
): CallableDoc['documentationIssues'] {
    const issues: NonNullable<CallableDoc['documentationIssues']> = [];
    const parameterNames = new Set(signature.parameters.map((parameter) => parameter.name));
    const seen = new Set<string>();
    for (const parameter of parsed.params) {
        if (seen.has(parameter.name)) {
            issues.push({ code: 'duplicate-param-tag', parameterName: parameter.name });
        }
        seen.add(parameter.name);
        if (!parameterNames.has(parameter.name)) {
            issues.push({ code: 'stale-parameter-name', parameterName: parameter.name });
        }
    }
    for (let index = 0; index < parsed.malformedParamTagCount; index += 1) {
        issues.push({ code: 'orphan-param-tag' });
    }
    for (let index = 0; index < parsed.duplicateReturnTagCount; index += 1) {
        issues.push({ code: 'duplicate-return-tag' });
    }
    return issues.length > 0 ? issues : undefined;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
