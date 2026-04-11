export interface LanguagePosition {
    line: number;
    character: number;
}

export interface LanguageRange {
    start: LanguagePosition;
    end: LanguagePosition;
}

export interface LanguageLocation {
    uri: string;
    range: LanguageRange;
}
