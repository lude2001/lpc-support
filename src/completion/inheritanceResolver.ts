import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MacroManager } from '../macroManager';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { ResolvedInheritTarget } from './types';

export interface InheritanceIndexView {
    getResolvedInheritTargets(uri: string): ResolvedInheritTarget[];
}

type MacroLookup = Pick<MacroManager, 'getMacro' | 'getIncludePath'>;
type InheritanceSnapshot = Pick<SemanticSnapshot, 'uri' | 'inheritStatements'>;

export class InheritanceResolver {
    private readonly macroManager?: MacroLookup;
    private readonly workspaceRoots?: string[];
    private indexView?: InheritanceIndexView;

    constructor(macroManager?: MacroLookup, workspaceRoots?: string[]) {
        this.macroManager = macroManager;
        this.workspaceRoots = workspaceRoots;
    }

    public attachIndex(indexView: InheritanceIndexView): void {
        this.indexView = indexView;
    }

    public resolveInheritTargets(snapshot: InheritanceSnapshot): ResolvedInheritTarget[] {
        return snapshot.inheritStatements.map(statement => {
            const resolvedPath = this.resolveDirectivePath(snapshot.uri, statement.value, statement.expressionKind);

            return {
                rawValue: statement.value,
                expressionKind: statement.expressionKind,
                sourceUri: snapshot.uri,
                resolvedUri: resolvedPath ? vscode.Uri.file(resolvedPath).toString() : undefined,
                isResolved: !!resolvedPath
            };
        });
    }

    public getInheritanceChain(uri: string | vscode.Uri): string[] {
        const sourceUri = typeof uri === 'string' ? uri : uri.toString();
        const chain: string[] = [];
        const visited = new Set<string>([sourceUri]);

        const traverse = (currentUri: string): void => {
            const targets = this.indexView?.getResolvedInheritTargets(currentUri) || [];

            for (const target of targets) {
                if (!target.resolvedUri || visited.has(target.resolvedUri)) {
                    continue;
                }

                visited.add(target.resolvedUri);
                chain.push(target.resolvedUri);
                traverse(target.resolvedUri);
            }
        };

        traverse(sourceUri);
        return chain;
    }

    private resolveDirectivePath(
        sourceUri: string,
        directiveValue: string,
        expressionKind: ResolvedInheritTarget['expressionKind']
    ): string | undefined {
        const resolvedValue = this.resolveDirectiveValue(directiveValue, expressionKind);
        if (!resolvedValue) {
            return undefined;
        }

        const normalizedFile = this.ensureFileExtension(resolvedValue);
        const sourcePath = vscode.Uri.parse(sourceUri).fsPath;
        const workspaceRoots = this.getWorkspaceRoots(sourcePath);
        const candidates = new Set<string>();

        if (path.isAbsolute(normalizedFile) || normalizedFile.startsWith('/')) {
            const relativePath = normalizedFile.replace(/^\/+/, '');
            for (const workspaceRoot of workspaceRoots) {
                candidates.add(path.normalize(path.join(workspaceRoot, relativePath)));
            }
            candidates.add(path.normalize(normalizedFile));
        } else {
            candidates.add(path.normalize(path.join(path.dirname(sourcePath), normalizedFile)));

            for (const workspaceRoot of workspaceRoots) {
                candidates.add(path.normalize(path.join(workspaceRoot, normalizedFile)));
                candidates.add(path.normalize(path.resolve(workspaceRoot, normalizedFile)));
            }

            const includePath = this.macroManager?.getIncludePath?.();
            if (includePath) {
                candidates.add(path.normalize(path.join(includePath, normalizedFile)));
            }
        }

        return Array.from(candidates).find(candidate => fs.existsSync(candidate));
    }

    private resolveDirectiveValue(
        directiveValue: string,
        expressionKind: ResolvedInheritTarget['expressionKind']
    ): string | undefined {
        if (expressionKind === 'macro') {
            const macroValue = this.macroManager?.getMacro(directiveValue)?.value;
            if (!macroValue) {
                return undefined;
            }

            return this.stripQuotes(macroValue.trim());
        }

        return this.stripQuotes(directiveValue.trim());
    }

    private ensureFileExtension(filePath: string): string {
        return filePath.endsWith('.c') ? filePath : `${filePath}.c`;
    }

    private getWorkspaceRoots(sourcePath: string): string[] {
        if (this.workspaceRoots && this.workspaceRoots.length > 0) {
            return this.workspaceRoots;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const folderForSource = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(sourcePath));

        if (folderForSource) {
            return [folderForSource.uri.fsPath];
        }

        return workspaceFolders.map(folder => folder.uri.fsPath);
    }

    private stripQuotes(value: string): string {
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
            return value.slice(1, -1);
        }

        return value;
    }
}
