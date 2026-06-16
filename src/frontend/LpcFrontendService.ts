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
import { getDocumentWorkspaceProjectConfig } from '../language/shared/documentWorkspaceConfig';

export interface LpcFrontendServiceOptions {
    dialect?: LpcDialectProfile;
    includeDirectories?: string[];
}

interface ConfiguredPreprocessorConfig {
    includeDirectories: string[];
    globalIncludeFile?: string;
}

export class LpcFrontendService {
    private readonly snapshots = new Map<string, LpcFrontendSnapshot>();
    private readonly scanner = new PreprocessorScanner();
    private readonly conditionEvaluator = new PreprocessorConditionEvaluator();
    private readonly activeSourceBuilder = new ActiveSourceBuilder();
    private readonly macroFactResolver = new MacroFactResolver();
    private readonly macroExpansionBuilder = new MacroExpansionBuilder();
    private readonly dialect: LpcDialectProfile;
    private readonly includeDirectories: string[];
    private readonly configuredPreprocessorConfigCache = new Map<string, ConfiguredPreprocessorConfig>();

    constructor(options: LpcFrontendServiceOptions = {}) {
        this.dialect = options.dialect ?? createDefaultFluffOSDialectProfile();
        this.includeDirectories = options.includeDirectories ?? [];
    }

