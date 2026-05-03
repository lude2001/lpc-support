import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ActiveSourceBuilder } from './ActiveSourceBuilder';
import { createDefaultFluffOSDialectProfile } from './dialect';
import { IncludeResolver } from './IncludeResolver';
import { MacroExpansionBuilder } from './MacroExpansionBuilder';
import { MacroFactResolver } from './MacroFactResolver';
import { PreprocessorConditionEvaluator } from './PreprocessorConditionEvaluator';
import { PreprocessorScanner } from './PreprocessorScanner';
import { IncludeReferenceFact, LpcDialectProfile, LpcFrontendSnapshot, MacroDefinitionFact } from './types';
import { parseConfigHell } from '../projectConfig/configHellParser';

export interface LpcFrontendServiceOptions {
    dialect?: LpcDialectProfile;
    includeDirectories?: string[];
}

export class LpcFrontendService {
    private readonly snapshots = new Map<string, LpcFrontendSnapshot>();
    private readonly scanner = new PreprocessorScanner();
    private readonly conditionEvaluator = new PreprocessorConditionEvaluator();
    private readonly activeSourceBuilder = new ActiveSourceBuilder();
    private readonly macroFactResolver = new MacroFactResolver();
    private readonly macroExpansionBuilder = new MacroExpansionBuilder();
    private readonly dialect: LpcDialectProfile;
    private readonly includeResolver: IncludeResolver;
    private readonly globalIncludeMacroCache = new Map<string, MacroDefinitionFact[]>();

    constructor(options: LpcFrontendServiceOptions = {}) {
        this.dialect = options.dialect ?? createDefaultFluffOSDialectProfile();
        this.includeResolver = new IncludeResolver(options.includeDirectories ?? []);
    }

    public get(document: vscode.TextDocument): LpcFrontendSnapshot {
        const cacheKey = `${document.uri.toString()}@${document.version}`;
        const cached = this.snapshots.get(cacheKey);
        if (cached) {
            return cached;
        }

        const text = document.getText();
        const scanned = this.scanner.scan(document.uri.toString(), document.version, text);
        const includes = this.includeResolver.resolve(document.uri.toString(), scanned.includeReferences);
        const configuredMacros = this.collectConfiguredIncludeMacros(document.uri.toString());
        const includeMacros = [
            ...configuredMacros,
            ...this.collectIncludeMacros(includes.includeReferences)
        ];
        const conditional = this.conditionEvaluator.evaluate(text, scanned.directives, includeMacros);
        const macroFacts = this.macroFactResolver.resolve(
            text,
            scanned.directives,
            conditional.inactiveRanges,
            includeMacros,
            document.uri.toString()
        );
        const activeView = this.macroExpansionBuilder.expand(
            this.activeSourceBuilder.build(text, scanned.directives, conditional.inactiveRanges),
            macroFacts.macroReferences
        );
        const preprocessor = {
            ...scanned,
            macros: macroFacts.activeMacros,
            undefs: macroFacts.undefs,
            macroReferences: macroFacts.macroReferences,
            includeReferences: includes.includeReferences,
            includeGraph: includes.includeGraph,
            inactiveRanges: conditional.inactiveRanges,
            diagnostics: [...scanned.diagnostics, ...conditional.diagnostics, ...includes.diagnostics],
            activeView
        };
        const snapshot: LpcFrontendSnapshot = {
            uri: document.uri.toString(),
            version: document.version,
            text,
            preprocessor,
            dialect: this.dialect,
            createdAt: Date.now()
        };

        this.snapshots.set(cacheKey, snapshot);
        return snapshot;
    }

    public invalidate(uri: vscode.Uri): void {
        const uriText = uri.toString();
        for (const key of Array.from(this.snapshots.keys())) {
            if (key.startsWith(`${uriText}@`)) {
                this.snapshots.delete(key);
            }
        }
    }

    public clear(): void {
        this.snapshots.clear();
        this.globalIncludeMacroCache.clear();
    }

    private collectConfiguredIncludeMacros(documentUri: string): MacroDefinitionFact[] {
        const documentPath = normalizeFsPath(vscode.Uri.parse(documentUri).fsPath);
        const workspaceRoot = this.findWorkspaceRoot(documentPath);
        if (!workspaceRoot) {
            return [];
        }

        const cached = this.globalIncludeMacroCache.get(workspaceRoot);
        if (cached) {
            return cached;
        }

        const includeDirectories = this.readConfiguredIncludeDirectories(workspaceRoot);
        const macros = includeDirectories.flatMap((includeDirectory) =>
            this.collectHeaderMacrosFromDirectory(includeDirectory)
        );
        this.globalIncludeMacroCache.set(workspaceRoot, macros);
        return macros;
    }

    private findWorkspaceRoot(documentPath: string): string | undefined {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder?.(vscode.Uri.file(documentPath));
        if (workspaceFolder?.uri.fsPath && fs.existsSync(path.join(workspaceFolder.uri.fsPath, 'lpc-support.json'))) {
            return workspaceFolder.uri.fsPath;
        }

        let current = path.dirname(documentPath);
        while (true) {
            if (fs.existsSync(path.join(current, 'lpc-support.json'))) {
                return current;
            }

            const parent = path.dirname(current);
            if (parent === current) {
                return undefined;
            }

            current = parent;
        }
    }

