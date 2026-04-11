export interface LanguageDocument {
    uri: string;
    version: number;
    getText(): string;
}
