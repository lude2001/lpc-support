import * as vscode from 'vscode';
import { Symbol } from '../ast/symbolTable';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';

export interface SymbolUsageIndex {
    hasUse(symbol: Symbol, containingRange: vscode.Range): boolean;
}

export interface SymbolDiagnosticOffsetData {
    start: number;
    end: number;
}

export type SymbolDiagnosticData = {
    kind: 'global' | 'var';
} & Partial<SymbolDiagnosticOffsetData>;

export type DiagnosticWithSymbolData = vscode.Diagnostic & {
    data: SymbolDiagnosticData;
};

export function createSymbolUsageIndex(syntax: SyntaxDocument): SymbolUsageIndex {
    const parents = buildParentMap(syntax.root);
    const valueIdentifiersByName = new Map<string, SyntaxNode[]>();

    for (const node of syntax.nodes) {
        if (
            node.kind === SyntaxKind.Identifier
            && typeof node.name === 'string'
            && isValueIdentifier(node, parents.get(node))
        ) {
            const nodes = valueIdentifiersByName.get(node.name) ?? [];
            nodes.push(node);
            valueIdentifiersByName.set(node.name, nodes);
        }
    }

    return {
        hasUse(symbol, containingRange) {
            const declarationRange = symbol.selectionRange ?? symbol.range;
            return (valueIdentifiersByName.get(symbol.name) ?? []).some((node) =>
                containingRange.contains(node.range.start)
                && !isSameRange(node.range, declarationRange)
            );
        }
    };
}

export function createOffsetData(
    document: vscode.TextDocument,
    range: vscode.Range
): SymbolDiagnosticOffsetData | undefined {
    if (typeof document.offsetAt !== 'function') {
        return undefined;
    }

    return {
        start: document.offsetAt(range.start),
        end: document.offsetAt(range.end)
    };
}

export function attachSymbolDiagnosticData(
    diagnostic: vscode.Diagnostic,
    kind: SymbolDiagnosticData['kind'],
    offsetData?: SymbolDiagnosticOffsetData
): void {
    (diagnostic as DiagnosticWithSymbolData).data = offsetData
        ? { kind, ...offsetData }
        : { kind };
}

function buildParentMap(root: SyntaxNode): Map<SyntaxNode, SyntaxNode | undefined> {
    const parents = new Map<SyntaxNode, SyntaxNode | undefined>();

    const visit = (node: SyntaxNode, parent: SyntaxNode | undefined) => {
        parents.set(node, parent);
        for (const child of node.children) {
            visit(child, node);
        }
    };

    visit(root, undefined);
    return parents;
}

function isValueIdentifier(node: SyntaxNode, parent: SyntaxNode | undefined): boolean {
    if (!parent) {
        return true;
    }

    switch (parent.kind) {
        case SyntaxKind.VariableDeclarator:
        case SyntaxKind.ParameterDeclaration:
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.FieldDeclaration:
        case SyntaxKind.StructDeclaration:
        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.TypeReference:
        case SyntaxKind.InheritDirective:
        case SyntaxKind.IncludeDirective:
        case SyntaxKind.PreprocessorIncludeDirective:
        case SyntaxKind.MacroDefinitionDirective:
            return false;
        case SyntaxKind.MemberAccessExpression:
            return parent.children[0] === node;
        default:
            return true;
    }
}

function isSameRange(left: vscode.Range, right: vscode.Range): boolean {
    return left.start.line === right.start.line
        && left.start.character === right.start.character
        && left.end.line === right.end.line
        && left.end.character === right.end.character;
}
