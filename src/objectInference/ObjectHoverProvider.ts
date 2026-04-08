import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ASTManager } from '../ast/astManager';
import { MacroManager } from '../macroManager';
import { parseFunctionDocs } from '../efun/docParser';
import { ObjectInferenceService } from './ObjectInferenceService';

interface MethodDocResult {
    path: string;
    syntax: string;
    description: string;
}

export class ObjectHoverProvider implements vscode.HoverProvider {
    private readonly astManager = ASTManager.getInstance();

    public constructor(
        private readonly objectInferenceService: ObjectInferenceService,
        private readonly macroManager?: MacroManager
    ) {}

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

        const resolvedDocs = await this.loadMethodDocsFromCandidates(inference.candidates.map((c) => c.path), memberName);
        if (resolvedDocs.length === 1) {
            return this.createMethodHover(resolvedDocs[0].syntax, resolvedDocs[0].description);
        }

        if (resolvedDocs.length > 1 || inference.candidates.length > 1 || inference.status === 'multiple') {
            return this.createMultipleCandidatesHover(memberName, inference.candidates.map((c) => c.path));
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

    private async loadMethodDocsFromCandidates(paths: string[], memberName: string): Promise<MethodDocResult[]> {
        const results: MethodDocResult[] = [];
        const seenPaths = new Set<string>();

        for (const candidatePath of paths) {
            const docs = await this.findMethodDocsInChain(candidatePath, memberName, new Set<string>());
            for (const doc of docs) {
                if (seenPaths.has(doc.path)) {
                    continue;
                }
                seenPaths.add(doc.path);
                results.push(doc);
            }
        }

        return results;
    }

    private async findMethodDocsInChain(
        targetPath: string,
        memberName: string,
        visited: Set<string>
    ): Promise<MethodDocResult[]> {
        if (visited.has(targetPath)) {
            return [];
        }
        visited.add(targetPath);

        let targetDocument: vscode.TextDocument;
        try {
            targetDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
        } catch {
            return [];
        }

        const methodDoc = parseFunctionDocs(targetDocument.getText(), '对象方法').get(memberName);
        if (methodDoc) {
            return [{ path: targetPath, syntax: methodDoc.syntax, description: methodDoc.description }];
        }

        const snapshot = this.astManager.getSemanticSnapshot(targetDocument, true);
        if (!snapshot) {
            return [];
        }

        for (const inheritStatement of snapshot.inheritStatements) {
            const inheritedPath = this.resolveInheritedFilePath(targetDocument, inheritStatement.value);
            if (!inheritedPath || !fs.existsSync(inheritedPath)) {
                continue;
            }

            const inheritedDocs = await this.findMethodDocsInChain(inheritedPath, memberName, visited);
            if (inheritedDocs.length > 0) {
                return inheritedDocs;
            }
        }

        return [];
    }

    private resolveInheritedFilePath(document: vscode.TextDocument, inheritValue: string): string | undefined {
        let resolvedValue = inheritValue;

        if (/^[A-Z_][A-Z0-9_]*$/.test(resolvedValue)) {
            const macro = this.macroManager?.getMacro(resolvedValue);
            if (!macro?.value) {
                return undefined;
            }

            resolvedValue = macro.value.replace(/^"(.*)"$/, '$1');
        }

        if (!resolvedValue.endsWith('.c')) {
            resolvedValue = `${resolvedValue}.c`;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return path.join(workspaceFolder.uri.fsPath, resolvedValue.substring(1));
        }

        return path.resolve(path.dirname(document.uri.fsPath), resolvedValue);
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
            ? paths.map((p) => `\`${p}\``).join('、')
            : '多个对象';
        content.appendMarkdown(`可能来自多个对象的 \`${memberName}\`() 实现：${summary}`);
        return new vscode.Hover(content);
    }
}
