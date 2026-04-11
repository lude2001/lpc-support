# LSP Spec C Single-Path Cutover Implementation Plan

> **Execution status:** Completed on 2026-04-11.
> 
> **Shipped outcome:** diagnostics and formatter now run on the LSP production path, spawned runtime and workspace/config hardening landed, and the public extension surface is now a single LSP runtime path with no exposed multi-mode config.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate diagnostics and formatter into the LSP runtime, harden the production transport/runtime path, and finish by collapsing the extension onto a single public `lsp` runtime path.

**Architecture:** Reuse the Spec A/B client/server foundation and the existing parser/syntax/semantic truth chain. Shared diagnostics and formatting services landed first, parity work was used to close the migration safely, and the public mode-splitting surface has now been removed after the runtime, regression, and cutover checks passed.

**Tech Stack:** TypeScript, VS Code extension APIs, `vscode-languageclient`, `vscode-languageserver`, Jest + ts-jest, existing parser/syntax/semantic/objectInference/formatter infrastructure.

---

## File Map

- Create: `src/language/services/diagnostics/LanguageDiagnosticsService.ts`
  Responsibility: Expose a host-agnostic diagnostics pipeline that wraps the current orchestrator/collector/analyzer chain without depending on `vscode.DiagnosticCollection`.
- Create: `src/language/adapters/classic/diagnosticsAdapter.ts`
  Responsibility: Convert shared diagnostics results back into the temporary classic diagnostics surface during the migration window.
- Create: `src/lsp/server/runtime/DiagnosticsSession.ts`
  Responsibility: Coordinate document-triggered diagnostics work inside the server, cache latest results, and publish them through the LSP connection.
- Create: `src/lsp/server/handlers/diagnostics/registerDiagnosticsHandlers.ts`
  Responsibility: Register document-open/change/close-triggered diagnostics publication backed by `LanguageDiagnosticsService`.
- Create: `src/lsp/server/__tests__/diagnosticsHandlers.test.ts`
  Responsibility: Lock server-side diagnostics scheduling and publish payloads.
- Create: `src/lsp/__tests__/diagnosticsParity.test.ts`
  Responsibility: Compare temporary classic diagnostics output to the LSP diagnostics output for representative fixtures.
- Modify: `src/diagnostics/DiagnosticsOrchestrator.ts`
  Responsibility: Split host-only collection/panel wiring from reusable diagnostics analysis logic.
- Modify: `src/modules/diagnosticsModule.ts`
  Responsibility: Stop owning the production diagnostics pipeline directly; consume the temporary adapter or host-side UX bridge during the migration window.
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
  Responsibility: Wire diagnostics runtime registration without disturbing the Spec B capability handlers.
- Modify: `src/lsp/server/bootstrap/createServer.ts`
  Responsibility: Construct shared diagnostics runtime state once and thread it into the server bootstrap.
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
  Responsibility: Construct the production diagnostics service alongside the existing completion/navigation/structure services.

- Create: `src/language/services/formatting/LanguageFormattingService.ts`
  Responsibility: Expose host-agnostic full/range formatting powered by the existing `FormattingService`.
- Create: `src/language/adapters/classic/formattingAdapter.ts`
  Responsibility: Adapt shared formatting results into the temporary classic formatting provider seam.
- Create: `src/lsp/server/handlers/formatting/registerFormattingHandlers.ts`
  Responsibility: Register LSP document formatting and range formatting handlers backed by `LanguageFormattingService`.
- Create: `src/lsp/server/__tests__/formattingHandlers.test.ts`
  Responsibility: Lock full/range formatting handler behavior and formatting parity expectations.
- Create: `src/lsp/__tests__/formattingParity.test.ts`
  Responsibility: Compare classic formatting output with LSP formatting output on real fixtures and range-formatting cases.
- Modify: `src/formatter/LPCFormattingProvider.ts`
  Responsibility: Delegate through the shared formatting service during the migration window.
- Modify: `src/formatter/FormattingService.ts`
  Responsibility: Remain the syntax-backed formatting core while exposing a cleaner shared-service seam.
