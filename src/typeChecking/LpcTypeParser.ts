import { parseLpcType as parseNormalizedLpcType } from '../ast/typeNormalization';
import {
    LpcType,
    createArrayType,
    createFunctionType,
    createMappingType,
    createNamedType,
    createPrimitiveType,
    createUnionType,
    createUnknownType
} from './LpcType';

export class LpcTypeParser {
    public parse(typeText: string | undefined): LpcType {
        if (typeText === undefined) {
            return createUnknownType();
        }

        const unionType = this.tryParseUnionType(typeText);
        if (unionType) {
            return unionType;
        }

        return this.parseSingleType(typeText);
    }

    private tryParseUnionType(typeText: string): LpcType | undefined {
        if (!typeText.includes('|')) {
            return undefined;
        }

        const alternatives = typeText.split('|').map((part) => part.trim());
        if (alternatives.length < 2 || alternatives.some((part) => part.length === 0)) {
            return createUnknownType(typeText.trim() || 'unknown');
        }

        const parsedAlternatives = alternatives.map((part) => this.parseSingleType(part));
        if (parsedAlternatives.some((type) => type.isUnknown)) {
            return createUnknownType(typeText.trim());
        }

        return createUnionType(parsedAlternatives, parsedAlternatives.map((type) => type.sourceText).join(' | '));
    }

    private parseSingleType(typeText: string): LpcType {
        const parsed = parseNormalizedLpcType(typeText);
        const isBuiltinArray = parsed.qualifiedName === 'array';
        const totalArrayDepth = parsed.pointerDepth + parsed.arrayDepth + (isBuiltinArray ? 1 : 0);
        const baseType = isBuiltinArray
            ? createPrimitiveType('mixed')
            : this.createBaseType(parsed.qualifiedName, parsed.normalized);

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
