import { LpcFrontendService } from '../LpcFrontendService';
import { TestHelper } from '../../__tests__/utils/TestHelper';

describe('LpcFrontendService', () => {
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
});
