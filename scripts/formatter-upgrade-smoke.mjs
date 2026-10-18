import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyFormatterUpgrade(connection, workspace) {
    const headerUri = pathToFileURL(path.join(workspace, 'formatter-upgrade.h')).toString();
    const uri = pathToFileURL(path.join(workspace, 'formatter-upgrade.c')).toString();
    const textDocument = { uri };
    writeFileSync(path.join(workspace, 'formatter-upgrade.h'), '#define imported_text(x) #x\n');
    const source = [
        '#include "formatter-upgrade.h"',
        '#if 0',
        'int hidden(){return 2;}',
        '#else',
        'int visible(){string value=imported_text( alpha +  beta );return consume(first_argument, second_argument, third_argument);}',
        '#endif', ''
    ].join('\n');
    const options = { tabSize: 8, insertSpaces: true };
    const configure = formatting => connection.sendNotification('lpc/workspaceConfigSync', {
        workspaceRoots: [workspace], workspaces: [{ workspaceRoot: workspace }], formatting
    });
    configure({ indentSize: 2, printWidth: 44, braceStyle: 'kr' });
    connection.sendNotification('textDocument/didOpen', {
        textDocument: { uri, languageId: 'lpc', version: 1, text: source }
    });
    try {
        const edits = await connection.sendRequest('textDocument/formatting', { textDocument, options });
        assert.equal(edits.length, 1);
        const formatted = edits[0].newText;
        assert(formatted.includes('int hidden() {\n  return 2;'));
        assert(formatted.includes('int visible() {'));
        assert(formatted.includes('imported_text( alpha +  beta )'), 'imported stringizing macro arguments must stay verbatim');
        assert(formatted.includes('consume(\n    first_argument,\n    second_argument,\n    third_argument\n  )'));
        assert.deepEqual(formatted.match(/^#.*$/gm), source.match(/^#.*$/gm));
        connection.sendNotification('textDocument/didChange', {
            textDocument: { uri, version: 2 }, contentChanges: [{ text: formatted }]
        });
        assert.deepEqual(await connection.sendRequest('textDocument/formatting', { textDocument, options }), []);
        configure({ indentSize: 2, printWidth: 0, braceStyle: 'allman' });
        const tabs = await connection.sendRequest('textDocument/formatting', {
            textDocument, options: { tabSize: 2, insertSpaces: false }
        });
        assert(tabs[0].newText.includes('int hidden()\n{\n\treturn 2;'));
        assert(tabs[0].newText.includes('imported_text( alpha +  beta )'));

        // Header overlays must change the formatter's macro facts immediately.
        connection.sendNotification('textDocument/didOpen', {
            textDocument: { uri: headerUri, languageId: 'lpc', version: 1, text: '#define different_macro(x) #x\n' }
        });
        const refreshed = await connection.sendRequest('textDocument/formatting', { textDocument, options });
        assert(refreshed[0].newText.includes('imported_text(alpha + beta)'), 'stale imported macro protection survived a header edit');

        connection.sendNotification('textDocument/didChange', {
            textDocument: { uri, version: 3 }, contentChanges: [{ text: source }]
        });
        const range = await connection.sendRequest('textDocument/rangeFormatting', {
            textDocument, options,
            range: { start: { line: 4, character: 0 }, end: { line: 4, character: source.split('\n')[4].length } }
        });
        assert.equal(range.length, 1);
        assert.equal(range[0].range.start.line, 4);
        assert.equal(range[0].range.end.line, 4);
        assert(range[0].newText.includes('int visible()\n{'));
        assert(!range[0].newText.includes('hidden'));
    } finally {
        connection.sendNotification('textDocument/didClose', { textDocument: { uri: headerUri } });
        connection.sendNotification('textDocument/didClose', { textDocument });
        connection.sendNotification('lpc/workspaceConfigSync', { workspaceRoots: [], workspaces: [{ formatIndentSize: 2 }] });
    }
}
