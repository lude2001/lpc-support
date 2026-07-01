import type { SyntaxNode } from '../syntax/types';
import { SyntaxKind } from '../syntax/types';
import type { LpcType } from './LpcType';
import {
    createArrayType,
    createFunctionType,
    createMappingType,
    createPrimitiveType,
    createUnknownType,
    createZeroLiteralType
} from './LpcType';
import { LpcTypeRelation } from './LpcTypeRelation';
import { CallableSignatureIndex, type CallableSignatureLookup } from './CallableSignatureIndex';
import type { ScopeSymbolTypeResolver } from './ScopeSymbolTypeResolver';
import type { TypeNarrowingLookup } from './TypeNarrowingLookup';

export interface ExpressionCallableParameter {
    dataType?: string;
    optional?: boolean;
    variadic?: boolean;
}

export interface ExpressionCallableSignature {
    name: string;
    requiredParameterCount: number;
    maxParameterCount?: number;
    isVariadic: boolean;
    returnType?: string;
    parameters?: readonly ExpressionCallableParameter[];
}

export interface ExpressionTypeEvaluatorOptions {
    scopeResolver: ScopeSymbolTypeResolver;
    callableSignatures?: readonly ExpressionCallableSignature[];
    callableSignatureIndex?: CallableSignatureLookup<ExpressionCallableSignature>;
    narrowingLookup?: TypeNarrowingLookup;
    typeRelation?: LpcTypeRelation;
}

const NUMERIC_TYPES = new Set(['int', 'float', 'status']);
const COMPARISON_OPERATORS = new Set(['==', '!=', '>', '<', '>=', '<=']);
const BITWISE_OPERATORS = new Set(['|', '&', '^', '<<', '>>']);
const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/', '%']);

export class ExpressionTypeEvaluator {
    private readonly scopeResolver: ScopeSymbolTypeResolver;
    private readonly callableSignatureIndex: CallableSignatureLookup<ExpressionCallableSignature>;
    private readonly narrowingLookup?: TypeNarrowingLookup;
    private readonly typeRelation: LpcTypeRelation;

    public constructor(options: ExpressionTypeEvaluatorOptions) {
        this.scopeResolver = options.scopeResolver;
        this.callableSignatureIndex = options.callableSignatureIndex
            ?? new CallableSignatureIndex(options.callableSignatures ?? []);
        this.narrowingLookup = options.narrowingLookup;
        this.typeRelation = options.typeRelation ?? new LpcTypeRelation();
    }

    public evaluate(node: SyntaxNode | undefined): LpcType {
        if (!node || node.isMissing || node.isOpaque) {
            return createUnknownType();
        }

        switch (node.kind) {
            case SyntaxKind.Literal:
                return this.evaluateLiteral(node);
            case SyntaxKind.Identifier:
                return this.evaluateIdentifier(node);
            case SyntaxKind.ParenthesizedExpression:
                return this.evaluate(node.children[0]);
            case SyntaxKind.UnaryExpression:
                return this.evaluateUnary(node);
            case SyntaxKind.BinaryExpression:
                return this.evaluateBinary(node);
            case SyntaxKind.ConditionalExpression:
                return this.evaluateConditional(node);
            case SyntaxKind.CallExpression:
                return this.evaluateCall(node);
            case SyntaxKind.AssignmentExpression:
                return this.evaluate(node.children[1]);
            case SyntaxKind.ArrayLiteralExpression:
                return this.evaluateArrayLiteral(node);
            case SyntaxKind.MappingLiteralExpression:
                return this.evaluateMappingLiteral(node);
            case SyntaxKind.MemberAccessExpression:
                return this.evaluateMemberAccess(node);
            case SyntaxKind.IndexExpression:
                return this.evaluateIndex(node);
            case SyntaxKind.PostfixExpression:
                return this.evaluateNumericPassThrough(node.children[0]);
            case SyntaxKind.AnonymousFunctionExpression:
            case SyntaxKind.ClosureExpression:
                return createFunctionType();
            case SyntaxKind.NewExpression:
                return this.evaluateNewExpression(node);
            case SyntaxKind.SpreadElement:
            case SyntaxKind.OpaqueExpression:
            case SyntaxKind.Missing:
                return createUnknownType();
            default:
                return createUnknownType();
        }
    }

    public resolveAssignableTargetType(node: SyntaxNode | undefined): LpcType {
        if (!node) {
            return createUnknownType();
        }

        switch (node.kind) {
            case SyntaxKind.Identifier:
                return this.evaluateIdentifier(node);
            case SyntaxKind.MemberAccessExpression:
                return this.evaluateMemberAccess(node);
            case SyntaxKind.IndexExpression:
                return this.evaluateIndex(node);
            case SyntaxKind.ParenthesizedExpression:
                return this.resolveAssignableTargetType(node.children[0]);
            default:
                return createUnknownType();
        }
    }

