import type { CallableDoc, CallableSourceKind, DocumentCallableDocs } from '../language/documentation/types';

export interface FunctionDocSourceGroup {
    source: string;
    filePath: string;
    sourceKind: CallableSourceKind;
    entries: CallableDoc[];
    docs: Map<string, CallableDoc>;
    depth?: number;
    parentFilePath?: string;
}

export interface FunctionDocLookup {
    currentFile: FunctionDocSourceGroup;
    inheritedGroups: FunctionDocSourceGroup[];
    includeGroups: FunctionDocSourceGroup[];
    diagnostics?: FunctionDocLookupDiagnostic[];
}

export interface FunctionDocLookupDiagnostic {
    stage: 'inheritance' | 'include' | 'analysis';
    code:
        | 'inherit-target-unresolved'
        | 'include-target-unresolved'
        | 'dependency-open-failed'
        | 'dependency-analysis-failed'
        | 'inherit-cycle'
        | 'include-cycle'
        | 'analysis-cancelled';
    sourceFilePath: string;
    target: string;
    message: string;
}

export interface RawFunctionDocSource {
    source: string;
    filePath: string;
    sourceKind: CallableSourceKind;
    docs: DocumentCallableDocs;
    depth?: number;
    parentFilePath?: string;
}

export interface RawFunctionDocLookup {
    inheritedFiles: string[];
    currentFile: RawFunctionDocSource;
    inheritedGroups: RawFunctionDocSource[];
    includeGroups: RawFunctionDocSource[];
    diagnostics?: FunctionDocLookupDiagnostic[];
}

export interface MaterializedFunctionDocLookup {
    inheritedFiles: string[];
    currentFileDocs: Map<string, CallableDoc>;
    inheritedFileDocs: Map<string, Map<string, CallableDoc>>;
    includeFileDocs: Map<string, Map<string, CallableDoc>>;
    lookup: FunctionDocLookup;
    diagnostics?: FunctionDocLookupDiagnostic[];
}
