# LSP Spec A Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase A LSP foundation so the extension can start and manage a language server, synchronize workspace/document state, and expose stable migration seams without moving the main language features yet.

**Architecture:** Keep the existing classic provider path as the default runtime, and add a parallel LSP runtime made of a host-side client manager plus a server-side bootstrap/runtime layer. Phase A stops at infrastructure: mode switching, client/server lifecycle, document/config bridges, a health request path, and explicit language-service contracts for later phases.

**Tech Stack:** TypeScript, VS Code extension APIs, `vscode-languageclient`, `vscode-languageserver`, esbuild, Jest + ts-jest.

---

## File Map

- Modify: `package.json`
  Responsibility: Add LSP runtime dependencies, declare experimental mode settings, and expose any Phase A verification scripts if needed.
- Modify: `esbuild.mjs`
  Responsibility: Bundle both the extension host entry and the new LSP server entry without disturbing the current extension artifact.
- Modify: `tsconfig.json`
  Responsibility: Keep TypeScript aware of the new LSP source tree and any node-side types needed by the server bundle.
- Modify: `src/extension.ts`
  Responsibility: Start the LSP client manager during activation and ensure shutdown is coordinated with existing service disposal.
- Modify: `src/modules/languageModule.ts`
  Responsibility: Respect runtime mode so classic providers stay enabled only when the chosen mode allows them.
- Create: `src/lsp/client/LspClientManager.ts`
  Responsibility: Own client startup, shutdown, restart, output logging, and runtime-mode-aware behavior.
- Create: `src/lsp/client/activateLspClient.ts`
  Responsibility: Provide a focused activation entry that wires the manager into extension activation.
- Create: `src/lsp/client/bridges/modeSwitch.ts`
  Responsibility: Resolve `classic | hybrid | lsp` mode from experimental settings and expose a single source of truth to activation code.
- Create: `src/lsp/client/bridges/configurationBridge.ts`
  Responsibility: Read synchronized workspace config inputs and send server configuration notifications without changing the project-config truth source.
- Create: `src/lsp/shared/protocol/health.ts`
  Responsibility: Define the minimal custom request/response payload used for Phase A smoke validation.
- Create: `src/lsp/server/main.ts`
  Responsibility: Provide the server process entrypoint consumed by the client manager and esbuild.
- Create: `src/lsp/server/bootstrap/createServer.ts`
  Responsibility: Build the LSP connection, runtime session, stores, and handler registration.
- Create: `src/lsp/server/bootstrap/registerCapabilities.ts`
  Responsibility: Register Phase A capabilities, including text sync and health request handling.
- Create: `src/lsp/server/runtime/DocumentStore.ts`
  Responsibility: Store server-side document text/version state for `didOpen`, `didChange`, and `didClose`.
- Create: `src/lsp/server/runtime/WorkspaceSession.ts`
  Responsibility: Hold workspace roots, synchronized project-config snapshots, shared services, and server lifecycle helpers.
- Create: `src/lsp/server/runtime/ServerLogger.ts`
  Responsibility: Centralize structured server logging so bootstrap and handlers do not log ad hoc.
- Create: `src/lsp/server/handlers/health/healthHandler.ts`
  Responsibility: Return a deterministic Phase A health payload proving request/response wiring and runtime metadata.
- Create: `src/language/contracts/LanguageDocument.ts`
  Responsibility: Define the host-agnostic document contract that later services and handlers will consume.
- Create: `src/language/contracts/LanguageWorkspaceContext.ts`
  Responsibility: Define the workspace/session contract for future language services.
- Create: `src/language/contracts/LanguageFeatureServices.ts`
  Responsibility: Define the minimum service seams for later completion/definition/symbol migration without implementing them yet.
- Test: `src/lsp/__tests__/modeSwitch.test.ts`
  Responsibility: Lock runtime mode resolution and default behavior.
