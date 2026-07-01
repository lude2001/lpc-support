import { SymbolType, type Scope, type Symbol } from '../ast/symbolTable';
import type {
    FileGlobalSummary,
    TypeDefinitionSummary
} from '../semantic/documentSemanticTypes';
import type { SemanticSnapshot } from '../semantic/semanticSnapshot';
import type { LpcType } from './LpcType';
import { createNamedType, createUnknownType } from './LpcType';
import { LpcTypeParser } from './LpcTypeParser';
import type { TypeCheckingPosition } from './TypeNarrowingLookup';

export interface ScopeSymbolTypeResolverOptions {
    semantic: SemanticSnapshot;
    visibleFileGlobals?: readonly FileGlobalSummary[];
    visibleTypeDefinitions?: readonly TypeDefinitionSummary[];
    typeParser?: LpcTypeParser;
}

export class ScopeSymbolTypeResolver {
    private readonly semantic: SemanticSnapshot;
    private readonly visibleFileGlobals: readonly FileGlobalSummary[];
    private readonly visibleTypeDefinitions: readonly TypeDefinitionSummary[];
    private readonly typeParser: LpcTypeParser;

    public constructor(options: ScopeSymbolTypeResolverOptions) {
        this.semantic = options.semantic;
        this.visibleFileGlobals = options.visibleFileGlobals ?? [];
        this.visibleTypeDefinitions = options.visibleTypeDefinitions ?? [];
        this.typeParser = options.typeParser ?? new LpcTypeParser();
    }

    public resolveIdentifierType(name: string | undefined, position: TypeCheckingPosition): LpcType {
        if (!name) {
            return createUnknownType();
        }

        if (name === 'true' || name === 'false') {
            return this.parseType('int');
        }

        const local = this.resolveLocalOrParameter(name, position);
        if (local) {
            return local;
        }

        const fileGlobal = this.findFileGlobal(this.semantic.fileGlobals ?? [], name)
            ?? this.findFileGlobal(this.visibleFileGlobals, name);
        if (fileGlobal) {
            return this.parseType(fileGlobal.dataType);
        }

        return createUnknownType(name);
    }

    public resolveMemberType(receiverType: LpcType, memberName: string | undefined): LpcType {
        if (!memberName || receiverType.isUnknown || receiverType.isMixed) {
            return createUnknownType();
        }

        const definition = this.resolveTypeDefinition(receiverType);
        const member = definition?.members.find((entry) => entry.name === memberName);
        return member ? this.parseType(member.dataType) : createUnknownType(memberName);
    }

    public resolveTypeDefinition(type: LpcType): TypeDefinitionSummary | undefined {
        if (type.kind !== 'class' && type.kind !== 'struct') {
            return undefined;
        }

        return this.findTypeDefinition(type.name, type.kind);
    }

    public parseType(typeText: string | undefined): LpcType {
        const parsed = this.typeParser.parse(typeText);
        if (parsed.kind !== 'primitive') {
            return parsed;
        }

        const definition = this.findTypeDefinition(parsed.name);
        return definition ? createNamedType(definition.kind, definition.name, parsed.sourceText) : parsed;
    }

    private resolveLocalOrParameter(name: string, position: TypeCheckingPosition): LpcType | undefined {
        const globalScope = this.semantic.symbolTable.getGlobalScope();
        let scope = this.findInnermostScope(globalScope, position);

        while (scope && scope !== globalScope) {
            const symbol = scope.symbols.get(name);
            if (symbol && this.isLocalOrParameter(symbol) && isBefore(this.declarationStart(symbol), position)) {
                return this.parseType(symbol.dataType);
            }
            scope = scope.parent;
        }

        return undefined;
    }

    private findInnermostScope(scope: Scope, position: TypeCheckingPosition): Scope | undefined {
        if (!rangeContains(scope.range, position)) {
            return undefined;
        }

        for (const child of scope.children) {
            const found = this.findInnermostScope(child, position);
            if (found) {
                return found;
            }
        }

        return scope;
    }

    private isLocalOrParameter(symbol: Symbol): boolean {
        return symbol.type === SymbolType.VARIABLE || symbol.type === SymbolType.PARAMETER;
    }

    private declarationStart(symbol: Symbol): TypeCheckingPosition {
        return symbol.selectionRange?.start ?? symbol.range.start;
    }

    private findFileGlobal(
        globals: readonly FileGlobalSummary[],
        name: string
    ): FileGlobalSummary | undefined {
        return globals.find((entry) => entry.name === name);
    }

    private findTypeDefinition(
        name: string,
        kind?: TypeDefinitionSummary['kind']
    ): TypeDefinitionSummary | undefined {
        const currentMatches = this.semantic.typeDefinitions.filter((entry) =>
            entry.name === name && (kind === undefined || entry.kind === kind)
        );
        if (currentMatches.length > 0) {
            return currentMatches.length === 1 ? currentMatches[0] : undefined;
        }

        const matches = dedupeTypeDefinitions(this.visibleTypeDefinitions).filter((entry) =>
            entry.name === name && (kind === undefined || entry.kind === kind)
        );

        return matches.length === 1 ? matches[0] : undefined;
    }
}

function dedupeTypeDefinitions(types: readonly TypeDefinitionSummary[]): TypeDefinitionSummary[] {
    const seen = new Set<string>();
    const result: TypeDefinitionSummary[] = [];
    for (const type of types) {
        const key = `${type.sourceUri}:${type.kind}:${type.name}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(type);
    }
    return result;
}

function rangeContains(range: { start: TypeCheckingPosition; end: TypeCheckingPosition }, position: TypeCheckingPosition): boolean {
    return comparePositions(range.start, position) <= 0 && comparePositions(position, range.end) <= 0;
}

function isBefore(left: TypeCheckingPosition, right: TypeCheckingPosition): boolean {
    return comparePositions(left, right) < 0;
}

function comparePositions(left: TypeCheckingPosition, right: TypeCheckingPosition): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}
