import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { CallableDoc } from '../../language/documentation/types';
import { FunctionDocumentationSnapshotService } from '../services/FunctionDocumentationSnapshotService';

function createDoc(
    name: string,
    key: string,
    declarationKind: 'implementation' | 'prototype',
    line: number
): CallableDoc {
    return {
        name,
        declarationKey: key,
        sourceKind: 'local',
        declarationKind,
        modifiers: declarationKind === 'implementation' ? ['varargs'] : ['private'],
        attachedCommentRange: {
            start: { line: Math.max(0, line - 2), character: 0 },
            end: { line, character: 0 }
        },
        sourceRange: {
            start: { line, character: 0 },
            end: { line: line + 1, character: 1 }
        },
        selectionRange: {
            start: { line, character: 13 },
            end: { line, character: 16 }
        },
        summary: '处理角色死亡逻辑',
        details: '处理角色死亡的全部流程。',
        returns: { type: 'void', description: 'void' },
        signatures: [{
            label: declarationKind === 'prototype' ? 'private void die(object killer);' : 'varargs void die(object killer)',
            returnType: 'void',
            parameters: [{ name: 'killer', type: 'object', description: '杀死角色的对象' }],
            arity: declarationKind === 'implementation' ? { min: 0, max: 1 } : undefined,
            isVariadic: false
        }]
    };
}

