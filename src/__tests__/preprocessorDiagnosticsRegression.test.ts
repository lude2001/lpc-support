import * as vscode from 'vscode';
import { ParsedDocumentService } from '../parser/ParsedDocumentService';

function createDocument(content: string, fileName: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version: 1,
        lineCount: content.split(/\r?\n/).length,
        getText: jest.fn(() => content)
    } as unknown as vscode.TextDocument;
}

describe('preprocessor diagnostics regressions', () => {
    test('parses controller macros before following public function declarations', () => {
        const document = createDocument([
            '#define RequestType(f_name,http_type) string f_name##_request_type = http_type;',
            '',
            'RequestType(pay_add,"POST")',
            'public mapping pay_add(string userid, mixed rmb)',
            '{',
            '    return ([]);',
            '}'
        ].join('\n'), '/virtual/external_system_package/http/controller/pay_game.c');

        const parsed = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: true }).get(document);

        expect(parsed.diagnostics).toHaveLength(0);
        expect(parsed.parseText).toContain('string pay_add_request_type = "POST";');
    });

    test('does not parse disabled else branches as active LPC code', () => {
        const document = createDocument([
            '#if 0',
            'if (interactive(target))',
            '    tell_object(target, msg);',
            'else',
            '    message("tell_object", msg, target);',
            'else',
            '    message("tell_room", msg, environment(target));',
            '#endif',
            '',
            'void create()',
            '{',
            '    return;',
            '}'
        ].join('\n'), '/virtual/adm/simul_efun/message.c');

        const parsed = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: true }).get(document);

        expect(parsed.diagnostics).toHaveLength(0);
        expect(parsed.frontend?.preprocessor.inactiveRanges).toHaveLength(1);
    });
});
