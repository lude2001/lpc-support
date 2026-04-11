# LSP Spec B Language Capabilities Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the eight primary language capabilities to an LSP path that can be validated in `hybrid` mode while preserving the current parser/syntax/semantic truth chain and keeping classic providers as the comparison baseline.

**Architecture:** Build pure language services first, then adapt them twice: once back into the existing classic providers and once into LSP server handlers. Execute the migration in three capability groups: completion; navigation/understanding; structural presentation. Use `hybrid` as the primary validation mode and add classic-vs-lsp comparison tests so we can measure drift before deciding whether full `lsp` mode should take over these capabilities.

**Tech Stack:** TypeScript, VS Code extension APIs, `vscode-languageclient`, `vscode-languageserver`, Jest + ts-jest, existing parser/syntax/semantic/objectInference services.

---

## File Map

- Create: `src/language/contracts/LanguagePosition.ts`
  Responsibility: Define host-agnostic position/range/location primitives used by LSP and classic adapters.
- Create: `src/language/contracts/LanguageMarkup.ts`
  Responsibility: Define shared documentation/hover/content shapes without importing VS Code or LSP types directly.
- Create: `src/language/contracts/LanguageCapabilityContext.ts`
  Responsibility: Define common request context for capability services, including document, workspace, cancellation, and runtime mode hints.
- Create: `src/language/services/completion/LanguageCompletionService.ts`
  Responsibility: Expose a pure completion pipeline that wraps the current completion query engine and object-inference-aware completion candidate resolution.
- Create: `src/language/services/navigation/LanguageHoverService.ts`
  Responsibility: Expose hover resolution for object methods, macros, efuns, and future symbol-based docs.
- Create: `src/language/services/navigation/LanguageDefinitionService.ts`
  Responsibility: Expose definition lookup for includes, macros, simulated efuns, local symbols, and inferred object methods.
- Create: `src/language/services/navigation/LanguageReferenceService.ts`
  Responsibility: Expose reference discovery via symbol binding results.
- Create: `src/language/services/navigation/LanguageRenameService.ts`
  Responsibility: Expose prepare-rename and rename edit plans without binding directly to `vscode.WorkspaceEdit`.
- Create: `src/language/services/navigation/LanguageSymbolService.ts`
  Responsibility: Expose document-symbol output from semantic/type summaries.
- Create: `src/language/services/structure/LanguageFoldingService.ts`
  Responsibility: Expose folding ranges derived from syntax and trivia.
- Create: `src/language/services/structure/LanguageSemanticTokensService.ts`
  Responsibility: Expose semantic token data and legend-compatible token classifications.
- Create: `src/language/adapters/classic/completionAdapter.ts`
  Responsibility: Convert pure completion results into `vscode.CompletionItemProvider`-friendly output and reuse the same service as LSP.
- Create: `src/language/adapters/classic/navigationAdapter.ts`
  Responsibility: Convert hover/definition/reference/rename/symbol service results into classic VS Code provider outputs.
- Create: `src/language/adapters/classic/structureAdapter.ts`
  Responsibility: Convert folding and semantic-token service results into classic VS Code provider outputs.
- Create: `src/language/adapters/lsp/conversions.ts`
  Responsibility: Convert between shared language contracts and LSP `Position`, `Range`, `Location`, markup, completion, token, and symbol payloads.
- Create: `src/lsp/server/handlers/completion/registerCompletionHandler.ts`
  Responsibility: Register LSP completion and completion-resolve handlers backed by `LanguageCompletionService`.
- Create: `src/lsp/server/handlers/navigation/registerHoverHandler.ts`
  Responsibility: Register the LSP hover handler backed by `LanguageHoverService`.
- Create: `src/lsp/server/handlers/navigation/registerDefinitionHandler.ts`
  Responsibility: Register the LSP definition handler backed by `LanguageDefinitionService`.
- Create: `src/lsp/server/handlers/navigation/registerReferencesHandler.ts`
  Responsibility: Register the LSP references handler backed by `LanguageReferenceService`.
- Create: `src/lsp/server/handlers/navigation/registerRenameHandler.ts`
  Responsibility: Register the LSP rename / prepareRename handlers backed by `LanguageRenameService`.
