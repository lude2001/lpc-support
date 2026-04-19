import { FunctionDocumentationService } from './FunctionDocumentationService';

export function assertDocumentationService(
    owner: string,
    documentationService: FunctionDocumentationService | undefined
): FunctionDocumentationService {
    if (!documentationService) {
        throw new Error(`${owner} requires an injected FunctionDocumentationService`);
    }

    return documentationService;
}