- Modify: `src/__tests__/formatPrinter.test.ts`
  Responsibility: Keep printer rule coverage intact while the host surface moves to shared formatting services.
- Modify: `src/__tests__/formatterIntegration.test.ts`
  Responsibility: Lock full-document formatting results through the shared formatting service.
- Modify: `src/__tests__/rangeFormatting.test.ts`
  Responsibility: Lock range-formatting parity through the shared formatting service.
- Modify: `src/__tests__/yifengDebug.test.ts`
  Responsibility: Guard critical real-sample formatter regressions through the migration.

- Create: `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
  Responsibility: Exercise the real built server entry, startup, health request, diagnostics publication, and formatting round-trips across a spawned client/server path.
- Create: `src/lsp/__tests__/singlePathCutover.test.ts`
  Responsibility: Lock that the extension exposes only the `lsp` public runtime path after cutover.
- Modify: `src/lsp/client/activateLspClient.ts`
  Responsibility: Stop treating LSP as optional and become the only public activation path once cutover lands.
- Modify: `src/lsp/client/LspClientManager.ts`
  Responsibility: Harden startup/shutdown/restart/logging and expose any runtime status needed for post-cutover support.
- Modify: `src/lsp/client/bridges/modeSwitch.ts`
  Responsibility: First become migration-only glue, then be deleted or reduced to a private migration helper before the final cutover commit.
- Modify: `src/extension.ts`
  Responsibility: Remove public runtime branching and activate only the LSP path after cutover.
- Modify: `src/modules/languageModule.ts`
  Responsibility: Remove classic provider registration from the production path at the end of the plan.
- Modify: `src/modules/__tests__/languageModule.test.ts`
  Responsibility: Lock the removal of public classic/hybrid mode branching.
- Modify: `src/__tests__/extension.test.ts`
  Responsibility: Lock the final single-path activation behavior.
- Modify: `README.md`
  Responsibility: Update user-facing runtime documentation to a single-path LSP story.
- Modify: `CHANGELOG.md`
  Responsibility: Record the diagnostics/formatter migration and the single-path LSP cutover.
- Modify: `package.json`
  Responsibility: Remove public multi-mode settings/contributions once the single-path cutover is complete.

## Chunk 1: Diagnostics Migration

### Task 1: Extract A Shared Diagnostics Service From The Current Orchestrator

**Files:**
- Create: `src/language/services/diagnostics/LanguageDiagnosticsService.ts`
- Create: `src/language/adapters/classic/diagnosticsAdapter.ts`
- Modify: `src/diagnostics/DiagnosticsOrchestrator.ts`
- Test: `src/__tests__/providerIntegration.test.ts`
- Test: `src/lsp/__tests__/diagnosticsParity.test.ts`

- [ ] **Step 1: Write the failing parity-oriented diagnostics tests**

Add targeted tests that force a shared diagnostics seam to exist:

```ts
const classic = await collectClassicDiagnostics(document);
const shared = await diagnosticsService.collectDiagnostics(request);
expect(normalizeDiagnostics(shared)).toEqual(normalizeDiagnostics(classic));
```

Also add a regression assertion that diagnostics still stay on parser/syntax/semantic truth sources rather than legacy parse cache.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts src/lsp/__tests__/diagnosticsParity.test.ts`

Expected: FAIL because no shared diagnostics service or parity harness exists yet.

- [ ] **Step 3: Implement the smallest reusable diagnostics seam**

Create `src/language/services/diagnostics/LanguageDiagnosticsService.ts` with a contract like:

```ts
export interface LanguageDiagnostic {
    range: LanguageRange;
    severity: 'error' | 'warning' | 'information' | 'hint';
    message: string;
    code?: string;
    source?: string;
}

export interface LanguageDiagnosticsService {
    collectDiagnostics(request: LanguageDiagnosticsRequest): Promise<LanguageDiagnostic[]>;
}
```

Refactor `DiagnosticsOrchestrator` so:

- collector/analyzer execution can be called without owning `vscode.DiagnosticCollection`
- panel/tree-view/file-scan wiring stays host-side
- the shared service remains parser/syntax/semantic-backed

