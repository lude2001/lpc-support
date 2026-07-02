export type LpcTypeKind =
    | 'primitive'
    | 'class'
    | 'struct'
    | 'array'
    | 'mapping'
    | 'function'
    | 'union'
    | 'unknown';

export interface LpcType {
    kind: LpcTypeKind;
    name: string;
    pointerDepth: number;
    sourceText: string;
    elementType?: LpcType;
    keyType?: LpcType;
    valueType?: LpcType;
    alternatives?: readonly LpcType[];
    isMixed: boolean;
    isUnknown: boolean;
    isVoid: boolean;
    isZeroLiteral: boolean;
}

export function createUnknownType(sourceText = 'unknown'): LpcType {
    return {
        kind: 'unknown',
        name: 'unknown',
        pointerDepth: 0,
        sourceText,
        isMixed: false,
        isUnknown: true,
        isVoid: false,
        isZeroLiteral: false
    };
}

export function createZeroLiteralType(): LpcType {
    return {
        kind: 'primitive',
        name: '0',
        pointerDepth: 0,
        sourceText: '0',
        isMixed: false,
        isUnknown: false,
        isVoid: false,
        isZeroLiteral: true
    };
}

export function createPrimitiveType(name: string, sourceText = name): LpcType {
    return {
        kind: 'primitive',
        name,
        pointerDepth: 0,
        sourceText,
        isMixed: name === 'mixed',
        isUnknown: false,
        isVoid: name === 'void',
        isZeroLiteral: false
    };
}

export function createNamedType(
    kind: 'class' | 'struct',
    name: string,
    sourceText: string
): LpcType {
    return {
        kind,
        name,
        pointerDepth: 0,
        sourceText,
        isMixed: false,
        isUnknown: false,
        isVoid: false,
        isZeroLiteral: false
    };
}

export function createArrayType(elementType: LpcType, pointerDepth: number, sourceText: string): LpcType {
    return {
        kind: 'array',
        name: elementType.name,
        pointerDepth,
        sourceText,
        elementType,
        isMixed: false,
        isUnknown: false,
        isVoid: false,
        isZeroLiteral: false
    };
}

export function createMappingType(sourceText = 'mapping', keyType?: LpcType, valueType?: LpcType): LpcType {
    return {
        kind: 'mapping',
        name: 'mapping',
        pointerDepth: 0,
        sourceText,
        keyType,
        valueType,
        isMixed: false,
        isUnknown: false,
        isVoid: false,
        isZeroLiteral: false
    };
}

export function createFunctionType(sourceText = 'function'): LpcType {
    return {
        kind: 'function',
        name: 'function',
        pointerDepth: 0,
        sourceText,
        isMixed: false,
        isUnknown: false,
        isVoid: false,
        isZeroLiteral: false
    };
}

export function createUnionType(alternatives: readonly LpcType[], sourceText: string): LpcType {
    return {
        kind: 'union',
        name: 'union',
        pointerDepth: 0,
        sourceText,
        alternatives: [...alternatives],
        isMixed: alternatives.some((type) => type.isMixed),
        isUnknown: alternatives.some((type) => type.isUnknown),
        isVoid: false,
        isZeroLiteral: false
    };
}
