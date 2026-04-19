import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import { DefaultCallableDocResolver } from '../DefaultCallableDocResolver';
import { createCallableDoc, createDocument } from './testSupport';

describe('DefaultCallableDocResolver', () => {
    test('returns standard efun docs directly from efun manager', async () => {
        const standardDoc = createCallableDoc('efun_call', 'efun', 'efun:efun_call', [{
            label: 'string efun_call(int value)',
            returnType: 'string',
            isVariadic: false,
            parameters: [{ name: 'value', type: 'int' }]
        }]);
        const resolver = new DefaultCallableDocResolver(
            {} as any,
            { getStandardCallableDoc: jest.fn(() => standardDoc) } as any,
            {} as any
        );

        await expect(resolver.resolveFromTarget({
            kind: 'efun',
            name: 'efun_call',
            targetKey: 'efun:efun_call',
            sourceLabel: 'efun',
            priority: 6
        })).resolves.toEqual(standardDoc);
    });

    test('materializes simul_efun compatibility docs without opening a document', async () => {
        const resolver = new DefaultCallableDocResolver(
            {} as any,
            {
                getSimulatedDoc: jest.fn(() => ({
                    name: 'simul_call',
                    syntax: 'mixed simul_call(int value)',
                    returnType: 'mixed',
                    returnValue: 'simulated value'
                }))
            } as any,
            {
                openTextDocument: jest.fn()
            }
        );

        const doc = await resolver.resolveFromTarget({
            kind: 'simulEfun',
            name: 'simul_call',
            targetKey: 'simulEfun:simul_call',
            sourceLabel: 'simul_efun',
            priority: 5
        });

        expect(doc).toEqual(expect.objectContaining({
            name: 'simul_call',
            sourceKind: 'simulEfun'
        }));
    });

    test('loads declaration-backed docs through the documentation service', async () => {
        const document = createDocument('void demo(int value) {}', 'D:/workspace/demo.c');
        const documentationService = {
            invalidate: jest.fn(),
            getDocForDeclaration: jest.fn(() => createCallableDoc('demo', 'local', 'decl:demo', [{
                label: 'void demo(int value)',
                returnType: 'void',
                isVariadic: false,
                parameters: [{ name: 'value', type: 'int' }]
            }]))
        };
        const host = {
            openTextDocument: jest.fn(async () => document)
        };
        const resolver = new DefaultCallableDocResolver(documentationService as any, undefined, host);

        const resolved = await resolver.resolveFromTarget({
            kind: 'local',
            name: 'demo',
            targetKey: 'decl:demo',
            documentUri: 'file:///D:/workspace/demo.c',
            declarationKey: 'decl:demo',
            sourceLabel: 'current-file',
            priority: 1
        });

        expect(host.openTextDocument).toHaveBeenCalledWith(vscode.Uri.parse('file:///D:/workspace/demo.c'));
        expect(documentationService.invalidate).toHaveBeenCalledWith('file:///D:/workspace/demo.c');
        expect(documentationService.getDocForDeclaration).toHaveBeenCalledWith(document, 'decl:demo');
        expect(resolved).toEqual(expect.objectContaining({
            name: 'demo',
            sourceKind: 'local'
        }));
    });
});
