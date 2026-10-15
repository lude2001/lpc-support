const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

async function waitFor(probe, description) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        const result = await probe();
        if (result) return result;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${description}`);
}

async function symbols(query) {
    return await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', query) ?? [];
}

async function run() {
    const root = process.env.LPC_NAVIGATION_WORKSPACE;
    assert.ok(root);
    assert.strictEqual(vscode.workspace.workspaceFolders.length, 1);
    assert.strictEqual(vscode.workspace.workspaceFolders[0].uri.fsPath.toLowerCase(), root.toLowerCase());
    const document = await vscode.workspace.openTextDocument(path.join(root, 'navigation.c'));
    const editor = await vscode.window.showTextDocument(document);
    const extension = vscode.extensions.getExtension('ludexiang.lpc-support');
    assert.ok(extension);
    await extension.activate();

    await waitFor(async () => (await symbols('navigation_closed')).length === 1, 'Ctrl+T provider to include closed files');
    console.log('Accepted: closed-file workspace symbols.');
    await waitFor(async () => (await symbols('navigation_enabled')).length === 1, 'configured header to enable a branch');
    assert.strictEqual((await symbols('navigation_disabled')).length, 0);
    assert.strictEqual((await symbols('navigation_simul')).length, 1);
    const hits = await waitFor(async () => {
        const result = await vscode.commands.executeCommand('vscode.executeDocumentHighlights', document.uri, new vscode.Position(6, 26));
        return result?.length === 3 ? result : undefined;
    }, 'three scoped references through the real VS Code provider');
    assert.ok(hits.every(hit => hit.range.start.line === 6));
    console.log('Accepted: scoped document highlights.');

    // A live unsaved header edit must update Ctrl+T without reloading the window.
    const header = await vscode.workspace.openTextDocument(path.join(root, 'macros.h'));
    const edit = new vscode.WorkspaceEdit();
    edit.replace(header.uri, new vscode.Range(0, 0, header.lineCount, 0), '#define FEATURE 0\n');
    assert.strictEqual(await vscode.workspace.applyEdit(edit), true);
    await waitFor(async () => (await symbols('navigation_disabled')).length === 1 && (await symbols('navigation_enabled')).length === 0, 'unsaved header dependency refresh');
    console.log('Accepted: unsaved header dependency refresh.');

    const added = path.join(root, 'added.c');
    fs.writeFileSync(added, 'int navigation_added() { return 1; }\n');
    await waitFor(async () => (await symbols('navigation_added')).length === 1, 'new file watcher update');
    console.log('Accepted: created-file symbol; URI', (await symbols('navigation_added'))[0].location.uri.toString());
    fs.unlinkSync(added);
    await waitFor(async () => (await symbols('navigation_added')).length === 0, 'deleted file watcher update');

    editor.selection = new vscode.Selection(6, 26, 6, 26);
    await vscode.commands.executeCommand('lpc.showAnalysisInspector');
    await waitFor(async () => {
        const inspection = await readInspector();
        return inspection?.status.includes(`版本 ${document.version}`) && inspection.text.includes('已解析到声明');
    }, 'the actual inspector webview to render the current Rust snapshot');
    const focus = vscode.window.activeTextEditor;
    assert.strictEqual(focus?.document.uri.toString(), document.uri.toString(), 'The inspector must preserve source editor focus.');
    await header.save();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    console.log('VS Code navigation acceptance passed: workspace symbols, scoped highlights, unsaved-header refresh, file create/delete, and inspector command.');
}

async function readInspector() {
    const targets = await (await fetch(`http://127.0.0.1:${process.env.LPC_NAVIGATION_DEBUG_PORT}/json/list`)).json();
    for (const target of targets.filter(target => target.type === 'page' || target.type === 'iframe')) {
        const result = await evaluate(target.webSocketDebuggerUrl, `(() => {
            const documents = [document];
            for (let index = 0; index < documents.length; index++) {
                const doc = documents[index];
                if (doc.querySelector('.title')?.textContent === 'LPC 分析查看器') {
                    return { status: doc.getElementById('status').textContent, text: doc.body.textContent };
                }
                for (const frame of doc.querySelectorAll('iframe')) { try { if (frame.contentDocument) documents.push(frame.contentDocument); } catch {} }
            }
            return null;
        })()`);
        if (result) return result;
    }
}

function evaluate(url, expression) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);
        const timer = setTimeout(() => { const state = socket.readyState; socket.close(); reject(new Error(`Inspector CDP evaluation timed out (socket ${state}, ${url})`)); }, 5000);
        socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
        socket.onerror = error => { clearTimeout(timer); reject(error); };
        socket.onmessage = event => {
            const message = JSON.parse(event.data);
            if (message.id !== 1) return;
            clearTimeout(timer);
            socket.close();
            resolve(message.result?.result?.value);
        };
    });
}

module.exports = { run };