    private evaluateLiteral(node: SyntaxNode): LpcType {
        const text = getMetadataString(node, 'text')?.trim() ?? '';
        if (text === '0') {
            return createZeroLiteralType();
        }

        if (text.startsWith('"')) {
            return createPrimitiveType('string', text);
        }

        if (text.startsWith("'")) {
            return createPrimitiveType('int', text);
        }

        if (isIntegerLiteral(text)) {
            return createPrimitiveType('int', text);
        }

        if (isFloatLiteral(text)) {
            return createPrimitiveType('float', text);
        }

        return createUnknownType(text || 'literal');
    }

    private evaluateIdentifier(node: SyntaxNode): LpcType {
        if (node.metadata?.placeholder || node.metadata?.scopeQualifier) {
            return createUnknownType(node.name);
        }

        const name = node.name;
        const narrowed = name ? this.narrowingLookup?.getNarrowedType(name, node.range.start) : undefined;
        return narrowed ?? this.scopeResolver.resolveIdentifierType(name, node.range.start);
    }

    private evaluateUnary(node: SyntaxNode): LpcType {
        const operator = getMetadataString(node, 'operator');
        if (operator === 'cast') {
            return this.evaluateCast(node);
        }

        if (operator === 'sizeof' || operator === '!' || operator === '!!') {
            return createPrimitiveType('int');
        }

        if (operator === '+' || operator === '-' || operator === '~' || operator === '++' || operator === '--') {
            return this.evaluateNumericPassThrough(node.children[0]);
        }

        return createUnknownType();
    }

    private evaluateCast(node: SyntaxNode): LpcType {
        const typeReference = node.children.find((child) => child.kind === SyntaxKind.TypeReference);
        return this.parseTypeReference(typeReference);
    }

    private evaluateBinary(node: SyntaxNode): LpcType {
        const operator = getMetadataString(node, 'operator');
        const left = this.evaluate(node.children[0]);
        const right = this.evaluate(node.children[1]);

        if (operator === 'comma') {
            return right;
        }

        if (COMPARISON_OPERATORS.has(operator ?? '')) {
            return createPrimitiveType('int');
        }

        if (operator === '&&' || operator === '||') {
            return createPrimitiveType('int');
        }

        if (operator === '??') {
            return this.unifyTypes(left, right);
        }

        if (operator === 'concat') {
            return left.name === 'string' && right.name === 'string'
                ? createPrimitiveType('string')
                : createUnknownType();
        }

        if (operator === '+' && left.name === 'string' && right.name === 'string') {
            return createPrimitiveType('string');
        }

        if (ARITHMETIC_OPERATORS.has(operator ?? '')) {
            return this.evaluateNumericBinary(left, right);
        }

        if (BITWISE_OPERATORS.has(operator ?? '')) {
            return this.areNumeric(left, right) ? createPrimitiveType('int') : createUnknownType();
        }

        return createUnknownType();
    }

    private evaluateConditional(node: SyntaxNode): LpcType {
        return this.unifyTypes(this.evaluate(node.children[1]), this.evaluate(node.children[2]));
    }

    private evaluateCall(node: SyntaxNode): LpcType {
        if (node.metadata?.source === 'dollar-call' || node.metadata?.source === 'macro-invoke') {
            return createUnknownType();
        }

        const callee = getDirectCallee(node);
        const argumentCount = getArgumentCount(node);
        if (!callee?.name || argumentCount === undefined) {
            return createUnknownType();
        }

        const acceptedSignatures = this.callableSignatureIndex.get(callee.name)
            .filter((signature) => acceptsArgumentCount(signature, argumentCount));
        if (
            acceptedSignatures.length === 0
            || acceptedSignatures.some((signature) => !signature.returnType?.trim())
        ) {
            return createUnknownType();
        }

        const returnTypes = acceptedSignatures
            .map((signature) => this.scopeResolver.parseType(signature.returnType));

        return this.unifyAll(returnTypes);
    }

    private evaluateArrayLiteral(node: SyntaxNode): LpcType {
        const expressionList = node.children.find((child) => child.kind === SyntaxKind.ExpressionList);
        const elements = expressionList?.children ?? [];
        if (elements.some((element) => element.kind === SyntaxKind.SpreadElement || element.isMissing || element.isOpaque)) {
            return createUnknownType();
        }

        const elementType = this.unifyAll(elements.map((element) => this.evaluate(element)));
        return createArrayType(elementType, 1, `array<${elementType.sourceText}>`);
    }

    private evaluateMappingLiteral(node: SyntaxNode): LpcType {
        if (node.children.length === 0) {
            return createMappingType('mapping', createUnknownType(), createUnknownType());
        }

        const keyTypes: LpcType[] = [];
        const valueTypes: LpcType[] = [];
        for (const entry of node.children) {
            if (entry.kind !== SyntaxKind.MappingEntry || entry.children.length !== 2) {
                return createMappingType('mapping', createUnknownType(), createUnknownType());
            }

            keyTypes.push(this.evaluate(entry.children[0]));
            valueTypes.push(this.evaluate(entry.children[1]));
        }

        const keyType = this.unifyAll(keyTypes);
        const valueType = this.unifyAll(valueTypes);
        return createMappingType(`mapping<${keyType.sourceText},${valueType.sourceText}>`, keyType, valueType);
    }

