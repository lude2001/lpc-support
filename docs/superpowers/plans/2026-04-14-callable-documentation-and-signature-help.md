# Callable Documentation And Signature Help Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad hoc function-doc parsing with a unified callable-documentation pipeline, migrate standard efun docs to a structured local schema, and ship full signature help across local, inherited, include, simul_efun, efun, and object-method call sites.

**Architecture:** Keep parser/syntax/semantic boundaries intact by letting syntax only attach doc-comment ownership while a new documentation layer builds `CallableDoc` objects from `ParsedDocument + SyntaxDocument`. Reuse existing navigation/object-inference services for target discovery, then route hover, panel, return-object propagation, and signature help through shared documentation contracts and shared LSP wiring.

**Tech Stack:** TypeScript, VS Code extension APIs, vscode-languageclient/languageserver, existing LPC parser/syntax/semantic services, Jest + ts-jest.

---

## Chunk 1: Foundation And Data Sources

### Task 1: Attach Javadoc Blocks To Function Declarations In Syntax

**Write Scope:** Syntax attachment only. This task owns the doc-to-declaration binding contract and must not implement `CallableDoc` parsing or any consumer migration.

**Files:**
- Create: `src/language/documentation/types.ts`
- Modify: `src/syntax/types.ts`
- Modify: `src/syntax/SyntaxBuilder.ts`
- Test: `src/__tests__/syntaxBuilder.test.ts`

**Reads From:**
- [docs/superpowers/specs/2026-04-14-callable-documentation-and-signature-help-design.md](D:/code/lpc-support/docs/superpowers/specs/2026-04-14-callable-documentation-and-signature-help-design.md:1)
- Existing syntax node and token-backed range behavior in `src/syntax/`

**Must Not Change:**
- No `CallableDoc` parsing
- No hover/panel/signature help wiring
- No efun loader changes

**Hand-off Output:**
- Stable `AttachedDocComment` type
- Function syntax nodes expose `attachedDocComment`
- Binding rules A-D from the spec are locked by tests

- [ ] **Step 1: Add failing syntax attachment tests**

Extend `src/__tests__/syntaxBuilder.test.ts` with cases that assert:

- comment binds when directly above modifiers
- comment binds across exactly one blank line
- comment does not bind across preprocessor directives
- comment does not bind across two blank lines
- when multiple consecutive Javadoc blocks precede one declaration, the nearest block wins
- one Javadoc block binds only to the first following declaration, leaving later declarations unattached unless they have their own block

Use fixture snippets matching the examples in the spec, and assert the resulting function node exposes `attachedDocComment.text` and `attachedDocComment.range` only in the allowed cases.

- [ ] **Step 2: Run syntax tests to verify failure**

Run:

```bash
npx jest --runInBand src/__tests__/syntaxBuilder.test.ts
```

Expected:

- New attachment-rule assertions fail because `attachedDocComment` does not exist yet

- [ ] **Step 3: Add `AttachedDocComment` type and syntax-node field**

Implement the minimal contract from the spec:

```ts
export interface AttachedDocComment {
    kind: 'javadoc';
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    text: string;
}
```

Then extend the relevant function-declaration syntax node shape in `src/syntax/types.ts` to optionally carry `attachedDocComment`.

- [ ] **Step 4: Implement binding in `SyntaxBuilder`**

Update `src/syntax/SyntaxBuilder.ts` so function-declaration construction:

- looks backward for the nearest Javadoc block trivia
- allows only whitespace/newlines plus grammar-approved declaration modifiers between the block and the declaration
- rejects intervening directives, comments, or other tokens
- records the normalized range and raw text

Do not parse tags here. This task ends at attachment only.

- [ ] **Step 5: Re-run syntax tests**

Run:

```bash
npx jest --runInBand src/__tests__/syntaxBuilder.test.ts
```

Expected:

- All syntax-builder tests, including new attachment tests, pass

- [ ] **Step 6: Commit**

```bash
git add src/syntax/types.ts src/syntax/SyntaxBuilder.ts src/language/documentation/types.ts src/__tests__/syntaxBuilder.test.ts
git commit -m "feat: attach javadoc comments to function syntax nodes"
```

### Task 2: Build `CallableDoc` Types And `FunctionDocumentationService`

**Write Scope:** Documentation contracts, Javadoc parsing, single-document caching, and invalidation only.

**Files:**
- Modify: `src/language/documentation/types.ts`
- Create: `src/language/documentation/FunctionDocumentationService.ts`
- Create: `src/language/documentation/CallableDocRenderer.ts`
- Test: `src/language/documentation/__tests__/functionDocumentationService.test.ts`
- Test: `src/language/documentation/__tests__/callableDocRenderer.test.ts`