- Create: `src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts`
  Responsibility: Register the LSP document symbol handler backed by `LanguageSymbolService`.
- Create: `src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts`
  Responsibility: Register the LSP folding range handler backed by `LanguageFoldingService`.
- Create: `src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts`
  Responsibility: Register the LSP semantic tokens legend/full handler backed by `LanguageSemanticTokensService`.
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
  Responsibility: Register the Spec B handlers and capability declarations without disturbing Phase A config/document/health wiring.
- Modify: `src/lsp/server/bootstrap/createServer.ts`
  Responsibility: Construct the language services once and thread them into handler registration.
- Modify: `src/completionProvider.ts`
  Responsibility: Delegate classic completion behavior to the shared completion service instead of duplicating provider-only logic.
- Modify: `src/definitionProvider.ts`
  Responsibility: Delegate classic definition behavior to the shared definition service and keep object inference/target lookup reuse intact.
- Modify: `src/objectInference/ObjectHoverProvider.ts`
  Responsibility: Delegate object hover behavior through the shared hover service without losing existing object-doc behavior.
- Modify: `src/referenceProvider.ts`
  Responsibility: Delegate classic references to the shared reference service.
- Modify: `src/renameProvider.ts`
  Responsibility: Delegate classic prepareRename/rename to the shared rename service.
- Modify: `src/symbolProvider.ts`
  Responsibility: Delegate classic document symbols to the shared symbol service.
- Modify: `src/foldingProvider.ts`
  Responsibility: Delegate classic folding ranges to the shared folding service.
- Modify: `src/semanticTokensProvider.ts`
  Responsibility: Delegate classic semantic tokens to the shared semantic token service and preserve legend compatibility.
- Modify: `src/modules/languageModule.ts`
  Responsibility: Keep classic provider registration but update provider construction to consume the new service-backed adapters where needed.
- Test: `src/lsp/server/__tests__/completionHandler.test.ts`
  Responsibility: Lock LSP completion behavior and resolve semantics.
- Test: `src/lsp/server/__tests__/navigationHandlers.test.ts`
  Responsibility: Lock hover, definition, references, rename, and document symbol LSP handler output.
- Test: `src/lsp/server/__tests__/structureHandlers.test.ts`
  Responsibility: Lock folding range and semantic tokens LSP handler output and legend behavior.
- Test: `src/lsp/__tests__/languageParity.test.ts`
  Responsibility: Compare classic vs lsp outputs for representative fixtures across the 8 capabilities in `hybrid`-style harnesses.
- Modify: `src/__tests__/providerIntegration.test.ts`
  Responsibility: Extend regression coverage so migrated classic providers still stay on the semantic/syntax truth chain while matching the new services.
- Modify: `src/__tests__/completionProvider.test.ts`
  Responsibility: Keep classic completion regression coverage while the provider delegates to the shared service.
- Modify: `src/__tests__/semanticTokensProvider.test.ts`
  Responsibility: Keep classic semantic-token regression coverage while the provider delegates to the shared service.
- Modify: `src/__tests__/extension.test.ts`
  Responsibility: Lock that hybrid and lsp activation routes still behave correctly after capability handlers are registered on the server side.
- Modify: `README.md`
  Responsibility: Update user-facing runtime notes only after the capability matrix and hybrid validation story are accurate.
- Modify: `CHANGELOG.md`
  Responsibility: Record Spec B capability migration scope and any explicit remaining gaps.

## Chunk 1: Shared Contracts And Service Seams

### Task 1: Add Shared Capability Contracts And LSP Conversion Primitives

**Files:**
- Create: `src/language/contracts/LanguagePosition.ts`
- Create: `src/language/contracts/LanguageMarkup.ts`
- Create: `src/language/contracts/LanguageCapabilityContext.ts`
- Create: `src/language/adapters/lsp/conversions.ts`
- Test: `src/lsp/server/__tests__/navigationHandlers.test.ts`

- [ ] **Step 1: Write the failing test for shared range/location conversion**

Add `src/lsp/server/__tests__/navigationHandlers.test.ts` assertions that will require common conversions:

```ts
expect(toLspRange({
    start: { line: 1, character: 2 },
    end: { line: 3, character: 4 }
})).toEqual({
    start: { line: 1, character: 2 },
    end: { line: 3, character: 4 }
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts -t "shared range/location conversion"`

