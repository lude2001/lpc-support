import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';
import { LPCDiagnostics } from '../diagnostics'; // Adjust path if necessary
import { MacroManager } from '../macroManager'; // Adjust path if necessary

// Mock TextDocument
class MockTextDocument implements vscode.TextDocument {
    private _uri: vscode.Uri;
    private _content: string;
    private _languageId: string;
    private _version: number = 1;
    private _isDirty: boolean = false;
    private _isUntitled: boolean = false;
    private _isClosed: boolean = false;
    private _lineCount: number;

    constructor(uri: vscode.Uri, languageId: string, content: string) {
        this._uri = uri;
        this._languageId = languageId;
        this._content = content;
        this._lineCount = content.split(/\r\n|\r|\n/).length;
    }

    get uri(): vscode.Uri { return this._uri; }
    get fileName(): string { return this._uri.fsPath; }
    get isUntitled(): boolean { return this._isUntitled; }
    get languageId(): string { return this._languageId; }
    get version(): number { return this._version; }
    get isDirty(): boolean { return this._isDirty; }
    get isClosed(): boolean { return this._isClosed; }
    save(): Thenable<boolean> { throw new Error('Method not implemented.'); }
    eol: vscode.EndOfLine = vscode.EndOfLine.LF;
    get lineCount(): number { return this._lineCount; }

    lineAt(lineOrPosition: number | vscode.Position): vscode.TextLine {
        const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
        const lines = this._content.split(/\r\n|\r|\n/);
        const text = lines[line];
        const firstNonWhitespaceCharacterIndex = text.search(/\S|$/);
        const range = new vscode.Range(line, 0, line, text.length);
        const rangeIncludingLineBreak = line < this._lineCount - 1
            ? new vscode.Range(line, 0, line + 1, 0)
            : range;

        return {
            lineNumber: line,
            text: text,
            range: range,
            firstNonWhitespaceCharacterIndex: firstNonWhitespaceCharacterIndex,
            rangeIncludingLineBreak: rangeIncludingLineBreak,
            isEmptyOrWhitespace: firstNonWhitespaceCharacterIndex === text.length,
        };
    }
    offsetAt(position: vscode.Position): number {
        const lines = this._content.split(/\r\n|\r|\n/);
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            offset += lines[i].length + (this.eol === vscode.EndOfLine.CRLF ? 2 : 1);
        }
        offset += position.character;
        return offset;
    }
    positionAt(offset: number): vscode.Position {
        const lines = this._content.split(/\r\n|\r|\n/);
        let currentOffset = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + (this.eol === vscode.EndOfLine.CRLF ? 2 : 1);
            if (offset <= currentOffset + lineLength) {
                return new vscode.Position(i, Math.max(0, offset - currentOffset));
            }
            currentOffset += lineLength;
        }
        return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
    }
    getText(range?: vscode.Range): string {
        if (!range) {
            return this._content;
        }
        const startOffset = this.offsetAt(range.start);
        const endOffset = this.offsetAt(range.end);
        return this._content.substring(startOffset, endOffset);
    }
    getWordRangeAtPosition(position: vscode.Position, regex?: RegExp): vscode.Range | undefined {
        throw new Error('Method not implemented.');
    }
    validateRange(range: vscode.Range): vscode.Range { throw new Error('Method not implemented.'); }
    validatePosition(position: vscode.Position): vscode.Position { throw new Error('Method not implemented.'); }
}


const createMockDocument = (content: string, fileName: string = 'test.c'): MockTextDocument => {
    return new MockTextDocument(vscode.Uri.file(path.join(__dirname, fileName)), 'lpc', content);
};

let parser: Parser;
let lpcDiagnostics: LPCDiagnostics;
let LpcLanguage: Parser.Language;