**Reads From:**
- Task 1 output (`attachedDocComment`)
- Existing Javadoc expectations in `README.md`
- Existing ad hoc parsing behavior in `src/efun/docParser.ts`

**Must Not Change:**
- No cross-file target discovery
- No efun schema migration
- No hover/panel/signature help integration yet

**Hand-off Output:**
- Canonical `CallableDoc`, `CallableSignature`, `CallableParameter`, `CallableReturnDoc`, `CallableReturnObjects`
- Single-document documentation service with cache + `invalidate(uri)`
- Deterministic parsing for supported tags and invalid-input rules
- Renderer APIs that consume selected signatures but do not select them

- [ ] **Step 1: Add failing service tests for tag parsing**

Create `src/language/documentation/__tests__/functionDocumentationService.test.ts` covering:

- `@brief`, `@details`, `@note`, `@return`, `@param`
- strict `@lpc-return-objects`
- duplicate tags (`@brief`, `@details`, `@return`)
- unknown tags ignored
- malformed `@param` ignored without killing the whole doc
- malformed `@lpc-return-objects` returns `undefined`
- `invalidate(uri)` rebuilds after content changes

- [ ] **Step 2: Add failing renderer tests**

Create `src/language/documentation/__tests__/callableDocRenderer.test.ts` that verify:

- hover renders signature, summary, params, returns, details, note
- signature summary renderer returns only presentation data
- renderer never picks a different signature on its own

- [ ] **Step 3: Run documentation tests to verify failure**

Run:

```bash
npx jest --runInBand src/language/documentation/__tests__/functionDocumentationService.test.ts src/language/documentation/__tests__/callableDocRenderer.test.ts
```

Expected:

- Tests fail because the service and renderer do not exist yet

- [ ] **Step 4: Implement canonical documentation contracts**

Populate `src/language/documentation/types.ts` with the spec-defined structures, including:

- `CallableDoc`
- `CallableSignature`
- `CallableParameter`
- `CallableReturnDoc`
- `CallableReturnObjects`
- `DocumentCallableDocs`

Keep this file focused on data contracts only.

- [ ] **Step 5: Implement `FunctionDocumentationService`**

Implement `src/language/documentation/FunctionDocumentationService.ts` so it:

- builds docs lazily per `vscode.TextDocument`
- uses `attachedDocComment` from syntax nodes
- parses only the supported Javadoc grammar
- derives `declarationKey` from URI + range
- indexes by declaration and by name
- supports `invalidate(uri)` and `clear()`

Do not reach into inherit/include/object-method discovery here.

- [ ] **Step 6: Implement `CallableDocRenderer`**

Implement `src/language/documentation/CallableDocRenderer.ts` as a pure formatting helper with:

- `renderHover(...)`
- `renderPanel(...)`
- `renderSignatureSummary(...)`

It may accept a `sourceLabel`, but it must never sort, dedupe, merge, or choose `activeSignature`.

- [ ] **Step 7: Run documentation tests and typecheck**

Run:

```bash
npx jest --runInBand src/language/documentation/__tests__/functionDocumentationService.test.ts src/language/documentation/__tests__/callableDocRenderer.test.ts
npx tsc --noEmit
```

Expected:

- Documentation tests pass
- TypeScript passes without introducing unused exports/imports

- [ ] **Step 8: Commit**

```bash
git add src/language/documentation/types.ts src/language/documentation/FunctionDocumentationService.ts src/language/documentation/CallableDocRenderer.ts src/language/documentation/__tests__/functionDocumentationService.test.ts src/language/documentation/__tests__/callableDocRenderer.test.ts
git commit -m "feat: add callable documentation service and renderer"
```

### Task 3: Migrate Standard Efun Docs To Structured Local Schema

**Write Scope:** Standard efun data and loader only. This task owns the new `config/efun-docs.json` schema and bundle failure behavior.

**Files:**
- Modify: `config/efun-docs.json`
- Modify: `src/efun/types.ts`
- Modify: `src/efun/BundledEfunLoader.ts`
- Modify: `src/efun/EfunDocsManager.ts`
- Modify: `src/efunDocs.ts`
- Modify: `src/__tests__/efunDocs.test.ts`
- Delete or isolate from product path: `src/efun/RemoteEfunFetcher.ts`

**Reads From:**
- Spec section 20 schema
- Task 2 `CallableDoc` contracts
- Existing `EfunDocsManager` consumers

