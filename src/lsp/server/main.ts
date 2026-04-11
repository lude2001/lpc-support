import { createServer } from './bootstrap/createServer';
import { createProductionLanguageServices } from './runtime/createProductionLanguageServices';

createServer(createProductionLanguageServices()).start();