- Test: `src/lsp/__tests__/LspClientManager.test.ts`
  Responsibility: Lock startup/shutdown behavior, classic-mode bypass, and hybrid/lsp launch behavior.
- Test: `src/lsp/server/__tests__/DocumentStore.test.ts`
  Responsibility: Lock server-side document synchronization semantics.
- Test: `src/lsp/server/__tests__/WorkspaceSession.test.ts`
  Responsibility: Lock workspace config snapshot lifecycle and invalidation behavior.
- Test: `src/lsp/server/__tests__/healthHandler.test.ts`
  Responsibility: Lock the Phase A health response contract.
- Modify: `src/__tests__/extension.test.ts`
  Responsibility: Cover activation/deactivation interactions with the new client manager.
- Modify: `README.md`
  Responsibility: Add a short note describing the experimental LSP modes and their current Phase A scope.
- Modify: `CHANGELOG.md`
  Responsibility: Record that the release adds LSP infrastructure groundwork, not full feature migration.

## Chunk 1: Host And Build Foundation

### Task 1: Add LSP Dependencies, Build Outputs, And Experimental Mode Setting

**Files:**
- Modify: `package.json`
- Modify: `esbuild.mjs`
- Modify: `tsconfig.json`
- Test: `src/lsp/__tests__/modeSwitch.test.ts`

- [ ] **Step 1: Write the failing test for runtime mode resolution**

Add `src/lsp/__tests__/modeSwitch.test.ts` with cases that prove:

```ts
expect(resolveLspMode(undefined)).toBe('classic');
expect(resolveLspMode('classic')).toBe('classic');
expect(resolveLspMode('hybrid')).toBe('hybrid');
expect(resolveLspMode('lsp')).toBe('lsp');
expect(resolveLspMode('invalid-value' as any)).toBe('classic');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/lsp/__tests__/modeSwitch.test.ts`

Expected: FAIL because the LSP mode bridge and test path do not exist yet.

- [ ] **Step 3: Add the minimum dependency and build scaffolding**

Update `package.json` to add:

```json
"dependencies": {
  "vscode-languageclient": "^9.0.1",
  "vscode-languageserver": "^9.0.1",
  "vscode-languageserver-textdocument": "^1.0.11"
}
```

Add an experimental configuration contribution for a runtime-only mode switch, for example:

```json
"configuration": {
  "title": "LPC",
  "properties": {
    "lpc.experimental.lspMode": {
      "type": "string",
      "enum": ["classic", "hybrid", "lsp"],
      "default": "classic",
      "description": "Controls the experimental LPC language runtime mode."
    }
  }
}
```

Extend `esbuild.mjs` so it emits both:

- `dist/extension.js`
- `dist/lsp/server.js`

Keep `tsconfig.json` compatible with the new `src/lsp/**` and `src/language/**` trees.

- [ ] **Step 4: Implement the mode bridge and re-run the test**

Create `src/lsp/client/bridges/modeSwitch.ts` with a tiny pure resolver:

```ts
export type LspMode = 'classic' | 'hybrid' | 'lsp';

export function resolveLspMode(rawValue: unknown): LspMode {
    return rawValue === 'hybrid' || rawValue === 'lsp' || rawValue === 'classic'
        ? rawValue
        : 'classic';
}
```

Run: `npx jest --runInBand src/lsp/__tests__/modeSwitch.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the build/runtime groundwork**

```bash
git add package.json esbuild.mjs tsconfig.json src/lsp/client/bridges/modeSwitch.ts src/lsp/__tests__/modeSwitch.test.ts
git commit -m "feat(lsp): add phase-a build and runtime mode scaffolding"
```

### Task 2: Wire Extension Activation To An LSP Client Manager

**Files:**
- Create: `src/lsp/client/LspClientManager.ts`
- Create: `src/lsp/client/activateLspClient.ts`
- Modify: `src/extension.ts`
- Modify: `src/modules/languageModule.ts`
- Test: `src/lsp/__tests__/LspClientManager.test.ts`
- Modify: `src/__tests__/extension.test.ts`

- [ ] **Step 1: Write failing tests for activation behavior**

Add tests that prove:

```ts
await activateLspClient(context, 'classic');
expect(startSpy).not.toHaveBeenCalled();