**Must Not Change:**
- No source-function doc parsing
- No hover/panel/signature help behavior outside efun document loading

**Hand-off Output:**
- Structured efun JSON bundle committed to the repo
- Loader understands only the new schema
- Deterministic failure behavior for malformed/missing bundle input
- `EfunDocsManager` can materialize `CallableDoc`-compatible efun docs without remote fetches

- [ ] **Step 1: Add failing efun schema tests**

Expand `src/__tests__/efunDocs.test.ts` to cover:

- simple structured doc loads
- overloaded doc loads
- variadic doc loads
- missing optional fields still load
- malformed JSON
- missing `docs`
- missing `categories`
- category references missing doc keys
- `signatures[]` item missing `label`
- parameter item missing `name`

- [ ] **Step 2: Run efun tests to verify failure**

Run:

```bash
npx jest --runInBand src/__tests__/efunDocs.test.ts
```

Expected:

- New schema-oriented tests fail against the current loader and data shape

- [ ] **Step 3: Rewrite `config/efun-docs.json` to the structured schema**

Update the bundle so the canonical top-level keys are only:

- `generatedAt`
- `categories`
- `docs`

For each efun doc entry, store:

- `name`
- `summary`
- `details`
- `note`
- `reference`
- `category`
- `signatures[]`

Ensure at least one simple, one overloaded, and one variadic real efun entry exist in the migrated bundle.

- [ ] **Step 4: Replace loader contracts and remove remote fallback**

Update `src/efun/types.ts` and `src/efun/BundledEfunLoader.ts` so:

- legacy loader branches are removed
- malformed JSON or missing `docs` return empty docs/maps with logged errors per the spec
- missing `categories` returns an empty categories map but still loads valid docs
- missing category references are ignored with warnings

Then update `src/efun/EfunDocsManager.ts` so standard efun docs come only from the structured local bundle.

- [ ] **Step 5: Remove `RemoteEfunFetcher` from the product path**

Either:

- delete `src/efun/RemoteEfunFetcher.ts`, or
- leave the file in place but remove every construction/import path from production code

Also update `src/efunDocs.ts` if any public surface types need to re-export the new structured efun model.

- [ ] **Step 6: Re-run efun tests and typecheck**

Run:

```bash
npx jest --runInBand src/__tests__/efunDocs.test.ts
npx tsc --noEmit
```

Expected:

- Efun bundle tests pass
- No production import path still depends on remote fetch

- [ ] **Step 7: Commit**

```bash
git add config/efun-docs.json src/efun/types.ts src/efun/BundledEfunLoader.ts src/efun/EfunDocsManager.ts src/efunDocs.ts src/__tests__/efunDocs.test.ts src/efun/RemoteEfunFetcher.ts
git commit -m "refactor: migrate efun docs to structured local schema"
```

## Chunk 2: Consumers, Signature Help, And Verification

### Task 4: Migrate Hover, Function Panel, And Return-Object Propagation To Shared Docs

**Write Scope:** Existing documentation consumers only.

**Files:**
- Modify: `src/language/services/navigation/LanguageHoverService.ts`
- Modify: `src/language/services/navigation/EfunLanguageHoverService.ts`
- Modify: `src/language/services/navigation/UnifiedLanguageHoverService.ts`
- Modify: `src/functionDocPanel.ts`
- Modify: `src/objectInference/ReturnObjectResolver.ts`
- Modify or remove: `src/efun/docParser.ts`
- Modify or remove: `src/efun/FileFunctionDocTracker.ts`
- Test: `src/objectInference/__tests__/ObjectHoverProvider.test.ts`
- Test: add `src/__tests__/functionDocPanel.test.ts` if the panel still lacks direct regression coverage
- Test: add `src/objectInference/__tests__/ReturnObjectResolver.test.ts` if the resolver does not already have direct coverage

**Reads From:**
- Task 2 documentation service/renderer
- Task 3 efun structured docs
- Existing hover and panel tests

**Must Not Change:**
- No signature-help handler work
- No new parsing rules
- No efun schema changes

**Blocks / Unblocks:**
- Blocks on: Task 2 and Task 3
- Unblocks: Task 5 and the final regression work in Task 6

**Verification:**
- Hover consumers render through shared docs
- Panel reads shared docs instead of panel-specific extraction
- `ReturnObjectResolver` reads `CallableDoc.returnObjects` on the production path

