export type LanguageMarkupKind = 'markdown' | 'plaintext';

export interface LanguageMarkupContent {
    kind: LanguageMarkupKind;
    value: string;
}