await activateLspClient(context, 'hybrid');
expect(startSpy).toHaveBeenCalledTimes(1);

await activate(context);
expect(disposeSpy).toHaveBeenCalledTimes(1);
```

Also add a test that `registerLanguageProviders(...)` is skipped only in full `lsp` mode and still runs in `classic` / `hybrid`.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/__tests__/LspClientManager.test.ts src/__tests__/extension.test.ts`

Expected: FAIL because the client manager and mode-aware activation flow do not exist yet.

- [ ] **Step 3: Implement the smallest manager and activation path**

Create `src/lsp/client/LspClientManager.ts` with methods like:

```ts
export class LspClientManager implements vscode.Disposable {
    public async start(): Promise<void> {}
    public async stop(): Promise<void> {}
    public dispose(): void {}
}
```

Create `src/lsp/client/activateLspClient.ts` to:

- resolve the mode
- no-op in `classic`
- start the manager in `hybrid` and `lsp`
- push the manager into `context.subscriptions`

Update `src/extension.ts` so activation does:

1. register core/diagnostics
2. resolve LSP mode
3. conditionally register classic providers
4. activate the LSP client path
5. keep existing deactivation cleanup intact

Update `src/modules/languageModule.ts` only enough to allow mode-aware bypass from the host entry, without mixing mode resolution into provider logic.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/__tests__/LspClientManager.test.ts src/__tests__/extension.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the host-side activation wiring**

```bash
git add src/lsp/client/LspClientManager.ts src/lsp/client/activateLspClient.ts src/extension.ts src/modules/languageModule.ts src/lsp/__tests__/LspClientManager.test.ts src/__tests__/extension.test.ts
git commit -m "feat(lsp): wire host activation to client manager"
```

## Chunk 2: Server Runtime And Bridges

### Task 3: Build The Server Bootstrap, Document Store, And Health Handler

**Files:**
- Create: `src/lsp/shared/protocol/health.ts`
- Create: `src/lsp/server/main.ts`
- Create: `src/lsp/server/bootstrap/createServer.ts`
- Create: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Create: `src/lsp/server/runtime/DocumentStore.ts`
- Create: `src/lsp/server/runtime/ServerLogger.ts`
- Create: `src/lsp/server/handlers/health/healthHandler.ts`
- Test: `src/lsp/server/__tests__/DocumentStore.test.ts`
- Test: `src/lsp/server/__tests__/healthHandler.test.ts`

- [ ] **Step 1: Write failing tests for server document sync and health contract**

Add a `DocumentStore` test that proves:

```ts
store.open(uri, 1, 'one');
store.applyFullChange(uri, 2, 'two');
expect(store.get(uri)?.version).toBe(2);
expect(store.get(uri)?.text).toBe('two');
store.close(uri);
expect(store.get(uri)).toBeUndefined();
```

Add a health-handler test that expects:

```ts
expect(result).toEqual({
    status: 'ok',
    mode: 'phase-a',
    serverVersion: expect.any(String),
    documentCount: 0
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/__tests__/healthHandler.test.ts`

Expected: FAIL because the server runtime files do not exist yet.

- [ ] **Step 3: Implement the minimum server runtime skeleton**

Create:

- `src/lsp/shared/protocol/health.ts`
- `src/lsp/server/runtime/DocumentStore.ts`
- `src/lsp/server/runtime/ServerLogger.ts`
- `src/lsp/server/handlers/health/healthHandler.ts`
- `src/lsp/server/bootstrap/registerCapabilities.ts`
- `src/lsp/server/bootstrap/createServer.ts`
- `src/lsp/server/main.ts`