Use `src/language/adapters/classic/diagnosticsAdapter.ts` only to keep the temporary classic surface green.

- [ ] **Step 4: Re-run the targeted diagnostics tests and confirm they pass**

Run: `npx jest --runInBand src/__tests__/providerIntegration.test.ts src/lsp/__tests__/diagnosticsParity.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/diagnostics/LanguageDiagnosticsService.ts src/language/adapters/classic/diagnosticsAdapter.ts src/diagnostics/DiagnosticsOrchestrator.ts src/__tests__/providerIntegration.test.ts src/lsp/__tests__/diagnosticsParity.test.ts
git commit -m "refactor(diagnostics): extract shared diagnostics service"
```

### Task 2: Publish Diagnostics From The LSP Server And Keep Host UX Alive

**Files:**
- Create: `src/lsp/server/runtime/DiagnosticsSession.ts`
- Create: `src/lsp/server/handlers/diagnostics/registerDiagnosticsHandlers.ts`
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Modify: `src/lsp/server/bootstrap/createServer.ts`
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
- Modify: `src/modules/diagnosticsModule.ts`
- Test: `src/lsp/server/__tests__/diagnosticsHandlers.test.ts`
- Test: `src/modules/__tests__/diagnosticsModule.test.ts`

- [ ] **Step 1: Write the failing server diagnostics publication test**

Add a test that proves document lifecycle events trigger `publishDiagnostics`-style behavior from the server runtime:

```ts
documentStore.open(uri, 1, text);
await diagnosticsSession.refresh(uri);
expect(sendDiagnosticsSpy).toHaveBeenCalledWith(uri, expectedDiagnostics);
```

Also add a host-side module test proving panel/tree UX now consumes shared diagnostics results instead of owning the production analysis path.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/modules/__tests__/diagnosticsModule.test.ts`

Expected: FAIL because the server diagnostics session/registration path does not exist yet.

- [ ] **Step 3: Implement server publication and host-side bridge separation**

Create:

- `src/lsp/server/runtime/DiagnosticsSession.ts`
- `src/lsp/server/handlers/diagnostics/registerDiagnosticsHandlers.ts`

Wire the shared diagnostics service into server startup, then make `diagnosticsModule` responsible only for:

- panel/tree/file-scan UX
- temporary classic bridge consumption during migration

Do not let host-side UX remain the production diagnostics source of truth.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/modules/__tests__/diagnosticsModule.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/server/runtime/DiagnosticsSession.ts src/lsp/server/handlers/diagnostics/registerDiagnosticsHandlers.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/bootstrap/createServer.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/modules/diagnosticsModule.ts src/lsp/server/__tests__/diagnosticsHandlers.test.ts src/modules/__tests__/diagnosticsModule.test.ts
git commit -m "feat(lsp): publish diagnostics from server runtime"
```

## Chunk 2: Formatter Migration

### Task 3: Wrap The Existing Formatter In A Shared Formatting Service

**Files:**
- Create: `src/language/services/formatting/LanguageFormattingService.ts`
- Create: `src/language/adapters/classic/formattingAdapter.ts`
- Modify: `src/formatter/LPCFormattingProvider.ts`
- Modify: `src/formatter/FormattingService.ts`
- Test: `src/__tests__/formatterIntegration.test.ts`
- Test: `src/__tests__/rangeFormatting.test.ts`
- Test: `src/__tests__/yifengDebug.test.ts`

- [ ] **Step 1: Write the failing formatting seam tests**

Add tests proving classic formatting now delegates through a shared service but preserves exact output on real fixtures:

```ts
const edits = await provider.provideDocumentFormattingEdits(document, options, token);
expect(applyEdits(document, edits)).toBe(expectedFixtureText);
expect(formattingServiceSpy).toHaveBeenCalledTimes(1);
```

