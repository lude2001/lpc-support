import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import { DefaultCallableTargetDiscoveryService } from '../DefaultCallableTargetDiscoveryService';
import { createDocument } from './testSupport';

describe('DefaultCallableTargetDiscoveryService', () => {
    test('discovers local and inherited callable targets from efun docs manager', async () => {
        const document = createDocument('void test() { demo(1); }');
        const service = new DefaultCallableTargetDiscoveryService({
            getCurrentFileDocForDocument: jest.fn(async () => ({
                name: 'demo',
                sourcePath: document.fileName,
                sourceRange: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 4 }
                }
            })),
            getInheritedFileDocForDocument: jest.fn(async () => ({
                name: 'demo',
                sourcePath: 'D:/workspace/std/base.c',
                sourceRange: {
                    start: { line: 10, character: 0 },
                    end: { line: 10, character: 4 }
                }
            }))
        } as any);

        const targets = await service.discoverLocalOrInheritedTargets({
            document,
            position: new vscode.Position(0, 19),
            callExpressionRange: new vscode.Range(0, 14, 0, 21),
            calleeName: 'demo',
            callKind: 'function'
        });

        expect(targets).toEqual([
            expect.objectContaining({ kind: 'local', sourceLabel: 'current-file', priority: 1 }),
            expect.objectContaining({ kind: 'inherit', sourceLabel: 'inherited', priority: 2 })
        ]);
    });

    test('discovers object-method targets from inferred object access', async () => {
        const document = createDocument('void test(object ob) { ob->query_name(1); }');
        const service = new DefaultCallableTargetDiscoveryService(
            undefined,
            {
                inferObjectAccess: jest.fn(async () => ({
                    memberName: 'query_name',
                    inference: {
                        status: 'resolved',
                        candidates: [{ path: 'D:/workspace/obj/npc.c' }]
                    }
                }))
            } as any,
            {
                findMethod: jest.fn(async () => ({
                    document: createDocument('string query_name(int mode) { return "x"; }', 'D:/workspace/obj/npc.c'),
                    declarationRange: new vscode.Range(0, 0, 0, 27)
                }))
            } as any
        );

        const targets = await service.discoverObjectMethodTargets({
            document,
            position: new vscode.Position(0, 38),
            callExpressionRange: new vscode.Range(0, 28, 0, 42),
            calleeName: 'query_name',
            callKind: 'objectMethod',
            calleeLookupPosition: new vscode.Position(0, 32)
        });

        expect(targets).toEqual([
            expect.objectContaining({
                kind: 'objectMethod',
                sourceLabel: 'object-method',
                documentUri: createDocument('', 'D:/workspace/obj/npc.c').uri.toString()
            })
        ]);
    });

    test('discovers scoped and efun-backed targets with preserved labels', async () => {
        const document = createDocument('void test() { ::create(1); efun_call(2); }');
        const service = new DefaultCallableTargetDiscoveryService(
            {
                getSimulatedDoc: jest.fn(() => undefined),
                getStandardCallableDoc: jest.fn((name: string) => name === 'efun_call' ? { name } : undefined)
            } as any,
            undefined,
            undefined,
            {
                resolveCallAt: jest.fn(async () => ({
                    status: 'resolved',
                    targets: [{
                        document: createDocument('void create(int mode) {}', 'D:/workspace/std/base.c'),
                        declarationRange: new vscode.Range(0, 0, 0, 21)
                    }]
                }))
            } as any
        );

        const scopedTargets = await service.discoverScopedMethodTargets({
            document,
            position: new vscode.Position(0, 25),
            callExpressionRange: new vscode.Range(0, 14, 0, 26),
            calleeName: 'create',
            callKind: 'scopedMethod',
            calleeLookupPosition: new vscode.Position(0, 18)
        });
        const efunTargets = await service.discoverEfunTargets({
            document,
            position: new vscode.Position(0, 39),
            callExpressionRange: new vscode.Range(0, 29, 0, 41),
            calleeName: 'efun_call',
            callKind: 'function'
        });

        expect(scopedTargets).toEqual([
            expect.objectContaining({ kind: 'scopedMethod', sourceLabel: 'scoped-method', priority: 4 })
        ]);
        expect(efunTargets).toEqual([
            expect.objectContaining({ kind: 'efun', sourceLabel: 'efun', priority: 6 })
        ]);
    });
});
