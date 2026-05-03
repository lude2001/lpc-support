import * as vscode from 'vscode';
import { SymbolType } from '../../../ast/symbolTable';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import { CompletionCandidate, CompletionQueryResult, TypeDefinitionSummary } from '../../../completion/types';
import type { MacroManager } from '../../../macroManager';
import type { EfunDocsManager } from '../../../efun/EfunDocsManager';
import type { CallableDoc } from '../../documentation/types';
import { ScopedMethodCompletionSupport } from './ScopedMethodCompletionSupport';
import type { LanguageCompletionItem } from './LanguageCompletionService';
import { buildFunctionSnippet } from './completionSnippetUtils';

type PresentationEfunDocs = Pick<EfunDocsManager, 'getStandardCallableDoc' | 'getSimulatedDoc'>;
type PresentationMacroManager = Pick<MacroManager, 'getMacro' | 'getMacroHoverContent'>;
type ScopedDocumentationSupport = Pick<ScopedMethodCompletionSupport, 'applyScopedDocumentation'>;

export class CompletionItemPresentationService {
    constructor(
        private readonly efunDocsManager: PresentationEfunDocs,
        private readonly macroManager: PresentationMacroManager,
        private readonly projectSymbolIndex: ProjectSymbolIndex,
        private readonly scopedCompletionSupport: ScopedDocumentationSupport
    ) {}

    public createCompletionItem(
        candidate: CompletionCandidate,
        result: CompletionQueryResult,
        document: vscode.TextDocument
    ): LanguageCompletionItem {
        return {
            label: candidate.label,
            kind: this.mapCompletionKind(candidate.kind),
            detail: candidate.detail,
            sortText: `${this.getSortPrefix(candidate.sortGroup)}_${this.getCandidateSortBucket(candidate)}_${candidate.label}`,
            data: {
                candidate,
                context: result.context,
                documentUri: document.uri.toString(),
                documentVersion: document.version,
                resolved: false
            }
        };
    }

    public async resolveCompletionItem(
        item: LanguageCompletionItem,
        candidate: CompletionCandidate
    ): Promise<LanguageCompletionItem> {
        const resolvedItem: LanguageCompletionItem = {
            ...item
        };

        if (candidate.insertText) {
            resolvedItem.insertText = candidate.insertText;
        }

        switch (candidate.metadata.sourceType) {
            case 'efun':
                this.applyEfunDocumentation(resolvedItem, this.efunDocsManager.getStandardCallableDoc(candidate.label));
                break;
            case 'simul-efun':
                this.applyEfunDocumentation(resolvedItem, this.efunDocsManager.getSimulatedDoc(candidate.label));
                break;
            case 'macro':
                this.applyMacroDocumentation(resolvedItem, candidate.label);
                break;
            case 'scoped-method':
                return this.scopedCompletionSupport.applyScopedDocumentation(resolvedItem, candidate);
            case 'local':
            case 'inherited':
            case 'struct-member':
                this.applyStructuredDocumentation(resolvedItem, candidate);
                break;
            case 'keyword':
            default:
                this.applyKeywordDocumentation(resolvedItem, candidate);
                break;
        }

        return resolvedItem;
    }

    private mapCompletionKind(kind: vscode.CompletionItemKind): string {
        switch (kind) {
            case vscode.CompletionItemKind.Method:
                return 'method';
            case vscode.CompletionItemKind.Function:
                return 'function';
            case vscode.CompletionItemKind.Struct:
                return 'struct';
            case vscode.CompletionItemKind.Class:
                return 'class';
            case vscode.CompletionItemKind.Field:
                return 'field';
            case vscode.CompletionItemKind.Variable:
                return 'variable';
            case vscode.CompletionItemKind.Keyword:
                return 'keyword';
            default:
                return 'text';
        }
    }

    private getSortPrefix(group: CompletionCandidate['sortGroup']): string {
        switch (group) {
            case 'scope': return '0';
            case 'type-member': return '1';
            case 'inherited': return '2';
            case 'builtin': return '3';
            case 'keyword': return '4';
            default: return '9';
        }
    }

    private getCandidateSortBucket(candidate: CompletionCandidate): string {
        if (candidate.key.startsWith('object-member:shared:')) {
            return '0';
        }

        if (candidate.key.startsWith('object-member:specific:')) {
            return '1';
        }

        return '9';
    }

