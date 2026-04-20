import { SemanticValue } from './types';
import { unionValue, unknownValue } from './valueFactories';

function serializeSemanticValue(value: SemanticValue): string {
    switch (value.kind) {
        case 'unknown':
            return '{"kind":"unknown"}';
        case 'non-static':
            return JSON.stringify({
                kind: value.kind,
                reason: value.reason ?? null
            });
        case 'literal':
            return JSON.stringify({
                kind: value.kind,
                valueType: value.valueType,
                value: value.value
            });
        case 'object':
            return JSON.stringify({
                kind: value.kind,
                path: value.path
            });
        case 'candidate-set':
            return JSON.stringify({
                kind: value.kind,
                values: value.values.map(serializeSemanticValue)
            });
        case 'configured-candidate-set':
            return JSON.stringify({
                kind: value.kind,
                provider: value.provider,
                values: value.values.map(serializeSemanticValue)
            });
        case 'mapping-shape': {
            const entries = Object.keys(value.entries)
                .sort()
                .map((key) => [key, serializeSemanticValue(value.entries[key])]);
            return JSON.stringify({
                kind: value.kind,
                entries
            });
        }
        case 'array-shape':
            return JSON.stringify({
                kind: value.kind,
                elements: value.elements.map(serializeSemanticValue)
            });
        case 'union': {
            const values = value.values
                .map(serializeSemanticValue)
                .sort();
            return JSON.stringify({
                kind: value.kind,
                values
            });
        }
        default:
            return JSON.stringify(value);
    }
}

function flattenSemanticValues(values: SemanticValue[]): SemanticValue[] {
    return values.flatMap((value) => value.kind === 'union' ? flattenSemanticValues(value.values) : [value]);
}

export function joinSemanticValues(values: SemanticValue[]): SemanticValue {
    const flattened = flattenSemanticValues(values);

    if (flattened.length === 0) {
        return unknownValue();
    }

    const uniqueValues: SemanticValue[] = [];
    const seenValues = new Set<string>();

    for (const value of flattened) {
        const serialized = serializeSemanticValue(value);
        if (seenValues.has(serialized)) {
            continue;
        }

        seenValues.add(serialized);
        uniqueValues.push(value);
    }

    if (uniqueValues.length === 1) {
        return uniqueValues[0];
    }

    return unionValue(uniqueValues);
}
