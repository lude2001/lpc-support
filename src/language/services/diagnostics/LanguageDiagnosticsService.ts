import type { LanguageDocument } from '../../contracts/LanguageDocument';
import type { LanguageRange } from '../../contracts/LanguagePosition';
import type { LanguageWorkspaceContext } from '../../contracts/LanguageWorkspaceContext';

export interface LanguageDiagnostic {
    range: LanguageRange;
    severity: 'error' | 'warning' | 'information' | 'hint';
    message: string;
    code?: string;
    source?: string;
    data?: unknown;
}

export interface LanguageDiagnosticsSyntaxNode {
    kind: string;
    name?: string;
    range?: LanguageRange;
    children?: LanguageDiagnosticsSyntaxNode[];
}

export interface LanguageDiagnosticsSyntax {
    nodes: LanguageDiagnosticsSyntaxNode[];
}

export interface LanguageDiagnosticsSemantic {
    parseDiagnostics: LanguageDiagnostic[];
}

export interface LanguageDiagnosticsWorkspaceContext extends Pick<LanguageWorkspaceContext, 'workspaceRoot'> {}

export interface LanguageDiagnosticsContext {
    document: LanguageDocument;
    workspace: LanguageDiagnosticsWorkspaceContext;
    mode: 'lsp';
}

export interface LanguageDiagnosticsRequest {
    context: LanguageDiagnosticsContext;
}

export interface LanguageDiagnosticsAnalysis {
    syntax?: LanguageDiagnosticsSyntax;
    semantic?: LanguageDiagnosticsSemantic;
    parseDiagnostics: LanguageDiagnostic[];
}

export interface LanguageDiagnosticsCollector {
    collect(
        document: LanguageDocument,
        analysis: LanguageDiagnosticsAnalysis,
        context: LanguageDiagnosticsContext
    ): Promise<LanguageDiagnostic[]> | LanguageDiagnostic[];
}

export interface LanguageDiagnosticsCollectOptions {
    batchSize?: number;
    yieldToMainThread?: () => Promise<void>;
}

export interface LanguageDiagnosticsAnalyzer {
    analyze(document: LanguageDocument): Promise<LanguageDiagnosticsAnalysis> | LanguageDiagnosticsAnalysis;
}

export interface LanguageDiagnosticsService {
    collectDiagnostics(
        request: LanguageDiagnosticsRequest,
        options?: LanguageDiagnosticsCollectOptions
    ): Promise<LanguageDiagnostic[]>;
}

export interface LanguageDiagnosticsServiceDependencies {
    analyzeDocument: LanguageDiagnosticsAnalyzer;
    collectors: LanguageDiagnosticsCollector[];
}

class DefaultLanguageDiagnosticsService implements LanguageDiagnosticsService {
    public constructor(
        private readonly analyzer: LanguageDiagnosticsAnalyzer,
        private readonly collectors: LanguageDiagnosticsCollector[]
    ) {}

    public async collectDiagnostics(
        request: LanguageDiagnosticsRequest,
        options: LanguageDiagnosticsCollectOptions = {}
    ): Promise<LanguageDiagnostic[]> {
        const analysis = await this.analyzer.analyze(request.context.document);
        const diagnostics: LanguageDiagnostic[] = [...analysis.parseDiagnostics];

        if (options.batchSize && options.batchSize > 0) {
            for (let index = 0; index < this.collectors.length; index += options.batchSize) {
                const batch = this.collectors.slice(index, index + options.batchSize);
                const results = await Promise.allSettled(
                    batch.map(async (collector) => {
                        if (options.yieldToMainThread) {
                            await options.yieldToMainThread();
                        }

                        return collector.collect(request.context.document, analysis, request.context);
                    })
                );

                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        diagnostics.push(...result.value);
                    } else {
                        console.error('收集器执行失败:', result.reason);
                    }
                }
            }
        } else {
            for (const collector of this.collectors) {
                try {
                    const result = await collector.collect(request.context.document, analysis, request.context);
                    diagnostics.push(...result);
                } catch (error) {
                    console.error('收集器执行失败:', error);
                }
            }
        }

        return diagnostics;
    }
}

export function createLanguageDiagnosticsService(
    dependencies: LanguageDiagnosticsServiceDependencies
): LanguageDiagnosticsService {
    return new DefaultLanguageDiagnosticsService(
        dependencies.analyzeDocument,
        dependencies.collectors
    );
}
