import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const DEFAULT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CODE_EXTENSION = /\.(?:[cm]?js|jsx|tsx?)$/i;
const HTML_EXTENSION = /\.html?$/i;
const EXCLUDED_DIRECTORY = /^(?:__tests__|__mocks__|__fixtures__|tests?|fixtures?|node_modules|dist|out)$/i;
const UI_PROPERTIES = new Set(['label', 'title', 'description', 'detail', 'tooltip', 'prompt', 'placeHolder', 'placeholder', 'text', 'message', 'status', 'validationMessage', 'accessibilityInformation']);
const HTML_UI_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label', 'aria-description', 'aria-valuetext', 'alt', 'label', 'summary']);
const NOTIFICATIONS = /^(?:showInformationMessage|showWarningMessage|showErrorMessage)$/;
const SLOT = /__I18N_SLOT_(\d+)__/g;
const DEFINITE_TYPES = /^(?:string|number|boolean|object|unknown|undefined|null|void|never|any|String|Number|Boolean|Object|Error|Promise|Array|Record|Map|Set)$/;

const hash = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const compact = value => value.replace(/\s+/gu, ' ').trim();

function propertyName(node, source) {
    return node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : node?.getText(source);
}

function callName(node, source) {
    if (!node) return '';
    return ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isIdentifier(node) ? node.text : node.getText(source);
}

function anchorFor(node, source) {
    const parts = [];
    for (let current = node; current; current = current.parent) {
        if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isClassDeclaration(current)
            || ts.isVariableDeclaration(current) || ts.isPropertyDeclaration(current)) && current.name) {
            parts.unshift(compact(current.name.getText(source)));
        }
    }
    return parts.join('/') || '<module>';
}

function sourceLocation(source, start, end) {
    const first = source.getLineAndCharacterOfPosition(Math.max(0, start));
    const last = source.getLineAndCharacterOfPosition(Math.max(start, end));
    return { line: first.line + 1, column: first.character + 1, endLine: last.line + 1, endColumn: last.character + 1 };
}

// Decode a JS literal without evaluating it, retaining a source offset for every character.
// TypeScript provides the AST and literal boundaries; the map keeps HTML fragment lines exact.
function decodeChunk(raw, sourceStart, mapPosition) {
    let text = '';
    const positions = [];
    for (let i = 0; i < raw.length;) {
        const start = i;
        let value = raw[i++];
        if (value === '\\' && i < raw.length) {
            const escaped = raw[i++];
            if (escaped === '\r' || escaped === '\n') {
                if (escaped === '\r' && raw[i] === '\n') i++;
                continue;
            }
            const basic = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };
            value = basic[escaped] ?? escaped;
            if (escaped === 'x' && /^[\da-f]{2}$/i.test(raw.slice(i, i + 2))) {
                value = String.fromCharCode(Number.parseInt(raw.slice(i, i + 2), 16));
                i += 2;
            } else if (escaped === 'u') {
                const match = raw.slice(i).match(/^(?:\{([\da-f]+)\}|([\da-f]{4}))/i);
                if (match) {
                    const codePoint = Number.parseInt(match[1] ?? match[2], 16);
                    if (codePoint <= 0x10ffff) value = String.fromCodePoint(codePoint);
                    i += match[0].length;
                }
            }
        }
        text += value;
        for (let j = 0; j < value.length; j++) positions.push(mapPosition(sourceStart + start));
    }
    return { text, positions };
}

function literalValue(node, source, mapPosition) {
    const chunks = ts.isTemplateExpression(node)
        ? [node.head, ...node.templateSpans.map(span => span.literal)] : [node];
    let text = '';
    const positions = [];
    const placeholders = [];
    for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const start = chunk.getStart(source) + 1;
        const trailing = chunk.kind === ts.SyntaxKind.TemplateHead || chunk.kind === ts.SyntaxKind.TemplateMiddle ? 2 : 1;
        const decoded = decodeChunk(source.text.slice(start, chunk.end - trailing), start, mapPosition);
        text += decoded.text;
        for (const position of decoded.positions) positions.push(position);
        if (ts.isTemplateExpression(node) && index < node.templateSpans.length) {
            const expression = node.templateSpans[index].expression;
            const marker = `__I18N_SLOT_${index}__`;
            const offset = mapPosition(expression.getStart(source));
            text += marker;
            positions.push(...Array(marker.length).fill(offset));
            placeholders.push({ name: String(index), expression: compact(expression.getText(source)), offset,
                end: mapPosition(expression.end) });
        }
    }
    return { text, positions, placeholders };
}

