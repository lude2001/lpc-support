import { describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { EnvironmentSemanticRegistry } from '../environment/EnvironmentSemanticRegistry';
import { RuntimeNonStaticProvider } from '../environment/RuntimeNonStaticProvider';
import { ConfiguredFunctionReturnProvider } from '../environment/ConfiguredFunctionReturnProvider';
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
    test('configured efun returns a configured candidate set', async () => {
        const provider = new ConfiguredFunctionReturnProvider({
            instanceResolutionFunctions: {
                this_player: ['/adm/objects/player']
            }
        });

        const result = await provider.evaluate(createRequest());

        expect(result).toEqual(
            configuredCandidateSetValue('configured-function-return:this_player', [
                objectValue(path.join('D:\\workspace', 'adm', 'objects', 'player.c'))
            ])
        );
    });

    test('configured efun provider returns unknown when no function mapping exists', async () => {
        const provider = new ConfiguredFunctionReturnProvider();

        const result = await provider.evaluate(createRequest());

        expect(result).toEqual(unknownValue());
    });

    test('configured efun provider ignores invalid builtin efun arity', async () => {
        const provider = new ConfiguredFunctionReturnProvider({
            projectConfigProvider: {
                getWorkspaceProjectConfig: jest.fn(() => ({
                    resolvedConfig: {
                        masterFile: '/adm/obj/master'
                    }
                }))
            }
        });

        const result = await provider.evaluate(createRequest({
            calleeName: 'master',
            argumentCount: 1
        }));

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

    test('configured efun provider resolves project config snapshot only when workspaceRoot is explicitly provided', async () => {
        const projectConfigProvider = {
            getWorkspaceProjectConfig: jest.fn((workspaceRoot: string) => ({
                instanceResolutionFunctions: workspaceRoot === 'D:\\workspace'
                    ? { this_player: ['/adm/objects/player'] }
                    : undefined
            }))
        };
        const provider = new ConfiguredFunctionReturnProvider({
            projectConfigProvider
        });

        const result = await provider.evaluate(createRequest());

        expect(result).toEqual(
            configuredCandidateSetValue('configured-function-return:this_player', [
                objectValue(path.join('D:\\workspace', 'adm', 'objects', 'player.c'))
            ])
        );
        expect(projectConfigProvider.getWorkspaceProjectConfig).toHaveBeenCalledWith('D:\\workspace');
    });

    test('configured efun provider does not fall back to ambient workspace state when workspaceRoot is absent', async () => {
        const projectConfigProvider = {
            getWorkspaceProjectConfig: jest.fn(() => ({
                instanceResolutionFunctions: {
                    this_player: ['/adm/objects/player']
                }
            }))
        };
        const provider = new ConfiguredFunctionReturnProvider({
            projectConfigProvider
        });

        const result = await provider.evaluate(createRequest({
            workspaceRoot: undefined
        }));

        expect(result).toEqual(unknownValue());
        expect(projectConfigProvider.getWorkspaceProjectConfig).not.toHaveBeenCalled();
    });

    test('this_object() is outside the provider registry and remains a core builtin concern', async () => {
        const registry = new EnvironmentSemanticRegistry([
            new ConfiguredFunctionReturnProvider(),
            new RuntimeNonStaticProvider()
        ]);

        const result = await registry.evaluate(createRequest({
            calleeName: 'this_object'
        }));

        expect(result).toBeUndefined();
    });

    test('registry falls through from missing configured values to runtime non-static efuns', async () => {
        const registry = new EnvironmentSemanticRegistry([
            new ConfiguredFunctionReturnProvider(),
            new RuntimeNonStaticProvider()
        ]);

        const result = await registry.evaluate(createRequest({
            calleeName: 'environment'
        }));

        expect(result).toEqual(
            nonStaticValue('environment() depends on runtime object state')
        );
    });

    test('registry ignores unrelated calls that are absent from the config snapshot', async () => {
        const projectConfigProvider = {
            getWorkspaceProjectConfig: jest.fn(() => ({
                instanceResolutionFunctions: {
                    this_player: ['/adm/objects/player']
                }
            }))
        };
        const registry = new EnvironmentSemanticRegistry([
            new ConfiguredFunctionReturnProvider({
                projectConfigProvider
            }),
            new RuntimeNonStaticProvider()
        ]);

        const result = await registry.evaluate(createRequest({
            calleeName: 'plain_helper'
        }));

        expect(result).toBeUndefined();
        expect(projectConfigProvider.getWorkspaceProjectConfig).toHaveBeenCalledWith('D:\\workspace');
    });

    test('registry resolves custom project-configured function names through project config snapshot', async () => {
        const workspaceRoot = path.join(process.cwd(), '.tmp-environment-provider-config');
        const projectConfigProvider = {
            getWorkspaceProjectConfig: jest.fn(() => ({
                instanceResolutionFunctions: {
                    get_actor: ['/adm/objects/player']
                }
            }))
        };
        const registry = new EnvironmentSemanticRegistry([
            new ConfiguredFunctionReturnProvider({
                projectConfigProvider
            }),
            new RuntimeNonStaticProvider()
        ]);

        const result = await registry.evaluate(createRequest({
            workspaceRoot,
            document: createDocument(path.join(workspaceRoot, 'room', 'demo.c')),
            pathSupport: createPathSupport(workspaceRoot),
            calleeName: 'get_actor'
        }));

        expect(result).toEqual(
            configuredCandidateSetValue('configured-function-return:get_actor', [
                objectValue(path.join(workspaceRoot, 'adm', 'objects', 'player.c'))
            ])
        );
        expect(projectConfigProvider.getWorkspaceProjectConfig).toHaveBeenCalledWith(workspaceRoot);
    });

    test('configured provider does not treat object-array efuns as single object receivers', async () => {
        const registry = new EnvironmentSemanticRegistry([
            new ConfiguredFunctionReturnProvider({
                instanceResolutionFunctions: {
                    all_inventory: ['/obj/item']
                }
            }),
            new RuntimeNonStaticProvider()
        ]);

        const result = await registry.evaluate(createRequest({
            calleeName: 'all_inventory'
        }));

        expect(result).toEqual(
            nonStaticValue('all_inventory() depends on runtime object state')
        );
    });

    test('master() resolves from synced config.hell facts when explicit mapping is absent', async () => {
        const provider = new ConfiguredFunctionReturnProvider({
            projectConfigProvider: {
                getWorkspaceProjectConfig: jest.fn(() => ({
                    resolvedConfig: {
                        masterFile: '/adm/obj/master'
                    }
                }))
            }
        });

        const result = await provider.evaluate(createRequest({
            calleeName: 'master'
        }));

        expect(result).toEqual(
            configuredCandidateSetValue('configured-function-return:master', [
                objectValue(path.join('D:\\workspace', 'adm', 'obj', 'master.c'))
            ])
        );
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
