import * as vscode from 'vscode';
import { SyntaxTrivia } from './trivia';

export interface TokenRange {
    start: number;
    end: number;
}

export type SyntaxNodeCategory =
    | 'document'
    | 'declaration'
    | 'statement'
    | 'expression'
    | 'type'
    | 'clause'
    | 'list'
    | 'support'
    | 'unknown';

export enum SyntaxKind {
    SourceFile = 'SourceFile',
    InheritDirective = 'InheritDirective',
    IncludeDirective = 'IncludeDirective',
    PreprocessorIncludeDirective = 'PreprocessorIncludeDirective',
    MacroDefinitionDirective = 'MacroDefinitionDirective',
    MacroUndefDirective = 'MacroUndefDirective',
    ConditionalDirective = 'ConditionalDirective',
    PreprocessorDirective = 'PreprocessorDirective',
    ModifierList = 'ModifierList',
    ArgumentList = 'ArgumentList',
    ExpressionList = 'ExpressionList',
    TypeReference = 'TypeReference',
    FunctionDeclaration = 'FunctionDeclaration',
    ParameterList = 'ParameterList',
    ParameterDeclaration = 'ParameterDeclaration',
    VariableDeclaration = 'VariableDeclaration',
    VariableDeclarator = 'VariableDeclarator',
    StructDeclaration = 'StructDeclaration',
    ClassDeclaration = 'ClassDeclaration',
    FieldDeclaration = 'FieldDeclaration',
    Block = 'Block',
    ExpressionStatement = 'ExpressionStatement',
    EmptyStatement = 'EmptyStatement',
    IfStatement = 'IfStatement',
    WhileStatement = 'WhileStatement',
    DoWhileStatement = 'DoWhileStatement',
    ForStatement = 'ForStatement',
    ForeachStatement = 'ForeachStatement',
    SwitchStatement = 'SwitchStatement',
    CaseClause = 'CaseClause',
    DefaultClause = 'DefaultClause',
    BreakStatement = 'BreakStatement',
    ContinueStatement = 'ContinueStatement',
    ReturnStatement = 'ReturnStatement',
    Identifier = 'Identifier',
    Literal = 'Literal',
    ParenthesizedExpression = 'ParenthesizedExpression',
    UnaryExpression = 'UnaryExpression',
    BinaryExpression = 'BinaryExpression',
    AssignmentExpression = 'AssignmentExpression',
    ConditionalExpression = 'ConditionalExpression',
    CallExpression = 'CallExpression',
    MemberAccessExpression = 'MemberAccessExpression',
    IndexExpression = 'IndexExpression',
    PostfixExpression = 'PostfixExpression',
    AnonymousFunctionExpression = 'AnonymousFunctionExpression',
    ClosureExpression = 'ClosureExpression',
    MappingLiteralExpression = 'MappingLiteralExpression',
    MappingEntry = 'MappingEntry',
    ArrayLiteralExpression = 'ArrayLiteralExpression',
    ArrayDelimiterLiteralExpression = 'ArrayDelimiterLiteralExpression',
    NewExpression = 'NewExpression',
    StructInitializerList = 'StructInitializerList',
    StructInitializer = 'StructInitializer',
    SpreadElement = 'SpreadElement',
    OpaqueExpression = 'OpaqueExpression',
    Missing = 'Missing'
}

export interface SyntaxNode {
    kind: SyntaxKind;
    category: SyntaxNodeCategory;
    range: vscode.Range;
    tokenRange: TokenRange;
    leadingTrivia: readonly SyntaxTrivia[];
    trailingTrivia: readonly SyntaxTrivia[];
    children: readonly SyntaxNode[];
    name?: string;
    isMissing: boolean;
    isOpaque: boolean;
    metadata?: Readonly<Record<string, unknown>>;
}

export type SourceFileSyntaxNode = SyntaxNode & {
    kind: SyntaxKind.SourceFile;
};

export interface CreateSyntaxNodeOptions {
    kind: SyntaxKind;
    range: vscode.Range;
    tokenRange: TokenRange;
    leadingTrivia?: readonly SyntaxTrivia[];
    trailingTrivia?: readonly SyntaxTrivia[];
    children?: readonly SyntaxNode[];
    name?: string;
    isMissing?: boolean;
    isOpaque?: boolean;
    metadata?: Readonly<Record<string, unknown>>;
}

