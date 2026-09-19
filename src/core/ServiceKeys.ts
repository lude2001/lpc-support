import type { LPCCompiler } from '../compiler';
import type { DiagnosticsCommands } from '../diagnostics/RustDiagnosticsCommands';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import type { BundledEfunDocsProvider } from '../efun/BundledEfunDocsProvider';
import type { ErrorTreeDataProvider } from '../errorTreeDataProvider';
import type { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import type { LpcProjectConfigSnapshotService } from '../projectConfig/LpcProjectConfigSnapshotService';
import type { ProjectConfigOnboardingService } from '../projectConfig/ProjectConfigOnboardingService';
import { ServiceKey } from './ServiceRegistry';

export const Services = {
    EfunDocs: new ServiceKey<BundledEfunDocsProvider>('EfunDocs'),
    Compiler: new ServiceKey<LPCCompiler>('Compiler'),
    ProjectConfig: new ServiceKey<LpcProjectConfigService>('ProjectConfig'),
    ProjectConfigSnapshot: new ServiceKey<LpcProjectConfigSnapshotService>('ProjectConfigSnapshot'),
    ProjectConfigOnboarding: new ServiceKey<ProjectConfigOnboardingService>('ProjectConfigOnboarding'),
    TextDocumentHost: new ServiceKey<TextDocumentHost>('TextDocumentHost'),
    Diagnostics: new ServiceKey<DiagnosticsCommands>('Diagnostics'),
    ErrorTree: new ServiceKey<ErrorTreeDataProvider>('ErrorTree')
};
