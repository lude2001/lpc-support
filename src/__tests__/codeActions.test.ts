import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { createLpcCodeActionCommandHandlers } from '../codeActions';

describe('createLpcCodeActionCommandHandlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns rename and Javadoc handlers without registering commands directly', () => {
        const handlers = createLpcCodeActionCommandHandlers({
            getSyntaxDocument: jest.fn()
        });

        expect(handlers.map(handler => handler.id)).toEqual([
            'lpc.renameVarToSnakeCase',
            'lpc.renameVarToCamelCase',
            'lpc.generateJavadoc'
        ]);
        expect(handlers.every(handler => typeof handler.handler === 'function')).toBe(true);
        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
    });
});
