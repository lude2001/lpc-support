import * as vscode from 'vscode';
import { SymbolType } from '../../ast/symbolTable';
import type { ParsedDocument } from '../../parser/types';
import type {
    FileGlobalSummary,
    FunctionSummary,
    MacroDefinitionSummary,
    SemanticSymbolSummary,
    TypeDefinitionSummary
} from '../../semantic/documentSemanticTypes';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type {
    DiagnosticCallableSignature,
    DiagnosticSymbolResolver,
    VisibleDiagnosticSymbols
} from '../semantic/DiagnosticSymbolResolver';
import { isFluffOSPredefinedMacro } from '../semantic/FluffOSPredefinedMacros';
import type { DiagnosticContext, IDiagnosticCollector } from '../types';

const ARGUMENT_COUNT_CODE = 'lpc.argumentCountMismatch';
const UNDEFINED_FUNCTION_CODE = 'lpc.undefinedFunction';
const UNDEFINED_SYMBOL_CODE = 'lpc.undefinedSymbol';

const KNOWN_LPC_NAMES = new Set([
    'array',
    'buffer',
    'class',
    'closure',
    'float',
    'function',
    'int',
    'lwobject',
    'mapping',
    'mixed',
    'object',
    'status',
    'string',
    'struct',
    'symbol',
    'void',
    'any',
    'bytes',
    'unknown',
    'true',
    'false',
    'null',
    'undefined',
    'this_object',
    'this_player',
    'previous_object',
    'environment',
    'call_other'
]);

const DECLARATION_NAME_PARENTS = new Set<SyntaxKind>([
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.ParameterDeclaration,
    SyntaxKind.VariableDeclarator,
    SyntaxKind.StructDeclaration,
    SyntaxKind.ClassDeclaration,
    SyntaxKind.FieldDeclaration,
    SyntaxKind.TypeReference,
    SyntaxKind.MacroDefinitionDirective,
    SyntaxKind.MacroUndefDirective,
    SyntaxKind.IncludeDirective,
    SyntaxKind.PreprocessorIncludeDirective,
    SyntaxKind.InheritDirective,
    SyntaxKind.PreprocessorDirective,
    SyntaxKind.ModifierSection,
    SyntaxKind.ModifierList
]);

interface ParentInfo {
    parent?: SyntaxNode;
    ancestors: SyntaxNode[];
}

export class BasicSemanticDiagnosticsCollector implements IDiagnosticCollector {
    public readonly name = 'BasicSemanticDiagnosticsCollector';

    public constructor(private readonly resolver?: DiagnosticSymbolResolver) {}

    public async collect(
        _document: vscode.TextDocument,
        _parsed: ParsedDocument,
        context?: DiagnosticContext
    ): Promise<vscode.Diagnostic[]> {
        if (!context?.syntax || !context.semantic || context.semantic.degraded) {
            return [];
        }

        const visibleSymbols = this.resolver
            ? await this.resolver.resolveVisibleSymbols(_document, context.semantic)
            : createCurrentFileVisibleSymbols(context.semantic);
        const parentMap = buildParentMap(context.syntax.nodes);
        const diagnostics: vscode.Diagnostic[] = [];
        const callCalleeRanges = new Set<string>();

        for (const callExpression of context.syntax.nodes.filter((node) => isKind(node, SyntaxKind.CallExpression))) {
            const callee = getDirectCallee(callExpression);
            if (!callee) {
                continue;
            }

            const calleeName = callee.name!;
            callCalleeRanges.add(getRangeKey(callee.range));
            const argumentCount = getArgumentCount(callExpression);
            if (argumentCount === undefined) {
                continue;
            }

            const signatures = visibleSymbols.callableSignatures.filter((signature) => signature.name === calleeName);
            if (signatures.length === 0) {
                if (!visibleSymbols.hasUnresolvedDependencies && !isKnownName(calleeName, visibleSymbols)) {
                    diagnostics.push(createWarning(
                        callee.range,
                        `未定义函数: ${calleeName}`,
                        UNDEFINED_FUNCTION_CODE
                    ));
                }
                continue;
            }

            if (!signatures.some((signature) => acceptsArgumentCount(signature, argumentCount))) {
                diagnostics.push(createWarning(
                    callee.range,
                    formatArgumentCountMessage(calleeName, argumentCount, signatures),
                    ARGUMENT_COUNT_CODE
                ));
            }
        }

        if (visibleSymbols.hasUnresolvedDependencies) {
            return diagnostics;
        }

        for (const identifier of context.syntax.nodes.filter((node) => isKind(node, SyntaxKind.Identifier))) {
            if (!identifier.name || callCalleeRanges.has(getRangeKey(identifier.range))) {
                continue;
            }

            const info = parentMap.get(identifier);
            if (!isReferenceIdentifier(identifier, info, visibleSymbols)) {
                continue;
            }

            if (!isKnownName(identifier.name, visibleSymbols)) {
                diagnostics.push(createWarning(
                    identifier.range,
                    `未定义符号: ${identifier.name}`,
                    UNDEFINED_SYMBOL_CODE
                ));
            }
        }

        return diagnostics;
    }
}