function readableText(value) {
    return value.replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
        .replace(/&#(x[\da-f]+|\d+);/gi, (match, number) => {
            const point = number[0].toLowerCase() === 'x' ? Number.parseInt(number.slice(1), 16) : Number(number);
            return point <= 0x10ffff ? String.fromCodePoint(point) : match;
        });
}

function languageHint(value) {
    const hasChinese = /\p{Script=Han}/u.test(value);
    const hasEnglish = /[a-z]{2,}/i.test(value.replace(/\{\d+\}/g, ''));
    return hasChinese ? (hasEnglish ? 'mixed' : 'zh') : hasEnglish ? 'en' : 'undetermined';
}

function isHumanText(value, explicit = false) {
    const candidate = value.replace(SLOT, '').replace(/\$\([\w~-]+\)/g, '').trim();
    if (!candidate) return explicit && /__I18N_SLOT_\d+__/.test(value);
    if (!/\p{L}/u.test(candidate)) return false;
    if (explicit) return true;
    if (/__I18N_SLOT_\d+__/.test(value) && /^[\w.:/@${}-]+$/.test(value)) return false;
    if (/^@\w+(?:\s+__I18N_SLOT_\d+__)*$/.test(value)) return false;
    if (/^(?:[a-z]+:\/\/|(?:\.{0,2}\/|[a-z]:\\))/i.test(candidate)) return false;
    if (/^[^\s]*[\\/][^\s]*$/u.test(candidate) || /^\S+\.(?:ts|js|json|html|css|svg|exe|c|h|lpc)$/i.test(candidate)) return false;
    if (/\p{Script=Han}/u.test(candidate)) return true;
    if (DEFINITE_TYPES.test(candidate)) return false;
    if (/^(?:[\w-]+\.)+[\w*-]+$/.test(candidate) || /^[\w-]+:[\w.-]+$/.test(candidate)) return false;
    if (/^[a-z_$][\w$-]*$/.test(candidate) || /^[A-Z][A-Z\d_:-]+$/.test(candidate)) return false;
    if (/^[\w${}]+(?:[.-][\w${}]+)+$/.test(candidate)) return false;
    if (/^(?:[.#][\w.-]+|[A-Z][\w]*(?:<.*>|\[\]))$/.test(candidate)) return false;
    return true;
}

function isIdentityPosition(node) {
    const parent = node.parent;
    if (!parent) return false;
    return (ts.isPropertyAssignment(parent) && parent.name === node)
        || (ts.isElementAccessExpression(parent) && parent.argumentExpression === node)
        || ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)
        || ts.isExternalModuleReference(parent) || ts.isLiteralTypeNode(parent)
        || ts.isImportTypeNode(parent) || ts.isModuleDeclaration(parent);
}

function isIdentityValue(node, source, value) {
    const parent = node.parent;
    const key = ts.isPropertyAssignment(parent) ? propertyName(parent.name, source)
        : ts.isBinaryExpression(parent) && ts.isPropertyAccessExpression(parent.left) ? parent.left.name.text : '';
    if (key === 'Authorization') return true;
    return /^(?:id|modelId|command|type|kind|mode|value|path|uri|url|className|role|language|languageId|sourceKind|status|contextValue|filterText|sortText|insertText|Authorization)$/i.test(key)
        && !isHumanText(value.text);
}

function describeContext(node, source, inWebview) {
    let property;
    let call;
    let callArgument;
    const names = [];
    for (let current = node; current?.parent; current = current.parent) {
        const parent = current.parent;
        if (ts.isPropertyAssignment(parent) && parent.initializer === current && !property) {
            property = propertyName(parent.name, source);
        }
        if (ts.isBinaryExpression(parent) && parent.right === current && ts.isPropertyAccessExpression(parent.left) && !property) {
            property = parent.left.name.text;
        }
        if (ts.isVariableDeclaration(parent) && parent.name) names.push(parent.name.getText(source));
        if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) names.push(parent.name?.getText(source) ?? '');
        if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && !call) {
            call = callName(parent.expression, source);
            callArgument = parent.arguments?.findIndex(argument => argument === current);
        }
    }
    const base = { anchor: anchorFor(node, source), ...(property ? { property } : {}), ...(call ? { call } : {}) };
    // A prompt is model input, while UI input-box prompts are ordinary interface strings.
    if (names.some(name => /(?:systemPrompt|userPrompt|signatureFacts|modelPrompt)/i.test(name))) {
        return { ...base, category: 'model-prompt', classification: 'generation-prompt', explicit: true,
            reason: 'Model instruction or prompt construction; not interface copy.' };
    }
    if (call && /^(?:log|debug|info|warn|error|trace|appendLine|append|writeLine)$/.test(call)
        && !/^(?:show|new)/.test(call)) {
        const callNode = closestCall(node);
        const receiver = callNode?.expression.getText(source) ?? '';
        if (/console\.|output|channel|logger|log\./i.test(receiver)) {
            return { ...base, category: 'log', classification: 'log', explicit: true,
                reason: 'Console or output-channel sink; visibility and translation policy need a separate decision.' };
        }
    }
    if (call === 'Error' || call === 'TypeError' || call === 'RangeError') {
        return { ...base, category: 'error', classification: 'manual-review', explicit: true,
            reason: 'Thrown or constructed error; trace the caller before treating this as interface copy.' };
    }
    if (call && NOTIFICATIONS.test(call)) {
        return { ...base, category: callArgument > 0 ? 'notification-action' : 'notification', classification: 'user-interface', explicit: true };
    }
    if (call === 'showQuickPick') return { ...base, category: 'quick-pick', classification: 'user-interface', explicit: true };
    if (call === 'showInputBox') return { ...base, category: 'input-box', classification: 'user-interface', explicit: true };
    if (call === 'withProgress' || call === 'report') {
        return { ...base, category: 'progress', classification: 'user-interface', explicit: true };
    }
    if (call === 'createWebviewPanel' && callArgument === 1) {
        return { ...base, category: 'webview-title', classification: 'user-interface', explicit: true };
    }
    if (call === 'createOutputChannel' && callArgument === 0) {
        return { ...base, category: 'output-channel-title', classification: 'user-interface', explicit: true };
    }
    if (/renderSkeleton|completeEmptyTags|buildMissing/i.test(names.join('/')) || /TODO:/.test(node.getText(source))) {
        return { ...base, category: 'generated-documentation', classification: 'generated-documentation', explicit: false,
            reason: 'Text written into a generated comment; language is independent of interface language.' };
    }
    if (call === 'setAttribute') {
        const invocation = closestCall(node);
        const attribute = invocation?.arguments?.[0];
        if (attribute && ts.isStringLiteralLike(attribute) && HTML_UI_ATTRIBUTES.has(attribute.text) && callArgument === 1) {
            return { ...base, category: 'webview-attribute', classification: 'user-interface', explicit: true, attribute: attribute.text };
        }
    }
    if (call && /^(?:setStatus|setStatusText|badge)$/.test(call) && callArgument === 0) {
        return { ...base, category: 'status', classification: 'user-interface', explicit: true };
    }
    if (property && UI_PROPERTIES.has(property)) {
        const assignment = node.parent?.getText(source) ?? '';
        const status = /statusBar|tooltip/i.test(assignment);
        return { ...base, category: status ? 'status' : inWebview ? 'webview-text' : 'display-property',
            classification: status || inWebview ? 'user-interface' : 'manual-review', explicit: true,
            ...(status || inWebview ? {} : { reason: 'Display-like property; confirm its consumer and preserve user or language data.' }) };
    }
    return { ...base, category: inWebview ? 'webview-script-candidate' : 'text-candidate', classification: 'manual-review', explicit: false,
        reason: 'Static text candidate; its eventual consumer cannot be proven by this source-only inventory.' };
}

