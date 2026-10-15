import type { Position, Range, Location } from 'vscode-languageserver-protocol';

export const ANALYSIS_INSPECTION_METHOD = 'lpc/analysisInspection';

export interface AnalysisInspectionRequest {
    textDocument: { uri: string };
    position: Position;
}

export interface AnalysisInspection {
    uri: string;
    version: number;
    revision: number;
    preprocessedText: string;
    inactiveRanges: Range[];
    macros: Array<{ name: string; kind: 'define' | 'undef'; value: string | null; range: Range }>;
    initialMacros: Record<string, string>;
    analysis: {
        dependencies: Array<{ path: string; kind: string; targets: string[] }>;
        dependenciesComplete: boolean;
        symbol: {
            name: string;
            status: string;
            definitions: Location[];
            macroValue: string | null;
        } | null;
    } | null;
}