    private evaluateMemberAccess(node: SyntaxNode): LpcType {
        const receiverType = this.evaluate(node.children[0]);
        if (receiverType.kind !== 'class' && receiverType.kind !== 'struct') {
            return createUnknownType();
        }

        return this.scopeResolver.resolveMemberType(receiverType, node.children[1]?.name);
    }

    private evaluateIndex(node: SyntaxNode): LpcType {
        const targetType = this.evaluate(node.children[0]);
        const indexNode = node.children[1];
        if (
            indexNode?.kind === SyntaxKind.ExpressionList
            && (indexNode.metadata?.source === 'slice' || indexNode.metadata?.hasRange === true)
        ) {
            return createUnknownType();
        }

        if (targetType.kind === 'array') {
            return targetType.elementType ?? createUnknownType();
        }

        if (targetType.kind === 'mapping') {
            return targetType.valueType ?? createUnknownType();
        }

        return createUnknownType();
    }

    private evaluateNewExpression(node: SyntaxNode): LpcType {
        const first = node.children[0];
        if (!first) {
            return createUnknownType();
        }

        if (first.kind === SyntaxKind.TypeReference) {
            return this.parseTypeReference(first);
        }

        const sourceType = this.evaluate(first);
        return sourceType.name === 'string' ? createPrimitiveType('object') : createUnknownType();
    }

    private evaluateNumericPassThrough(node: SyntaxNode | undefined): LpcType {
        const operand = this.evaluate(node);
        return NUMERIC_TYPES.has(operand.name) ? operand : createUnknownType();
    }

    private evaluateNumericBinary(left: LpcType, right: LpcType): LpcType {
        if (!this.areNumeric(left, right)) {
            return createUnknownType();
        }

        return left.name === 'float' || right.name === 'float'
            ? createPrimitiveType('float')
            : createPrimitiveType('int');
    }

    private areNumeric(left: LpcType, right: LpcType): boolean {
        return NUMERIC_TYPES.has(left.name) && NUMERIC_TYPES.has(right.name);
    }

    private parseTypeReference(typeReference: SyntaxNode | undefined): LpcType {
        const typeText = getMetadataString(typeReference, 'text') ?? typeReference?.name;
        return this.scopeResolver.parseType(typeText);
    }

    private unifyAll(types: readonly LpcType[]): LpcType {
        if (types.length === 0) {
            return createUnknownType();
        }

        return types.reduce((current, next) => this.unifyTypes(current, next));
    }

    private unifyTypes(left: LpcType, right: LpcType): LpcType {
        if (left.isUnknown || right.isUnknown) {
            return createUnknownType();
        }

        if (left.isMixed || right.isMixed) {
            return createPrimitiveType('mixed');
        }

        if (left.name === right.name && left.kind === right.kind && left.pointerDepth === right.pointerDepth) {
            return left;
        }

        if (this.areNumeric(left, right)) {
            return left.name === 'float' || right.name === 'float'
                ? createPrimitiveType('float')
                : createPrimitiveType('int');
        }

        if (this.typeRelation.isAssignable(left, right)) {
            return right;
        }

        if (this.typeRelation.isAssignable(right, left)) {
            return left;
        }

        return createUnknownType();
    }
}

function getDirectCallee(callExpression: SyntaxNode): SyntaxNode | undefined {
    const firstChild = callExpression.children[0];
    return firstChild?.kind === SyntaxKind.Identifier && !firstChild.metadata?.scopeQualifier
        ? firstChild
        : undefined;
}

function getArgumentCount(callExpression: SyntaxNode): number | undefined {
    const argumentList = callExpression.children.find((child) => child.kind === SyntaxKind.ArgumentList);
    if (!argumentList) {
        return 0;
    }

    return argumentList.children.some((child) => child.kind === SyntaxKind.SpreadElement || child.isMissing || child.isOpaque)
        ? undefined
        : argumentList.children.length;
}

function acceptsArgumentCount(signature: ExpressionCallableSignature, argumentCount: number): boolean {
    if (argumentCount < signature.requiredParameterCount) {
        return false;
    }

    return signature.maxParameterCount === undefined
        || signature.isVariadic
        || argumentCount <= signature.maxParameterCount;
}

function getMetadataString(node: SyntaxNode | undefined, key: string): string | undefined {
    const value = node?.metadata?.[key];
    return typeof value === 'string' ? value : undefined;
}

function isIntegerLiteral(text: string): boolean {
    return /^(0[xX][0-9a-fA-F]+|0[bB][01]+|[0-9]+)$/.test(text);
}

function isFloatLiteral(text: string): boolean {
    return /^([0-9]+\.[0-9]*|\.[0-9]+|[0-9]+[eE][+-]?[0-9]+|[0-9]*\.[0-9]+[eE][+-]?[0-9]+)$/.test(text);
}