function closestCall(node) {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isCallExpression(current) || ts.isNewExpression(current)) return current;
    }
    return undefined;
}

/** Scan package.json and production src TS/JS/HTML only. Never opens a user LPC workspace. */
export async function scanTextInventory({ rootDir = DEFAULT_ROOT } = {}) {
    const root = path.resolve(rootDir);
    const entries = [];
    const files = [];
    const duplicateIds = new Map();
    let activeFile;
    let activeSource;

    function emit(value, context, start = 0, end = value.text.length) {
        const raw = value.text.slice(start, end);
        if (!isHumanText(readableText(raw), context.explicit)) return;
        const leading = raw.length - raw.trimStart().length;
        const trailing = raw.length - raw.trimEnd().length;
        const selected = new Set([...raw.matchAll(SLOT)].map(match => match[1]));
        const placeholders = value.placeholders.filter(slot => selected.has(slot.name)).map(slot => ({
            name: slot.name, expression: slot.expression, ...sourceLocation(activeSource, slot.offset, slot.end)
        }));
        const message = readableText(raw.replace(SLOT, (_, name) => `{${name}}`)).trim();
        const { explicit, ...publicContext } = context;
        const identity = JSON.stringify([activeFile.path, context.anchor, context.category, context.attribute, message]);
        const occurrence = duplicateIds.get(identity) ?? 0;
        duplicateIds.set(identity, occurrence + 1);
        const first = value.positions[start + leading] ?? 0;
        const last = value.positions[Math.max(start, end - trailing - 1)] ?? first;
        entries.push({ id: `text-${hash(`${identity}:${occurrence}`).slice(0, 20)}`, path: activeFile.path,
            ...sourceLocation(activeSource, first, last + 1), classification: context.classification,
            category: context.category, message, placeholders, languageHint: languageHint(message), context: publicContext });
    }

    function scanHtml(value, anchor) {
        const text = value.text;
        let cursor = 0;
        let tag = 'fragment';
        while (cursor < text.length) {
            if (text.startsWith('<!--', cursor)) {
                const end = text.indexOf('-->', cursor + 4);
                cursor = end < 0 ? text.length : end + 3;
                continue;
            }
            if (text[cursor] !== '<') {
                const next = text.indexOf('<', cursor);
                const end = next < 0 ? text.length : next;
                const dynamic = /__I18N_SLOT_\d+__/.test(text.slice(cursor, end));
                emit(value, { anchor, category: 'webview-text', classification: dynamic ? 'manual-review' : 'user-interface',
                    explicit: true, element: tag, ...(dynamic ? { reason: 'Dynamic HTML slot; confirm whether the expression is UI copy, markup, or user content.' } : {}) }, cursor, end);
                cursor = end;
                continue;
            }
            const match = text.slice(cursor).match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i);
            if (!match) { cursor++; continue; }
            const opening = !match[1];
            tag = match[2].toLowerCase();
            // Respect quoted > characters, including templates nested in attribute values.
            let end = cursor + match[0].length;
            let quote;
            for (; end < text.length; end++) {
                const char = text[end];
                if (quote) { if (char === quote) quote = undefined; }
                else if (char === '"' || char === "'") quote = char;
                else if (char === '>') break;
            }
            if (opening) {
                const attributesStart = cursor + match[0].length;
                const attributes = text.slice(attributesStart, end);
                const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
                for (const attribute of attributes.matchAll(attributePattern)) {
                    const name = attribute[1].toLowerCase();
                    const content = attribute[2] ?? attribute[3] ?? attribute[4];
                    if (content === undefined || (!HTML_UI_ATTRIBUTES.has(name) && name !== 'lang')) continue;
                    const equal = attribute[0].indexOf('=');
                    const afterEqual = attribute[0].slice(equal + 1);
                    const whitespace = afterEqual.length - afterEqual.trimStart().length;
                    const quoted = /^\s*["']/.test(afterEqual) ? 1 : 0;
                    const start = attributesStart + attribute.index + equal + 1 + whitespace + quoted;
                    emit(value, { anchor, category: name === 'lang' ? 'webview-language' : 'webview-attribute',
                        classification: name === 'lang' || /__I18N_SLOT_\d+__/.test(content) ? 'manual-review' : 'user-interface',
                        attribute: name, element: tag, explicit: true }, start, start + content.length);
                }
            }
            cursor = Math.min(end + 1, text.length);
            if (opening && (tag === 'script' || tag === 'style')) {
                const closePattern = new RegExp(`<\\/\\s*${tag}\\s*>`, 'ig');
                closePattern.lastIndex = cursor;
                const close = closePattern.exec(text);
                const bodyEnd = close?.index ?? text.length;
                if (tag === 'script') scanCode(text.slice(cursor, bodyEnd), index => value.positions[cursor + index] ?? 0, `${anchor}/script`, true);
                cursor = close ? close.index + close[0].length : text.length;
            }
        }
    }

    function scanCode(text, mapPosition, anchorPrefix = '', inWebview = false) {
        const source = ts.createSourceFile(activeFile.path, text, ts.ScriptTarget.Latest, true,
            /\.tsx$/i.test(activeFile.path) ? ts.ScriptKind.TSX : /\.jsx$/i.test(activeFile.path) ? ts.ScriptKind.JSX : ts.ScriptKind.TS);
        for (const diagnostic of source.parseDiagnostics) {
            activeFile.parseDiagnostics.push({ ...sourceLocation(activeSource, mapPosition(diagnostic.start ?? 0), mapPosition((diagnostic.start ?? 0) + (diagnostic.length ?? 0))),
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ') });
        }
        function visit(node) {
            if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
                if (!isIdentityPosition(node)) {
                    const value = literalValue(node, source, mapPosition);
                    const context = describeContext(node, source, inWebview);
                    context.anchor = `${anchorPrefix}${anchorPrefix ? '/' : ''}${context.anchor}`;
                    if (isIdentityValue(node, source, value) || /^(?:createServiceKey|ServiceKey)$/.test(context.call ?? '')) {
                        // Still visit template expressions below: data values may contain nested UI.
                    } else if (/<(?:!doctype|[a-z][\w:-]*)(?:\s|\/?>)/i.test(value.text)
                        && context.classification !== 'generation-prompt' && context.classification !== 'log') {
                        scanHtml(value, context.anchor);
                    } else {
                        emit(value, context);
                    }
                }
                // Template expressions contain real AST expressions: nested templates and labels
                // must be visited too. Static head/middle/tail tokens are emitted as one message.
                if (ts.isTemplateExpression(node)) {
                    for (const span of node.templateSpans) visit(span.expression);
                }
                return;
            }
            if (ts.isJsxText(node) && compact(node.text)) {
                const start = node.getStart(source);
                emit({ text: node.text, positions: Array.from(node.text, (_, index) => mapPosition(start + index)), placeholders: [] },
                    { anchor: `${anchorPrefix}/${anchorFor(node, source)}`, category: 'webview-text', classification: 'user-interface', explicit: true });
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }

    function scanManifest(text) {
        const source = ts.createSourceFile('package.json', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSON);
        if (source.parseDiagnostics.length) throw new Error('Cannot inventory invalid package.json.');
        function visit(node, pointer = '', display = false) {
            if (ts.isObjectLiteralExpression(node)) {
                for (const member of node.properties) {
                    if (!ts.isPropertyAssignment(member)) continue;
                    const key = propertyName(member.name, source);
                    const childPointer = `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
                    const isDisplay = pointer === '' ? ['displayName', 'description'].includes(key)
                        : pointer.startsWith('/contributes/') && ['title', 'name', 'category', 'description', 'markdownDescription', 'enumDescriptions', 'markdownEnumDescriptions', 'deprecationMessage', 'markdownDeprecationMessage', 'contents', 'message', 'button', 'label'].includes(key);
                    visit(member.initializer, childPointer, isDisplay);
                }
            } else if (ts.isArrayLiteralExpression(node)) {
                node.elements.forEach((element, index) => visit(element, `${pointer}/${index}`, display));
            } else if (ts.isStringLiteralLike(node) && display) {
                const value = literalValue(node, source, offset => offset);
                emit(value, { anchor: pointer, jsonPointer: pointer, category: pointer.startsWith('/contributes/configuration') ? 'manifest-setting'
                    : pointer.startsWith('/contributes/commands') ? 'manifest-command' : 'manifest-display', classification: 'user-interface', explicit: true });
            }
        }
        visit(source.statements[0]?.expression);
    }

    const paths = ['package.json'];
    async function walk(directory) {
        const children = await fs.readdir(path.join(root, directory), { withFileTypes: true });
        for (const child of children.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
            const relative = slash(path.join(directory, child.name));
            if (child.isSymbolicLink()) continue;
            if (child.isDirectory()) { if (!EXCLUDED_DIRECTORY.test(child.name)) await walk(relative); }
            else if (child.isFile() && (CODE_EXTENSION.test(child.name) || HTML_EXTENSION.test(child.name))
                && !/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(child.name) && !/\.d\.[cm]?ts$/i.test(child.name)) paths.push(relative);
        }
    }
    await walk('src');
    for (const relative of paths.sort()) {
        const text = await fs.readFile(path.join(root, relative), 'utf8');
        activeFile = { path: relative, sha256: hash(text), entries: 0, parseDiagnostics: [] };
        activeSource = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
        const before = entries.length;
        if (relative === 'package.json') scanManifest(text);
        else if (HTML_EXTENSION.test(relative)) scanHtml({ text, positions: Array.from({ length: text.length }, (_, index) => index), placeholders: [] }, '<html>');
        else scanCode(text, offset => offset, '', /(?:^|\/)templates\//.test(relative));
        activeFile.entries = entries.length - before;
        files.push(activeFile);
    }
    entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line || a.column - b.column || a.id.localeCompare(b.id, 'en'));
    function counts(key) {
        const result = {};
        for (const entry of entries) result[entry[key]] = (result[entry[key]] ?? 0) + 1;
        return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return { schemaVersion: 1, scope: { included: ['package.json (display fields)', 'src/**/*.{ts,tsx,js,jsx,mjs,cjs,html,htm}'],
        excluded: ['tests, fixtures, mocks, declaration files, comments, obvious IDs/paths/types', 'Rust, Efun data and snippets (separate inventories)', 'user LPC source and external workspaces'],
        sourceOnly: true, parser: 'TypeScript compiler API with mapped HTML text/attribute and inline-script traversal' },
        limitations: ['This is a coverage inventory, not proof that every candidate reaches a user.',
            'Dynamic HTML slots, thrown errors and display-like data properties require consumer review; original user and driver content must remain untranslated.',
            'Runtime-computed text without a literal, imported text resources, CSS generated content and arbitrary custom UI helper flows cannot be fully resolved statically.',
            'English identifiers used as labels outside a known display context may require a supplemental consumer audit.',
            'HTML is tokenized conservatively; malformed markup and unsupported template syntax require review. Parse diagnostics are retained per file.'],
        summary: { filesScanned: files.length, totalEntries: entries.length, byClassification: counts('classification'), byCategory: counts('category'), byLanguageHint: counts('languageHint'),
            parseDiagnostics: files.reduce((total, file) => total + file.parseDiagnostics.length, 0) }, files, entries };
}

async function main(args) {
    let out;
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--out' && args[index + 1]) out = args[++index];
        else if (args[index] === '--help') {
            process.stdout.write('Usage: node scripts/localization/text-inventory.mjs [--out .tmp/i18n/text-inventory.json]\nWithout --out, prints JSON and writes no files. Scans this extension repository only.\n');
            return;
        } else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
    }
    const report = await scanTextInventory();
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (!out) { process.stdout.write(json); return; }
    const destination = path.resolve(DEFAULT_ROOT, out);
    const reportRoot = path.resolve(DEFAULT_ROOT, '.tmp/i18n');
    const relative = path.relative(reportRoot, destination);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(destination) !== '.json') {
        throw new Error('--out must name a JSON report inside .tmp/i18n/.');
    }
    // Check existing ancestors before creating anything, including a symlinked .tmp.
    let parent = DEFAULT_ROOT;
    for (const segment of path.relative(DEFAULT_ROOT, path.dirname(destination)).split(path.sep)) {
        parent = path.join(parent, segment);
        try { if ((await fs.lstat(parent)).isSymbolicLink()) throw new Error('Report directory must not contain symlinks.'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try { if ((await fs.lstat(destination)).isSymbolicLink()) throw new Error('Report destination must not be a symlink.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.writeFile(destination, json, 'utf8');
    process.stdout.write(`${JSON.stringify({ out: slash(path.relative(DEFAULT_ROOT, destination)), ...report.summary }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