function createCurrentFileVisibleSymbols(semantic: SemanticSnapshot): VisibleDiagnosticSymbols {
    return {
        functions: semantic.exportedFunctions,
        symbols: semantic.symbols,
        fileGlobals: semantic.fileGlobals ?? [],
        types: semantic.typeDefinitions,
        macros: semantic.macroDefinitions ?? [],
        macroReferences: semantic.macroReferences,
        callableSignatures: semantic.exportedFunctions.map((summary) => toCallableSignature(summary)),
        hasUnresolvedDependencies: semantic.includeStatements.length > 0 || semantic.inheritStatements.length > 0
    };
}

function toCallableSignature(summary: FunctionSummary): DiagnosticCallableSignature {
    const isVariadic = Boolean(summary.isVariadic || summary.parameters.some((parameter) => parameter.isVariadic));
    return {
        name: summary.name,
        requiredParameterCount: summary.requiredParameterCount
            ?? summary.parameters.filter((parameter) => !parameter.hasDefaultValue && !parameter.isVariadic).length,
        maxParameterCount: summary.maxParameterCount ?? (isVariadic ? undefined : summary.parameters.length),
        isVariadic,
        source: summary.origin
    };
}

function buildParentMap(nodes: readonly SyntaxNode[]): Map<SyntaxNode, ParentInfo> {
    const map = new Map<SyntaxNode, ParentInfo>();
    const childNodes = new Set<SyntaxNode>();

    const visit = (node: SyntaxNode, ancestors: SyntaxNode[]): void => {
        for (const child of node.children) {
            childNodes.add(child);
            map.set(child, {
                parent: node,
                ancestors
            });
            visit(child, [...ancestors, node]);
        }
    };

    for (const node of nodes) {
        if (!childNodes.has(node)) {
            visit(node, []);
        }
    }
    return map;
}

function getDirectCallee(callExpression: SyntaxNode): SyntaxNode | undefined {
    const firstChild = callExpression.children[0];
    if (
        isKind(firstChild, SyntaxKind.Identifier)
        && firstChild.name
        && !firstChild.metadata?.scopeQualifier
    ) {
        return firstChild;
    }

    if (isKind(firstChild, SyntaxKind.MemberAccessExpression) || firstChild?.metadata?.scopeQualifier) {
        return undefined;
    }

    if (typeof callExpression.name !== 'string') {
        return undefined;
    }

    const namedCallee = callExpression.children.find((child) =>
        isKind(child, SyntaxKind.Identifier)
        && child.name === callExpression.name
        && !child.metadata?.scopeQualifier
    );
    return namedCallee;
}

function isKind(node: SyntaxNode | undefined, kind: SyntaxKind): node is SyntaxNode {
    return Boolean(node && String(node.kind) === kind);
}

function getArgumentCount(callExpression: SyntaxNode): number | undefined {
    const argumentList = callExpression.children.find((child) => child.kind === SyntaxKind.ArgumentList);
    if (!argumentList) {
        return 0;
    }

    if (argumentList.children.some((child) => child.kind === SyntaxKind.SpreadElement || child.isMissing || child.isOpaque)) {
        return undefined;
    }

    return argumentList.children.length;
}

