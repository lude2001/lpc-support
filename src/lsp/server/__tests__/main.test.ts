import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
describe('production LSP server entry', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('creates production language services and passes them into createServer', () => {
        const start = jest.fn();
        const createServer = jest.fn(() => ({ start }));
        const services = {
            completionService: { provideCompletion: jest.fn() },
            navigationService: { provideHover: jest.fn() },
            structureService: { provideFoldingRanges: jest.fn() },
            codeActionsService: { provideCodeActions: jest.fn() }
        };
        const createProductionLanguageServices = jest.fn(() => services);

        jest.isolateModules(() => {
            jest.doMock('../bootstrap/createServer', () => ({
                createServer
            }));
            jest.doMock('../runtime/createProductionLanguageServices', () => ({
                createProductionLanguageServices
            }));

            require('../main');
        });

        expect(createProductionLanguageServices).toHaveBeenCalledTimes(1);
        expect(createServer).toHaveBeenCalledWith(services);
        expect(start).toHaveBeenCalledTimes(1);
    });
});
