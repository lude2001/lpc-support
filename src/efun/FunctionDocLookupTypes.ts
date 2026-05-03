import type { CallableDoc, CallableSourceKind, DocumentCallableDocs } from '../language/documentation/types';

export interface FunctionDocSourceGroup {
    source: string;
    filePath: string;
    docs: Map<string, CallableDoc>;
}

export interface FunctionDocLookup {
    currentFile: FunctionDocSourceGroup;
    inheritedGroups: FunctionDocSourceGroup[];
    includeGroups: FunctionDocSourceGroup[];
}

export interface RawFunctionDocSource {
    source: string;
    filePath: string;
    sourceKind: CallableSourceKind;
    docs: DocumentCallableDocs;
}

export interface RawFunctionDocLookup {
    inheritedFiles: string[];
    currentFile: RawFunctionDocSource;
    inheritedGroups: RawFunctionDocSource[];
    includeGroups: RawFunctionDocSource[];
}

export interface MaterializedFunctionDocLookup {
    inheritedFiles: string[];
    currentFileDocs: Map<string, CallableDoc>;
    inheritedFileDocs: Map<string, Map<string, CallableDoc>>;
    includeFileDocs: Map<string, Map<string, CallableDoc>>;
    lookup: FunctionDocLookup;
}