Mirror the same idea for range formatting.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/__tests__/formatterIntegration.test.ts src/__tests__/rangeFormatting.test.ts src/__tests__/yifengDebug.test.ts`

Expected: FAIL because the shared formatting service seam does not exist yet.

- [ ] **Step 3: Implement the smallest shared formatting seam**

Create `src/language/services/formatting/LanguageFormattingService.ts` and keep `src/formatter/FormattingService.ts` as the syntax-backed core.

The shared service should expose:

```ts
formatDocument(request: LanguageFormattingRequest): Promise<LanguageTextEdit[]>;
formatRange(request: LanguageRangeFormattingRequest): Promise<LanguageTextEdit[]>;
```

Then use `src/language/adapters/classic/formattingAdapter.ts` to keep `LPCFormattingProvider` thin.

- [ ] **Step 4: Re-run the formatter regression tests and confirm they pass**

Run: `npx jest --runInBand src/__tests__/formatterIntegration.test.ts src/__tests__/rangeFormatting.test.ts src/__tests__/yifengDebug.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/formatting/LanguageFormattingService.ts src/language/adapters/classic/formattingAdapter.ts src/formatter/LPCFormattingProvider.ts src/formatter/FormattingService.ts src/__tests__/formatterIntegration.test.ts src/__tests__/rangeFormatting.test.ts src/__tests__/yifengDebug.test.ts
git commit -m "refactor(formatter): add shared formatting service"
```

### Task 4: Register LSP Formatting Handlers And Add Parity Coverage

**Files:**
- Create: `src/lsp/server/handlers/formatting/registerFormattingHandlers.ts`
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Modify: `src/lsp/server/bootstrap/createServer.ts`
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
- Create: `src/lsp/server/__tests__/formattingHandlers.test.ts`
- Create: `src/lsp/__tests__/formattingParity.test.ts`
- Test: `src/__tests__/formatPrinter.test.ts`

- [ ] **Step 1: Write the failing LSP formatting handler tests**

Add tests like:

```ts
const edits = await formattingHandler(params);
expect(edits).toEqual(expectedLspEdits);
expect(initializeResult.capabilities.documentFormattingProvider).toBe(true);
expect(initializeResult.capabilities.documentRangeFormattingProvider).toBe(true);
```

Add a parity test that applies classic and LSP edits to the same fixture and compares normalized output.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/formattingHandlers.test.ts src/lsp/__tests__/formattingParity.test.ts src/__tests__/formatPrinter.test.ts`

Expected: FAIL because the LSP formatting handlers do not exist yet.

- [ ] **Step 3: Implement the handler and capability wiring**

Create `src/lsp/server/handlers/formatting/registerFormattingHandlers.ts` and register:

- document formatting
- document range formatting

Back them with the same shared formatting service already used by the temporary classic provider.

