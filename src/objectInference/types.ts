export type ObjectCandidateSource = 'literal' | 'macro' | 'builtin-call' | 'assignment' | 'doc';

export type ObjectInferenceStatus = 'resolved' | 'multiple' | 'unknown' | 'unsupported';

export type ObjectInferenceReason = 'array-element' | 'unsupported-expression';

export interface ObjectCandidate {
    path: string;
    source: ObjectCandidateSource;
}

export interface ObjectInferenceResult {
    status: ObjectInferenceStatus;
    candidates: ObjectCandidate[];
    reason?: ObjectInferenceReason;
}

export type ClassifiedReceiver =
    | { kind: 'literal'; expression: string; nodeText: string }
    | { kind: 'macro'; expression: string; nodeText: string }
    | { kind: 'identifier'; expression: string; nodeText: string }
    | { kind: 'call'; calleeName: string; firstArgument?: string; nodeText: string }
    | { kind: 'index'; reason: ObjectInferenceReason; nodeText: string }
    | { kind: 'unsupported'; reason: ObjectInferenceReason; nodeText: string };

export interface InferredObjectAccess {
    receiver: string;
    memberName: string;
    inference: ObjectInferenceResult;
}
