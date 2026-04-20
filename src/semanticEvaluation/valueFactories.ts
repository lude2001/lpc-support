import {
    ArrayShapeValue,
    CandidateSetValue,
    ConfiguredCandidateSetValue,
    LiteralValue,
    LiteralValueType,
    MappingShapeValue,
    NonStaticValue,
    ObjectValue,
    SemanticValue,
    UnionValue,
    UnknownValue
} from './types';

function inferLiteralValueType(value: LiteralValue['value']): LiteralValueType {
    if (value === null) {
        return 'null';
    }

    if (typeof value === 'string') {
        return 'string';
    }

    if (typeof value === 'boolean') {
        return 'boolean';
    }

    return Number.isInteger(value) ? 'int' : 'float';
}

export function unknownValue(): UnknownValue {
    return {
        kind: 'unknown'
    };
}

export function nonStaticValue(reason?: string): NonStaticValue {
    return {
        kind: 'non-static',
        reason
    };
}

export function literalValue(
    value: LiteralValue['value'],
    valueType = inferLiteralValueType(value)
): LiteralValue {
    return {
        kind: 'literal',
        valueType,
        value
    };
}

export function objectValue(path: string): ObjectValue {
    return {
        kind: 'object',
        path
    };
}

export function candidateSetValue(values: SemanticValue[]): CandidateSetValue {
    return {
        kind: 'candidate-set',
        values
    };
}

export function configuredCandidateSetValue(
    provider: string,
    values: SemanticValue[]
): ConfiguredCandidateSetValue {
    return {
        kind: 'configured-candidate-set',
        provider,
        values
    };
}

export function mappingShapeValue(entries: Record<string, SemanticValue>): MappingShapeValue {
    return {
        kind: 'mapping-shape',
        entries
    };
}

export function arrayShapeValue(elements: SemanticValue[]): ArrayShapeValue {
    return {
        kind: 'array-shape',
        elements
    };
}

export function unionValue(values: SemanticValue[]): UnionValue {
    return {
        kind: 'union',
        values
    };
}
