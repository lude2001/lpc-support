import assert from 'node:assert/strict';
import test from 'node:test';
import { DiagnosticsInbox } from '../diagnostics-inbox.mjs';

const target = 'file:///syntax-coverage.c';
const other = 'file:///main.c';

test('interleaved diagnostics stay associated with their document and version', async () => {
    const inbox = new DiagnosticsInbox();
    const expected = { uri: target, version: 3, diagnostics: [] };
    const unrelated = { uri: other, version: 2, diagnostics: [{ code: 'unusedGlobalVar' }] };
    inbox.accept(expected);
    inbox.accept(unrelated); // Reproduces the CI ordering that broke the old global slot.
    assert.deepEqual(await inbox.waitFor(target, 3), expected);
    assert.deepEqual(await inbox.waitFor(other, 2), unrelated);
    inbox.dispose();
});

test('a delayed notification must match both URI and version', async () => {
    const inbox = new DiagnosticsInbox();
    const pending = inbox.waitFor(target, 3);
    inbox.accept({ uri: other, version: 3, diagnostics: [{ code: 'syntax-error' }] });
    inbox.accept({ uri: target, version: 2, diagnostics: [{ code: 'old-error' }] });
    const expected = { uri: target, version: 3, diagnostics: [{ code: 'current-error' }] };
    inbox.accept(expected);
    assert.deepEqual(await pending, expected); // Diagnostics are not filtered or suppressed.
    inbox.dispose();
});

test('late old versions cannot overwrite a current result', async () => {
    const inbox = new DiagnosticsInbox();
    inbox.accept({ uri: target, version: 3, diagnostics: [] });
    inbox.accept({ uri: target, version: 1, diagnostics: [{ code: 'stale' }] });
    assert.deepEqual((await inbox.waitFor(target, 3)).diagnostics, []);
    await assert.rejects(inbox.waitFor(target, 2), /superseded/);
    inbox.dispose();
});

test('missing diagnostics fail with a bounded timeout', async () => {
    const inbox = new DiagnosticsInbox();
    await assert.rejects(inbox.waitFor(target, 3, 5), /Timed out/);
    inbox.dispose();
});

test('disposing rejects pending waits instead of leaving timers alive', async () => {
    const inbox = new DiagnosticsInbox();
    const pending = inbox.waitFor(target, 3);
    inbox.dispose();
    await assert.rejects(pending, /disposed/);
});