- [ ] **Step 4: Re-run the targeted formatting tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/server/__tests__/formattingHandlers.test.ts src/lsp/__tests__/formattingParity.test.ts src/__tests__/formatPrinter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/server/handlers/formatting/registerFormattingHandlers.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/bootstrap/createServer.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/__tests__/formattingHandlers.test.ts src/lsp/__tests__/formattingParity.test.ts src/__tests__/formatPrinter.test.ts
git commit -m "feat(lsp): add formatting handlers and parity coverage"
```

## Chunk 3: Runtime Hardening

### Task 5: Add Spawned Runtime Integration Coverage For Health, Diagnostics, And Formatting

**Files:**
- Create: `src/lsp/__tests__/spawnedRuntime.integration.test.ts`
- Modify: `src/lsp/client/LspClientManager.ts`
- Modify: `src/lsp/client/activateLspClient.ts`
- Modify: `src/lsp/server/handlers/health/healthHandler.ts`
- Modify: `src/lsp/server/__tests__/healthHandler.test.ts`

- [ ] **Step 1: Write the failing spawned-runtime integration test**

Add an integration test that starts the real built server entry and proves:

```ts
expect(await requestHealth()).toEqual(expect.objectContaining({ status: 'ok' }));
expect(await receiveDiagnostics(uri)).toEqual(expectedDiagnostics);
expect(await requestFormatting(uri)).toEqual(expectedEdits);
```

Keep the fixture intentionally small and deterministic.

- [ ] **Step 2: Run the targeted integration test to verify it fails**

Run: `npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts`

Expected: FAIL because the real spawned runtime contract is not fully covered yet.

- [ ] **Step 3: Implement the minimum runtime hardening needed**

Tighten `LspClientManager` and any health/runtime metadata needed so:

- startup failure is diagnosable
- server restart/shutdown is deterministic
- spawned integration can exercise real health/diagnostics/formatting round-trips

Do not add speculative telemetry surfaces; add only what the spawned integration test needs.

- [ ] **Step 4: Re-run the spawned-runtime integration test and confirm it passes**

Run: `npx jest --runInBand src/lsp/__tests__/spawnedRuntime.integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/__tests__/spawnedRuntime.integration.test.ts src/lsp/client/LspClientManager.ts src/lsp/client/activateLspClient.ts src/lsp/server/handlers/health/healthHandler.ts src/lsp/server/__tests__/healthHandler.test.ts
git commit -m "test(lsp): add spawned runtime integration coverage"
```

### Task 6: Lock Multi-Workspace, Config-Sync, And Node-Safe Server Guarantees

**Files:**
- Modify: `src/lsp/client/bridges/configurationBridge.ts`
- Modify: `src/lsp/server/runtime/WorkspaceSession.ts`
- Modify: `src/lsp/server/runtime/serverHostState.ts`
- Modify: `src/lsp/server/runtime/vscodeShim.ts`
- Modify: `src/lsp/server/__tests__/serverBundle.test.ts`
- Modify: `src/lsp/__tests__/LspClientManager.test.ts`
- Modify: `src/lsp/server/__tests__/WorkspaceSession.test.ts`

- [ ] **Step 1: Write the failing hardening regressions**

Add focused tests for:

- nested/multi-workspace config sync updates
- server-side workspace root updates after config changes
- built server bundle remaining free of runtime `require("vscode")`

Example assertion:

```ts
expect(bundle).not.toContain('require("vscode")');
expect(session.getWorkspaceRoots()).toEqual(['D:/workspace-a', 'D:/workspace-b']);
```

- [ ] **Step 2: Run the targeted hardening tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/serverBundle.test.ts src/lsp/__tests__/LspClientManager.test.ts src/lsp/server/__tests__/WorkspaceSession.test.ts`

Expected: FAIL if the current runtime hardening is incomplete.

- [ ] **Step 3: Implement only the missing hardening**

Tighten config sync and workspace-root propagation, and keep the server-only `vscode` compatibility boundary explicit and tested.

This step must not reintroduce public mode branching.

