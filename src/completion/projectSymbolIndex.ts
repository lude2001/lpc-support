import { getTypeLookupName } from '../ast/typeNormalization';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import {
    FileSymbolRecord,
    FileGlobalSummary,
    FunctionSummary,
    IncludeDirective,
    IncludedSymbolSet,
    InheritedSymbolSet,
    ResolvedInheritTarget,
    TypeDefinitionSummary
} from './types';
import { InheritanceIndexView, InheritanceResolver } from './inheritanceResolver';

type ProjectSemanticSnapshot = Pick<
    SemanticSnapshot,
    | 'uri'
    | 'version'
    | 'exportedFunctions'
    | 'symbols'
    | 'typeDefinitions'
    | 'fileGlobals'
    | 'inheritStatements'
    | 'includeStatements'
    | 'macroReferences'
    | 'createdAt'
> & Pick<Partial<SemanticSnapshot>, 'degraded'>;

export class ProjectSymbolIndex implements InheritanceIndexView {
    private readonly inheritanceResolver: InheritanceResolver;
    private readonly records = new Map<string, FileSymbolRecord>();
    private readonly resolvedTargets = new Map<string, ResolvedInheritTarget[]>();
    private readonly typeLookup = new Map<string, TypeDefinitionSummary[]>();

    constructor(inheritanceResolver: InheritanceResolver) {
        this.inheritanceResolver = inheritanceResolver;
        this.inheritanceResolver.attachIndex(this);
    }

    public updateFromSemanticSnapshot(snapshot: ProjectSemanticSnapshot): void {
        if (snapshot.degraded) {
            return;
        }

        const existingRecord = this.records.get(snapshot.uri);
        if (existingRecord && existingRecord.version >= snapshot.version) {
            return;
        }

        const resolvedTargets = this.inheritanceResolver.resolveInheritTargets(snapshot);
        const resolvedUriByValue = new Map<string, ResolvedInheritTarget>();

        for (const target of resolvedTargets) {
            resolvedUriByValue.set(`${target.expressionKind}:${target.rawValue}`, target);
        }

        this.records.set(snapshot.uri, {
            uri: snapshot.uri,
            version: snapshot.version,
            exportedFunctions: snapshot.exportedFunctions.map(func => cloneFunctionSummary(func)),
            symbols: snapshot.symbols?.map(symbol => ({ ...symbol })),
            typeDefinitions: snapshot.typeDefinitions.map(type => ({
                ...type,
                members: type.members.map(member => ({
                    ...member,
                    parameters: member.parameters?.map(parameter => ({ ...parameter }))
                }))
            })),
            fileGlobals: (snapshot.fileGlobals || []).map(summary => cloneFileGlobalSummary(summary)),
            inheritStatements: snapshot.inheritStatements.map(statement => {
                const target = resolvedUriByValue.get(`${statement.expressionKind}:${statement.value}`);

                return {
                    ...statement,
                    resolvedUri: target?.resolvedUri,
                    isResolved: target?.isResolved ?? statement.isResolved
                };
            }),
            includeStatements: snapshot.includeStatements.map(statement => ({ ...statement })),
            macroReferences: snapshot.macroReferences.map(reference => ({ ...reference })),
            updatedAt: snapshot.createdAt
        });

        this.resolvedTargets.set(snapshot.uri, resolvedTargets.map(target => ({ ...target })));
        this.rebuildTypeLookup();
    }

    public updateFromSnapshot(snapshot: ProjectSemanticSnapshot): void {
        this.updateFromSemanticSnapshot(snapshot);
    }

    public removeFile(uri: string): void {
        this.records.delete(uri);
        this.resolvedTargets.delete(uri);
        this.rebuildTypeLookup();
    }

    public clear(): void {
        this.records.clear();
        this.resolvedTargets.clear();
        this.typeLookup.clear();
    }

    public getRecord(uri: string): FileSymbolRecord | undefined {
        const record = this.records.get(uri);
        return record ? cloneFileSymbolRecord(record) : undefined;
    }

    public getResolvedInheritTargets(uri: string): ResolvedInheritTarget[] {
        return this.resolvedTargets.get(uri)?.map(target => ({ ...target })) || [];
    }

