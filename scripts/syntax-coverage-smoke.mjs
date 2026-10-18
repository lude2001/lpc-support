import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifySyntaxCoverage(connection, workspace, publishedDiagnostics) {
    const uri = pathToFileURL(path.join(workspace, 'syntax-coverage.c')).toString();
    const textDocument = { uri };
    const source = [
        'class CoveragePair { int x, y; }',
        'class CoveragePair pair;',
        'promise<int> *pending;',
        'async int coverage_value() { return 1; }',
        'promise<int> coverage_pass(promise<int> p) { return p; }',
        'async mixed coverage_main(mapping data, mixed *items, int ref value) {',
        '  mixed elapsed = time_expression { value++; };',
        '  acatch { value = await coverage_value(); };',
        '  foreach (int &item in items) { item++; }',
        '  return ({ 1e-3, items..., (: (: $1 :) :), `value=${value}`, data?.key, data?.["key"], data.?["key"], pair->y, pending, elapsed });',
        '}',
        ''
    ].join('\n');
    connection.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'lpc', version: 1, text: source } });
    try {
        const inspection = await connection.sendRequest('lpc/analysisInspection', { textDocument, position: { line: 2, character: 15 } });
        assert.equal(inspection.version, 1);
        assert.equal(publishedDiagnostics()?.uri, uri);
        assert.deepEqual(publishedDiagnostics()?.diagnostics, []);
        const diagnostics = await connection.sendRequest('lpc/workspaceDiagnostics', { uriPrefix: uri });
        assert.deepEqual(diagnostics, []);
        const docs = await connection.sendRequest('lpc/functionDocumentation', { textDocument });
        const signature = docs.currentFile.entries.find(entry => entry.name === 'coverage_pass').structuredSignature;
        assert.equal(signature.returnType, 'promise<int>');
        assert.equal(signature.parameters[0].typeName, 'promise<int>');
        const symbols = await connection.sendRequest('textDocument/documentSymbol', { textDocument });
        assert.deepEqual(symbols.find(symbol => symbol.name === 'CoveragePair').children.map(symbol => symbol.name), ['x', 'y']);
        assert(symbols.some(symbol => symbol.name === 'pending'));
        const definitions = await connection.sendRequest('textDocument/definition', { textDocument, position: { line: 7, character: source.split('\n')[7].indexOf('coverage_value') + 1 } });
        assert.equal(definitions.length, 1);
        assert.equal(definitions[0].range.start.line, 3);
        const edits = await connection.sendRequest('textDocument/formatting', { textDocument, options: { tabSize: 4, insertSpaces: true } });
        const formatted = edits[0]?.newText;
        assert(formatted?.includes('class CoveragePair pair;'));
        assert(formatted.includes('1e-3'));
        assert(formatted.includes('items...'));
        assert(formatted.includes('`value=${value}`'));
        assert.equal((formatted.match(/\(:/g) ?? []).length, 2);
        connection.sendNotification('textDocument/didChange', { textDocument: { uri, version: 2 }, contentChanges: [{ text: formatted }] });
        await connection.sendRequest('lpc/health');
        assert.deepEqual(publishedDiagnostics()?.diagnostics, []);
        const repeated = await connection.sendRequest('textDocument/formatting', { textDocument, options: { tabSize: 4, insertSpaces: true } });
        assert.deepEqual(repeated, []);
    } finally {
        connection.sendNotification('textDocument/didClose', { textDocument });
    }

    const preprocessorSource = [
        '/*', '#if 0', '*/',
        '#define DOUBLE(x) ((x) * 2)',
        '#if DOUBLE(DOUBLE(2)) == 8 && (1 << 2) == 4 && efun_defined(sizeof) /* comment */',
        'int coverage_selected() { return 1; }',
        '#else', 'int coverage_hidden() { return 0; }', '#endif',
        '#define COVERAGE_DECL(name) int name = 1',
        'COVERAGE_DECL(coverage_generated);',
        'int coverage_read_macro() { return coverage_generated; }', ''
    ].join('\n');
    connection.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'lpc', version: 3, text: preprocessorSource } });
    try {
        const inspection = await connection.sendRequest('lpc/analysisInspection', { textDocument, position: { line: 5, character: 8 } });
        assert(inspection.preprocessedText.includes('int coverage_selected()'));
        assert(!inspection.preprocessedText.includes('int coverage_hidden()'));
        assert.deepEqual(publishedDiagnostics()?.diagnostics, []);
        const symbols = await connection.sendRequest('workspace/symbol', { query: 'coverage_generated' });
        assert.equal(symbols.length, 1);
        assert.equal(symbols[0].location.uri, uri);
    } finally {
        connection.sendNotification('textDocument/didClose', { textDocument });
    }
}
