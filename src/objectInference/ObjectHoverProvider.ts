import * as vscode from 'vscode';
import { parseFunctionDocs } from '../efun/docParser';
import { ObjectInferenceService } from './ObjectInferenceService';

export class ObjectHoverProvider implements vscode.HoverProvider {
    public constructor(private readonly objectInferenceService: ObjectInferenceService) {}

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

        const resolvedDocs = await this.loadMethodDocs(inference.candidates.map((candidate) => candidate.path), memberName);
        if (resolvedDocs.length === 1 && inference.candidates.length === 1) {
            return this.createMethodHover(resolvedDocs[0].syntax, resolvedDocs[0].description);
        }

        if (resolvedDocs.length > 1 || inference.candidates.length > 1 || inference.status === 'multiple') {
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

    private async loadMethodDocs(paths: string[], memberName: string) {
        const docs: Array<{ path: string; syntax: string; description: string }> = [];

        for (const targetPath of paths) {
            const targetDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
            const methodDoc = parseFunctionDocs(targetDocument.getText(), '对象方法').get(memberName);
            if (!methodDoc) {
                continue;
            }

            docs.push({
                path: targetPath,
                syntax: methodDoc.syntax,
                description: methodDoc.description
            });
        }

        return docs;
    }

    private createMethodHover(syntax: string, description: string): vscode.Hover {
        const content = new vscode.MarkdownString();
        content.appendCodeblock(syntax, 'lpc');

        if (description) {
            content.appendMarkdown(`\n\n${description}`);
        }

        return new vscode.Hover(content);
    }

    private createMultipleCandidatesHover(memberName: string, paths: string[]): vscode.Hover {
        const content = new vscode.MarkdownString();
        const summary = paths.length > 0
            ? paths.map((path) => `\`${path}\``).join('、')
            : '多个对象';
        content.appendMarkdown(`可能来自多个对象的 \`${memberName}\`() 实现：${summary}`);
        return new vscode.Hover(content);
    }
}