**Hand-off Output:**
- Hover pulls docs from the shared documentation pipeline
- Function panel becomes a UI shell over shared docs
- `ReturnObjectResolver` consumes `CallableDoc.returnObjects`
- Ad hoc text parsing is removed or reduced to private helpers no longer used in production

- [ ] **Step 1: Add failing consumer regression tests**

Update or add tests that assert:

- object-method hover still shows syntax + docs
- include/inherit-backed hovers still resolve
- standard efun hover still renders parameter tables/details
- function doc panel renders from the shared documentation pipeline rather than a panel-specific extractor
- `ReturnObjectResolver` reads `returnObjects` from shared docs instead of reparsing comments

- [ ] **Step 2: Run targeted consumer tests to verify failure**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/functionDocPanel.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts
```

Expected:

- New or updated assertions fail because consumers still use legacy parsing paths

- [ ] **Step 3: Switch hover services to shared documentation**

Refactor the navigation services so:

- object-method hover loads `CallableDoc` from shared services
- efun hover uses structured efun docs through the same renderer shape
- unified hover keeps macro routing, but callable rendering no longer owns independent doc parsing

- [ ] **Step 4: Switch panel and return-object resolver**

Update `src/functionDocPanel.ts` to fetch structured docs from shared services instead of maintaining panel-specific extraction.  
Update `src/objectInference/ReturnObjectResolver.ts` so `@lpc-return-objects` flows through `CallableDoc.returnObjects`.

- [ ] **Step 5: Remove production use of legacy doc extractors**

Either delete or fully demote:

- `src/efun/docParser.ts`
- `src/efun/FileFunctionDocTracker.ts`

If a helper must remain for tests or migration glue, keep it out of the production main path and document the boundary in code comments.

- [ ] **Step 6: Re-run targeted tests and typecheck**

Run:

```bash
npx jest --runInBand src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/functionDocPanel.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts
npx tsc --noEmit
```

Expected:

- Consumer regressions pass
- No production path still depends on ad hoc comment reparsing

- [ ] **Step 7: Commit**

```bash
git add src/language/services/navigation/LanguageHoverService.ts src/language/services/navigation/EfunLanguageHoverService.ts src/language/services/navigation/UnifiedLanguageHoverService.ts src/functionDocPanel.ts src/objectInference/ReturnObjectResolver.ts src/efun/docParser.ts src/efun/FileFunctionDocTracker.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/__tests__/functionDocPanel.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts
git commit -m "refactor: route callable documentation consumers through shared docs"
```

### Task 5: Add Shared Signature Help Service And LSP Wiring

**Write Scope:** Signature-help contracts, call-site analysis, target discovery orchestration, and server wiring.

**Files:**
- Modify: `src/language/contracts/LanguageFeatureServices.ts`
- Create: `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- Create: `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
- Create: `src/language/services/signatureHelp/__tests__/CallableTargetDiscoveryService.test.ts` if discovery is split out
- Modify: `src/lsp/server/bootstrap/registerCapabilities.ts`
- Create: `src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts`
- Create: `src/lsp/server/__tests__/signatureHelpHandlers.test.ts`
- Modify: `src/lsp/server/runtime/createProductionLanguageServices.ts`
- Modify: any shared navigation/object lookup files needed to expose `ResolvedCallableTarget` discovery seams

**Reads From:**
- Task 2 `CallableDoc` and renderer contracts
- Task 3 efun docs
- Existing navigation/object inference services
- Existing LSP handler patterns in `src/lsp/server/handlers/`

**Must Not Change:**
- No hover/panel formatting divergence
- No reimplementation of object inference or definition logic
- No changes to `CallableDoc` schema

**Blocks / Unblocks:**
- Blocks on: Task 2, Task 3, and Task 4
- Unblocks: Task 6 final regression and docs update

**Verification:**
- Shared service returns the spec-defined DTO
- LSP advertises signature-help capability
- All five source kinds resolve through the shared service

**Hand-off Output:**
- Shared `LanguageSignatureHelpService`
- Deterministic candidate discovery, dedupe, precedence, merge, and `activeSignature` selection
- LSP advertises and serves signature help
- Tests cover all five source kinds plus overloaded/variadic cases

- [ ] **Step 1: Add failing signature-help service tests**

Create `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts` covering:

- local function call
- inherited function call
- include-backed function call
- `simul_efun`
- standard `efun`
- object-method call
- multi-source collision where the same callable is discovered from multiple sources and must dedupe by `targetKey`, preserve provenance, and choose `activeSignature` by precedence
- overloaded signatures
- variadic signatures
- nested calls / active parameter calculation
- unresolved target returns `undefined`

- [ ] **Step 2: Add failing LSP handler tests**

Create `src/lsp/server/__tests__/signatureHelpHandlers.test.ts` that verify:

- `initialize` advertises signature help capability
- handler delegates to the shared service
- LSP result preserves `activeSignature`, `activeParameter`, and parameter docs

- [ ] **Step 3: Run signature-help tests to verify failure**

Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts
```

