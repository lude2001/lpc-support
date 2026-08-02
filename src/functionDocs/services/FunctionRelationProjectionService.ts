import type { FunctionDocumentationPanelEntry } from '../contracts/FunctionDocumentationPanelProtocol';

export class FunctionRelationProjectionService {
    public project(
        entries: FunctionDocumentationPanelEntry[],
        options: { inheritanceResolved?: boolean } = {}
    ): void {
        if (options.inheritanceResolved === false) {
            for (const entry of entries) {
                if (entry.sourceKind === 'local' || entry.sourceKind === 'inherit') {
                    entry.relation = {
                        status: 'unresolved',
                        relatedEntryIds: [],
                        relatedSourceUris: [],
                        explanationCode: 'inheritance-graph-incomplete'
                    };
                }
            }
            return;
        }
        const byName = new Map<string, FunctionDocumentationPanelEntry[]>();
        for (const entry of entries) {
            const existing = byName.get(entry.name) ?? [];
            existing.push(entry);
            byName.set(entry.name, existing);
        }

        for (const family of byName.values()) {
            const localImplementations = family.filter((entry) =>
                entry.sourceKind === 'local' && entry.declarationKind === 'implementation'
            );
            const inherited = family.filter((entry) => entry.sourceKind === 'inherit');

            if (localImplementations.length > 0 && inherited.length > 0) {
                for (const local of localImplementations) {
                    local.relation = {
                        status: 'overrides',
                        relatedEntryIds: inherited.map((entry) => entry.id),
                        relatedSourceUris: uniqueUris(inherited)
                    };
                }
                for (const inheritedEntry of inherited) {
                    inheritedEntry.relation = {
                        status: 'overridden',
                        relatedEntryIds: localImplementations.map((entry) => entry.id),
                        relatedSourceUris: uniqueUris(localImplementations)
                    };
                }
                continue;
            }

            const inheritedSources = new Set(inherited.map((entry) => entry.sourceGroupId));
            if (localImplementations.length === 0 && inheritedSources.size > 1) {
                for (const inheritedEntry of inherited) {
                    inheritedEntry.relation = {
                        status: 'ambiguous',
                        relatedEntryIds: inherited.filter((entry) => entry.id !== inheritedEntry.id).map((entry) => entry.id),
                        relatedSourceUris: uniqueUris(inherited.filter((entry) => entry.id !== inheritedEntry.id)),
                        explanationCode: 'multiple-visible-inherited-declarations'
                    };
                }
            }
        }
    }
}

function uniqueUris(entries: FunctionDocumentationPanelEntry[]): string[] {
    return [...new Set(entries.map((entry) => entry.sourceUri).filter((uri): uri is string => Boolean(uri)))];
}
