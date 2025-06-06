import * as vscode from 'vscode';
import { findDefinitionUsingParser } from './lpcDefinitionService';
import { LPCDefinitionProvider as OriginalLPCDefinitionProvider } from '../definitionProvider'; // Import original
import { MacroManager } from '../macroManager';
import { EfunDocsManager } from '../efunDocs';

export class LPCWrappingDefinitionProvider implements vscode.DefinitionProvider {
    private originalDefinitionProvider: OriginalLPCDefinitionProvider;

    constructor(macroManager: MacroManager, efunDocsManager: EfunDocsManager) {
        this.originalDefinitionProvider = new OriginalLPCDefinitionProvider(macroManager, efunDocsManager);
    }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.DefinitionLink[] | null | undefined> {

        // 1. Try parser-based definition lookup first
        try {
            // console.log("LPCWrappingDefinitionProvider: Attempting parser-based definition lookup.");
            const parserBasedLocation = await findDefinitionUsingParser(document, position);
            if (parserBasedLocation) {
                // console.log("LPCWrappingDefinitionProvider: Parser-based definition found.", parserBasedLocation);
                return parserBasedLocation;
            }
            // console.log("LPCWrappingDefinitionProvider: Parser-based definition not found, falling back.");
        } catch (e) {
            console.error("LPCWrappingDefinitionProvider: Error during parser-based definition lookup:", e);
            // Fall through to original provider on error
        }

        // 2. Fallback to the original (regex-based) definition provider
        // console.log("LPCWrappingDefinitionProvider: Falling back to original definition provider.");
        return this.originalDefinitionProvider.provideDefinition(document, position, token);
    }
}
