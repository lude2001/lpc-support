import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
    let tempRoot: string | undefined;

    afterEach(() => {
        if (tempRoot) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
            tempRoot = undefined;
        }
    });

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

    test('resolves bare system includes from the mudlib include directory', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-preprocessor-regression-'));
        const itemDir = path.join(tempRoot, 'inherit', 'item');
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(itemDir, { recursive: true });
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(includeDir, 'dbase.h'), '#define F_DBASE "/inherit/dbase"');
        fs.writeFileSync(path.join(includeDir, 'name.h'), '#define F_NAME "/inherit/name"');

        const fileName = path.join(itemDir, 'combined.c');
        const document = createDocument([
            '#include <dbase.h>',
            '#include <name.h>',
            '',
            'inherit F_DBASE;',
            'inherit F_NAME;',
            '',
            'void create()',
            '{',
            '    return;',
            '}'
        ].join('\n'), fileName);

        const parsed = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: true }).get(document);

        expect(parsed.diagnostics).toHaveLength(0);
        expect(parsed.frontend?.preprocessor.includeReferences).toEqual([
            expect.objectContaining({
                value: 'dbase.h',
                resolvedUri: vscode.Uri.file(path.join(includeDir, 'dbase.h')).toString()
            }),
            expect.objectContaining({
                value: 'name.h',
                resolvedUri: vscode.Uri.file(path.join(includeDir, 'name.h')).toString()
            })
        ]);
    });

    test('keeps function-like macro receivers as normal expressions when followed by member access', () => {
        const document = createDocument([
            '#define SKILL_D(x)      ("/kungfu/skill/" + x)',
            '',
            'void cast_spell(string spell)',
            '{',
            '    string spell_skill;',
            '',
            '    if (stringp(spell_skill = query_skill_mapped("spells")))',
            '        SKILL_D(spell_skill)->cast_spell(this_object(), spell);',
            '}'
        ].join('\n'), '/virtual/inherit/char/npc.c');

        const parsed = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: true }).get(document);

        expect(parsed.diagnostics).toHaveLength(0);
        expect(parsed.parseText).toContain('SKILL_D(spell_skill)->cast_spell(this_object(), spell);');
    });
});
