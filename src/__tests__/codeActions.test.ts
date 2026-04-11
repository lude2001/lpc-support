import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { registerLpcCodeActionCommands } from '../codeActions';

describe('registerLpcCodeActionCommands', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('registers rename and Javadoc commands only once', () => {
        registerLpcCodeActionCommands();
        registerLpcCodeActionCommands();

        expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(3);
        expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
            1,
            'lpc.renameVarToSnakeCase',
            expect.any(Function)
        );
        expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
            2,
            'lpc.renameVarToCamelCase',
            expect.any(Function)
        );
        expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
            3,
            'lpc.generateJavadoc',
            expect.any(Function)
        );
    });
});
