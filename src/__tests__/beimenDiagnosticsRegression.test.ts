import { afterEach, describe, expect, test } from '@jest/globals';
import { createDiagnosticsStack } from '../diagnostics';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';

function createLanguageDocument(text: string) {
    return {
        uri: 'file:///workspace/d/city/beimen.c',
        version: 1,
        getText: () => text
    };
}

describe('city room diagnostics regression', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
    });

    test('accepts heredoc arguments followed by a closing call delimiter', async () => {
        const source = [
            '// Room: /city/beimen.c',
            '#define LONG 16',
            '',
            'inherit ROOM;',
            '',
            'string look_gaoshi();',
            '',
            'void create()',
            '{',
            '    set("short", "北城门");',
            '    set("long", @LONG',
            '这是扬州北城门。',
            'LONG );',
            '    set("item_desc", ([',
            '        "【告示】" : (:look_gaoshi:),',
            '    ]));',
            '    set("exits", ([',
            '        "south" : __DIR__"beidajie2",',
            '        "north" : "/d/shaolin/yidao",',
            '    ]));',
            '    setup();',
            '}',
            '',
            'string look_gaoshi()',
            '{',
            '    return FINGER_D->get_killer() + "\\n扬城巡检司\\n";',
            '}'
        ].join('\n');
        const diagnosticsService = createDiagnosticsStack(DocumentSemanticSnapshotService.getInstance()).diagnosticsService;

        const diagnostics = await diagnosticsService.collectDiagnostics({
            context: {
                document: createLanguageDocument(source),
                workspace: {
                    workspaceRoot: '/workspace'
                },
                mode: 'lsp'
            }
        });

        expect(diagnostics).toEqual([]);
    });
});
