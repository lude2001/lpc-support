import type { LpcType } from './LpcType';

const NUMERIC_TYPES = new Set(['int', 'float', 'status']);

export class LpcTypeRelation {
    public isAssignable(source: LpcType, target: LpcType): boolean {
        if (source.isUnknown || target.isUnknown) {
            return true;
        }

        if (source.isMixed || target.isMixed) {
            return true;
        }

        if (target.isVoid) {
            return source.isVoid;
        }

        if (source.isVoid) {
            return false;
        }

        if (source.isZeroLiteral) {
            return true;
        }

        if (source.kind === 'union') {
            return this.isSourceUnionAssignable(source, target);
        }

        if (target.kind === 'union') {
            return this.isTargetUnionAssignable(source, target);
        }

        if (source.kind === 'array' || target.kind === 'array') {
            return this.isArrayAssignable(source, target);
        }

        if (source.kind === 'mapping' || target.kind === 'mapping') {
            return this.isMappingAssignable(source, target);
        }

        if (source.kind === 'function' || target.kind === 'function') {
            return source.kind === 'function' && target.kind === 'function';
        }

        if (source.kind === 'class' || source.kind === 'struct' || target.kind === 'class' || target.kind === 'struct') {
            return source.kind === target.kind && source.name === target.name;
        }

        if (NUMERIC_TYPES.has(source.name) && NUMERIC_TYPES.has(target.name)) {
            return true;
        }

        return source.kind === target.kind && source.name === target.name;
    }

    private isSourceUnionAssignable(source: LpcType, target: LpcType): boolean {
        const alternatives = source.alternatives ?? [];
        return alternatives.length > 0 && alternatives.every((alternative) =>
            this.isAssignable(alternative, target)
        );
    }

    private isTargetUnionAssignable(source: LpcType, target: LpcType): boolean {
        const alternatives = target.alternatives ?? [];
        return alternatives.some((alternative) =>
            this.isAssignable(source, alternative)
        );
    }

    private isArrayAssignable(source: LpcType, target: LpcType): boolean {
        if (source.kind !== 'array' || target.kind !== 'array') {
            return false;
        }

        if (!source.elementType || !target.elementType) {
            return true;
        }

        return this.isAssignable(source.elementType, target.elementType);
    }

    private isMappingAssignable(source: LpcType, target: LpcType): boolean {
        if (source.kind !== 'mapping' || target.kind !== 'mapping') {
            return false;
        }

        if (source.keyType && target.keyType && !this.isAssignable(source.keyType, target.keyType)) {
            return false;
        }

        if (source.valueType && target.valueType && !this.isAssignable(source.valueType, target.valueType)) {
            return false;
        }

        return true;
    }
}