    public get(document: vscode.TextDocument): LpcFrontendSnapshot {
        const cacheKey = `${document.uri.toString()}@${document.version}`;
        const cached = this.snapshots.get(cacheKey);
        if (cached) {
            return cached;
        }

        const text = document.getText();
        const scanned = this.scanner.scan(document.uri.toString(), document.version, text);
        const preprocessorConfig = this.getPreprocessorConfigForDocument(document);
        const includeResolver = new IncludeResolver(preprocessorConfig);
        const includes = includeResolver.resolve(document.uri.toString(), scanned.includeReferences);
        const globalIncludeMacros = this.collectGlobalIncludeMacros(
            document.uri.toString(),
            preprocessorConfig.globalIncludeFile,
            includeResolver
        );
        const includeMacros = this.collectIncludeMacros(
            includes.includeReferences,
            includeResolver,
            new Set(),
            globalIncludeMacros
        );
        const initialMacros = [...globalIncludeMacros, ...includeMacros];
        const conditional = this.conditionEvaluator.evaluate(text, scanned.directives, initialMacros);
        const macroFacts = this.macroFactResolver.resolve(
            text,
            scanned.directives,
            conditional.inactiveRanges,
            initialMacros,
            document.uri.toString()
        );
        const activeView = this.macroExpansionBuilder.expand(
            this.activeSourceBuilder.build(text, scanned.directives, conditional.inactiveRanges),
            macroFacts.macroReferences,
            macroFacts.activeMacros
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
        this.configuredPreprocessorConfigCache.clear();
    }

    private getPreprocessorConfigForDocument(document: vscode.TextDocument): {
        includeDirectories: string[];
        workspaceRoot?: string;
        globalIncludeFile?: string;
    } {
        const documentUri = document.uri.toString();
        const documentPath = normalizeFsPath(vscode.Uri.parse(documentUri).fsPath);
        const workspaceRoot = this.findWorkspaceRoot(documentPath);
        const attachedConfig = getDocumentWorkspaceProjectConfig(document);
        const attachedResolved = attachedConfig?.resolvedConfig;

        if (workspaceRoot && attachedResolved) {
            const mudlibRoot = this.resolveMudlibRoot(
                workspaceRoot,
                attachedResolved.mudlibDirectory,
                attachedConfig.configHellPath ?? ''
            );
            return {
                includeDirectories: [
                    ...this.includeDirectories,
                    ...(attachedResolved.includeDirectories ?? [])
                        .map((includeDirectory) => this.resolveProjectPath(mudlibRoot, includeDirectory))
                        .filter((includeDirectory) => fs.existsSync(includeDirectory))
                ],
                workspaceRoot,
                globalIncludeFile: attachedResolved.globalIncludeFile
            };
        }

        const configured = this.collectConfiguredPreprocessorConfig(workspaceRoot);
        return {
            includeDirectories: [
                ...this.includeDirectories,
                ...configured.includeDirectories
            ],
            workspaceRoot,
            globalIncludeFile: configured.globalIncludeFile
        };
    }

    private collectConfiguredPreprocessorConfig(workspaceRoot: string | undefined): {
        includeDirectories: string[];
        globalIncludeFile?: string;
    } {
        if (!workspaceRoot) {
            return { includeDirectories: [] };
        }

        const cached = this.configuredPreprocessorConfigCache.get(workspaceRoot);
        if (cached) {
            return cached;
        }

        const config = this.readConfiguredPreprocessorConfig(workspaceRoot);
        this.configuredPreprocessorConfigCache.set(workspaceRoot, config);
        return config;
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

    private readConfiguredPreprocessorConfig(workspaceRoot: string): {
        includeDirectories: string[];
        globalIncludeFile?: string;
    } {
        const projectConfigPath = path.join(workspaceRoot, 'lpc-support.json');
        if (!fs.existsSync(projectConfigPath)) {
            return { includeDirectories: [] };
        }

        try {
            const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8')) as { configHellPath?: string };
            if (!projectConfig.configHellPath) {
                return { includeDirectories: [] };
            }

            const configHellPath = path.isAbsolute(projectConfig.configHellPath)
                ? projectConfig.configHellPath
                : path.resolve(workspaceRoot, projectConfig.configHellPath);
            if (!fs.existsSync(configHellPath)) {
                return { includeDirectories: [] };
            }

            const resolved = parseConfigHell(fs.readFileSync(configHellPath, 'utf8'));
            const mudlibRoot = this.resolveMudlibRoot(workspaceRoot, resolved.mudlibDirectory, projectConfig.configHellPath);
            return {
                includeDirectories: (resolved.includeDirectories ?? [])
                    .map((includeDirectory) => this.resolveProjectPath(mudlibRoot, includeDirectory))
                    .filter((includeDirectory) => fs.existsSync(includeDirectory)),
                globalIncludeFile: resolved.globalIncludeFile
            };
        } catch {
            return { includeDirectories: [] };
        }
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
        includeResolver: IncludeResolver,
        visited: Set<string> = new Set(),
        inheritedMacros: MacroDefinitionFact[] = []
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
            const nestedIncludes = includeResolver.resolve(include.resolvedUri, scanned.includeReferences);
            const nestedMacros = this.collectIncludeMacros(
                nestedIncludes.includeReferences,
                includeResolver,
                visited,
                inheritedMacros
            );
            macros.push(...nestedMacros);

            const availableMacros = [...inheritedMacros, ...nestedMacros];
            const conditional = this.conditionEvaluator.evaluate(text, scanned.directives, availableMacros);
            const facts = this.macroFactResolver.resolve(
                text,
                scanned.directives,
                conditional.inactiveRanges,
                availableMacros,
                include.resolvedUri
            );

            macros.push(...facts.activeMacros
                .filter((macro) => !availableMacros.includes(macro))
                .map((macro) => ({
                ...macro,
                sourceUri: macro.sourceUri ?? include.resolvedUri,
                source: macro.source === 'document' ? 'include' as const : macro.source
            })));
        }

        return macros;
    }

    private collectGlobalIncludeMacros(
        documentUri: string,
        globalIncludeFile: string | undefined,
        includeResolver: IncludeResolver
    ): MacroDefinitionFact[] {
        const implicitInclude = this.createImplicitGlobalIncludeReference(globalIncludeFile);
        if (!implicitInclude) {
            return [];
        }

        const resolved = includeResolver.resolve(documentUri, [implicitInclude]).includeReferences[0];
        if (!resolved?.resolvedUri) {
            return [];
        }

        return this.collectIncludeMacros([resolved], includeResolver);
    }

    private createImplicitGlobalIncludeReference(globalIncludeFile: string | undefined): IncludeReferenceFact | undefined {
        if (!globalIncludeFile?.trim()) {
            return undefined;
        }

        const trimmed = globalIncludeFile.trim();
        const isAngleInclude = trimmed.startsWith('<') && trimmed.endsWith('>');
        const isQuotedInclude = trimmed.startsWith('"') && trimmed.endsWith('"');
        const value = isAngleInclude || isQuotedInclude
            ? trimmed.slice(1, -1)
            : trimmed;
        if (!value) {
            return undefined;
        }

        return {
            rawText: trimmed,
            value,
            isSystemInclude: isAngleInclude || !value.startsWith('/'),
            startOffset: 0,
            endOffset: 0,
            range: new vscode.Range(0, 0, 0, 0)
        };
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