Expected:

- Tests fail because the signature-help service/handler do not exist yet

- [ ] **Step 4: Implement the shared service contracts**

Create `LanguageSignatureHelpService` so it:

- computes the active argument index from syntax/token-aware call analysis
- requests candidates through discovery seams
- dedupes by `targetKey`
- sorts by spec precedence
- materializes docs only after ordering
- merges same-signature groups
- chooses `activeSignature` once
- returns the shared DTO with source provenance

If discovery seams need extraction, do that in small dedicated helpers rather than embedding discovery logic into the service.

- [ ] **Step 5: Wire the runtime and LSP handler**

Update:

- `src/language/contracts/LanguageFeatureServices.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/lsp/server/bootstrap/registerCapabilities.ts`

Then add `registerSignatureHelpHandler.ts` following the existing handler pattern used for hover/definition/formatting.

- [ ] **Step 6: Re-run signature-help tests and typecheck**

Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts
npx tsc --noEmit
```

Expected:

- Shared service and handler tests pass
- LSP capability registration is correct

- [ ] **Step 7: Commit**

```bash
git add src/language/contracts/LanguageFeatureServices.ts src/language/services/signatureHelp src/lsp/server/bootstrap/registerCapabilities.ts src/lsp/server/handlers/signatureHelp/registerSignatureHelpHandler.ts src/lsp/server/runtime/createProductionLanguageServices.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts
git commit -m "feat: add shared signature help service and lsp handler"
```

### Task 6: Run Regression Matrix And Update User-Facing Docs

**Write Scope:** Verification, test cleanup, and user-facing documentation only.

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: any newly added test files from Tasks 1-5

**Reads From:**
- Spec success criteria
- All prior task outputs
- Existing README feature descriptions

**Must Not Change:**
- No new production behavior beyond what Tasks 1-5 already introduced
- No schema churn

**Blocks / Unblocks:**
- Blocks on: Tasks 1-5
- Unblocks: final execution handoff and branch-finishing workflow

**Verification:**
- Focused callable-doc regression suite passes
- Typecheck passes
- Existing parity/integration checks still pass
- README and CHANGELOG reflect shipped behavior

**Hand-off Output:**
- Regression evidence for the full callable-doc/signature-help path
- README and CHANGELOG updated for the new local efun-doc strategy and signature-help capability

- [ ] **Step 1: Add any missing integration assertions**

Before running the full matrix, make sure the following are explicitly covered somewhere:

- malformed structured efun bundle handling
- hover precedence with multiple callable sources
- signature help precedence with multiple source groups
- `@lpc-return-objects` invalid input does not kill other tags

If any of these are missing, add the minimal regression tests now.

- [ ] **Step 2: Run the focused regression suite**

Run:

```bash
npx jest --runInBand src/__tests__/syntaxBuilder.test.ts src/language/documentation/__tests__/functionDocumentationService.test.ts src/language/documentation/__tests__/callableDocRenderer.test.ts src/__tests__/efunDocs.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/lsp/server/__tests__/signatureHelpHandlers.test.ts
```

Expected:

- All callable-doc and signature-help regressions pass

- [ ] **Step 3: Run repository-wide safety checks**

Run:

```bash
npx tsc --noEmit
npx jest --runInBand src/__tests__/providerIntegration.test.ts src/lsp/__tests__/languageParity.test.ts
```

Expected:

- TypeScript passes
- Existing language-service parity/integration coverage still passes

- [ ] **Step 4: Update README and CHANGELOG**

Document:

- standard efun docs are now fully local and structured
- runtime mud.wiki fetch is gone
- function docs now flow through a unified callable-documentation pipeline
- signature help is available for local/inherited/include/simul_efun/efun/object-method calls

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md src/__tests__/syntaxBuilder.test.ts src/language/documentation/__tests__ src/__tests__/efunDocs.test.ts src/objectInference/__tests__/ObjectHoverProvider.test.ts src/objectInference/__tests__/ReturnObjectResolver.test.ts src/language/services/signatureHelp/__tests__ src/lsp/server/__tests__/signatureHelpHandlers.test.ts
git commit -m "docs: record callable documentation and signature help upgrade"
```
