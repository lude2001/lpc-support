import { stripLeadingLpcDeclarationModifiers } from '../frontend/languageFacts';

export interface ParsedLpcType {
    normalized: string;
    qualifiedName: string;
    lookupName: string;
    pointerDepth: number;
    arrayDepth: number;
}

export function normalizeLpcType(typeName: string): string {
    return parseLpcType(typeName).normalized;
}

export function getTypeLookupName(typeName: string): string {
    return parseLpcType(typeName).lookupName;
}

export function composeLpcType(typeName: string, additionalPointers: number = 0): string {
    const parsed = parseLpcType(typeName);

    return formatLpcType(
        parsed.qualifiedName,
        parsed.pointerDepth + Math.max(0, additionalPointers),
        parsed.arrayDepth
    );
}

export function parseLpcType(typeName: string): ParsedLpcType {
    const trimmed = typeName.trim();
    if (!trimmed) {
        return {
            normalized: 'mixed',
            qualifiedName: 'mixed',
            lookupName: 'mixed',
            pointerDepth: 0,
            arrayDepth: 0
        };
    }

    const withoutModifiers = stripLeadingLpcDeclarationModifiers(trimmed).trim();

    const arrayMatches = withoutModifiers.match(/\[\s*\]/g);
    const arrayDepth = arrayMatches ? arrayMatches.length : 0;
    const withoutArrays = withoutModifiers.replace(/\[\s*\]/g, ' ').trim();

    const pointerMatches = withoutArrays.match(/\*/g);
    const pointerDepth = pointerMatches ? pointerMatches.length : 0;
    const withoutPointers = withoutArrays.replace(/\*/g, ' ').trim().replace(/\s+/g, ' ');

    const qualifiedName = normalizeQualifiedName(withoutPointers || 'mixed');

    return {
        normalized: formatLpcType(qualifiedName, pointerDepth, arrayDepth),
        qualifiedName,
        lookupName: getLookupNameFromQualifiedName(qualifiedName),
        pointerDepth,
        arrayDepth
    };
}

function normalizeQualifiedName(typeName: string): string {
    const compact = typeName.replace(/\s+/g, ' ').trim();
    const classMatch = compact.match(/^(class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)$/);

    if (classMatch) {
        return `${classMatch[1]} ${classMatch[2]}`;
    }

    return compact;
}

function getLookupNameFromQualifiedName(typeName: string): string {
    const qualifiedMatch = typeName.match(/^(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
    return qualifiedMatch ? qualifiedMatch[1] : typeName;
}

function formatLpcType(qualifiedName: string, pointerDepth: number, arrayDepth: number): string {
    let normalized = qualifiedName.trim() || 'mixed';

    if (pointerDepth > 0) {
        normalized += ` ${'*'.repeat(pointerDepth)}`;
    }

    if (arrayDepth > 0) {
        normalized += '[]'.repeat(arrayDepth);
    }

    return normalized;
}
