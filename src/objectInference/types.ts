export type ObjectCandidateSource = 'literal' | 'macro' | 'builtin-call' | 'assignment' | 'doc';

export type ObjectInferenceStatus = 'resolved' | 'multiple' | 'unknown' | 'unsupported';

export type ObjectInferenceReason = 'unsupported-expression';

export type ObjectInferenceDiagnosticCode = 'missing-return-annotation';

export interface MissingReturnAnnotationDiagnostic {
    code: 'missing-return-annotation';
    methodName: string;
}

export type ObjectInferenceDiagnostic = MissingReturnAnnotationDiagnostic;

export interface ObjectCandidate {
    path: string;
    source: ObjectCandidateSource;
}

export interface ObjectInferenceResult {
    status: ObjectInferenceStatus;
    candidates: ObjectCandidate[];
    reason?: ObjectInferenceReason;
    diagnostics?: ObjectInferenceDiagnostic[];
}

export type ClassifiedReceiver =
    | { kind: 'literal'; expression: string; nodeText: string }
    | { kind: 'macro'; expression: string; nodeText: string }
    | { kind: 'identifier'; expression: string; nodeText: string }
    | {
        kind: 'call';
        calleeName: string;
        argumentCount: number;
        firstArgument?: string;
        unsupportedReason?: ObjectInferenceReason;
        nodeText: string;
    }
    | { kind: 'index'; reason: ObjectInferenceReason; nodeText: string }
    | { kind: 'unsupported'; reason: ObjectInferenceReason; nodeText: string };

export interface InferredObjectAccess {
    receiver: string;
    memberName: string;
    inference: ObjectInferenceResult;
}
