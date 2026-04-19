import type { CallableDoc, DocumentCallableDocs, DocumentRange } from './types';

export function cloneDocumentCallableDocs(documentDocs: DocumentCallableDocs): DocumentCallableDocs {
    return {
        uri: documentDocs.uri,
        declarationOrder: [...documentDocs.declarationOrder],
        byDeclaration: new Map(
            Array.from(documentDocs.byDeclaration.entries(), ([declarationKey, callableDoc]) => [
                declarationKey,
                cloneCallableDoc(callableDoc)
            ])
        ),
        byName: new Map(
            Array.from(documentDocs.byName.entries(), ([name, declarationKeys]) => [
                name,
                [...declarationKeys]
            ])
        )
    };
}

export function cloneCallableDoc(callableDoc: CallableDoc): CallableDoc {
    return {
        ...callableDoc,
        signatures: callableDoc.signatures.map((signature) => ({
            ...signature,
            parameters: signature.parameters.map((parameter) => ({ ...parameter }))
        })),
        returns: callableDoc.returns ? { ...callableDoc.returns } : undefined,
        returnObjects: callableDoc.returnObjects ? [...callableDoc.returnObjects] : undefined,
        sourceRange: callableDoc.sourceRange ? cloneDocumentRange(callableDoc.sourceRange) : undefined
    };
}

function cloneDocumentRange(range: DocumentRange): DocumentRange {
    return {
        start: { ...range.start },
        end: { ...range.end }
    };
}
