import * as vscode from 'vscode';
import { activate } from '../extension';

jest.mock('../diagnostics', () => ({
    DiagnosticsOrchestrator: jest.fn().mockImplementation(() => ({
        analyzeDocument: jest.fn(),
        scanFolder: jest.fn()
    }))
}));

jest.mock('../codeActions', () => ({
    LPCCodeActionProvider: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../completionProvider', () => ({
    LPCCompletionItemProvider: jest.fn().mockImplementation(() => ({
        handleDocumentChange: jest.fn(),
        scanInheritance: jest.fn(),
        clearCache: jest.fn()
    }))
}));

jest.mock('../config', () => ({
    LPCConfigManager: jest.fn().mockImplementation(() => ({
        addServer: jest.fn(),
        selectServer: jest.fn(),
        removeServer: jest.fn(),
        showServerManager: jest.fn()
    }))
}));

jest.mock('../compiler', () => ({
    LPCCompiler: jest.fn().mockImplementation(() => ({
        compileFile: jest.fn(),
        compileFolder: jest.fn()
    }))
}));

jest.mock('../macroManager', () => ({
    MacroManager: jest.fn().mockImplementation(() => ({
        showMacrosList: jest.fn(),
        configurePath: jest.fn(),
        dispose: jest.fn()
    }))
}));

jest.mock('../definitionProvider', () => ({
    LPCDefinitionProvider: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../efunDocs', () => ({
    EfunDocsManager: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../functionDocPanel', () => ({
    FunctionDocPanel: {
        createOrShow: jest.fn()
    }
}));

jest.mock('../errorTreeDataProvider', () => ({
    ErrorTreeDataProvider: jest.fn().mockImplementation(() => ({
        refresh: jest.fn(),
        clearErrors: jest.fn(),
        getServers: jest.fn(() => []),
        setActiveServer: jest.fn()
    }))
}));

jest.mock('../foldingProvider', () => ({
    LPCFoldingRangeProvider: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../parser/ParseTreePrinter', () => ({
    getParseTreeString: jest.fn(() => '')
}));

jest.mock('../parser/DebugErrorListener', () => ({
    DebugErrorListener: jest.fn().mockImplementation(() => ({
        errors: []
    }))
}));

jest.mock('../antlr/LPCLexer', () => ({
    LPCLexer: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../antlr/LPCParser', () => ({
    LPCParser: jest.fn().mockImplementation(() => ({
        removeErrorListeners: jest.fn(),
        addErrorListener: jest.fn(),
        sourceFile: jest.fn()
    }))
}));

jest.mock('../semanticTokensProvider', () => ({
    LPCSemanticTokensProvider: jest.fn().mockImplementation(() => ({})),
    LPCSemanticTokensLegend: {}
}));

jest.mock('../symbolProvider', () => ({
    LPCSymbolProvider: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../referenceProvider', () => ({
    LPCReferenceProvider: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../renameProvider', () => ({
    LPCRenameProvider: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../completion/completionInstrumentation', () => ({
    CompletionInstrumentation: jest.fn().mockImplementation(() => ({
        showReport: jest.fn(),
        formatSummary: jest.fn(() => ''),
        clear: jest.fn(),
        dispose: jest.fn()
    }))
}));

jest.mock('../parser/ParsedDocumentService', () => ({
    clearGlobalParsedDocumentService: jest.fn(),
    disposeGlobalParsedDocumentService: jest.fn(),
    getGlobalParsedDocumentService: jest.fn(() => ({
        getStats: jest.fn(() => ({}))
    }))
}));

describe('formatter provider registration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('activate 注册 LPC 文档与选区格式化 provider', () => {
        activate({ subscriptions: [] } as any);

        expect(vscode.languages.registerDocumentFormattingEditProvider).toHaveBeenCalledWith(
            'lpc',
            expect.anything()
        );
        expect(vscode.languages.registerDocumentRangeFormattingEditProvider).toHaveBeenCalledWith(
            'lpc',
            expect.anything()
        );
    });
});
