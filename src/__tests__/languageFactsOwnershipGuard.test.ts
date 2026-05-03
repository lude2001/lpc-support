import { describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('language facts ownership guards', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const srcRoot = path.join(repoRoot, 'src');

    test('production parser construction remains inside the parser owner', () => {
        const parserConstructors = listProductionTypeScriptFiles(srcRoot)
            .filter((filePath) => fs.readFileSync(filePath, 'utf8').match(/\bnew\s+(?:LPCLexer|LPCParser)\b/))
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(parserConstructors).toEqual([
            'src/parser/LPCParserUtil.ts',
            'src/parser/ParsedDocumentService.ts'
        ]);
    });

    test('language fact tables stay centralized and legacy regex utility stays removed', () => {
        const productionFiles = listProductionTypeScriptFiles(srcRoot);
        const duplicatedFactOwners = productionFiles
            .filter((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/') !== 'src/frontend/languageFacts.ts')
            .filter((filePath) => {
                const source = fs.readFileSync(filePath, 'utf8');
                return /\b(?:TYPE_KEYWORDS|DEFAULT_KEYWORDS|PREPROCESSOR_KEYWORDS|LPC_TYPES|RegexPatterns)\b/.test(source);
            })
            .map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'))
            .sort();

        expect(duplicatedFactOwners).toEqual([]);
        expect(fs.existsSync(path.join(srcRoot, 'utils', 'regexPatterns.ts'))).toBe(false);
    });
});

function listProductionTypeScriptFiles(rootDir: string): string[] {
    const files: string[] = [];

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
        const fullPath = path.join(rootDir, entry.name);

        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'antlr') {
                continue;
            }

            files.push(...listProductionTypeScriptFiles(fullPath));
            continue;
        }

        if (!entry.name.endsWith('.ts')) {
            continue;
        }

        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
            continue;
        }

        files.push(fullPath);
    }

    return files;
}
