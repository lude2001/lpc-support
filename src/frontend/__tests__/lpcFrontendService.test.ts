import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { LpcFrontendService } from '../LpcFrontendService';
import { TestHelper } from '../../__tests__/utils/TestHelper';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('LpcFrontendService', () => {
    let tempRoot: string | undefined;

    afterEach(() => {
        if (tempRoot) {
            fs.rmSync(tempRoot, { recursive: true, force: true });
            tempRoot = undefined;
        }
    });

    test('creates a snapshot with directives, macros, inactive ranges, and active source', () => {
        const document = TestHelper.createMockDocument([
            '#define PATH "/std/object"',
            '#ifdef ENABLED',
            'int broken = ;',
            '#endif',
            'inherit PATH;'
        ].join('\n'));

        const snapshot = new LpcFrontendService().get(document);

        expect(snapshot.uri).toBe(document.uri.toString());
        expect(snapshot.preprocessor.macros).toEqual([
            expect.objectContaining({ name: 'PATH', replacement: '"/std/object"' })
        ]);
        expect(snapshot.preprocessor.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 2, character: 0 })
                })
            })
        ]);
        expect(snapshot.preprocessor.activeView.text).toContain('inherit PATH;');
        expect(snapshot.dialect.name).toBe('FluffOS');
    });

    test('returns cached snapshots for unchanged document versions', () => {
        const document = TestHelper.createMockDocument('#define FOO 1\nvoid create() {}');
        const service = new LpcFrontendService();

        const first = service.get(document);
        const second = service.get(document);

        expect(second).toBe(first);
    });

    test('imports include macros into conditional evaluation and macro expansion', () => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-frontend-include-'));
        const includeDir = path.join(tempRoot, 'include');
        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(path.join(includeDir, 'defs.h'), [
            '#define ENABLED 1',
            '#define Declare(name) int name##_value;'
        ].join('\n'));
        const document = TestHelper.createMockDocument([
            '#include <defs.h>',
            '#ifdef ENABLED',
            'Declare(score)',
            '#else',
            'int broken = ;',
            '#endif'
        ].join('\n'), 'lpc', path.join(tempRoot, 'main.c'));

        const snapshot = new LpcFrontendService({ includeDirectories: [includeDir] }).get(document);

        expect(snapshot.preprocessor.inactiveRanges).toEqual([
            expect.objectContaining({
                range: expect.objectContaining({
                    start: expect.objectContaining({ line: 4, character: 0 })
                })
            })
        ]);
        expect(snapshot.preprocessor.macros.map((macro) => macro.name)).toEqual(
            expect.arrayContaining(['ENABLED', 'Declare'])
        );
        expect(snapshot.preprocessor.activeView.text).toContain('int score_value;');
    });
});
