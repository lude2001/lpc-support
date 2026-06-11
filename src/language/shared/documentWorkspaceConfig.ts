import type { LanguageWorkspaceProjectConfig } from '../contracts/LanguageWorkspaceContext';

const DOCUMENT_WORKSPACE_PROJECT_CONFIG_KEY = '__lpcWorkspaceProjectConfig';

type DocumentWithWorkspaceProjectConfig = object & {
    [DOCUMENT_WORKSPACE_PROJECT_CONFIG_KEY]?: LanguageWorkspaceProjectConfig;
};

export function attachDocumentWorkspaceProjectConfig<T extends object>(
    document: T,
    projectConfig: LanguageWorkspaceProjectConfig | undefined
): T {
    if (!projectConfig) {
        return document;
    }

    Object.defineProperty(document, DOCUMENT_WORKSPACE_PROJECT_CONFIG_KEY, {
        configurable: true,
        enumerable: false,
        value: projectConfig,
        writable: false
    });
    return document;
}

export function getDocumentWorkspaceProjectConfig(
    document: object | undefined
): LanguageWorkspaceProjectConfig | undefined {
    return (document as DocumentWithWorkspaceProjectConfig | undefined)?.[DOCUMENT_WORKSPACE_PROJECT_CONFIG_KEY];
}