// Suite setup
suite('LPCDiagnostics Unused Variable Tests', function () {
    this.timeout(5000); // Increase timeout for wasm loading

    suiteSetup(async () => {
        await Parser.init();
        parser = new Parser();

        // Path to WASM file - this is critical and might need adjustment
        // Assuming tests are run from the project root, and WASM is in 'parser' directory
        const wasmPath = path.join(__dirname, '../../parser/tree-sitter-lpc.wasm');

        if (!fs.existsSync(wasmPath)) {
            console.error(`WASM file not found at: ${wasmPath}`);
            // Attempt an alternative path, common if tests are in a subfolder like 'out/test'
            const altWasmPath = path.join(__dirname, '../../../../parser/tree-sitter-lpc.wasm');
            if (!fs.existsSync(altWasmPath)) {
                throw new Error(`LPC grammar WASM not found at ${wasmPath} or ${altWasmPath}. Adjust path in test setup.`);
            }
            LpcLanguage = await Parser.Language.load(altWasmPath);
        } else {
            LpcLanguage = await Parser.Language.load(wasmPath);
        }

        parser.setLanguage(LpcLanguage);
        LPCDiagnostics.setLanguage(LpcLanguage);

        const mockContext: vscode.ExtensionContext = {
            subscriptions: [],
            workspaceState: { get: () => {}, update: () => {} } as any,
            globalState: { get: () => {}, update: () => {}, setKeysForSync: () => {} } as any,
            extensionPath: path.resolve(__dirname, '../../'), // Points to project root from 'src/test'
            storagePath: undefined,
            logPath: path.join(__dirname, '../../.logs'), // Dummy log path
            globalStoragePath: path.join(__dirname, '../../.globalStorage'), // Dummy global storage
            asAbsolutePath: (relativePath) => path.join(path.resolve(__dirname, '../../'), relativePath),
            storageUri: undefined,
            globalStorageUri: undefined,
            logUri: vscode.Uri.file(path.join(__dirname, '../../.logs')),
            extensionMode: vscode.ExtensionMode.Test,
            extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../')),
            environmentVariableCollection: {} as any,
            secrets: { get: async () => undefined, store: async () => {}, delete: async () => {}, onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event } as any,
            extension: {} as any, // Mock the extension property
            options: {} as any, // Mock the options property
        };

        const mockMacroManager = new MacroManager(mockContext); // MacroManager might not need deep mocking for these tests
        lpcDiagnostics = new LPCDiagnostics(mockContext, mockMacroManager);
    });

    test('Should detect unused global variable', () => {
        const code = "int unused_global_var;\nvoid main() { }";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic for unused global variable");
        if (diagnostics.length > 0) {
            assert.ok(diagnostics[0].message.includes("未使用的全局变量: 'unused_global_var'"), `Message was: ${diagnostics[0].message}`);
            assert.strictEqual(diagnostics[0].range.start.line, 0);
            assert.strictEqual(diagnostics[0].range.start.character, 4); // "int " length
            assert.strictEqual(diagnostics[0].range.end.character, 4 + "unused_global_var".length);
        }
    });

    test('Should not detect used global variable', () => {
        const code = "int used_global_var;\nvoid main() { used_global_var = 1; }";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);
        assert.strictEqual(diagnostics.length, 0, `Expected no diagnostics, but got ${diagnostics.length}: ${diagnostics[0]?.message}`);
    });

    test('Should detect unused local variable', () => {
        const code = "void main() {\n  int local_var;\n}";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic for unused local variable");
        if (diagnostics.length > 0) {
            assert.ok(diagnostics[0].message.includes("未使用的局部变量: 'local_var'"), `Message was: ${diagnostics[0].message}`);
            assert.strictEqual(diagnostics[0].range.start.line, 1);
            assert.strictEqual(diagnostics[0].range.start.character, 6); // "  int "
            assert.strictEqual(diagnostics[0].range.end.character, 6 + "local_var".length);
        }
    });

    test('Should not detect used local variable', () => {
        const code = "void main() {\n  int local_var;\n  local_var = 1;\n}";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);
        assert.strictEqual(diagnostics.length, 0, `Expected no diagnostics, but got ${diagnostics.length}: ${diagnostics[0]?.message}`);
    });

    test('Should detect unused function parameter', () => {
        const code = "void main(int unused_param) {\n}";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic for unused parameter");
        if (diagnostics.length > 0) {
            assert.ok(diagnostics[0].message.includes("未使用的参数: 'unused_param'"), `Message was: ${diagnostics[0].message}`);
            assert.strictEqual(diagnostics[0].range.start.line, 0);
            assert.strictEqual(diagnostics[0].range.start.character, 14); // "void main(int "
            assert.strictEqual(diagnostics[0].range.end.character, 14 + "unused_param".length);
        }
    });

    test('Should not detect used function parameter', () => {
        const code = "void main(int used_param) {\n  used_param = 1;\n}";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);
        assert.strictEqual(diagnostics.length, 0, `Expected no diagnostics, but got ${diagnostics.length}: ${diagnostics[0]?.message}`);
    });

    test('Shadowing: Unused Parameter, Used Local', () => {
        const code = "void main(int val) {\n  int val;\n  val = 2;\n}";
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic for unused parameter 'val'");
        if (diagnostics.length > 0) {
            assert.ok(diagnostics[0].message.includes("未使用的参数: 'val'"), `Message was: ${diagnostics[0].message}`);
            assert.strictEqual(diagnostics[0].range.start.line, 0); // Parameter 'val'
        }
    });

    test('Should not warn for efun usage', () => {
        const code = "void main() {\n  write(\"hello\");\n}"; // Assuming 'write' is an efun
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        // Check that 'write' is not reported as an unused variable.
        const writeDiagnostic = diagnostics.find(d => d.message.includes("'write'"));
        assert.ok(!writeDiagnostic, "Efun 'write' should not be reported as unused.");
    });

    test('Unused variable in a more complex function', () => {
        const code = `
void complex_function(int used_param, string unused_param) {
    int local1;
    int local2 = 0;
    local1 = used_param + 5;
    if (local2 == 0) {
        write("Local2 is zero.");
    }
    // unused_param is not used
    // local_var_in_block is not used
    if (1) { int local_var_in_block; }
}`;
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        assert.strictEqual(diagnostics.length, 2, "Expected two diagnostics");
        const unusedParamDiag = diagnostics.find(d => d.message.includes("'unused_param'"));
        const unusedLocalInBlockDiag = diagnostics.find(d => d.message.includes("'local_var_in_block'"));

        assert.ok(unusedParamDiag, "Should find unused_param");
        if (unusedParamDiag) {
            assert.strictEqual(unusedParamDiag.range.start.line, 1);
        }

        assert.ok(unusedLocalInBlockDiag, "Should find local_var_in_block");
        if (unusedLocalInBlockDiag) {
            assert.strictEqual(unusedLocalInBlockDiag.range.start.line, 9);
        }
    });

    test('Variable used in function call', () => {
        const code = `
void callee(int x) { }
void caller() {
    int my_var = 10;
    callee(my_var);
}`;
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);
        assert.strictEqual(diagnostics.length, 0, "my_var should be considered used");
    });

    test('Variable used in return statement', () => {
        const code = `
int get_value() {
    int result = 42;
    return result;
}`;
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);
        assert.strictEqual(diagnostics.length, 0, "result should be considered used");
    });

    test('Multiple declarations on one line, some unused', () => {
        const code = `
void main() {
    int a, b, c;
    a = 1;
    // b is unused
    // c is unused
}`;
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);
        assert.strictEqual(diagnostics.length, 2, "Expected two unused variables (b, c)");
        assert.ok(diagnostics.some(d => d.message.includes("'b'")), "Should report 'b' as unused");
        assert.ok(diagnostics.some(d => d.message.includes("'c'")), "Should report 'c' as unused");
    });

    test('Foreach loop variable usage', () => {
        const code = `
void process_array(string *arr) {
    string item, key, val;
    mapping m = ([]);
    // item is used
    foreach (item in arr) {
        write(item);
    }
    // key is unused (special case for mapping key often), val is used
    foreach (key, val in m) {
        write(val);
    }
}`;
        const document = createMockDocument(code);
        const tree = parser.parse(document.getText());
        const diagnostics = lpcDiagnostics.collectAstBasedUnusedVariableDiagnostics(document, tree);

        // The isActualVariableUsage for foreach_variables might make them not reported as unused
        // by collectAstBasedUnusedVariableDiagnostics if they are always false.
        // This test checks if the current logic correctly handles them if they *were* to be checked.
        // Based on current isActualVariableUsage, foreach vars are *never* considered "actual usage"
        // for the purpose of being *marked* as used from their declaration point.
        // They are considered declarations. The linter should check if they are used *within their loop*.
        // This specific test might pass (0 diagnostics for item, key, val) because they are declarations.
        // A more advanced test would be needed for use *within* the loop body if the linter was more granular.
        // For now, we expect 'key' to be reported if not for the special handling.
        // The current `isActualVariableUsage` returns false for `foreach_variables`' `variable` field.
        // This means they are treated as declarations and their usage is within the loop itself.
        // `collectAstBasedUnusedVariableDiagnostics` will therefore not flag them as unused *unless*
        // a specific check for "used within its own loop body" is added.
        // This test will likely result in 'item', 'key', 'val' being reported if they are not used in their loops.
        // Given the current setup, `item` is used. `key` is not. `val` is used.
        // So, we expect 'key' to be reported.

        assert.strictEqual(diagnostics.length, 1, "Expected one diagnostic for 'key'");
        const keyDiag = diagnostics.find(d => d.message.includes("'key'"));
        assert.ok(keyDiag, "Unused foreach key 'key' should be reported.");
        if(keyDiag) {
            assert.strictEqual(keyDiag.range.start.line, 3); // line of "string item, key, val;"
        }

    });


});
