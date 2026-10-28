import * as vscode from 'vscode';
import type { CallableDoc } from '../../language/documentation/types';
import type {
    PanelDocumentationIssue,
    PanelDocumentationQuality
} from '../contracts/FunctionDocumentationPanelProtocol';

export class DocumentationQualityService {
    public analyze(doc: CallableDoc, options: { onlyDeclaration?: boolean } = {}): PanelDocumentationQuality {
        if (doc.declarationKind === 'external' && doc.sourceKind !== 'simulEfun') {
            return { status: 'notApplicable', issues: [], action: 'none' };
        }
        if (doc.declarationKind === 'prototype' && !doc.attachedCommentRange && options.onlyDeclaration !== true) {
            return { status: 'notApplicable', issues: [], action: 'none' };
        }

        const issues: PanelDocumentationIssue[] = [];
        for (const issue of doc.documentationIssues ?? []) {
            issues.push({
                ...issue,
                message: getConsistencyIssueMessage(issue.code, issue.parameterName)
            });
        }
        if (!doc.summary?.trim()) {
            issues.push({
                code: 'missing-summary',
                message: vscode.l10n.t('Missing summary.')
            });
        }

        const seenParameters = new Set<string>();
        for (const signature of doc.signatures) {
            for (const parameter of signature.parameters) {
                if (seenParameters.has(parameter.name)) {
                    continue;
                }
                seenParameters.add(parameter.name);
                if (!parameter.description?.trim()) {
                    issues.push({
                        code: 'missing-param-description',
                        parameterName: parameter.name,
                        message: vscode.l10n.t('Parameter {0} has no description.', parameter.name)
                    });
                }
            }
        }

        const returnTypes = doc.signatures
            .map((signature) => signature.returnType?.trim())
            .filter((value): value is string => Boolean(value));
        if (returnTypes.some((returnType) => returnType !== 'void') && !doc.returns?.description?.trim()) {
            issues.push({
                code: 'missing-return-description',
                message: vscode.l10n.t('Missing return value description.')
            });
        }

        if (issues.length === 0) {
            return { status: 'complete', issues, action: 'none' };
        }

        if (doc.documentationIssues && doc.documentationIssues.length > 0) {
            return { status: 'inconsistent', issues, action: 'update' };
        }

        return {
            status: 'incomplete',
            issues,
            action: doc.attachedCommentRange ? 'complete' : 'generate'
        };
    }
}

function getConsistencyIssueMessage(code: string, parameterName?: string): string {
    switch (code) {
        case 'duplicate-param-tag':
            return vscode.l10n.t('Parameter {0} has duplicate tags.', parameterName ?? vscode.l10n.t('Unknown'));
        case 'stale-parameter-name':
            return vscode.l10n.t('Documented parameter {0} is no longer in the function signature.', parameterName ?? vscode.l10n.t('Unknown'));
        case 'duplicate-return-tag':
            return vscode.l10n.t('Duplicate return value tags.');
        default:
            return vscode.l10n.t('Some parameter tags cannot be matched to the function signature.');
    }
}
