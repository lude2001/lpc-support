import * as vscode from 'vscode';
import * as fs from 'fs';
import { ActiveSourceBuilder } from './ActiveSourceBuilder';
import { createDefaultFluffOSDialectProfile } from './dialect';
import { IncludeResolver } from './IncludeResolver';
import { MacroExpansionBuilder } from './MacroExpansionBuilder';
import { MacroFactResolver } from './MacroFactResolver';
import { PreprocessorConditionEvaluator } from './PreprocessorConditionEvaluator';
import { PreprocessorScanner } from './PreprocessorScanner';
import { IncludeReferenceFact, LpcDialectProfile, LpcFrontendSnapshot, MacroDefinitionFact } from './types';

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
        const includeMacros = this.collectIncludeMacros(includes.includeReferences);
        const conditional = this.conditionEvaluator.evaluate(text, scanned.directives, includeMacros);
        const macroFacts = this.macroFactResolver.resolve(text, scanned.directives, conditional.inactiveRanges, includeMacros);
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
            const facts = this.macroFactResolver.resolve(text, scanned.directives, conditional.inactiveRanges, nestedMacros);

            macros.push(...facts.activeMacros.map((macro) => ({
                ...macro,
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
