import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageDiagnostic } from '../diagnostics/LanguageDiagnosticsService';
import type { LanguageRange, LanguagePosition } from '../../contracts/LanguagePosition';
import type { LanguageWorkspaceEdit, LanguageTextEdit } from '../navigation/LanguageRenameService';

export interface LanguageCodeActionCommand {
    title: string;
    command: string;
    arguments?: unknown[];
}

export interface LanguageCodeAction {
    title: string;
    kind?: string;
    diagnostics?: LanguageDiagnostic[];
    edit?: LanguageWorkspaceEdit;
    command?: LanguageCodeActionCommand;
    isPreferred?: boolean;
}

export interface LanguageCodeActionRequest {
    context: LanguageCapabilityContext;
    range: LanguageRange;
    diagnostics: LanguageDiagnostic[];
    only?: readonly string[];
}

export interface LanguageCodeActionService {
    provideCodeActions(request: LanguageCodeActionRequest): Promise<LanguageCodeAction[]>;
}

export interface RangeReadableDocument {
    uri: string;
    getText(range?: LanguageRange): string;
    lineAt(lineOrPosition: number | { line: number }): {
        text: string;
        range?: LanguageRange;
        rangeIncludingLineBreak?: LanguageRange;
    };
    positionAt(offset: number): LanguagePosition;
}

export type DiagnosticWithOffsets = LanguageDiagnostic & {
    data?: {
        start?: number;
        end?: number;
    };
};

export const LANGUAGE_CODE_ACTION_KIND_QUICKFIX = 'quickfix';
export const UNUSED_VAR_DIAGNOSTIC_CODE = 'unusedVar';
export const UNUSED_PARAM_DIAGNOSTIC_CODE = 'unusedParam';
export const UNUSED_GLOBAL_VAR_DIAGNOSTIC_CODE = 'unusedGlobalVar';
export const LOCAL_VARIABLE_POSITION_DIAGNOSTIC_CODE = 'localVariableDeclarationPosition';

export type { LanguageWorkspaceEdit, LanguageTextEdit, LanguageDiagnostic, LanguageRange, LanguagePosition };