    private readConfiguredIncludeDirectories(workspaceRoot: string): string[] {
        const projectConfigPath = path.join(workspaceRoot, 'lpc-support.json');
        if (!fs.existsSync(projectConfigPath)) {
            return [];
        }

        try {
            const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8')) as { configHellPath?: string };
            if (!projectConfig.configHellPath) {
                return [];
            }

            const configHellPath = path.isAbsolute(projectConfig.configHellPath)
                ? projectConfig.configHellPath
                : path.resolve(workspaceRoot, projectConfig.configHellPath);
            if (!fs.existsSync(configHellPath)) {
                return [];
            }

            const resolved = parseConfigHell(fs.readFileSync(configHellPath, 'utf8'));
            const mudlibRoot = this.resolveMudlibRoot(workspaceRoot, resolved.mudlibDirectory, projectConfig.configHellPath);
            return (resolved.includeDirectories ?? [])
                .map((includeDirectory) => this.resolveProjectPath(mudlibRoot, includeDirectory))
                .filter((includeDirectory) => fs.existsSync(includeDirectory));
        } catch {
            return [];
        }
    }

    private collectHeaderMacrosFromDirectory(includeDirectory: string): MacroDefinitionFact[] {
        const macros: MacroDefinitionFact[] = [];
        for (const filePath of this.listHeaderFiles(includeDirectory)) {
            const sourceUri = vscode.Uri.file(filePath).toString();
            const text = fs.readFileSync(filePath, 'utf8');
            const scanned = this.scanner.scan(sourceUri, 1, text);
            const conditional = this.conditionEvaluator.evaluate(text, scanned.directives);
            const facts = this.macroFactResolver.resolve(
                text,
                scanned.directives,
                conditional.inactiveRanges,
                [],
                sourceUri
            );
            macros.push(...facts.activeMacros.map((macro) => ({
                ...macro,
                source: 'global-include' as const,
                sourceUri
            })));
        }

        return macros;
    }

    private listHeaderFiles(directory: string): string[] {
        const results: string[] = [];
        if (!fs.existsSync(directory)) {
            return results;
        }

        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                results.push(...this.listHeaderFiles(entryPath));
                continue;
            }

            if (entry.isFile() && entry.name.endsWith('.h')) {
                results.push(entryPath);
            }
        }

        return results;
    }

    private resolveMudlibRoot(workspaceRoot: string, mudlibDirectory: string | undefined, configHellPath: string): string {
        if (!mudlibDirectory) {
            return workspaceRoot;
        }

        if (path.isAbsolute(mudlibDirectory)) {
            return mudlibDirectory;
        }

        const configHellAbsolutePath = path.isAbsolute(configHellPath)
            ? configHellPath
            : path.resolve(workspaceRoot, configHellPath);
        return path.resolve(path.dirname(configHellAbsolutePath), mudlibDirectory);
    }

    private resolveProjectPath(mudlibRoot: string, targetPath: string): string {
        if (targetPath.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(targetPath.slice(1))) {
            return path.join(mudlibRoot, targetPath.slice(1));
        }

        return path.isAbsolute(targetPath)
            ? targetPath
            : path.resolve(mudlibRoot, targetPath);
    }

    private collectIncludeMacros(
        includeReferences: IncludeReferenceFact[],
        visited: Set<string> = new Set()
    ): MacroDefinitionFact[] {
        const macros: MacroDefinitionFact[] = [];

        for (const include of includeReferences) {
            if (!include.resolvedUri || visited.has(include.resolvedUri)) {
                continue;
            }

            visited.add(include.resolvedUri);
            const includeUri = vscode.Uri.parse(include.resolvedUri);
            const includePath = normalizeFsPath(includeUri.fsPath);
            if (!fs.existsSync(includePath)) {
                continue;
            }

            const text = fs.readFileSync(includePath, 'utf8');
            const scanned = this.scanner.scan(include.resolvedUri, 1, text);
            const nestedIncludes = this.includeResolver.resolve(include.resolvedUri, scanned.includeReferences);
            const nestedMacros = this.collectIncludeMacros(nestedIncludes.includeReferences, visited);
            const conditional = this.conditionEvaluator.evaluate(text, scanned.directives, nestedMacros);
            const facts = this.macroFactResolver.resolve(
                text,
                scanned.directives,
                conditional.inactiveRanges,
                nestedMacros,
                include.resolvedUri
            );

            macros.push(...facts.activeMacros.map((macro) => ({
                ...macro,
                sourceUri: macro.sourceUri ?? include.resolvedUri,
                source: macro.source === 'document' ? 'include' as const : macro.source
            })));
        }

        return macros;
    }
}

function normalizeFsPath(fsPath: string): string {
    return fsPath.replace(/^\/+([A-Za-z]:[\\/])/, '$1');
}

let globalLpcFrontendService: LpcFrontendService | undefined;

export function getGlobalLpcFrontendService(): LpcFrontendService {
    if (!globalLpcFrontendService) {
        globalLpcFrontendService = new LpcFrontendService();
    }

    return globalLpcFrontendService;
}

export function clearGlobalLpcFrontendService(): void {
    getGlobalLpcFrontendService().clear();
}
