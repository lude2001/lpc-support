import { createServer } from './bootstrap/createServer';
import { createProductionLanguageServices } from './runtime/createProductionLanguageServices';
import { WorkspaceChangeIndex } from './runtime/WorkspaceChangeIndex';

const changeIndex = new WorkspaceChangeIndex();

createServer({
    ...createProductionLanguageServices({ changeIndex }),
    changeIndex
}).start();
