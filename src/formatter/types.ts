export interface FormatterConfig {
    indentSize: number;
}

export interface FormatterConfigSnapshot extends FormatterConfig {}

export type FormatTargetKind = 'document' | 'node' | 'heredoc-body' | 'array-delimiter-body';

export interface FormatTarget {
    kind: FormatTargetKind;
    range: import('vscode').Range;
    node?: unknown;
}
