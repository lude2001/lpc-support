import { describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { EnvironmentSemanticRegistry } from '../environment/EnvironmentSemanticRegistry';
import { RuntimeNonStaticProvider } from '../environment/RuntimeNonStaticProvider';
import { ThisPlayerProvider } from '../environment/ThisPlayerProvider';
import type {
    EnvironmentSemanticProvider,
    EnvironmentSemanticRequest
} from '../environment/types';
import { configuredCandidateSetValue, nonStaticValue, objectValue, unknownValue } from '../valueFactories';

function createDocument(fileName: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version: 1,
        lineCount: 1,
        getText: jest.fn(() => ''),
        lineAt: jest.fn(() => ({ text: '' })),
        positionAt: jest.fn(() => new vscode.Position(0, 0)),
        offsetAt: jest.fn(() => 0)
    } as unknown as vscode.TextDocument;
}

function createPathSupport(workspaceRoot: string) {
    return {
        resolveObjectFilePath: jest.fn((_document: vscode.TextDocument, expression: string) => {
            const trimmed = expression.trim().replace(/^"(.*)"$/, '$1');
            const relativePath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
            return path.join(workspaceRoot, `${relativePath}.c`);
        })
    };
}

function createRequest(
    overrides: Partial<EnvironmentSemanticRequest> = {}
): EnvironmentSemanticRequest {
    const workspaceRoot = 'D:\\workspace';
    return {
        document: createDocument(path.join(workspaceRoot, 'room', 'demo.c')),
        calleeName: 'this_player',
        argumentCount: 0,
        workspaceRoot,
        pathSupport: createPathSupport(workspaceRoot),
        ...overrides
    };
}

describe('environment semantic providers', () => {
    test('this_player() returns a configured candidate set when playerObjectPath is configured', async () => {
        const provider = new ThisPlayerProvider({
            playerObjectPath: '/adm/objects/player'
        });

        const result = await provider.evaluate(createRequest());

        expect(result).toEqual(
            configuredCandidateSetValue('this_player', [
                objectValue(path.join('D:\\workspace', 'adm', 'objects', 'player.c'))
            ])
        );
    });

    test('this_player() returns unknown when playerObjectPath is missing', async () => {
        const provider = new ThisPlayerProvider();

        const result = await provider.evaluate(createRequest());

        expect(result).toEqual(unknownValue());
    });

    test('previous_object() is explicitly classified as non-static', async () => {
        const provider = new RuntimeNonStaticProvider();

        const result = await provider.evaluate(createRequest({
            calleeName: 'previous_object'
        }));

        expect(result).toEqual(
            nonStaticValue('previous_object() depends on runtime call stack')
        );
    });

    test('this_player() resolves project config only when workspaceRoot is explicitly provided', async () => {
        const projectConfigService = {
            loadForWorkspace: jest.fn(async (workspaceRoot: string) => ({
                version: 1 as const,
                configHellPath: 'config.hell',
                playerObjectPath: workspaceRoot === 'D:\\workspace'
                    ? '/adm/objects/player'
                    : undefined
            }))
        };
        const provider = new ThisPlayerProvider({
            projectConfigService
        });

        const result = await provider.evaluate(createRequest());

        expect(result).toEqual(
            configuredCandidateSetValue('this_player', [
                objectValue(path.join('D:\\workspace', 'adm', 'objects', 'player.c'))
            ])
        );
        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith('D:\\workspace');
    });

    test('this_player() does not fall back to ambient workspace state when workspaceRoot is absent', async () => {
        const projectConfigService = {
            loadForWorkspace: jest.fn(async () => ({
                version: 1 as const,
                configHellPath: 'config.hell',
                playerObjectPath: '/adm/objects/player'
            }))
        };
        const provider = new ThisPlayerProvider({
            projectConfigService
        });

        const result = await provider.evaluate(createRequest({
            workspaceRoot: undefined
        }));

        expect(result).toEqual(unknownValue());
        expect(projectConfigService.loadForWorkspace).not.toHaveBeenCalled();
    });

    test('this_object() is outside the provider registry and remains a core builtin concern', async () => {
        const registry = new EnvironmentSemanticRegistry([
            new ThisPlayerProvider(),
            new RuntimeNonStaticProvider()
        ]);

        const result = await registry.evaluate(createRequest({
            calleeName: 'this_object'
        }));

        expect(result).toBeUndefined();
    });

    test('registry dispatch prefers exact matching provider', async () => {
        const exactProvider: EnvironmentSemanticProvider = {
            id: 'exact-provider',
            match: jest.fn((request) => request.calleeName === 'this_player' ? 'exact' : undefined),
            evaluate: jest.fn(async () => configuredCandidateSetValue('exact-provider', [objectValue('/exact.c')]))
        };
        const compatibleProvider: EnvironmentSemanticProvider = {
            id: 'compatible-provider',
            match: jest.fn(() => 'compatible'),
            evaluate: jest.fn(async () => configuredCandidateSetValue('compatible-provider', [objectValue('/fallback.c')]))
        };
        const registry = new EnvironmentSemanticRegistry([compatibleProvider, exactProvider]);

        const result = await registry.evaluate(createRequest());

        expect(result).toEqual(
            configuredCandidateSetValue('exact-provider', [objectValue('/exact.c')])
        );
        expect(exactProvider.evaluate).toHaveBeenCalledTimes(1);
        expect(compatibleProvider.evaluate).not.toHaveBeenCalled();
    });
});
