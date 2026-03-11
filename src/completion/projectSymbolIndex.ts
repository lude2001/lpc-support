import { getTypeLookupName } from '../ast/typeNormalization';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import {
    FileSymbolRecord,
    FunctionSummary,
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
    | 'typeDefinitions'
    | 'inheritStatements'
    | 'includeStatements'
    | 'macroReferences'
    | 'createdAt'
>;

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
            exportedFunctions: snapshot.exportedFunctions.map(func => ({ ...func })),
            typeDefinitions: snapshot.typeDefinitions.map(type => ({
                ...type,
                members: type.members.map(member => ({
                    ...member,
                    parameters: member.parameters?.map(parameter => ({ ...parameter }))
                }))
            })),
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
        return this.records.get(uri);
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
                    functions.push({ ...func, origin: 'inherited' });
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

    public findType(typeName: string): TypeDefinitionSummary | undefined {
        return this.typeLookup.get(getTypeLookupName(typeName))?.[0];
    }

    public getAllRecords(): FileSymbolRecord[] {
        return Array.from(this.records.values()).map(record => ({
            ...record,
            exportedFunctions: record.exportedFunctions.map(func => ({ ...func })),
            typeDefinitions: record.typeDefinitions.map(type => ({
                ...type,
                members: type.members.map(member => ({
                    ...member,
                    parameters: member.parameters?.map(parameter => ({ ...parameter }))
                }))
            })),
            inheritStatements: record.inheritStatements.map(statement => ({ ...statement })),
            includeStatements: record.includeStatements.map(statement => ({ ...statement })),
            macroReferences: record.macroReferences.map(reference => ({ ...reference }))
        }));
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
