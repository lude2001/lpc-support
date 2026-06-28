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
        const changeIndex = {
            addDependencyFootprint: jest.fn(),
            recordDependencyFootprint: jest.fn()
        };
        const WorkspaceChangeIndex = jest.fn(() => changeIndex);

        jest.isolateModules(() => {
            jest.doMock('../bootstrap/createServer', () => ({
                createServer
            }));
            jest.doMock('../runtime/createProductionLanguageServices', () => ({
                createProductionLanguageServices
            }));
            jest.doMock('../runtime/WorkspaceChangeIndex', () => ({
                WorkspaceChangeIndex
            }));

            require('../main');
        });

        expect(WorkspaceChangeIndex).toHaveBeenCalledTimes(1);
        expect(createProductionLanguageServices).toHaveBeenCalledWith({ changeIndex });
        expect(createServer).toHaveBeenCalledWith({
            ...services,
            changeIndex
        });
        expect(start).toHaveBeenCalledTimes(1);
    });
});
