// Independent development oracle; never loaded by the extension or sidecar.
// Use the tokenizer from a separate FluffOS checkout, not the formatter's CST.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [sourceRoot, candidateRoot, reportPath, tokenizerPath] = process.argv.slice(2);
assert(tokenizerPath, 'usage: node scripts/verify-formatter-corpus.mjs <source-copy> <candidates> <audit.json> <FluffOS-tokenizer.mjs>');
const { tokenize } = await import(pathToFileURL(path.resolve(tokenizerPath)).toString());
const report = JSON.parse(readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, ''));
const failures = [];
let checked = 0;
const tokens = source => tokenize(source).filter(token => token.kind !== 'whitespace').map(token => [
    token.kind,
    // The upstream lexer keeps the CR half of a physical directive EOL.
    // Whitespace layout may choose CRLF; internal continued lines stay exact.
    token.kind === 'directive' ? token.text.replace(/\r$/, '') : token.text,
    token.unterminated === true
]);
for (const entry of report.files.filter(entry => entry.status === 'changed')) {
    assert(!path.isAbsolute(entry.file) && !entry.file.split(/[\\/]/).includes('..'), 'invalid corpus entry');
    const before = readFileSync(path.join(sourceRoot, entry.file), 'utf8');
    const after = readFileSync(path.join(candidateRoot, entry.file), 'utf8');
    const left = tokens(before);
    const right = tokens(after);
    checked++;
    if (left.some(token => token[2]) || right.some(token => token[2])) {
        failures.push({ file: entry.file, reason: 'oracle found an unterminated token' });
    } else if (JSON.stringify(left) !== JSON.stringify(right)) {
        failures.push({ file: entry.file, reason: 'independent token sequence differs' });
    }
}
console.log(JSON.stringify({
    checkedFiles: checked,
    tokenizerSha256: createHash('sha256').update(readFileSync(tokenizerPath)).digest('hex'),
    grammarSha256: createHash('sha256').update(readFileSync(path.join(path.dirname(tokenizerPath), 'lpc-grammar.json'))).digest('hex'),
    failures
}, null, 2));
if (failures.length > 0) process.exitCode = 1;
