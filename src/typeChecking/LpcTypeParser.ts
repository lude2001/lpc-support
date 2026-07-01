import { parseLpcType as parseNormalizedLpcType } from '../ast/typeNormalization';
import {
    LpcType,
    createArrayType,
    createFunctionType,
    createMappingType,
    createNamedType,
    createPrimitiveType,
    createUnknownType
} from './LpcType';

export class LpcTypeParser {
    public parse(typeText: string | undefined): LpcType {
        if (typeText === undefined) {
            return createUnknownType();
        }

        const parsed = parseNormalizedLpcType(typeText);
        const totalArrayDepth = parsed.pointerDepth + parsed.arrayDepth;
        const baseType = this.createBaseType(parsed.qualifiedName, parsed.normalized);

        if (totalArrayDepth > 0) {
            return this.wrapArray(baseType, totalArrayDepth, parsed.normalized);
        }

        return baseType;
    }

    private createBaseType(qualifiedName: string, sourceText: string): LpcType {
        const classMatch = qualifiedName.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (classMatch) {
            return createNamedType('class', classMatch[1], sourceText);
        }

        const structMatch = qualifiedName.match(/^struct\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (structMatch) {
            return createNamedType('struct', structMatch[1], sourceText);
        }

        if (qualifiedName === 'mapping') {
            return createMappingType(sourceText);
        }

        if (qualifiedName === 'function' || qualifiedName === 'closure') {
            return createFunctionType(sourceText);
        }

        if (qualifiedName === 'unknown') {
            return createUnknownType(sourceText);
        }

        if (!isSimpleTypeName(qualifiedName)) {
            return createUnknownType(sourceText);
        }

        return createPrimitiveType(qualifiedName || 'mixed', sourceText);
    }

    private wrapArray(elementType: LpcType, depth: number, sourceText: string): LpcType {
        let result = elementType;
        for (let index = 1; index <= depth; index += 1) {
            result = createArrayType(result, index, sourceText);
        }
        return result;
    }
}

function isSimpleTypeName(typeName: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(typeName);
}
