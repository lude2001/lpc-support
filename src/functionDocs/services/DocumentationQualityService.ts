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
                message: '缺少简要说明。'
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
                        message: `参数 ${parameter.name} 缺少说明。`
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
                message: '缺少返回值说明。'
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
            return `参数 ${parameterName ?? '未知'} 存在重复标签。`;
        case 'stale-parameter-name':
            return `文档中的参数 ${parameterName ?? '未知'} 已不在函数签名中。`;
        case 'duplicate-return-tag':
            return '存在重复的返回值标签。';
        default:
            return '存在无法关联到函数签名的参数标签。';
    }
}
