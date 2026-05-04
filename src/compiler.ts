import { CompilationService } from './compilation/CompilationService';
import { LocalLpccpCompilationBackend } from './compilation/LocalLpccpCompilationBackend';
import { RemoteCompilationBackend } from './compilation/RemoteCompilationBackend';
import { LpcProjectConfigService } from './projectConfig/LpcProjectConfigService';

export class LPCCompiler {
    private readonly compilationService: CompilationService;

    constructor(
        projectConfigService: LpcProjectConfigService = new LpcProjectConfigService()
    ) {
        this.compilationService = new CompilationService(
            projectConfigService,
            new LocalLpccpCompilationBackend(),
            new RemoteCompilationBackend()
        );
    }

    public async compileFile(filePath: string): Promise<void> {
        await this.compilationService.compileFile(filePath);
    }

    public async compileFolder(folderPath: string): Promise<void> {
        await this.compilationService.compileFolder(folderPath);
    }
}