Expected: FAIL because the shared contracts and conversions do not exist yet.

- [ ] **Step 3: Implement the minimum shared contract layer**

Create:

- `src/language/contracts/LanguagePosition.ts`
- `src/language/contracts/LanguageMarkup.ts`
- `src/language/contracts/LanguageCapabilityContext.ts`
- `src/language/adapters/lsp/conversions.ts`

Keep the shapes intentionally small:

```ts
export interface LanguagePosition { line: number; character: number; }
export interface LanguageRange { start: LanguagePosition; end: LanguagePosition; }
export interface LanguageLocation { uri: string; range: LanguageRange; }
export interface LanguageMarkupContent { kind: 'markdown' | 'plaintext'; value: string; }
```

Do not define capability-specific payloads in this task.

- [ ] **Step 4: Re-run the targeted test and confirm it passes**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts -t "shared range/location conversion"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/contracts/LanguagePosition.ts src/language/contracts/LanguageMarkup.ts src/language/contracts/LanguageCapabilityContext.ts src/language/adapters/lsp/conversions.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "feat(lsp): add shared capability contracts and conversions"
```

### Task 2: Establish Service Interfaces For The Three Capability Groups

**Files:**
- Create: `src/language/services/completion/LanguageCompletionService.ts`
- Create: `src/language/services/navigation/LanguageHoverService.ts`
- Create: `src/language/services/navigation/LanguageDefinitionService.ts`
- Create: `src/language/services/navigation/LanguageReferenceService.ts`
- Create: `src/language/services/navigation/LanguageRenameService.ts`
- Create: `src/language/services/navigation/LanguageSymbolService.ts`
- Create: `src/language/services/structure/LanguageFoldingService.ts`
- Create: `src/language/services/structure/LanguageSemanticTokensService.ts`
- Modify: `src/lsp/server/runtime/WorkspaceSession.ts`
- Test: `src/lsp/server/__tests__/WorkspaceSession.test.ts`

- [ ] **Step 1: Write the failing test for exposing services through the language workspace context**

Add a test like:

```ts
const context = session.toLanguageWorkspaceContext(workspaceRoot);
expect(context.services).toBeDefined();
```

where `WorkspaceSession` is constructed with one or two stub services.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/lsp/server/__tests__/WorkspaceSession.test.ts -t "services through the language workspace context"`

Expected: FAIL because the service interfaces and session support do not exist yet.

- [ ] **Step 3: Add minimal interfaces only**

Define service method signatures, not implementations, for the three capability groups.

Example:

```ts
export interface LanguageCompletionService {
    provideCompletion(request: LanguageCompletionRequest): Promise<LanguageCompletionResult>;
}
```

Update `WorkspaceSession` only enough to carry these future-facing services in `LanguageWorkspaceContext`.

- [ ] **Step 4: Re-run the targeted test and confirm it passes**

Run: `npx jest --runInBand src/lsp/server/__tests__/WorkspaceSession.test.ts -t "services through the language workspace context"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/completion/LanguageCompletionService.ts src/language/services/navigation/LanguageHoverService.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/services/navigation/LanguageReferenceService.ts src/language/services/navigation/LanguageRenameService.ts src/language/services/navigation/LanguageSymbolService.ts src/language/services/structure/LanguageFoldingService.ts src/language/services/structure/LanguageSemanticTokensService.ts src/lsp/server/runtime/WorkspaceSession.ts src/lsp/server/__tests__/WorkspaceSession.test.ts
git commit -m "refactor(lsp): define spec-b language service interfaces"
```

## Chunk 2: Completion Group

### Task 3: Extract A Pure Completion Service And Keep Classic Completion Green

