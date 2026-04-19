import * as vscode from 'vscode';
import * as path from 'path';
import { MacroManager } from '../macroManager';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { TargetMethodLookup } from '../targetMethodLookup';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import {
    type LanguageHoverResult,
    LanguageHoverService,
    ObjectInferenceLanguageHoverService
} from '../language/services/navigation/LanguageHoverService';
import { ObjectInferenceService } from './ObjectInferenceService';

export class ObjectHoverProvider implements vscode.HoverProvider {
    private readonly hoverService: LanguageHoverService;

    public constructor(
        objectInferenceService: ObjectInferenceService,
        macroManager?: MacroManager,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        hoverService?: LanguageHoverService,
        documentationService?: FunctionDocumentationService,
        host?: TextDocumentHost
    ) {
        const resolvedDocumentationService = hoverService
            ? documentationService
            : assertDocumentationService('ObjectHoverProvider', documentationService);
        this.hoverService = hoverService ?? new ObjectInferenceLanguageHoverService(
            objectInferenceService,
            macroManager,
            targetMethodLookup,
            projectConfigService,
            {
                documentationService: resolvedDocumentationService,
                host
            }
        );
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token?: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const cancellationToken = token ?? ({
            isCancellationRequested: false,
            onCancellationRequested: () => ({ dispose: () => undefined })
        } as unknown as vscode.CancellationToken);
        return toVsCodeHover(await this.hoverService.provideHover({
            context: {
                document: document as unknown as any,
                workspace: {
                    workspaceRoot: resolveWorkspaceRoot(document)
                },
                mode: 'lsp',
                cancellation: cancellationToken
            },
            position: {
                line: position.line,
                character: position.character
            }
        }));
    }

    public getLanguageHoverService(): LanguageHoverService {
        return this.hoverService;
    }
}

function resolveWorkspaceRoot(document: vscode.TextDocument): string {
    const workspaceRoot = document.uri
        ? vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
        : undefined;
    if (workspaceRoot) {
        return workspaceRoot;
    }

    if (typeof document.fileName === 'string' && document.fileName.length > 0) {
        return path.dirname(document.fileName);
    }

    return process.cwd();
}

function toVsCodeHover(result: LanguageHoverResult | undefined): vscode.Hover | undefined {
    if (!result || result.contents.length === 0) {
        return undefined;
    }

    const contents = result.contents.length === 1
        ? toVsCodeMarkupContent(result.contents[0])
        : result.contents.map((content) => toVsCodeMarkupContent(content));

    return new vscode.Hover(contents, result.range ? toVsCodeRange(result.range) : undefined);
}

function toVsCodeMarkupContent(content: LanguageHoverResult['contents'][number]): vscode.MarkdownString | string {
    if (content.kind === 'markdown') {
        return new vscode.MarkdownString(content.value);
    }

    return content.value;
}

function toVsCodeRange(range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
}): vscode.Range {
    return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}
