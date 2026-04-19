import type { DocumentCallableDocs } from '../language/documentation/types';
import type { EfunDoc } from './types';

export interface FunctionDocSourceGroup {
    source: string;
    filePath: string;
    docs: Map<string, EfunDoc>;
}

export interface FunctionDocLookup {
    currentFile: FunctionDocSourceGroup;
    inheritedGroups: FunctionDocSourceGroup[];
    includeGroups: FunctionDocSourceGroup[];
}

export interface RawFunctionDocSource {
    source: string;
    filePath: string;
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
    currentFileDocs: Map<string, EfunDoc>;
    inheritedFileDocs: Map<string, Map<string, EfunDoc>>;
    includeFileDocs: Map<string, Map<string, EfunDoc>>;
    lookup: FunctionDocLookup;
}
