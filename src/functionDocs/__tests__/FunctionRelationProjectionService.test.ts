import { describe, expect, test } from '@jest/globals';
import type { FunctionDocumentationPanelEntry } from '../contracts/FunctionDocumentationPanelProtocol';
import { FunctionRelationProjectionService } from '../services/FunctionRelationProjectionService';

function entry(id: string, sourceKind: 'local' | 'inherit', sourceGroupId: string): FunctionDocumentationPanelEntry {
    return {
        id,
        declarationKey: id,
        name: 'reset',
        sourceKind,
        sourceGroupId,
        declarationKind: 'implementation',
        sourceUri: `file:///${sourceGroupId}.c`,
        signatures: [],
        documentation: { hasAttachedComment: false },
        quality: { status: 'incomplete', issues: [], action: 'generate' },
        relation: { status: 'none', relatedEntryIds: [], relatedSourceUris: [] },
        modifiers: [],
        capabilities: {
            canGoToDefinition: false,
            canFindReferences: false,
            canCopySignature: false,
            canGenerateDocumentation: false,
            canCompleteDocumentation: false,
            canUpdateDocumentation: false
        }
    };
}

describe('FunctionRelationProjectionService', () => {
    test('projects resolved local override and inherited overridden relations', () => {
        const local = entry('local', 'local', 'local-group');
        const inherited = entry('base', 'inherit', 'base-group');
        new FunctionRelationProjectionService().project([local, inherited]);

        expect(local.relation).toMatchObject({ status: 'overrides', relatedEntryIds: ['base'] });
        expect(inherited.relation).toMatchObject({ status: 'overridden', relatedEntryIds: ['local'] });
    });

    test('fails closed when the inheritance graph is incomplete', () => {
        const entries = [entry('local', 'local', 'local-group')];

        new FunctionRelationProjectionService().project(entries, { inheritanceResolved: false });

        expect(entries[0].relation.status).toBe('unresolved');
        expect(entries[0].relation.explanationCode).toBe('inheritance-graph-incomplete');
    });

    test('marks multiple visible inherited sources ambiguous without a local implementation', () => {
        const left = entry('left', 'inherit', 'left-group');
        const right = entry('right', 'inherit', 'right-group');
        new FunctionRelationProjectionService().project([left, right]);

        expect(left.relation.status).toBe('ambiguous');
        expect(right.relation.status).toBe('ambiguous');
    });
});
