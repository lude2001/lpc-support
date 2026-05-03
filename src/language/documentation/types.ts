export interface DocumentPosition {
    line: number;
    character: number;
}

export interface DocumentRange {
    start: DocumentPosition;
    end: DocumentPosition;
}

export interface AttachedDocComment {
    kind: 'javadoc';
    range: DocumentRange;
    text: string;
}

export type CallableSourceKind =
    | 'local'
    | 'inherit'
    | 'include'
    | 'simulEfun'
    | 'efun'
    | 'objectMethod'
    | 'scopedMethod';

export type CallableReturnObjects = string[];

export interface CallableParameter {
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    variadic?: boolean;
    defaultValueText?: string;
}

export interface CallableSignature {
    label: string;
    returnType?: string;
    parameters: CallableParameter[];
    isVariadic: boolean;
    rawSyntax?: string;
}

export interface CallableReturnDoc {
    type?: string;
    description?: string;
}

export interface CallableDoc {
    name: string;
    declarationKey: string;
    signatures: CallableSignature[];
    summary?: string;
    details?: string;
    note?: string;
    returns?: CallableReturnDoc;
    /**
     * Fallback-only object hint.
     *
     * Consumers must prefer natural semantic evaluation and environment providers
     * whenever they produce a non-unknown result.
     */
    returnObjects?: CallableReturnObjects;
    sourceKind: CallableSourceKind;
    sourcePath?: string;
    sourceRange?: DocumentRange;
}

export interface DocumentCallableDocs {
    uri: string;
    declarationOrder: string[];
    byDeclaration: Map<string, CallableDoc>;
    byName: Map<string, string[]>;
}
