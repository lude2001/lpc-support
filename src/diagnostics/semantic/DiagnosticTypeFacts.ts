import type * as vscode from 'vscode';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import type { LanguageDiagnosticsWorkspaceContext } from '../../language/services/diagnostics/LanguageDiagnosticsService';
import type { FunctionSummary } from '../../semantic/documentSemanticTypes';
import type {
    DiagnosticCallableSignature,
    DiagnosticSymbolResolver,
    VisibleDiagnosticSymbols
} from './DiagnosticSymbolResolver';

export interface TypeCheckingOptions {
    enabled: boolean;
}

export interface DiagnosticMacroSuppressionFacts {
    hasUnexpandedFunctionLikeMacroReference: boolean;
}

export interface DiagnosticTypeFacts {
    visibleSymbols: VisibleDiagnosticSymbols;
    macroSuppression: DiagnosticMacroSuppressionFacts;
    options: TypeCheckingOptions;
}

export interface DiagnosticFactsProvider {
    getFacts(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot,
        workspace?: LanguageDiagnosticsWorkspaceContext
    ): Promise<DiagnosticTypeFacts>;
}

export interface DefaultDiagnosticFactsProviderOptions {
    resolver?: DiagnosticSymbolResolver;
    typeChecking?: Partial<TypeCheckingOptions>;
}

const DEFAULT_TYPE_CHECKING_OPTIONS: TypeCheckingOptions = {
    enabled: true
};

export class DefaultDiagnosticFactsProvider implements DiagnosticFactsProvider {
    private readonly cache = new Map<string, Promise<DiagnosticTypeFacts>>();
    private readonly typeCheckingOptions: TypeCheckingOptions;

    public constructor(private readonly options: DefaultDiagnosticFactsProviderOptions = {}) {
        this.typeCheckingOptions = {
            ...DEFAULT_TYPE_CHECKING_OPTIONS,
            ...options.typeChecking
        };
    }

    public getFacts(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot,
        workspace?: LanguageDiagnosticsWorkspaceContext
    ): Promise<DiagnosticTypeFacts> {
        const key = this.createCacheKey(document, workspace);
        const cached = this.cache.get(key);
        if (cached) {
            return cached;
        }

        const pending = this.createFacts(document, semantic, workspace);
        this.cache.set(key, pending);
        pending.catch(() => {
            if (this.cache.get(key) === pending) {
                this.cache.delete(key);
            }
        });
        this.trimCache();
        return pending;
    }

    private async createFacts(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot,
        workspace?: LanguageDiagnosticsWorkspaceContext
    ): Promise<DiagnosticTypeFacts> {
        const visibleSymbols = this.options.resolver
            ? await this.options.resolver.resolveVisibleSymbols(document, semantic, workspace)
            : createCurrentFileVisibleSymbols(semantic);

        return {
            visibleSymbols,
            macroSuppression: {
                hasUnexpandedFunctionLikeMacroReference: hasUnexpandedFunctionLikeMacroReference(semantic)
            },
            options: this.typeCheckingOptions
        };
    }

    private createCacheKey(
        document: vscode.TextDocument,
        workspace?: LanguageDiagnosticsWorkspaceContext
    ): string {
        return [
            document.uri.toString(),
            document.version,
            workspace?.workspaceRoot ?? '',
            stableStringify(workspace?.projectConfig),
            this.typeCheckingOptions.enabled ? 'type:on' : 'type:off'
        ].join('|');
    }

    private trimCache(): void {
        const maxEntries = 64;
        while (this.cache.size > maxEntries) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey === undefined) {
                return;
            }
            this.cache.delete(firstKey);
        }
    }
}

export function createCurrentFileVisibleSymbols(semantic: SemanticSnapshot): VisibleDiagnosticSymbols {
    return {
        functions: semantic.exportedFunctions,
        symbols: semantic.symbols,
        fileGlobals: semantic.fileGlobals ?? [],
        types: semantic.typeDefinitions,
        macros: semantic.macroDefinitions ?? [],
        macroReferences: semantic.macroReferences,
        callableSignatures: semantic.exportedFunctions.map((summary) => toCurrentFileCallableSignature(summary)),
        hasUnresolvedDependencies: semantic.includeStatements.length > 0 || semantic.inheritStatements.length > 0
    };
}

export function hasUnexpandedFunctionLikeMacroReference(semantic: SemanticSnapshot): boolean {
    const expandedRanges = semantic.syntax.parsed?.frontend?.preprocessor?.activeView?.expandedRanges ?? [];
    return semantic.macroReferences.some((reference) => {
        if (!reference.isFunctionLike) {
            return false;
        }

        if (reference.startOffset === undefined || reference.endOffset === undefined) {
            return true;
        }

        return !expandedRanges.some((range) =>
            reference.startOffset! >= range.originalStartOffset
            && reference.endOffset! <= range.originalEndOffset
        );
    });
}

function toCurrentFileCallableSignature(summary: FunctionSummary): DiagnosticCallableSignature {
    const isVariadic = Boolean(summary.isVariadic || summary.parameters.some((parameter) => parameter.isVariadic));
    return {
        name: summary.name,
        requiredParameterCount: summary.requiredParameterCount
            ?? summary.parameters.filter((parameter) => !parameter.hasDefaultValue && !parameter.isVariadic).length,
        maxParameterCount: summary.maxParameterCount ?? (isVariadic ? undefined : summary.parameters.length),
        isVariadic,
        source: summary.origin,
        returnType: summary.returnType,
        parameters: summary.parameters.map((parameter) => ({
            name: parameter.name,
            dataType: parameter.dataType,
            optional: parameter.hasDefaultValue,
            variadic: parameter.isVariadic
        }))
    };
}

function stableStringify(value: unknown): string {
    if (value === undefined) {
        return '';
    }
    try {
        return JSON.stringify(sortObjectKeys(value));
    } catch {
        return '[unserializable]';
    }
}

function sortObjectKeys(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortObjectKeys);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
        sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
}