**Files:**
- Create: `src/language/services/completion/LanguageCompletionService.ts`
- Create: `src/language/adapters/classic/completionAdapter.ts`
- Modify: `src/completionProvider.ts`
- Modify: `src/__tests__/completionProvider.test.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Write the failing classic-provider regression**

Add a test proving the classic provider now delegates through a service boundary without changing observable output for a representative local function completion case:

```ts
expect(result.map(item => item.label)).toContain('local_call');
expect(serviceSpy).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts src/__tests__/providerIntegration.test.ts -t "delegates through LanguageCompletionService|local_call"`

Expected: FAIL because the provider still owns the pipeline directly.

- [ ] **Step 3: Extract the minimum service**

Move the provider’s core completion query behavior into `LanguageCompletionService` while preserving:

- query engine reuse
- inheritance prewarming/index updates
- object inference aware candidate resolution
- completion resolve support

Keep the classic provider as a thin VS Code adapter over the service.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/__tests__/completionProvider.test.ts src/__tests__/providerIntegration.test.ts -t "delegates through LanguageCompletionService|local_call"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/completion/LanguageCompletionService.ts src/language/adapters/classic/completionAdapter.ts src/completionProvider.ts src/__tests__/completionProvider.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "refactor(lsp): extract shared completion service"
```

### Task 4: Register LSP Completion And Completion-Resolve Handlers

**Files:**
- Create: `src/lsp/server/handlers/completion/registerCompletionHandler.ts`
- Modify: `src/lsp/server/bootstrap/createServer.ts`
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Test: `src/lsp/server/__tests__/completionHandler.test.ts`

- [ ] **Step 1: Write the failing LSP completion handler test**

Add a handler test that proves:

```ts
expect(result.items.map(item => item.label)).toContain('local_call');
expect(result.isIncomplete).toBe(false);
```

Also add a resolve-path test for one item’s documentation/snippet completion.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `npx jest --runInBand src/lsp/server/__tests__/completionHandler.test.ts`

Expected: FAIL because the completion handler is not registered yet.

- [ ] **Step 3: Implement the minimum LSP completion registration**

Create `registerCompletionHandler.ts`, thread the completion service from `createServer.ts`, and advertise completion capability in `registerCapabilities.ts`.

Do not add unrelated navigation or structure handlers in this task.

- [ ] **Step 4: Re-run the targeted test and confirm it passes**

Run: `npx jest --runInBand src/lsp/server/__tests__/completionHandler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/server/handlers/completion/registerCompletionHandler.ts src/lsp/server/bootstrap/createServer.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/__tests__/completionHandler.test.ts
git commit -m "feat(lsp): add completion handlers on the server path"
```

## Chunk 3: Navigation And Understanding Group

### Task 5: Extract Hover And Definition Services With Object-Inference Reuse

**Files:**
- Create: `src/language/services/navigation/LanguageHoverService.ts`
- Create: `src/language/services/navigation/LanguageDefinitionService.ts`
- Create: `src/language/adapters/classic/navigationAdapter.ts`
- Modify: `src/objectInference/ObjectHoverProvider.ts`
- Modify: `src/definitionProvider.ts`
- Modify: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`

- [ ] **Step 1: Write the failing regression tests**

Add tests that prove:

- object-method hover still resolves the same implementation docs
- definition still resolves updated-document semantic snapshots and inferred object methods
- the classic providers delegate through the new services

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/providerIntegration.test.ts -t "delegate through LanguageHoverService|delegate through LanguageDefinitionService|this_object"`

Expected: FAIL because the providers still own the logic directly.

- [ ] **Step 3: Extract the minimum services**

Preserve:

- object inference
- target method lookup
- include/macro/simul efun definition routing
- multi-implementation hover behavior

Keep classic providers as adapters only.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/providerIntegration.test.ts -t "delegate through LanguageHoverService|delegate through LanguageDefinitionService|this_object"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/navigation/LanguageHoverService.ts src/language/services/navigation/LanguageDefinitionService.ts src/language/adapters/classic/navigationAdapter.ts src/objectInference/ObjectHoverProvider.ts src/definitionProvider.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/providerIntegration.test.ts
git commit -m "refactor(lsp): extract hover and definition services"
```

### Task 6: Extract References, Rename, And Document Symbol Services

**Files:**
- Create: `src/language/services/navigation/LanguageReferenceService.ts`
- Create: `src/language/services/navigation/LanguageRenameService.ts`
- Create: `src/language/services/navigation/LanguageSymbolService.ts`
- Modify: `src/referenceProvider.ts`
- Modify: `src/renameProvider.ts`
- Modify: `src/symbolProvider.ts`
- Test: `src/lsp/server/__tests__/navigationHandlers.test.ts`

- [ ] **Step 1: Write the failing tests for the remaining navigation group**

Add tests that prove:

- references remain filtered by includeDeclaration semantics
- rename still returns precise same-file edit ranges
- document symbols still expose classes/structs/functions with child members

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts -t "references|rename|document symbols"`