describe('FunctionDocumentationSnapshotService', () => {
    beforeEach(() => {
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: 'D:/workspace' }
        });
    });

    test('preserves prototype and implementation declarations with structured parameters', async () => {
        const implementation = createDoc('die', 'file:///damage.c#10:0-20:1', 'implementation', 10);
        const prototype = createDoc('die', 'file:///damage.c#2:0-2:32', 'prototype', 2);
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件',
                    filePath: 'D:/workspace/feature/damage.c',
                    sourceKind: 'local' as const,
                    entries: [prototype, implementation],
                    docs: new Map([['die', implementation]])
                },
                inheritedGroups: [],
                includeGroups: []
            }))
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/feature/damage.c'),
            fileName: 'D:/workspace/feature/damage.c',
            languageId: 'lpc',
            version: 7
        } as vscode.TextDocument;

        const snapshot = await service.build(document, { sessionId: 'session', revision: 4 });

        expect(snapshot.rootDocument).toMatchObject({
            workspaceRelativePath: 'feature/damage.c',
            version: 7
        });
        expect(snapshot.entries).toHaveLength(2);
        expect(snapshot.entries.map((entry) => entry.declarationKind)).toEqual(['prototype', 'implementation']);
        expect(snapshot.entries[1]).toMatchObject({
            name: 'die',
            modifiers: ['varargs'],
            signatures: [{
                isFunctionVarargs: true,
                parameters: [{ name: 'killer', type: 'object', description: '杀死角色的对象' }]
            }]
        });
    });

    test('classifies include groups by sourceKind instead of localized labels', async () => {
        const includeDoc = createDoc('helper', 'file:///helper.h#0:0-0:13', 'prototype', 0);
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', filePath: 'D:/workspace/main.c', sourceKind: 'local' as const,
                    entries: [], docs: new Map()
                },
                inheritedGroups: [],
                includeGroups: [{
                    source: '任意本地化标签',
                    filePath: 'D:/workspace/include/helper.h',
                    sourceKind: 'include' as const,
                    depth: 2,
                    parentFilePath: 'D:/workspace/include/base.h',
                    entries: [includeDoc],
                    docs: new Map([['helper', includeDoc]])
                }]
            }))
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const snapshot = await service.build(document, { sessionId: 's', revision: 1 });

        expect(snapshot.groups[1]).toMatchObject({ sourceKind: 'include', depth: 2 });
        expect(snapshot.entries[0].sourceKind).toBe('include');
    });

    test('loads standard and simulated functions lazily through structured docs', async () => {
        const standard = createDoc('map_delete', 'efun:map_delete', 'prototype', 0);
        standard.sourceKind = 'efun';
        standard.declarationKind = 'external';
        const simulated = createDoc('mud_log', 'simul:mud_log', 'implementation', 0);
        simulated.sourceKind = 'simulEfun';
        simulated.declarationKind = 'external';
        simulated.sourcePath = 'D:/workspace/secure/simul_efun.c';
        const ensureWorkspaceStateCurrent = jest.fn().mockResolvedValue(undefined);
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(),
            getAllFunctions: () => ['map_delete', 'write'],
            getStandardCallableDoc: (name) => name === 'map_delete' ? standard : undefined,
            getAllSimulatedFunctions: () => ['mud_log'],
            getSimulatedDoc: (name) => name === 'mud_log' ? simulated : undefined,
            ensureWorkspaceStateCurrent
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const result = await service.searchExternal(document, {
            query: 'm',
            scopes: ['simulEfun', 'efun']
        });

        expect(ensureWorkspaceStateCurrent).toHaveBeenCalledWith(document, undefined);
        expect(result.groups.map((group) => group.sourceKind)).toEqual(['simulEfun', 'efun']);
        expect(result.entries.map((entry) => entry.name)).toEqual(['mud_log', 'map_delete']);
        expect(result.entries.every((entry) => entry.declarationKind === 'external')).toBe(true);
        expect(result.entries[0]).toMatchObject({
            sourceUri: vscode.Uri.file(simulated.sourcePath).toString(),
            quality: { status: 'complete' },
            capabilities: { canGoToDefinition: true, canFindReferences: true }
        });
        expect(result.entries[1]).toMatchObject({
            sourceUri: undefined,
            quality: { status: 'notApplicable' },
            capabilities: { canGoToDefinition: false, canFindReferences: false }
        });
        expect(result.diagnostics).toEqual([]);
    });

    test('keeps simulated-function quality stable before and after its source becomes the root document', async () => {
        const simulated = createDoc('mud_log', 'simul:mud_log', 'implementation', 0);
        simulated.sourcePath = 'D:/workspace/secure/simul_efun.c';
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', filePath: simulated.sourcePath!, sourceKind: 'local' as const,
                    entries: [simulated], docs: new Map([[simulated.name, simulated]])
                },
                inheritedGroups: [], includeGroups: []
            })),
            getAllSimulatedFunctions: () => [simulated.name],
            getSimulatedDoc: () => simulated
        });
        const document = {
            uri: vscode.Uri.file(simulated.sourcePath), fileName: simulated.sourcePath, languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const externalResult = await service.searchExternal(document, {
            query: simulated.name, scopes: ['simulEfun']
        });
        const rootSnapshot = await service.build(document, { sessionId: 's', revision: 1 });

        expect(externalResult.entries[0].quality).toEqual(rootSnapshot.entries[0].quality);
        expect(externalResult.entries[0].quality.status).toBe('complete');
        expect(externalResult.entries[0].capabilities.canUpdateDocumentation).toBe(false);
    });

    test('isolates a failed external source and keeps results from the other source', async () => {
        const standard = createDoc('map_delete', 'efun:map_delete', 'prototype', 0);
        standard.sourceKind = 'efun';
        standard.declarationKind = 'external';
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(),
            getAllSimulatedFunctions: () => { throw new Error('simul unavailable'); },
            getAllFunctions: () => ['map_delete'],
            getStandardCallableDoc: () => standard
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const result = await service.searchExternal(document, { query: 'map', scopes: ['simulEfun', 'efun'] });

        expect(result.entries.map((entry) => entry.name)).toEqual(['map_delete']);
        expect(result.diagnostics).toEqual([expect.objectContaining({
            code: 'external-source-unavailable', stage: 'simulEfun'
        })]);
    });

    test('matches external functions by structured documentation and parameter fields, not name only', async () => {
        const standard = createDoc('map_delete', 'efun:map_delete', 'prototype', 0);
        standard.sourceKind = 'efun';
        standard.declarationKind = 'external';
        standard.summary = '删除映射中的指定键。';
        standard.signatures[0].parameters = [{
            name: 'target_mapping', type: 'mapping', description: '需要修改的目标映射。'
        }];
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(),
            getAllFunctions: () => ['map_delete'],
            getStandardCallableDoc: () => standard
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const bySummary = await service.searchExternal(document, { query: '指定键', scopes: ['efun'] });
        const byParameter = await service.searchExternal(document, { query: 'target_mapping', scopes: ['efun'] });

        expect(bySummary.entries.map((entry) => entry.name)).toEqual(['map_delete']);
        expect(byParameter.entries.map((entry) => entry.name)).toEqual(['map_delete']);
    });

    test('preserves multiple rich signatures without conflating function and parameter varargs', async () => {
        const doc = createDoc('dispatch', 'dispatch-key', 'implementation', 1);
        doc.note = '仅用于测试。';
        doc.returnObjects = ['/obj/one', '/obj/two'];
        doc.signatures = [{
            label: 'varargs object dispatch(string name, int count = 1)', returnType: 'object',
            parameters: [
                { name: 'name', type: 'string', description: '名称。' },
                { name: 'count', type: 'int', optional: true, defaultValueText: '1' }
            ],
            isVariadic: false, arity: { min: 0, max: 2 }
        }, {
            label: 'varargs object dispatch(string name, mixed ...rest)', returnType: 'object',
            parameters: [
                { name: 'name', type: 'string' },
                { name: 'rest', type: 'mixed', variadic: true }
            ],
            isVariadic: true, arity: { min: 0, max: null }
        }];
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', filePath: 'D:/workspace/main.c', sourceKind: 'local' as const,
                    entries: [doc], docs: new Map([['dispatch', doc]])
                },
                inheritedGroups: [], includeGroups: []
            }))
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const entry = (await service.build(document, { sessionId: 's', revision: 1 })).entries[0];

        expect(entry.signatures).toHaveLength(2);
        expect(entry.signatures[0]).toMatchObject({
            isFunctionVarargs: true, isParameterVariadic: false,
            parameters: [{ name: 'name' }, { name: 'count', optional: true, defaultValueText: '1' }]
        });
        expect(entry.signatures[1]).toMatchObject({ isFunctionVarargs: true, isParameterVariadic: true });
        expect(entry.documentation).toMatchObject({ note: '仅用于测试。', returnObjects: ['/obj/one', '/obj/two'] });
    });

    test('exposes dependency diagnostics as partial and fails relation claims closed', async () => {
        const local = createDoc('die', 'local-die', 'implementation', 2);
        const inherited = createDoc('die', 'base-die', 'implementation', 2);
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', filePath: 'D:/workspace/main.c', sourceKind: 'local' as const,
                    entries: [local], docs: new Map([['die', local]])
                },
                inheritedGroups: [{
                    source: '继承自 base.c', filePath: 'D:/workspace/base.c', sourceKind: 'inherit' as const,
                    entries: [inherited], docs: new Map([['die', inherited]])
                }],
                includeGroups: [],
                diagnostics: [{
                    stage: 'inheritance' as const, code: 'inherit-target-unresolved' as const,
                    sourceFilePath: 'D:/workspace/base.c',
                    target: '/missing', message: '无法解析继承目标: /missing'
                }]
            }))
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const snapshot = await service.build(document, { sessionId: 's', revision: 1 });

        expect(snapshot.status).toBe('partial');
        expect(snapshot.diagnostics[0].code).toBe('inherit-target-unresolved');
        expect(snapshot.entries.every((entry) => entry.relation.status === 'unresolved')).toBe(true);
        expect(snapshot.entries.every((entry) => entry.capabilities.canFindReferences === false)).toBe(true);
    });

    test('keeps resolved inheritance relations when only an include dependency fails', async () => {
        const local = createDoc('die', 'local-die', 'implementation', 2);
        const inherited = createDoc('die', 'base-die', 'implementation', 2);
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', filePath: 'D:/workspace/main.c', sourceKind: 'local' as const,
                    entries: [local], docs: new Map([['die', local]])
                },
                inheritedGroups: [{
                    source: '继承自 base.c', filePath: 'D:/workspace/base.c', sourceKind: 'inherit' as const,
                    entries: [inherited], docs: new Map([['die', inherited]])
                }],
                includeGroups: [],
                diagnostics: [{
                    stage: 'include' as const, code: 'dependency-open-failed' as const,
                    sourceFilePath: 'D:/workspace/main.c', target: '/missing.h',
                    message: '无法打开包含文件: /missing.h'
                }]
            }))
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const snapshot = await service.build(document, { sessionId: 's', revision: 1 });

        expect(snapshot.status).toBe('partial');
        expect(snapshot.diagnostics[0].stage).toBe('include');
        expect(snapshot.entries.find((entry) => entry.id === 'local-die')?.relation.status).toBe('overrides');
        expect(snapshot.entries.every((entry) => entry.capabilities.canFindReferences)).toBe(true);
    });

    test('surfaces an unavailable project configuration as a recoverable partial snapshot', async () => {
        const service = new FunctionDocumentationSnapshotService({
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', filePath: 'D:/workspace/main.c', sourceKind: 'local' as const,
                    entries: [], docs: new Map()
                },
                inheritedGroups: [], includeGroups: [], diagnostics: []
            }))
        });
        const document = {
            uri: vscode.Uri.file('D:/workspace/main.c'), fileName: 'D:/workspace/main.c', languageId: 'lpc', version: 1
        } as vscode.TextDocument;

        const snapshot = await service.build(document, {
            sessionId: 's', revision: 1,
            projectConfig: { projectConfigPath: 'D:/workspace/lpc-support.json' }
        });

        expect(snapshot.status).toBe('partial');
        expect(snapshot.diagnostics).toEqual([expect.objectContaining({
            code: 'project-config-unavailable', stage: 'configuration', recoverable: true
        })]);
        expect(snapshot.diagnostics[0].message).not.toContain('D:/workspace');
    });
});