Use the smallest viable behavior:

- `DocumentStore` supports open, full change, close, get, count
- `ServerLogger` wraps `connection.console.*`
- `healthHandler` returns static Phase A metadata plus `documentCount`
- bootstrap registers text document sync and the health request

Do not implement language feature handlers yet.

- [ ] **Step 4: Re-run the targeted tests and then the type check**

Run: `npx jest --runInBand src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/__tests__/healthHandler.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS, or only failures directly related to the new LSP files.

- [ ] **Step 5: Commit the server bootstrap slice**

```bash
git add src/lsp/shared/protocol/health.ts src/lsp/server/main.ts src/lsp/server/bootstrap/createServer.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/runtime/DocumentStore.ts src/lsp/server/runtime/ServerLogger.ts src/lsp/server/handlers/health/healthHandler.ts src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/__tests__/healthHandler.test.ts
git commit -m "feat(lsp): add phase-a server bootstrap and health handler"
```

### Task 4: Add Workspace Session And Configuration Synchronization

**Files:**
- Create: `src/lsp/server/runtime/WorkspaceSession.ts`
- Create: `src/lsp/client/bridges/configurationBridge.ts`
- Test: `src/lsp/server/__tests__/WorkspaceSession.test.ts`
- Modify: `src/lsp/__tests__/LspClientManager.test.ts`
- Modify: `src/modules/coreModule.ts`

- [ ] **Step 1: Write failing tests for synchronized workspace configuration**

Add tests that prove:

```ts
session.updateWorkspaceConfig(workspaceRoot, {
    projectConfigPath: 'D:/code/lpc-support/lpc-support.json',
    resolvedConfig: { includeDirectories: ['include'] }
});

expect(session.getWorkspaceConfig(workspaceRoot)?.projectConfigPath).toContain('lpc-support.json');
expect(session.getWorkspaceConfig(workspaceRoot)?.resolvedConfig?.includeDirectories).toEqual(['include']);
```

Add a client-manager or configuration-bridge test that expects a config notification to be sent when the bridge is initialized in `hybrid`/`lsp` mode.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/__tests__/LspClientManager.test.ts -t "config|workspace"`

Expected: FAIL because no session/config bridge exists yet.

- [ ] **Step 3: Implement the smallest config bridge without changing config truth sources**

Create `WorkspaceSession` to hold:

- workspace roots
- synchronized config snapshot
- shared runtime references

Create `configurationBridge.ts` to:

- read workspace roots from VS Code
- use existing `LpcProjectConfigService`
- send a server notification with the synchronized snapshot

Modify `src/modules/coreModule.ts` only if needed to expose existing project-config service access in a way the bridge can reuse. Do not fork a second config-loading path.

- [ ] **Step 4: Re-run the targeted tests and validate the bridge logic**

Run: `npx jest --runInBand src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/__tests__/LspClientManager.test.ts -t "config|workspace"`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the workspace/config bridge**

```bash
git add src/lsp/server/runtime/WorkspaceSession.ts src/lsp/client/bridges/configurationBridge.ts src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/__tests__/LspClientManager.test.ts src/modules/coreModule.ts
git commit -m "feat(lsp): sync workspace config into server session"
```

## Chunk 3: Migration Seams And Verification

### Task 5: Define Host-Agnostic Language Contracts For Future Handlers

**Files:**
- Create: `src/language/contracts/LanguageDocument.ts`
- Create: `src/language/contracts/LanguageWorkspaceContext.ts`
- Create: `src/language/contracts/LanguageFeatureServices.ts`
- Test: `src/lsp/server/__tests__/WorkspaceSession.test.ts`
- Modify: `src/lsp/server/bootstrap/createServer.ts`

- [ ] **Step 1: Write the failing test for exposing a typed language workspace context**

Add a test that proves `WorkspaceSession` can expose a stable future-facing context object without leaking VS Code host types:

```ts
const context = session.toLanguageWorkspaceContext(workspaceRoot);
expect(context.workspaceRoot).toBe(workspaceRoot);
expect(context.projectConfig?.projectConfigPath).toContain('lpc-support.json');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/lsp/server/__tests__/WorkspaceSession.test.ts -t "language workspace context"`

Expected: FAIL because the language contracts and conversion hook do not exist yet.

- [ ] **Step 3: Add the minimal language contracts**

Create contracts such as:

```ts
export interface LanguageDocument {
    uri: string;
    version: number;
    getText(): string;
}

export interface LanguageWorkspaceContext {
    workspaceRoot: string;
    projectConfig?: {
        projectConfigPath: string;
        resolvedConfig?: unknown;
    };
}

export interface LanguageFeatureServices {
    completion?: unknown;
    definition?: unknown;
    symbols?: unknown;
}
```

Then add a small adapter on `WorkspaceSession` that returns a `LanguageWorkspaceContext` instance. Do not implement real feature services yet.

- [ ] **Step 4: Re-run the targeted test and verify it passes**

Run: `npx jest --runInBand src/lsp/server/__tests__/WorkspaceSession.test.ts -t "language workspace context"`

Expected: PASS.

- [ ] **Step 5: Commit the migration seams**

```bash
git add src/language/contracts/LanguageDocument.ts src/language/contracts/LanguageWorkspaceContext.ts src/language/contracts/LanguageFeatureServices.ts src/lsp/server/runtime/WorkspaceSession.ts src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/server/bootstrap/createServer.ts
git commit -m "refactor(lsp): define phase-a language service contracts"
```

### Task 6: Add README/Changelog Notes And Run Phase A Verification Sweep

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-04-10-lsp-spec-a-foundation-design.md`

- [ ] **Step 1: Write the docs updates as the final failing review checklist**

Add a short checklist section to the Spec A doc marking the completion evidence required:

```md
- [ ] Client/server start and stop verified
- [ ] Classic mode remains default
- [ ] Health request round-trip verified
- [ ] Workspace config sync verified
- [ ] Language contracts defined
```

Add a README note describing that Phase A introduces experimental LSP runtime modes but does not yet move the primary language features.

Add a changelog note describing Phase A as infrastructure only.

- [ ] **Step 2: Run the verification commands before finalizing docs**

Run:

```bash
npx jest --runInBand src/lsp/__tests__/modeSwitch.test.ts src/lsp/__tests__/LspClientManager.test.ts src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/server/__tests__/healthHandler.test.ts src/__tests__/extension.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: If any verification fails, fix only the failing Phase A infrastructure**

Keep the fix set limited to:

- LSP host/client startup
- server runtime/bootstrap
- config/document bridges
- language contracts

Do not start `Spec B` work to make the suite green.

- [ ] **Step 4: Update docs with the actual verification evidence**

Record the final commands and outcome in:

- `CHANGELOG.md`
- `docs/superpowers/specs/2026-04-10-lsp-spec-a-foundation-design.md`

- [ ] **Step 5: Commit the verification-and-docs finish**

```bash
git add README.md CHANGELOG.md docs/superpowers/specs/2026-04-10-lsp-spec-a-foundation-design.md
git commit -m "docs(lsp): record phase-a runtime foundation"
```

## Exit Criteria

Do not start `Spec B` planning until all tasks above are complete and these statements are true:

- The extension can run in `classic`, `hybrid`, and `lsp` modes without activation regressions.
- The server can receive document and config state and answer a health request.
- The project still treats `ParsedDocument -> SyntaxDocument -> SemanticSnapshot` as the future analysis truth chain.
- Classic providers remain available as the safe default path.
- Future feature migration has explicit contracts and no longer depends on directly reusing `vscode.*Provider` classes inside the server.

Plan complete and saved to `docs/superpowers/plans/2026-04-10-lsp-spec-a-foundation.md`. Ready to execute?
