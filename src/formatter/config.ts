import * as vscode from 'vscode';
import { FormatterConfigSnapshot } from './types';

const DEFAULT_INDENT_SIZE = 4;

export function getFormatterConfig(): FormatterConfigSnapshot {
    const configuration = vscode.workspace.getConfiguration();

    return {
        indentSize: configuration.get<number>('lpc.format.indentSize', DEFAULT_INDENT_SIZE)
    };
}
