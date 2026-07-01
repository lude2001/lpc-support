import * as vscode from 'vscode';
import type { ParsedDocument } from '../../parser/types';
import { SyntaxKind, type SyntaxNode } from '../../syntax/types';
import {
    ExpressionTypeEvaluator,
    ScopeSymbolTypeResolver,
    type ExpressionCallableSignature
} from '../../typeChecking';
import type { LpcType } from '../../typeChecking/LpcType';
import { LpcTypeRelation } from '../../typeChecking/LpcTypeRelation';
import {
    DefaultDiagnosticFactsProvider,
    type DiagnosticFactsProvider
} from '../semantic/DiagnosticTypeFacts';
import type {
    DiagnosticCallableSignature,
    DiagnosticSymbolResolver
} from '../semantic/DiagnosticSymbolResolver';
import {
    acceptsDiagnosticArgumentCount,
    getDirectDiagnosticCallSite
} from '../semantic/DiagnosticSyntaxFacts';
import type { DiagnosticContext, IDiagnosticCollector } from '../types';

const TYPE_SOURCE = 'lpc-support';
const VARIABLE_INITIALIZER_CODE = 'lpc.type.variableInitializerMismatch';
const ASSIGNMENT_CODE = 'lpc.type.assignmentMismatch';
const RETURN_CODE = 'lpc.type.returnMismatch';
const ARGUMENT_CODE = 'lpc.type.argumentMismatch';
const ARRAY_ELEMENT_CODE = 'lpc.type.arrayElementMismatch';
const MAPPING_ENTRY_CODE = 'lpc.type.mappingEntryMismatch';
const MEMBER_NOT_FOUND_CODE = 'lpc.type.memberNotFound';

export interface TypeDiagnosticsCollectorOptions {
    resolver?: DiagnosticSymbolResolver;
    diagnosticFactsProvider?: DiagnosticFactsProvider;
}

interface ParentInfo {
    parent?: SyntaxNode;
    ancestors: SyntaxNode[];
}

interface TypeCheckingSession {
    scopeResolver: ScopeSymbolTypeResolver;
    evaluator: ExpressionTypeEvaluator;
    relation: LpcTypeRelation;
}

export class TypeDiagnosticsCollector implements IDiagnosticCollector {
    public readonly name = 'TypeDiagnosticsCollector';
    private readonly resolver?: DiagnosticSymbolResolver;
    private readonly diagnosticFactsProvider?: DiagnosticFactsProvider;

    public constructor(options: TypeDiagnosticsCollectorOptions = {}) {
        this.resolver = options.resolver;
        this.diagnosticFactsProvider = options.diagnosticFactsProvider
            ?? (this.resolver ? new DefaultDiagnosticFactsProvider({ resolver: this.resolver }) : undefined);
    }

    public async collect(
        document: vscode.TextDocument,
        _parsed: ParsedDocument,
        context?: DiagnosticContext
    ): Promise<vscode.Diagnostic[]> {
        if (!context?.syntax || !context.semantic || context.semantic.degraded) {
            return [];
        }

        const factsProvider = context.diagnosticFactsProvider ?? this.diagnosticFactsProvider;
        if (!factsProvider) {
            return [];
        }

        const facts = await factsProvider.getFacts(document, context.semantic, context.workspace);
        if (
            !facts.options.enabled
            || facts.visibleSymbols.hasUnresolvedDependencies
            || facts.macroSuppression.hasUnexpandedFunctionLikeMacroReference
        ) {
            return [];
        }

        const relation = new LpcTypeRelation();
        const scopeResolver = new ScopeSymbolTypeResolver({
            semantic: context.semantic,
            visibleFileGlobals: facts.visibleSymbols.fileGlobals,
            visibleTypeDefinitions: facts.visibleSymbols.types
        });
        const evaluator = new ExpressionTypeEvaluator({
            scopeResolver,
            callableSignatures: facts.visibleSymbols.callableSignatures as readonly ExpressionCallableSignature[],
            typeRelation: relation
        });
        const session: TypeCheckingSession = {
            scopeResolver,
            evaluator,
            relation
        };
        const parentMap = buildParentMap(context.syntax.nodes);
        const diagnostics: vscode.Diagnostic[] = [];

        this.collectVariableInitializerDiagnostics(context.syntax.nodes, session, diagnostics);
        this.collectAssignmentDiagnostics(context.syntax.nodes, session, diagnostics);
        this.collectReturnDiagnostics(context.syntax.nodes, context.semantic.exportedFunctions, parentMap, session, diagnostics);
        this.collectCallArgumentDiagnostics(context.syntax.nodes, facts.visibleSymbols.callableSignatures, session, diagnostics);
        this.collectMemberDiagnostics(context.syntax.nodes, session, diagnostics);

        return diagnostics;
    }

