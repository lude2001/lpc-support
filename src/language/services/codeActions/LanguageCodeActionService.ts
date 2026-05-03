import { CodeActionDocumentSupport } from './CodeActionDocumentSupport';
import { UnusedVariableCodeActionBuilder } from './UnusedVariableCodeActionBuilder';
import { VariablePositionCodeActionBuilder } from './VariablePositionCodeActionBuilder';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { SyntaxDocument } from '../../../syntax/types';
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

type CodeActionAnalysisService = Pick<DocumentAnalysisService, 'getSyntaxDocument'>;

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

    public constructor(private readonly analysisService?: CodeActionAnalysisService) {}

    public async provideCodeActions(request: LanguageCodeActionRequest): Promise<LanguageCodeAction[]> {
        if (request.only && request.only.length > 0 && !request.only.includes(LANGUAGE_CODE_ACTION_KIND_QUICKFIX)) {
            return [];
        }

        const document = request.context.document as unknown as RangeReadableDocument;
        const syntax = this.getSyntaxDocument(request.context.document);
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
                actions.push(...this.variablePositionBuilder.build(document, diagnostic, syntax));
            }
        }

        return actions;
    }

    private getSyntaxDocument(document: LanguageCodeActionRequest['context']['document']): SyntaxDocument | undefined {
        if (!this.analysisService) {
            return undefined;
        }

        return this.analysisService.getSyntaxDocument(document as unknown as Parameters<CodeActionAnalysisService['getSyntaxDocument']>[0], false)
            ?? this.analysisService.getSyntaxDocument(document as unknown as Parameters<CodeActionAnalysisService['getSyntaxDocument']>[0], true);
    }
}

export function createLanguageCodeActionService(analysisService?: CodeActionAnalysisService): LanguageCodeActionService {
    return new DefaultLanguageCodeActionService(analysisService);
}