Expected: FAIL because the services and handlers do not exist yet.

- [ ] **Step 3: Extract the remaining services and thin classic adapters**

Continue reusing:

- `resolveSymbolReferences`
- semantic/type summaries

Do not enlarge rename scope beyond the current current-file contract in this task.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts -t "references|rename|document symbols"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/navigation/LanguageReferenceService.ts src/language/services/navigation/LanguageRenameService.ts src/language/services/navigation/LanguageSymbolService.ts src/referenceProvider.ts src/renameProvider.ts src/symbolProvider.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "refactor(lsp): extract symbol navigation services"
```

### Task 7: Register LSP Navigation Handlers

**Files:**
- Create: `src/lsp/server/handlers/navigation/registerHoverHandler.ts`
- Create: `src/lsp/server/handlers/navigation/registerDefinitionHandler.ts`
- Create: `src/lsp/server/handlers/navigation/registerReferencesHandler.ts`
- Create: `src/lsp/server/handlers/navigation/registerRenameHandler.ts`
- Create: `src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts`
- Modify: `src/lsp/server/bootstrap/createServer.ts`
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Test: `src/lsp/server/__tests__/navigationHandlers.test.ts`

- [ ] **Step 1: Write the failing LSP navigation handler tests**

Add direct handler tests for:

- hover markup
- definition locations
- references arrays
- prepareRename + rename edits
- document symbol trees

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts`

Expected: FAIL because the navigation handlers are not registered yet.

- [ ] **Step 3: Implement and register the LSP navigation handlers**

Wire only this group in this task. Do not mix structure handlers here.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/server/__tests__/navigationHandlers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/server/handlers/navigation/registerHoverHandler.ts src/lsp/server/handlers/navigation/registerDefinitionHandler.ts src/lsp/server/handlers/navigation/registerReferencesHandler.ts src/lsp/server/handlers/navigation/registerRenameHandler.ts src/lsp/server/handlers/navigation/registerDocumentSymbolHandler.ts src/lsp/server/bootstrap/createServer.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/__tests__/navigationHandlers.test.ts
git commit -m "feat(lsp): add navigation and symbol handlers"
```

## Chunk 4: Structure Group And Parity Closure

### Task 8: Extract Folding And Semantic Tokens Services

**Files:**
- Create: `src/language/services/structure/LanguageFoldingService.ts`
- Create: `src/language/services/structure/LanguageSemanticTokensService.ts`
- Create: `src/language/adapters/classic/structureAdapter.ts`
- Modify: `src/foldingProvider.ts`
- Modify: `src/semanticTokensProvider.ts`
- Modify: `src/__tests__/semanticTokensProvider.test.ts`
- Test: `src/lsp/server/__tests__/structureHandlers.test.ts`

- [ ] **Step 1: Write the failing regression tests**

Add tests that prove:

- classic folding ranges still follow syntax/trivia structure
- semantic token output preserves the same legend/type mapping for representative constructs

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/__tests__/semanticTokensProvider.test.ts src/lsp/server/__tests__/structureHandlers.test.ts`

Expected: FAIL because the services/handlers do not exist yet.

- [ ] **Step 3: Extract the structure services**

Keep:

- trivia-backed folding behavior
- token classification logic
- current semantic token legend semantics

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/__tests__/semanticTokensProvider.test.ts src/lsp/server/__tests__/structureHandlers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/language/services/structure/LanguageFoldingService.ts src/language/services/structure/LanguageSemanticTokensService.ts src/language/adapters/classic/structureAdapter.ts src/foldingProvider.ts src/semanticTokensProvider.ts src/__tests__/semanticTokensProvider.test.ts src/lsp/server/__tests__/structureHandlers.test.ts
git commit -m "refactor(lsp): extract structure presentation services"
```

### Task 9: Register LSP Folding And Semantic Tokens Handlers

**Files:**
- Create: `src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts`
- Create: `src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts`
- Modify: `src/lsp/server/bootstrap/createServer.ts`
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Test: `src/lsp/server/__tests__/structureHandlers.test.ts`

- [ ] **Step 1: Write the failing handler tests**

Add tests that prove:

- folding ranges are returned for representative syntax/trivia fixtures
- semantic tokens legend/full output are registered and stable

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx jest --runInBand src/lsp/server/__tests__/structureHandlers.test.ts`