    private collectVariableInitializerDiagnostics(
        nodes: readonly SyntaxNode[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): void {
        for (const declaration of nodes.filter((node) => node.kind === SyntaxKind.VariableDeclaration)) {
            for (const declarator of declaration.children.filter((child) => child.kind === SyntaxKind.VariableDeclarator)) {
                const initializer = declarator.children[1];
                if (!initializer || !declarator.name) {
                    continue;
                }

                const targetType = session.scopeResolver.resolveIdentifierType(declarator.name, initializer.range.start);
                this.checkExpressionAssignment({
                    targetType,
                    sourceExpression: initializer,
                    session,
                    diagnostics,
                    code: VARIABLE_INITIALIZER_CODE,
                    messagePrefix: `变量 ${declarator.name} 初始化类型不匹配`
                });
            }
        }
    }

    private collectAssignmentDiagnostics(
        nodes: readonly SyntaxNode[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): void {
        for (const assignment of nodes.filter((node) => node.kind === SyntaxKind.AssignmentExpression)) {
            if (assignment.metadata?.operator !== '=') {
                continue;
            }

            this.checkExpressionAssignment({
                targetType: session.evaluator.resolveAssignableTargetType(assignment.children[0]),
                sourceExpression: assignment.children[1],
                session,
                diagnostics,
                code: ASSIGNMENT_CODE,
                messagePrefix: '赋值类型不匹配'
            });
        }
    }

    private collectReturnDiagnostics(
        nodes: readonly SyntaxNode[],
        functions: readonly { name: string; returnType: string; range: vscode.Range }[],
        parentMap: Map<SyntaxNode, ParentInfo>,
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): void {
        for (const returnStatement of nodes.filter((node) => node.kind === SyntaxKind.ReturnStatement)) {
            const expression = returnStatement.children[0];
            if (!expression) {
                continue;
            }

            const functionNode = findLastAncestor(
                parentMap.get(returnStatement)?.ancestors ?? [],
                SyntaxKind.FunctionDeclaration
            );
            const functionSummary = functionNode
                ? functions.find((summary) =>
                    summary.name === functionNode.name
                    && samePosition(summary.range.start, functionNode.range.start)
                )
                : undefined;
            if (!functionSummary) {
                continue;
            }

            this.checkExpressionAssignment({
                targetType: session.scopeResolver.parseType(functionSummary.returnType),
                sourceExpression: expression,
                session,
                diagnostics,
                code: RETURN_CODE,
                messagePrefix: `函数 ${functionSummary.name} 返回值类型不匹配`
            });
        }
    }

    private collectCallArgumentDiagnostics(
        nodes: readonly SyntaxNode[],
        signatures: readonly DiagnosticCallableSignature[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): void {
        for (const callExpression of nodes.filter((node) => node.kind === SyntaxKind.CallExpression)) {
            const callSite = getDirectDiagnosticCallSite(callExpression);
            if (!callSite?.callee.name) {
                continue;
            }

            const acceptedSignatures = signatures.filter((signature) =>
                signature.name === callSite.callee.name
                && acceptsDiagnosticArgumentCount(signature, callSite.argumentCount)
            );
            if (acceptedSignatures.length === 0) {
                continue;
            }

            for (let index = 0; index < callSite.arguments.length; index += 1) {
                const argument = callSite.arguments[index];
                const targetTypes = acceptedSignatures
                    .map((signature) => getParameterTypeAt(signature, index))
                    .filter((typeText): typeText is string => Boolean(typeText && typeText.trim()))
                    .map((typeText) => session.scopeResolver.parseType(typeText));

                if (targetTypes.length !== acceptedSignatures.length || targetTypes.some(isNotCheckable)) {
                    continue;
                }

                if (this.checkCollectionLiteral(argument, targetTypes, session, diagnostics)) {
                    continue;
                }

                const sourceType = session.evaluator.evaluate(argument);
                if (isNotCheckable(sourceType) || hasUnsafeSyntax(argument)) {
                    continue;
                }

                const decisions = targetTypes.map((targetType) => session.relation.isAssignable(sourceType, targetType));
                if (decisions.every((decision) => decision === false)) {
                    diagnostics.push(createWarning(
                        argument.range,
                        `函数 ${callSite.callee.name} 第 ${index + 1} 个参数类型不匹配: 期望 ${formatExpectedTypes(targetTypes)}，实际 ${sourceType.sourceText}`,
                        ARGUMENT_CODE
                    ));
                }
            }
        }
    }

    private collectMemberDiagnostics(
        nodes: readonly SyntaxNode[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): void {
        for (const memberAccess of nodes.filter((node) => node.kind === SyntaxKind.MemberAccessExpression)) {
            const receiverType = session.evaluator.evaluate(memberAccess.children[0]);
            if (receiverType.kind !== 'class' && receiverType.kind !== 'struct') {
                continue;
            }

            const definition = session.scopeResolver.resolveTypeDefinition(receiverType);
            const memberName = memberAccess.children[1]?.name;
            if (!definition || !memberName || definition.members.some((member) => member.name === memberName)) {
                continue;
            }

            diagnostics.push(createWarning(
                memberAccess.children[1].range,
                `类型 ${receiverType.sourceText} 上不存在成员 ${memberName}`,
                MEMBER_NOT_FOUND_CODE
            ));
        }
    }

    private checkExpressionAssignment(options: {
        targetType: LpcType;
        sourceExpression: SyntaxNode | undefined;
        session: TypeCheckingSession;
        diagnostics: vscode.Diagnostic[];
        code: string;
        messagePrefix: string;
    }): void {
        const sourceExpression = unwrapParenthesized(options.sourceExpression);
        if (!sourceExpression || isNotCheckable(options.targetType)) {
            return;
        }

        if (this.checkCollectionLiteral(sourceExpression, [options.targetType], options.session, options.diagnostics)) {
            return;
        }

        if (hasUnsafeSyntax(sourceExpression)) {
            return;
        }

        const sourceType = options.session.evaluator.evaluate(sourceExpression);
        if (isNotCheckable(sourceType) || options.session.relation.isAssignable(sourceType, options.targetType)) {
            return;
        }

        options.diagnostics.push(createWarning(
            sourceExpression.range,
            `${options.messagePrefix}: 期望 ${options.targetType.sourceText}，实际 ${sourceType.sourceText}`,
            options.code
        ));
    }

    private checkCollectionLiteral(
        sourceExpression: SyntaxNode,
        targetTypes: readonly LpcType[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): boolean {
        if (sourceExpression.kind === SyntaxKind.ArrayLiteralExpression) {
            return this.checkArrayLiteral(sourceExpression, targetTypes, session, diagnostics);
        }

        if (sourceExpression.kind === SyntaxKind.MappingLiteralExpression) {
            return this.checkMappingLiteral(sourceExpression, targetTypes, session, diagnostics);
        }

        return false;
    }

    private checkArrayLiteral(
        sourceExpression: SyntaxNode,
        targetTypes: readonly LpcType[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): boolean {
        const arrayTargets = targetTypes.filter((targetType) => targetType.kind === 'array' && targetType.elementType);
        if (arrayTargets.length !== targetTypes.length || arrayTargets.some((targetType) => isNotCheckable(targetType.elementType!))) {
            return false;
        }

        const elements = getArrayLiteralElements(sourceExpression);
        if (!elements) {
            return true;
        }

        let reported = false;
        for (const element of elements) {
            if (hasUnsafeSyntax(element)) {
                continue;
            }

            const sourceType = session.evaluator.evaluate(element);
            if (isNotCheckable(sourceType)) {
                continue;
            }

            const decisions = arrayTargets.map((targetType) =>
                session.relation.isAssignable(sourceType, targetType.elementType!)
            );
            if (decisions.every((decision) => decision === false)) {
                reported = true;
                diagnostics.push(createWarning(
                    element.range,
                    `数组元素类型不匹配: 期望 ${formatExpectedTypes(arrayTargets.map((targetType) => targetType.elementType!))}，实际 ${sourceType.sourceText}`,
                    ARRAY_ELEMENT_CODE
                ));
            }
        }

        return reported;
    }

    private checkMappingLiteral(
        sourceExpression: SyntaxNode,
        targetTypes: readonly LpcType[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): boolean {
        const mappingTargets = targetTypes.filter((targetType) =>
            targetType.kind === 'mapping'
            && targetType.keyType
            && targetType.valueType
            && !isNotCheckable(targetType.keyType)
            && !isNotCheckable(targetType.valueType)
        );
        if (mappingTargets.length !== targetTypes.length) {
            return false;
        }

        let reported = false;
        for (const entry of sourceExpression.children) {
            if (entry.kind !== SyntaxKind.MappingEntry || entry.children.length !== 2) {
                return reported;
            }

            const [key, value] = entry.children;
            reported = this.checkMappingSlot(key, mappingTargets.map((targetType) => targetType.keyType!), session, diagnostics)
                || reported;
            reported = this.checkMappingSlot(value, mappingTargets.map((targetType) => targetType.valueType!), session, diagnostics)
                || reported;
        }

        return reported;
    }

    private checkMappingSlot(
        expression: SyntaxNode,
        targets: readonly LpcType[],
        session: TypeCheckingSession,
        diagnostics: vscode.Diagnostic[]
    ): boolean {
        if (hasUnsafeSyntax(expression)) {
            return false;
        }

        const sourceType = session.evaluator.evaluate(expression);
        if (isNotCheckable(sourceType)) {
            return false;
        }

        if (targets.some((targetType) => session.relation.isAssignable(sourceType, targetType))) {
            return false;
        }

        diagnostics.push(createWarning(
            expression.range,
            `mapping 条目类型不匹配: 期望 ${formatExpectedTypes(targets)}，实际 ${sourceType.sourceText}`,
            MAPPING_ENTRY_CODE
        ));
        return true;
    }
}

function buildParentMap(nodes: readonly SyntaxNode[]): Map<SyntaxNode, ParentInfo> {
    const map = new Map<SyntaxNode, ParentInfo>();
    const childNodes = new Set<SyntaxNode>();

    const visit = (node: SyntaxNode, ancestors: SyntaxNode[]): void => {
        for (const child of node.children) {
            childNodes.add(child);
            map.set(child, {
                parent: node,
                ancestors: [...ancestors, node]
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

function findLastAncestor(ancestors: readonly SyntaxNode[], kind: SyntaxKind): SyntaxNode | undefined {
    for (let index = ancestors.length - 1; index >= 0; index -= 1) {
        if (ancestors[index].kind === kind) {
            return ancestors[index];
        }
    }

    return undefined;
}

function getParameterTypeAt(signature: ExpressionCallableSignature, index: number): string | undefined {
    const parameters = signature.parameters ?? [];
    const parameter = parameters[index];
    if (parameter?.dataType) {
        return parameter.dataType;
    }

    const variadic = parameters.find((entry) => entry.variadic);
    return signature.isVariadic ? variadic?.dataType : undefined;
}

function getArrayLiteralElements(node: SyntaxNode): readonly SyntaxNode[] | undefined {
    const expressionList = node.children.find((child) => child.kind === SyntaxKind.ExpressionList);
    const elements = expressionList?.children ?? [];
    return elements.some((element) => element.kind === SyntaxKind.SpreadElement || element.isMissing || element.isOpaque)
        ? undefined
        : elements;
}

function unwrapParenthesized(node: SyntaxNode | undefined): SyntaxNode | undefined {
    let current = node;
    while (current?.kind === SyntaxKind.ParenthesizedExpression) {
        current = current.children[0];
    }
    return current;
}

function hasUnsafeSyntax(node: SyntaxNode): boolean {
    if (node.isMissing || node.isOpaque || node.kind === SyntaxKind.SpreadElement) {
        return true;
    }

    return node.children.some(hasUnsafeSyntax);
}

function isNotCheckable(type: LpcType): boolean {
    return type.isUnknown || type.isMixed;
}

function samePosition(left: vscode.Position, right: vscode.Position): boolean {
    return left.line === right.line && left.character === right.character;
}

function formatExpectedTypes(types: readonly LpcType[]): string {
    return Array.from(new Set(types.map((type) => type.sourceText))).join(' 或 ');
}

function createWarning(range: vscode.Range, message: string, code: string): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
    diagnostic.source = TYPE_SOURCE;
    diagnostic.code = code;
    return diagnostic;
}