function acceptsArgumentCount(signature: DiagnosticCallableSignature, argumentCount: number): boolean {
    if (argumentCount < signature.requiredParameterCount) {
        return false;
    }

    return signature.maxParameterCount === undefined
        || signature.isVariadic
        || argumentCount <= signature.maxParameterCount;
}

function formatArgumentCountMessage(
    name: string,
    argumentCount: number,
    signatures: DiagnosticCallableSignature[]
): string {
    const expected = Array.from(new Set(signatures.map(formatExpectedCount))).join(' 或 ');
    return `函数 ${name} 参数数量不匹配: 当前 ${argumentCount} 个，期望 ${expected}`;
}

function formatExpectedCount(signature: DiagnosticCallableSignature): string {
    if (signature.isVariadic || signature.maxParameterCount === undefined) {
        return `${signature.requiredParameterCount} 个或更多`;
    }

    if (signature.requiredParameterCount === signature.maxParameterCount) {
        return `${signature.requiredParameterCount} 个`;
    }

    return `${signature.requiredParameterCount}-${signature.maxParameterCount} 个`;
}

function isReferenceIdentifier(
    identifier: SyntaxNode,
    info: ParentInfo | undefined,
    visibleSymbols: VisibleDiagnosticSymbols
): boolean {
    if (!identifier.name || identifier.metadata?.placeholder || identifier.metadata?.scopeQualifier) {
        return false;
    }

    const parent = info?.parent;
    if (!parent) {
        return false;
    }

    if (isMacroName(identifier, visibleSymbols)) {
        return false;
    }

    if (DECLARATION_NAME_PARENTS.has(parent.kind)) {
        return false;
    }

    if (parent.kind === SyntaxKind.MemberAccessExpression && parent.children[1] === identifier) {
        return false;
    }

    if (parent.kind === SyntaxKind.CallExpression && parent.children[0] === identifier) {
        return false;
    }

    if (info.ancestors.some((ancestor) =>
        ancestor.kind === SyntaxKind.MacroDefinitionDirective
        || ancestor.kind === SyntaxKind.MacroUndefDirective
        || ancestor.kind === SyntaxKind.IncludeDirective
        || ancestor.kind === SyntaxKind.PreprocessorIncludeDirective
        || ancestor.kind === SyntaxKind.InheritDirective
        || ancestor.kind === SyntaxKind.PreprocessorDirective
    )) {
        return false;
    }

    return identifier.category === 'expression';
}

function isKnownName(name: string, visibleSymbols: VisibleDiagnosticSymbols): boolean {
    if (KNOWN_LPC_NAMES.has(name)) {
        return true;
    }

    return isFluffOSPredefinedMacro(name)
        || visibleSymbols.functions.some((entry) => entry.name === name)
        || visibleSymbols.callableSignatures.some((entry) => entry.name === name)
        || visibleSymbols.fileGlobals.some((entry) => entry.name === name)
        || visibleSymbols.types.some((entry) => entry.name === name)
        || visibleSymbols.macros.some((entry) => entry.name === name)
        || visibleSymbols.macroReferences.some((entry) => entry.name === name)
        || visibleSymbols.symbols.some((entry) => isVisibleSemanticSymbol(entry) && entry.name === name);
}

function isVisibleSemanticSymbol(symbol: SemanticSymbolSummary): boolean {
    return (
        symbol.kind === SymbolType.VARIABLE
        || symbol.kind === SymbolType.PARAMETER
        || symbol.kind === SymbolType.FUNCTION
        || symbol.kind === SymbolType.CLASS
        || symbol.kind === SymbolType.STRUCT
    );
}

function isMacroName(identifier: SyntaxNode, visibleSymbols: VisibleDiagnosticSymbols): boolean {
    return visibleSymbols.macros.some((macro) => macro.name === identifier.name && rangesEqual(macro.range, identifier.range))
        || visibleSymbols.macroReferences.some((macro) => macro.name === identifier.name && rangesEqual(macro.range, identifier.range));
}

function rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
    return left.start.line === right.start.line
        && left.start.character === right.start.character
        && left.end.line === right.end.line
        && left.end.character === right.end.character;
}

function getRangeKey(range: vscode.Range): string {
    return `${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
}

function createWarning(range: vscode.Range, message: string, code: string): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
    diagnostic.source = 'lpc-support';
    diagnostic.code = code;
    return diagnostic;
}
