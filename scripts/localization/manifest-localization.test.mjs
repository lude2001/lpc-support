import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = async filename => JSON.parse(await readFile(path.join(repositoryRoot, filename), 'utf8'));
const manifest = await readJson('package.json');
const english = await readJson('package.nls.json');
const chinese = await readJson('package.nls.zh-cn.json');
const referencePattern = /^%([^%]+)%$/u;
const visibleProperties = new Set([
    'title', 'shortTitle', 'category', 'name', 'description', 'markdownDescription',
    'deprecationMessage', 'markdownDeprecationMessage'
]);
const visibleArrays = new Set(['enumDescriptions', 'markdownEnumDescriptions', 'enumItemLabels']);

function collectFields(value, location, result, visibleOnly) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            const itemLocation = `${location}[${index}]`;
            if (!visibleOnly && typeof item === 'string') result.push([itemLocation, item]);
            else collectFields(item, itemLocation, result, visibleOnly);
        });
        return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
        const entryLocation = `${location}.${key}`;
        if (typeof entry === 'string' && (!visibleOnly || visibleProperties.has(key))) {
            result.push([entryLocation, entry]);
        }
        if (visibleOnly && visibleArrays.has(key)) {
            entry.forEach((item, index) => result.push([`${entryLocation}[${index}]`, item]));
        } else if (entry && typeof entry === 'object') {
            collectFields(entry, entryLocation, result, visibleOnly);
        }
    }
}

const visibleFields = [['package.displayName', manifest.displayName], ['package.description', manifest.description]];
collectFields(manifest.contributes, 'package.contributes', visibleFields, true);
// Native snippet localization selects one resource path through manifest NLS.
// This is the only technical path allowed to contain a localization reference.
const technicalResourceFields = [
    ['package.contributes.snippets[0].path', manifest.contributes.snippets[0]?.path]
];
const keys = [...visibleFields, ...technicalResourceFields].map(([location, value]) => {
    const match = referencePattern.exec(value);
    assert.ok(match, `${location} must use a manifest localization reference`);
    return match[1];
});
const placeholders = message => [...message.matchAll(/\{([^{}]+)\}/gu)].map(match => match[1]).sort();

test('all manifest resource references resolve in both languages without unused resource keys', () => {
    const expectedKeys = [...new Set(keys)].sort();
    assert.deepEqual(Object.keys(english).sort(), expectedKeys);
    assert.deepEqual(Object.keys(chinese).sort(), expectedKeys);
    for (const key of expectedKeys) {
        assert.equal(typeof english[key], 'string', `English value for ${key}`);
        assert.equal(typeof chinese[key], 'string', `Chinese value for ${key}`);
        assert.ok(english[key].trim(), `English value for ${key} cannot be empty`);
        assert.ok(chinese[key].trim(), `Chinese value for ${key} cannot be empty`);
        assert.deepEqual(placeholders(chinese[key]), placeholders(english[key]), `Placeholders for ${key}`);
    }
});

test('English is the default manifest resource and contains no untranslated Chinese text', () => {
    for (const [key, message] of Object.entries(english)) {
        assert.equal(/\p{Script=Han}/u.test(message), false, key);
        assert.equal(referencePattern.test(message), false, `Unresolved nested resource in ${key}`);
    }
});

test('localization references preserve technical identities except the known snippet resource path', () => {
    const allFields = [];
    collectFields(manifest, 'package', allFields, false);
    const allowedLocations = new Set([...visibleFields, ...technicalResourceFields].map(([location]) => location));
    for (const [location, value] of allFields) {
        if (referencePattern.test(value)) assert.ok(allowedLocations.has(location), location);
    }
    assert.equal(manifest.name, 'lpc-support');
    assert.deepEqual(manifest.contributes.commands.map(command => command.command), [
        'lpc.startDriver', 'lpc.showVariables', 'lpc.scanFolder', 'lpc.compileFile', 'lpc.compileFolder',
        'lpc.manageCompilation', 'lpc.configureSimulatedEfuns', 'lpc.initProjectConfig',
        'lpc.showFunctionDoc', 'lpc.showAnalysisInspector', 'lpc.rebuildWorkspaceIndex',
        'lpc.generateJavadoc', 'lpc.errorTree.refresh', 'lpc.errorTree.clear',
        'lpc.errorTree.openErrorLocation', 'lpc.errorTree.copyError'
    ]);
    assert.deepEqual(manifest.contributes.configuration.properties['lpc.format.braceStyle'].enum, ['allman', 'kr']);
    assert.equal(manifest.contributes.configuration.properties['lpc.glm4.model'].default, 'GLM-4-Flash-250414');
    assert.equal(manifest.contributes.configuration.properties['lpc.glm4.baseUrl'].default,
        'https://open.bigmodel.cn/api/paas/v4');
    assert.deepEqual(manifest.contributes.configuration.properties['lpc.glm4.customModels'].items.required,
        ['name', 'id']);
    assert.deepEqual(manifest.contributes.languages[0].aliases, ['LPC', 'lpc']);
});