- [ ] **Step 4: Re-run the targeted hardening tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/server/__tests__/serverBundle.test.ts src/lsp/__tests__/LspClientManager.test.ts src/lsp/server/__tests__/WorkspaceSession.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/client/bridges/configurationBridge.ts src/lsp/server/runtime/WorkspaceSession.ts src/lsp/server/runtime/serverHostState.ts src/lsp/server/runtime/vscodeShim.ts src/lsp/server/__tests__/serverBundle.test.ts src/lsp/__tests__/LspClientManager.test.ts src/lsp/server/__tests__/WorkspaceSession.test.ts
git commit -m "fix(lsp): harden workspace sync and server runtime boundary"
```

## Chunk 4: Single-Path Cutover

### Task 7: Remove Public Classic/Hybrid Runtime Branching

**Files:**
- Modify: `src/lsp/client/bridges/modeSwitch.ts`
- Modify: `src/extension.ts`
- Modify: `src/modules/languageModule.ts`
- Modify: `src/modules/__tests__/languageModule.test.ts`
- Modify: `src/__tests__/extension.test.ts`
- Create: `src/lsp/__tests__/singlePathCutover.test.ts`

- [ ] **Step 1: Write the failing single-path cutover tests**

Add tests that prove:

```ts
await activate(context);
expect(registerLanguageProviders).not.toHaveBeenCalled();
expect(activateLspClient).toHaveBeenCalledTimes(1);
expect(resolvePublicRuntimeModes()).toEqual(['lsp']);
```

The final public behavior should expose only the LSP runtime path.

- [ ] **Step 2: Run the targeted cutover tests to verify they fail**

Run: `npx jest --runInBand src/modules/__tests__/languageModule.test.ts src/__tests__/extension.test.ts src/lsp/__tests__/singlePathCutover.test.ts`

Expected: FAIL because public classic/hybrid branching still exists.

- [ ] **Step 3: Remove public mode-splitting**

Update activation/module code so:

- the extension always starts the LSP path
- classic provider registration is removed from the public production path
- any remaining migration-only helpers become private/internal or are deleted

Do not remove code that is still required by unfinished tests in the same commit; make the production surface single-path first, then clean residual internals in the next task.

- [ ] **Step 4: Re-run the targeted cutover tests and confirm they pass**

Run: `npx jest --runInBand src/modules/__tests__/languageModule.test.ts src/__tests__/extension.test.ts src/lsp/__tests__/singlePathCutover.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/client/bridges/modeSwitch.ts src/extension.ts src/modules/languageModule.ts src/modules/__tests__/languageModule.test.ts src/__tests__/extension.test.ts src/lsp/__tests__/singlePathCutover.test.ts
git commit -m "refactor(lsp): collapse public runtime to single lsp path"
```

### Task 8: Update Docs, Remove Public Multi-Mode Config, And Run The Final Spec C Sweep

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-04-10-lsp-spec-c-deep-runtime-and-default-cutover-design.md`
- Modify: `docs/superpowers/plans/2026-04-10-lsp-spec-c-single-path-cutover.md`

- [ ] **Step 1: Write the failing final-sweep expectations**

Before editing docs/config, add or update the cutover tests so they explicitly fail if:

```ts
expect(packageJson.contributes.configuration.properties['lpc.experimental.lspMode']).toBeUndefined();
expect(readmeText).toContain('single LSP runtime path');
```

If there is no good existing test file for one of these checks, add it to `src/lsp/__tests__/singlePathCutover.test.ts`.

- [ ] **Step 2: Run the targeted cutover test to verify it fails**

Run: `npx jest --runInBand src/lsp/__tests__/singlePathCutover.test.ts`

Expected: FAIL because docs/config still describe multi-mode behavior.

- [ ] **Step 3: Update public docs/config and then run the full verification sweep**

Remove the public multi-mode configuration from `package.json`, update `README.md` and `CHANGELOG.md` to the single-path LSP story, and align the Spec C docs/plan with what actually shipped.

Then run the full Spec C verification sweep:

```bash
npx jest --runInBand \
  src/lsp/__tests__/LspClientManager.test.ts \
  src/lsp/__tests__/diagnosticsParity.test.ts \
  src/lsp/__tests__/formattingParity.test.ts \
  src/lsp/__tests__/spawnedRuntime.integration.test.ts \
  src/lsp/__tests__/singlePathCutover.test.ts \
  src/lsp/server/__tests__/diagnosticsHandlers.test.ts \
  src/lsp/server/__tests__/formattingHandlers.test.ts \
  src/lsp/server/__tests__/serverBundle.test.ts \
  src/__tests__/providerIntegration.test.ts \
  src/__tests__/formatterIntegration.test.ts \
  src/__tests__/rangeFormatting.test.ts \
  src/__tests__/yifengDebug.test.ts \
  src/__tests__/extension.test.ts
npx tsc --noEmit
node esbuild.mjs
```

Expected: all commands PASS.

- [ ] **Step 4: Re-run the targeted cutover/doc test and confirm it passes**

Run: `npx jest --runInBand src/lsp/__tests__/singlePathCutover.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md CHANGELOG.md docs/superpowers/specs/2026-04-10-lsp-spec-c-deep-runtime-and-default-cutover-design.md docs/superpowers/plans/2026-04-10-lsp-spec-c-single-path-cutover.md src/lsp/__tests__/singlePathCutover.test.ts
git commit -m "feat(lsp): finalize single-path lsp cutover"
```

---

Plan executed and verified. This document now serves as the implementation record for the completed Spec C cutover.
