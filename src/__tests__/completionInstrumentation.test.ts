import * as vscode from 'vscode';
import { CompletionInstrumentation } from '../completion/completionInstrumentation';

describe('CompletionInstrumentation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'enableMonitoring') {
                    return true;
                }

                return defaultValue;
            })
        });
    });

    test('records stage metrics and writes developer report on demand', () => {
        const instrumentation = new CompletionInstrumentation();
        const trace = instrumentation.startRequest({
            documentUri: 'file:///room.c',
            documentVersion: 3,
            triggerKind: vscode.CompletionTriggerKind.Invoke
        });

        trace.measure('context-analysis', () => 'ok');
        trace.recordStage('snapshot-load', 1.25, { cacheHit: true });
        trace.recordStage('project-index-query', 0.75, { cacheHit: false });
        trace.recordStage('candidate-build', 2.5, { candidateCount: 4 });
        trace.complete('identifier', 4);

        const metrics = instrumentation.getRecentMetrics();
        expect(metrics).toHaveLength(1);
        expect(metrics[0].contextKind).toBe('identifier');
        expect(metrics[0].stages.find(stage => stage.stage === 'snapshot-load')?.cacheHit).toBe(true);
        expect(metrics[0].stages.find(stage => stage.stage === 'project-index-query')?.cacheHit).toBe(false);
        expect(metrics[0].stages.find(stage => stage.stage === 'candidate-build')?.candidateCount).toBe(4);

        instrumentation.showReport({ size: 2, memory: 4096 });

        const outputChannel = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
        expect(outputChannel.clear).toHaveBeenCalled();
        expect(outputChannel.appendLine).toHaveBeenCalled();
        expect(outputChannel.show).toHaveBeenCalledWith(true);
        expect(instrumentation.formatSummary({ size: 2, memory: 4096 })).toContain('最近 1 次补全');
    });

    test('keeps only the configured number of recent metrics', () => {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'enableMonitoring') {
                    return true;
                }

                if (key === 'completionMetricHistorySize') {
                    return 2;
                }

                return defaultValue;
            })
        });

        const instrumentation = new CompletionInstrumentation();

        for (let index = 0; index < 3; index += 1) {
            const trace = instrumentation.startRequest({
                documentUri: `file:///room-${index}.c`,
                documentVersion: index + 1
            });
            trace.recordStage('candidate-build', 1, { candidateCount: index + 1 });
            trace.complete('identifier', index + 1);
        }

        const metrics = instrumentation.getRecentMetrics();
        expect(metrics).toHaveLength(2);
        expect(metrics[0].documentUri).toBe('file:///room-2.c');
        expect(metrics[1].documentUri).toBe('file:///room-1.c');
    });
});