export function createTokenRange(start: number, end: number): TokenRange {
    if (end < start) {
        throw new Error(`Invalid token range: end ${end} is before start ${start}`);
    }

    return { start, end };
}

export function getTokenRangeKey(range: TokenRange): string {
    return `${range.start}:${range.end}`;
}

export function inferSyntaxNodeCategory(kind: SyntaxKind): SyntaxNodeCategory {
    switch (kind) {
        case SyntaxKind.SourceFile:
            return 'document';
        case SyntaxKind.InheritDirective:
        case SyntaxKind.IncludeDirective:
        case SyntaxKind.PreprocessorIncludeDirective:
        case SyntaxKind.MacroDefinitionDirective:
        case SyntaxKind.MacroUndefDirective:
        case SyntaxKind.ConditionalDirective:
        case SyntaxKind.PreprocessorDirective:
        case SyntaxKind.FunctionDeclaration:
        case SyntaxKind.VariableDeclaration:
        case SyntaxKind.VariableDeclarator:
        case SyntaxKind.StructDeclaration:
        case SyntaxKind.ClassDeclaration:
        case SyntaxKind.FieldDeclaration:
            return 'declaration';
        case SyntaxKind.Block:
        case SyntaxKind.ExpressionStatement:
        case SyntaxKind.EmptyStatement:
        case SyntaxKind.IfStatement:
        case SyntaxKind.WhileStatement:
        case SyntaxKind.DoWhileStatement:
        case SyntaxKind.ForStatement:
        case SyntaxKind.ForeachStatement:
        case SyntaxKind.SwitchStatement:
        case SyntaxKind.BreakStatement:
        case SyntaxKind.ContinueStatement:
        case SyntaxKind.ReturnStatement:
            return 'statement';
        case SyntaxKind.Identifier:
        case SyntaxKind.Literal:
        case SyntaxKind.ParenthesizedExpression:
        case SyntaxKind.UnaryExpression:
        case SyntaxKind.BinaryExpression:
        case SyntaxKind.AssignmentExpression:
        case SyntaxKind.ConditionalExpression:
        case SyntaxKind.CallExpression:
        case SyntaxKind.MemberAccessExpression:
        case SyntaxKind.IndexExpression:
        case SyntaxKind.PostfixExpression:
        case SyntaxKind.AnonymousFunctionExpression:
        case SyntaxKind.ClosureExpression:
        case SyntaxKind.MappingLiteralExpression:
        case SyntaxKind.ArrayLiteralExpression:
        case SyntaxKind.ArrayDelimiterLiteralExpression:
        case SyntaxKind.NewExpression:
        case SyntaxKind.OpaqueExpression:
            return 'expression';
        case SyntaxKind.MappingEntry:
        case SyntaxKind.StructInitializer:
        case SyntaxKind.StructInitializerList:
        case SyntaxKind.SpreadElement:
            return 'support';
        case SyntaxKind.TypeReference:
            return 'type';
        case SyntaxKind.CaseClause:
        case SyntaxKind.DefaultClause:
            return 'clause';
        case SyntaxKind.ModifierList:
        case SyntaxKind.ArgumentList:
        case SyntaxKind.ExpressionList:
        case SyntaxKind.ParameterList:
            return 'list';
        case SyntaxKind.ParameterDeclaration:
        case SyntaxKind.Missing:
            return 'support';
        default:
            return 'unknown';
    }
}

export function createSyntaxNode(options: CreateSyntaxNodeOptions): SyntaxNode {
    return {
        kind: options.kind,
        category: inferSyntaxNodeCategory(options.kind),
        range: options.range,
        tokenRange: options.tokenRange,
        leadingTrivia: options.leadingTrivia ?? [],
        trailingTrivia: options.trailingTrivia ?? [],
        children: options.children ?? [],
        name: options.name,
        isMissing: options.isMissing ?? false,
        isOpaque: options.isOpaque ?? false,
        metadata: options.metadata
    };
}

export function isSourceFileSyntaxNode(node: SyntaxNode): node is SourceFileSyntaxNode {
    return node.kind === SyntaxKind.SourceFile;
}
