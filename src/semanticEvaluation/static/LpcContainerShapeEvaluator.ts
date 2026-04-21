import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { arrayShapeValue, mappingShapeValue, unknownValue } from '../valueFactories';
import { joinSemanticValues } from '../valueJoin';
import type { StaticEvaluationState } from './StaticEvaluationState';

export interface LpcContainerShapeEvaluatorDependencies {
    evaluateExpression: (node: SyntaxNode | undefined, state: StaticEvaluationState) => SemanticValue;
}

export function literalValueToStaticKey(value: SemanticValue): string | undefined {
    if (value.kind !== 'literal') {
        return undefined;
    }

    if (typeof value.value === 'string') {
        return value.value;
    }

    if (typeof value.value === 'number' || typeof value.value === 'boolean') {
        return String(value.value);
    }

    if (value.value === null) {
        return 'null';
    }

    return undefined;
}

export function literalValueToArrayIndex(value: SemanticValue): number | undefined {
    if (value.kind !== 'literal' || typeof value.value !== 'number' || !Number.isInteger(value.value)) {
        return undefined;
    }

    return value.value;
}

export function collectStaticStringSet(value: SemanticValue): string[] | undefined {
    if (value.kind === 'literal' && typeof value.value === 'string') {
        return [value.value];
    }

    if (
        value.kind === 'union'
        || value.kind === 'candidate-set'
        || value.kind === 'configured-candidate-set'
    ) {
        const parts = value.values
            .map((entry) => collectStaticStringSet(entry))
            .filter((entry): entry is string[] => Boolean(entry));
        if (parts.length !== value.values.length) {
            return undefined;
        }

        return [...new Set(parts.flat())].sort();
    }

    return undefined;
}

export class LpcContainerShapeEvaluator {
    public constructor(private readonly dependencies: LpcContainerShapeEvaluatorDependencies) {}

    public evaluateMappingLiteral(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const entries: Record<string, SemanticValue> = {};

        for (const entryNode of node.children) {
            if (entryNode.kind !== SyntaxKind.MappingEntry || entryNode.children.length < 2) {
                return unknownValue();
            }

            const keyValue = this.dependencies.evaluateExpression(entryNode.children[0], state);
            const entryKey = literalValueToStaticKey(keyValue);
            if (entryKey === undefined) {
                return unknownValue();
            }

            entries[entryKey] = this.dependencies.evaluateExpression(entryNode.children[1], state);
        }

        return mappingShapeValue(entries);
    }

    public evaluateArrayLiteral(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const expressionList = node.children[0];
        if (!expressionList) {
            return arrayShapeValue([]);
        }

        const elements: SemanticValue[] = [];
        for (const child of expressionList.children) {
            if (child.kind === SyntaxKind.SpreadElement) {
                return unknownValue();
            }

            elements.push(this.dependencies.evaluateExpression(child, state));
        }

        return arrayShapeValue(elements);
    }

    public evaluateIndexExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const target = this.dependencies.evaluateExpression(node.children[0], state);
        const index = this.dependencies.evaluateExpression(node.children[1], state);

        return this.evaluateIndexOnTarget(target, index);
    }

    private evaluateIndexOnTarget(target: SemanticValue, index: SemanticValue): SemanticValue {
        if (target.kind === 'union') {
            return joinSemanticValues(
                target.values.map((entry) => this.evaluateIndexOnTarget(entry, index))
            );
        }

        if (target.kind === 'mapping-shape') {
            const entryKeys = collectStaticStringSet(index);
            if (!entryKeys || entryKeys.length === 0) {
                return unknownValue();
            }

            const values: SemanticValue[] = [];
            for (const entryKey of entryKeys) {
                const entryValue = target.entries[entryKey];
                if (!entryValue) {
                    return unknownValue();
                }

                values.push(entryValue);
            }

            return joinSemanticValues(values);
        }

        if (target.kind === 'array-shape') {
            const elementIndex = literalValueToArrayIndex(index);
            if (elementIndex === undefined || elementIndex < 0 || elementIndex >= target.elements.length) {
                return unknownValue();
            }

            return target.elements[elementIndex];
        }

        return unknownValue();
    }
}
