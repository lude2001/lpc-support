export type LiteralValueType =
    | 'string'
    | 'int'
    | 'float'
    | 'boolean'
    | 'null';

export interface UnknownValue {
    kind: 'unknown';
}

export interface NonStaticValue {
    kind: 'non-static';
    reason?: string;
}

export interface LiteralValue {
    kind: 'literal';
    valueType: LiteralValueType;
    value: string | number | boolean | null;
}

export interface ObjectValue {
    kind: 'object';
    path: string;
}

export interface CandidateSetValue {
    kind: 'candidate-set';
    values: SemanticValue[];
}

export interface ConfiguredCandidateSetValue {
    kind: 'configured-candidate-set';
    provider: string;
    values: SemanticValue[];
}

export interface MappingShapeValue {
    kind: 'mapping-shape';
    entries: Record<string, SemanticValue>;
}

export interface ArrayShapeValue {
    kind: 'array-shape';
    elements: SemanticValue[];
}

export interface UnionValue {
    kind: 'union';
    values: SemanticValue[];
}

export type SemanticValue =
    | UnknownValue
    | NonStaticValue
    | LiteralValue
    | ObjectValue
    | CandidateSetValue
    | ConfiguredCandidateSetValue
    | MappingShapeValue
    | ArrayShapeValue
    | UnionValue;
