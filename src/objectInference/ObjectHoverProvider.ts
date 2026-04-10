import * as vscode from 'vscode';
import { MacroManager } from '../macroManager';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { parseFunctionDocs } from '../efun/docParser';
import { TargetMethodLookup } from '../targetMethodLookup';
import { ObjectInferenceService } from './ObjectInferenceService';

interface MethodDocResult {
    path: string;
    syntax: string;
    description: string;
    relatedCandidatePaths: string[];
}

export class ObjectHoverProvider implements vscode.HoverProvider {
    public constructor(
        private readonly objectInferenceService: ObjectInferenceService,
        macroManager?: MacroManager,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService
    ) {
        this.targetMethodLookup = targetMethodLookup ?? new TargetMethodLookup(macroManager, projectConfigService);
    }

    private readonly targetMethodLookup: TargetMethodLookup;

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        const objectAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (!objectAccess) {
            return undefined;
        }

        const { inference, memberName } = objectAccess;
        if (inference.status === 'unknown' || inference.status === 'unsupported') {
            return undefined;
        }

        if (!this.isHoveringMemberName(document, position, memberName)) {
            return undefined;
        }

        const resolvedDocs = await this.loadMethodDocsFromCandidates(
            document,
            inference.candidates.map((candidate) => candidate.path),
            memberName
        );
        if (resolvedDocs.length === 1 && resolvedDocs[0].relatedCandidatePaths.length === 1) {
            return this.createMethodHover(resolvedDocs[0].syntax, resolvedDocs[0].description);
        }

        if (resolvedDocs.length > 0) {
            return this.createResolvedCandidatesHover(resolvedDocs);
        }

        if (inference.candidates.length > 1 || inference.status === 'multiple') {
            return this.createMultipleCandidatesHover(memberName, inference.candidates.map((candidate) => candidate.path));
        }

        return undefined;
    }

    private isHoveringMemberName(
        document: vscode.TextDocument,
        position: vscode.Position,
        memberName: string
    ): boolean {
        const wordRange = document.getWordRangeAtPosition(position);
        return Boolean(wordRange) && document.getText(wordRange) === memberName;
    }

    private async loadMethodDocsFromCandidates(
        document: vscode.TextDocument,
        candidatePaths: string[],
        memberName: string
    ): Promise<MethodDocResult[]> {
        const docsByImplementationPath = new Map<string, MethodDocResult>();

        for (const candidatePath of candidatePaths) {
            const resolvedMethod = await this.targetMethodLookup.findMethod(document, candidatePath, memberName);
            if (!resolvedMethod) {
                continue;
            }

            const methodDoc = parseFunctionDocs(resolvedMethod.document.getText(), '对象方法').get(memberName);
            if (!methodDoc) {
                continue;
            }

            const existing = docsByImplementationPath.get(resolvedMethod.path);
            if (existing) {
                if (!existing.relatedCandidatePaths.includes(candidatePath)) {
                    existing.relatedCandidatePaths.push(candidatePath);
                }
                continue;
            }

            docsByImplementationPath.set(resolvedMethod.path, {
                path: resolvedMethod.path,
                syntax: methodDoc.syntax,
                description: methodDoc.description,
                relatedCandidatePaths: [candidatePath]
            });
        }

        return [...docsByImplementationPath.values()];
    }

    private createMethodHover(syntax: string, description: string): vscode.Hover {
        const content = new vscode.MarkdownString();
        content.appendCodeblock(syntax, 'lpc');

        if (description) {
            content.appendMarkdown(`\n\n${description}`);
        }

        return new vscode.Hover(content);
    }

    private createResolvedCandidatesHover(docs: MethodDocResult[]): vscode.Hover {
        const content = new vscode.MarkdownString();

        docs.forEach((doc, index) => {
            if (index > 0) {
                content.appendMarkdown('\n\n---\n\n');
            }

            content.appendMarkdown(`实现：\`${doc.path}\``);
            content.appendCodeblock(doc.syntax, 'lpc');

            if (doc.description) {
                content.appendMarkdown(`\n\n${doc.description}`);
            }

            const alternateCandidates = doc.relatedCandidatePaths.filter((candidatePath) => candidatePath !== doc.path);
            if (alternateCandidates.length > 0) {
                content.appendMarkdown(
                    `\n\n部分分支继续沿用该实现：${alternateCandidates.map((candidatePath) => `\`${candidatePath}\``).join('、')}`
                );
            }
        });

        return new vscode.Hover(content);
    }

    private createMultipleCandidatesHover(memberName: string, paths: string[]): vscode.Hover {
        const content = new vscode.MarkdownString();
        const summary = paths.length > 0
            ? paths.map((filePath) => `\`${filePath}\``).join('、')
            : '多个对象';
        content.appendMarkdown(`可能来自多个对象的 \`${memberName}\`() 实现：${summary}`);
        return new vscode.Hover(content);
    }
}