Expected: FAIL because these handlers are not registered yet.

- [ ] **Step 3: Implement the LSP structure handlers**

Register only:

- folding range
- semantic tokens (legend + full)

Do not mix diagnostics or formatting behavior into this task.

- [ ] **Step 4: Re-run the targeted tests and confirm they pass**

Run: `npx jest --runInBand src/lsp/server/__tests__/structureHandlers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lsp/server/handlers/structure/registerFoldingRangeHandler.ts src/lsp/server/handlers/structure/registerSemanticTokensHandler.ts src/lsp/server/bootstrap/createServer.ts src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/__tests__/structureHandlers.test.ts
git commit -m "feat(lsp): add structure capability handlers"
```

### Task 10: Add Hybrid Parity Harness, Capability Matrix, And Spec B Verification Sweep

**Files:**
- Create: `src/lsp/__tests__/languageParity.test.ts`
- Modify: `src/__tests__/providerIntegration.test.ts`
- Modify: `src/__tests__/extension.test.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-04-10-lsp-spec-b-language-capabilities-design.md`

- [ ] **Step 1: Write the failing parity harness tests**

Add a parity suite that, for representative fixtures, compares classic vs lsp outputs for:

- completion
- hover
- definition
- references
- rename
- documentSymbol
- foldingRange
- semanticTokens

Start by asserting that the parity harness exists and records per-capability results.

- [ ] **Step 2: Run the parity suite to verify it fails**

Run: `npx jest --runInBand src/lsp/__tests__/languageParity.test.ts`

Expected: FAIL because the harness and/or parity record format does not exist yet.

- [ ] **Step 3: Implement the parity harness and record the capability matrix**

Build a minimal `hybrid`-style harness that:

- invokes the classic provider path
- invokes the LSP handler path
- records whether outputs match exactly or differ by known accepted reasons

Update docs only after the matrix is available.

- [ ] **Step 4: Run the full Spec B verification sweep**

Run:

```bash
npx jest --runInBand src/lsp/__tests__/modeSwitch.test.ts src/lsp/__tests__/LspClientManager.test.ts src/lsp/__tests__/languageParity.test.ts src/lsp/server/__tests__/completionHandler.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/server/__tests__/structureHandlers.test.ts src/lsp/server/__tests__/DocumentStore.test.ts src/lsp/server/__tests__/WorkspaceSession.test.ts src/lsp/server/__tests__/healthHandler.test.ts src/__tests__/completionProvider.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/semanticTokensProvider.test.ts src/__tests__/extension.test.ts
npx tsc --noEmit
node esbuild.mjs
```

Expected: PASS.

- [ ] **Step 5: Update docs and commit**

Record:

- the capability matrix
- the remaining accepted gaps
- whether `lsp` mode is ready to take over or still should remain non-default

Then commit:

```bash
git add src/lsp/__tests__/languageParity.test.ts src/__tests__/providerIntegration.test.ts src/__tests__/extension.test.ts README.md CHANGELOG.md docs/superpowers/specs/2026-04-10-lsp-spec-b-language-capabilities-design.md
git commit -m "docs(lsp): record spec-b capability parity results"
```

## Exit Criteria

Do not close `Spec B` until all of the following are true:

- All 8 target capabilities have both a shared language-service path and an LSP handler path.
- Classic providers continue to work and act as the comparison baseline.
- Hybrid parity results exist for all 8 capabilities.
- Any classic-vs-lsp mismatches are explicitly categorized and accepted or fixed.
- `formatter` and `diagnostics` have not been pulled forward into this phase.
- The team can make an informed end-of-phase decision about whether full `lsp` mode should take over these 8 capabilities.

Plan complete and saved to `docs/superpowers/plans/2026-04-10-lsp-spec-b-language-capabilities.md`. Ready to execute?
