export type ObjectCandidateSource = 'literal' | 'macro' | 'builtin-call' | 'assignment' | 'doc';

export type ObjectInferenceStatus = 'resolved' | 'multiple' | 'unknown' | 'unsupported';

export interface ObjectCandidate {
    path: string;
    source: ObjectCandidateSource;
}

export interface ObjectInferenceResult {
    status: ObjectInferenceStatus;
    candidates: ObjectCandidate[];
    reason?: 'array-element' | 'unsupported-expression';
}

export type ClassifiedReceiver =
    | { kind: 'literal'; expression: string; nodeText: string }
    | { kind: 'macro'; expression: string; nodeText: string }
    | { kind: 'identifier'; expression: string; nodeText: string }
    | { kind: 'call'; calleeName: string; firstArgument?: string; nodeText: string }
    | { kind: 'index'; nodeText: string }
    | { kind: 'unsupported'; reason: 'unsupported-expression'; nodeText: string };

export interface InferredObjectAccess {
    receiver: string;
    memberName: string;
    inference: ObjectInferenceResult;
}