    public getInheritedSymbols(uri: string): InheritedSymbolSet {
        const chain = this.inheritanceResolver.getInheritanceChain(uri);
        const functions: FunctionSummary[] = [];
        const types: TypeDefinitionSummary[] = [];
        const unresolvedTargets: ResolvedInheritTarget[] = [];
        const seenFunctionKeys = new Set<string>();
        const seenTypeKeys = new Set<string>();
        const visited = new Set<string>([uri]);

        const traverse = (currentUri: string): void => {
            const targets = this.resolvedTargets.get(currentUri) || [];

            for (const target of targets) {
                if (!target.isResolved || !target.resolvedUri) {
                    unresolvedTargets.push({ ...target });
                    continue;
                }

                if (visited.has(target.resolvedUri)) {
                    continue;
                }

                visited.add(target.resolvedUri);

                const record = this.records.get(target.resolvedUri);
                if (!record) {
                    unresolvedTargets.push({ ...target, isResolved: false });
                    continue;
                }

                for (const func of record.exportedFunctions) {
                    const key = `${record.uri}:${func.name}`;
                    if (seenFunctionKeys.has(key)) {
                        continue;
                    }

                    seenFunctionKeys.add(key);
                    functions.push({ ...cloneFunctionSummary(func), origin: 'inherited' });
                }

                for (const type of record.typeDefinitions) {
                    const key = `${record.uri}:${type.name}`;
                    if (seenTypeKeys.has(key)) {
                        continue;
                    }

                    seenTypeKeys.add(key);
                    types.push({
                        ...type,
                        members: type.members.map(member => ({
                            ...member,
                            parameters: member.parameters?.map(parameter => ({ ...parameter }))
                        }))
                    });
                }

                traverse(target.resolvedUri);
            }
        };

        traverse(uri);

        return {
            chain,
            functions,
            types,
            unresolvedTargets
        };
    }

    public getIncludedSymbols(uri: string): IncludedSymbolSet {
        const record = this.records.get(uri);
        const files: string[] = [];
        const functions: FunctionSummary[] = [];
        const types: TypeDefinitionSummary[] = [];
        const fileGlobals: FileGlobalSummary[] = [];
        const unresolvedIncludes: IncludeDirective[] = [];
        const visited = new Set<string>();

        if (!record) {
            return { files, functions, types, fileGlobals, unresolvedIncludes };
        }

        for (const includeStatement of record.includeStatements) {
            if (!includeStatement.resolvedUri || visited.has(includeStatement.resolvedUri)) {
                unresolvedIncludes.push({ ...includeStatement });
                continue;
            }

            visited.add(includeStatement.resolvedUri);
            const includeRecord = this.records.get(includeStatement.resolvedUri);
            if (!includeRecord) {
                unresolvedIncludes.push({ ...includeStatement });
                continue;
            }

            files.push(includeStatement.resolvedUri);
            functions.push(...includeRecord.exportedFunctions.map((func) => ({
                ...cloneFunctionSummary(func),
                origin: 'include' as const
            })));
            types.push(...includeRecord.typeDefinitions.map((type) => ({
                ...type,
                members: type.members.map(member => ({
                    ...member,
                    parameters: member.parameters?.map(parameter => ({ ...parameter }))
                }))
            })));
            fileGlobals.push(...includeRecord.fileGlobals.map((summary) => cloneFileGlobalSummary(summary)));
        }

        return { files, functions, types, fileGlobals, unresolvedIncludes };
    }

    public findType(typeName: string): TypeDefinitionSummary | undefined {
        return this.typeLookup.get(getTypeLookupName(typeName))?.[0];
    }

    public getAllRecords(): FileSymbolRecord[] {
        return Array.from(this.records.values()).map(record => cloneFileSymbolRecord(record));
    }

    private rebuildTypeLookup(): void {
        this.typeLookup.clear();

        for (const record of this.records.values()) {
            for (const typeDefinition of record.typeDefinitions) {
                const lookupName = getTypeLookupName(typeDefinition.name);
                const existing = this.typeLookup.get(lookupName) || [];
                existing.push({
                    ...typeDefinition,
                    members: typeDefinition.members.map(member => ({
                        ...member,
                        parameters: member.parameters?.map(parameter => ({ ...parameter }))
                    }))
                });
                this.typeLookup.set(lookupName, existing);
            }
        }
    }
}

function cloneFileGlobalSummary(summary: FileGlobalSummary): FileGlobalSummary {
    return {
        ...summary
    };
}

function cloneFunctionSummary(summary: FunctionSummary): FunctionSummary {
    return {
        ...summary,
        parameters: summary.parameters.map(parameter => ({ ...parameter }))
    };
}

function cloneFileSymbolRecord(record: FileSymbolRecord): FileSymbolRecord {
    return {
        ...record,
        exportedFunctions: record.exportedFunctions.map(func => cloneFunctionSummary(func)),
        symbols: record.symbols?.map(symbol => ({ ...symbol })),
        typeDefinitions: record.typeDefinitions.map(type => ({
            ...type,
            members: type.members.map(member => ({
                ...member,
                parameters: member.parameters?.map(parameter => ({ ...parameter }))
            }))
        })),
        fileGlobals: record.fileGlobals.map(summary => cloneFileGlobalSummary(summary)),
        inheritStatements: record.inheritStatements.map(statement => ({ ...statement })),
        includeStatements: record.includeStatements.map(statement => ({ ...statement })),
        macroReferences: record.macroReferences.map(reference => ({ ...reference }))
    };
}