    private applyEfunDocumentation(item: LanguageCompletionItem, doc?: CallableDoc): void {
        if (!doc) {
            return;
        }

        const sections: string[] = [];
        const syntax = doc.signatures.map((signature) => signature.label).join('\n');
        if (syntax) {
            sections.push(`\`\`\`lpc\n${syntax}\n\`\`\``);
        }
        const returnType = deriveCallableReturnType(doc);
        if (returnType) {
            sections.push(`**Return Type:** \`${returnType}\``);
        }
        if (doc.summary) {
            sections.push(doc.summary);
        }
        if (doc.details) {
            sections.push(doc.details);
        }

        item.documentation = {
            kind: 'markdown',
            value: sections.join('\n\n')
        };
        item.detail = returnType ? `${returnType} ${item.label}` : item.detail;
        item.insertText = `${item.label}($1)`;
    }

    private applyMacroDocumentation(item: LanguageCompletionItem, macroName: string): void {
        const macro = this.macroManager.getMacro(macroName);
        if (!macro) {
            return;
        }

        const documentation = this.macroManager.getMacroHoverContent(macro);
        if (documentation) {
            item.documentation = {
                kind: 'markdown',
                value: documentation.value
            };
        }
    }

    private applyStructuredDocumentation(item: LanguageCompletionItem, candidate: CompletionCandidate): void {
        const sections: string[] = [];
        const record = candidate.metadata.sourceUri ? this.projectSymbolIndex.getRecord(candidate.metadata.sourceUri) : undefined;
        const symbol = candidate.metadata.symbol;
        const exportedFunction = record?.exportedFunctions.find(func => func.name === candidate.label);

        if (symbol?.definition) {
            sections.push(`\`\`\`lpc\n${symbol.definition}\n\`\`\``);
        } else if (exportedFunction?.definition) {
            sections.push(`\`\`\`lpc\n${exportedFunction.definition}\n\`\`\``);
        } else if (candidate.detail) {
            sections.push(`\`\`\`lpc\n${candidate.detail}\n\`\`\``);
        }

        if (symbol?.documentation) {
            sections.push(symbol.documentation);
        } else if (exportedFunction?.documentation) {
            sections.push(exportedFunction.documentation);
        }

        if (candidate.metadata.sourceType === 'inherited' && candidate.metadata.sourceUri) {
            sections.push(`*Inherited from* \`${vscode.Uri.parse(candidate.metadata.sourceUri).fsPath}\``);
        }

        if (candidate.metadata.sourceType === 'struct-member' && candidate.metadata.sourceUri) {
            const member = this.findMemberDefinition(candidate.label, record?.typeDefinitions || []);
            if (member?.definition) {
                sections.push(`**Member Definition**\n\`\`\`lpc\n${member.definition}\n\`\`\``);
            }
        }

        if (sections.length > 0) {
            item.documentation = {
                kind: 'markdown',
                value: sections.join('\n\n')
            };
        }

        if (symbol?.type === SymbolType.FUNCTION && symbol.parameters && symbol.parameters.length > 0) {
            item.insertText = buildFunctionSnippet(symbol.name, symbol.parameters.map(parameter => parameter.name));
        }

        if ((candidate.metadata.sourceType === 'local' || candidate.metadata.sourceType === 'inherited') && exportedFunction) {
            item.insertText = buildFunctionSnippet(
                exportedFunction.name,
                exportedFunction.parameters.map(parameter => parameter.name)
            );
        }
    }

    private applyKeywordDocumentation(item: LanguageCompletionItem, candidate: CompletionCandidate): void {
        item.documentation = {
            kind: 'markdown',
            value: `\`\`\`lpc\n${candidate.label}\n\`\`\`\n\n${candidate.detail}`
        };

        if (candidate.label === 'new') {
            item.insertText = 'new(${1:struct_type}${2:, ${3:field1}: ${4:value1}})';
        }
    }
    private findMemberDefinition(
        memberName: string,
        definitions: TypeDefinitionSummary[]
    ): TypeDefinitionSummary['members'][number] | undefined {
        for (const definition of definitions) {
            const member = definition.members.find(candidate => candidate.name === memberName);
            if (member) {
                return member;
            }
        }

        return undefined;
    }
}

function deriveCallableReturnType(doc: CallableDoc): string | undefined {
    if (doc.signatures.length === 0) {
        return undefined;
    }

    if (doc.signatures.length === 1) {
        return doc.signatures[0].returnType;
    }

    const returnTypes = doc.signatures.map((signature) => signature.returnType?.trim()).filter(Boolean);
    if (returnTypes.length !== doc.signatures.length) {
        return undefined;
    }

    const [firstReturnType, ...restReturnTypes] = returnTypes;
    return restReturnTypes.every((returnType) => returnType === firstReturnType)
        ? firstReturnType
        : undefined;
}