test('manifest packages both localization mechanisms and registers one native snippet resource', () => {
    assert.equal(manifest.l10n, './l10n');
    assert.ok(manifest.files.includes('package.nls*.json'));
    assert.ok(manifest.files.includes('l10n/bundle.l10n*.json'));
    assert.ok(manifest.files.includes('snippets/**'));
    assert.deepEqual(manifest.contributes.snippets, [{ language: 'lpc', path: '%snippetPath%' }]);
    assert.equal(english.snippetPath, './snippets/lpc.json');
    assert.equal(chinese.snippetPath, './snippets/lpc.zh-cn.json');
});

test('both native snippet resources exist and preserve all nine logical entries and insertion bodies', async () => {
    const englishSnippets = await readJson(english.snippetPath);
    const chineseSnippets = await readJson(chinese.snippetPath);
    assert.deepEqual(Object.keys(englishSnippets), [
        'Create Function', 'Create Object', 'Create Room', 'Create NPC', 'Create Item',
        'Create Weapon', 'Create Armor', 'Add Action', 'Create Apply'
    ]);
    assert.deepEqual(Object.keys(chineseSnippets), Object.keys(englishSnippets));
    for (const [key, englishSnippet] of Object.entries(englishSnippets)) {
        const { description: englishDescription, ...englishFacts } = englishSnippet;
        const { description: chineseDescription, ...chineseFacts } = chineseSnippets[key];
        assert.deepEqual(chineseFacts, englishFacts, `${key}: only description may differ`);
        assert.deepEqual(chineseSnippets[key].prefix, englishSnippet.prefix, `${key}: prefix`);
        assert.deepEqual(chineseSnippets[key].body, englishSnippet.body, `${key}: body`);
        assert.equal(typeof englishDescription, 'string', `${key}: English description`);
        assert.equal(typeof chineseDescription, 'string', `${key}: Chinese description`);
        assert.ok(englishDescription.trim(), `${key}: English description must be nonempty`);
        assert.ok(chineseDescription.trim(), `${key}: Chinese description must be nonempty`);
        assert.equal(/\p{Script=Han}/u.test(englishDescription), false, key);
        assert.equal(/\p{Script=Han}/u.test(chineseDescription), true, key);
    }
});

test('command messages use literal English templates and complete Chinese mappings', async () => {
    const messages = await readJson('l10n/source/commands.json');
    const filename = 'src/modules/commandModule.ts';
    const source = await readFile(path.join(repositoryRoot, filename), 'utf8');
    const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    const usedMessages = new Set();
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'vscode.l10n.t') {
            const [template, ...args] = node.arguments;
            assert.ok(ts.isStringLiteral(template), 'Messages must be statically extractable literal templates');
            assert.equal(/\p{Script=Han}/u.test(template.text), false, template.text);
            assert.equal(typeof messages[template.text], 'string', `Missing command translation: ${template.text}`);
            assert.ok(messages[template.text].trim(), template.text);
            assert.deepEqual(placeholders(messages[template.text]), placeholders(template.text), template.text);
            for (const placeholder of placeholders(template.text)) {
                assert.match(placeholder, /^\d+$/u);
                assert.ok(Number(placeholder) < args.length, `Missing interpolation argument: ${template.text}`);
            }
            usedMessages.add(template.text);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    assert.ok(usedMessages.size > 0);
    assert.deepEqual(Object.keys(messages).sort(), [...usedMessages].sort(), 'Command resource has unused keys');
    assert.equal(/\p{Script=Han}/u.test(source), false, 'Command module retains an untranslated Chinese literal');
});
