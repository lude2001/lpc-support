import { CodeActionDocumentSupport } from './CodeActionDocumentSupport';
import { UnusedVariableCodeActionBuilder } from './UnusedVariableCodeActionBuilder';
import { VariablePositionCodeActionBuilder } from './VariablePositionCodeActionBuilder';
import {
    LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
    LOCAL_VARIABLE_POSITION_DIAGNOSTIC_CODE,
    UNUSED_GLOBAL_VAR_DIAGNOSTIC_CODE,
    UNUSED_PARAM_DIAGNOSTIC_CODE,
    UNUSED_VAR_DIAGNOSTIC_CODE,
    type LanguageCodeAction,
    type LanguageCodeActionRequest,
    type LanguageCodeActionService,
    type RangeReadableDocument
} from './types';

export {
    LANGUAGE_CODE_ACTION_KIND_QUICKFIX,
    LOCAL_VARIABLE_POSITION_DIAGNOSTIC_CODE,
    UNUSED_GLOBAL_VAR_DIAGNOSTIC_CODE,
    UNUSED_PARAM_DIAGNOSTIC_CODE,
    UNUSED_VAR_DIAGNOSTIC_CODE
} from './types';
export type {
    LanguageCodeAction,
    LanguageCodeActionCommand,
    LanguageCodeActionRequest,
    LanguageCodeActionService
} from './types';

class DefaultLanguageCodeActionService implements LanguageCodeActionService {
    private readonly unusedVariableBuilder = new UnusedVariableCodeActionBuilder(new CodeActionDocumentSupport());
    private readonly variablePositionBuilder = new VariablePositionCodeActionBuilder(new CodeActionDocumentSupport());

    public async provideCodeActions(request: LanguageCodeActionRequest): Promise<LanguageCodeAction[]> {
        if (request.only && request.only.length > 0 && !request.only.includes(LANGUAGE_CODE_ACTION_KIND_QUICKFIX)) {
            return [];
        }

        const document = request.context.document as unknown as RangeReadableDocument;
        const actions: LanguageCodeAction[] = [];

        for (const diagnostic of request.diagnostics) {
            const code = diagnostic.code?.toString();

            if (
                code === UNUSED_VAR_DIAGNOSTIC_CODE
                || code === UNUSED_PARAM_DIAGNOSTIC_CODE
                || code === UNUSED_GLOBAL_VAR_DIAGNOSTIC_CODE
            ) {
                actions.push(...this.unusedVariableBuilder.build(document, diagnostic));
            }

            if (code === LOCAL_VARIABLE_POSITION_DIAGNOSTIC_CODE) {
                actions.push(...this.variablePositionBuilder.build(document, diagnostic));
            }
        }

        return actions;
    }
}

export function createLanguageCodeActionService(): LanguageCodeActionService {
    return new DefaultLanguageCodeActionService();
}
