import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const readmePath = path.resolve(__dirname, '../../../README.md');
const languageModulePath = path.resolve(__dirname, '../../modules/languageModule.ts');

describe('single-path LSP cutover', () => {
    test('classic host language module is no longer kept as an empty cutover shell', () => {
        expect(fs.existsSync(languageModulePath)).toBe(false);
    });

    test('package.json does not expose public lspMode configuration', () => {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const properties = packageJson.contributes?.configuration?.properties ?? {};
        const commands = packageJson.contributes?.commands ?? [];

        expect(Object.prototype.hasOwnProperty.call(properties, 'lpc.experimental.lspMode')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(properties, 'lpc.includePath')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(properties, 'lpc.simulatedEfunsPath')).toBe(false);
        expect(commands.some((command: { command: string }) => command.command === 'lpc.migrateProjectConfig')).toBe(false);
    });

    test('README documents a single LSP runtime path', () => {
        const readme = fs.readFileSync(readmePath, 'utf8');

        expect(readme).toContain('单一路径 LSP');
        expect(readme).toContain('主语言能力链、诊断与格式化都通过这条路径提供');
        expect(readme).toContain('少量宿主侧 affordances 保留在 VS Code 扩展宿主中');
        expect(readme).toContain('函数文档面板、错误树视图、编译管理与启动驱动命令');
        expect(readme).not.toContain('语言能力、诊断与格式化都通过这条路径提供');
        expect(readme).not.toContain('Experimental LSP Runtime');
    });
});
