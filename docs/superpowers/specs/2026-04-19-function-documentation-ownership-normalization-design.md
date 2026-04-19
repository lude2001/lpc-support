# Function Documentation Ownership Normalization Design

## Goal

Normalize function-documentation ownership so that parsing, indexing, and caching flow through one shared service path instead of multiple ad-hoc `FunctionDocumentationService` instances.

## Problem

`src/language/documentation/FunctionDocumentationService.ts` currently mixes:

- per-document cache ownership
- parsed-document invalidation
- syntax-backed callable indexing
- doc-comment tag parsing
- defensive copy policy

At the same time, multiple production services still create their own `new FunctionDocumentationService()` instances, which fragments cache ownership across:

- completion
- hover
- signature help
- efun/file-doc tracking
- object-inference return-doc lookup

That leaves the function-documentation stack with both an internal god-object and multiple cache owners.

## Scope

### In scope

- internal decomposition of `FunctionDocumentationService`
- explicit single-owner injection for production `FunctionDocumentationService` usage
- tests and guards that lock the new ownership boundary

### Out of scope

- changing callable doc semantics
- changing `FunctionDocPanel` behavior
- changing efun bundled-doc behavior
- changing hover/completion/signature-help product behavior

## Recommended design

Keep `FunctionDocumentationService` as the public facade with the same external API:

- `getDocumentDocs(...)`
- `getDocForDeclaration(...)`
- `getDocsByName(...)`
- `invalidate(...)`
- `clear()`

Move its internal responsibilities into explicit owners:

1. `FunctionDocumentationDocumentIndex`
   - owns cache/invalidate/rebuild policy
   - owns parsed-document invalidation bridge
2. `CallableDocDocumentBuilder`
   - owns syntax-backed callable indexing and implementation-vs-prototype ordering
3. `DocCommentTagParser`
   - owns `@brief` / `@details` / `@note` / `@param` / `@return` / `@lpc-return-objects` parsing and normalization
4. `FunctionDocumentationService`
   - becomes a thin facade over those owners

Then normalize production ownership so that `new FunctionDocumentationService()` only happens in composition roots:

- `src/modules/coreModule.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`

Use explicit shared seams instead of ad-hoc constructor threading:

- extension side
  - register one shared documentation service through `ServiceRegistry`
- runtime side
  - create one shared documentation service inside `createProductionLanguageServices()` and thread it through the shipped feature bundle

All other production consumers, including nested helpers, must receive that injected documentation service instead of creating fallback instances.

## Rules

- No product behavior changes
- No new parser truth source
- No new documentation cache side channel
- No production `new FunctionDocumentationService()` outside the composition-root whitelist
- `FileFunctionDocTracker` / `FunctionDocLookupBuilder` / completion / hover / signature-help / return-object inference must all consume injected ownership
- nested helpers under those services must also consume the same injected instance

## Tests

- keep current `functionDocumentationService`, efun-doc, hover, completion, signature-help, and return-object regressions green
- add focused tests for:
- doc-comment parsing owner
- document-index cache/rebuild owner
- implementation-vs-prototype ordering owner
- add ownership guards that lock the production instantiation whitelist
- add owner-wiring tests that prove the same shared instance reaches:
- `EfunDocsManager`
- completion and its nested helpers
- hover and its nested helpers
- signature help
- return-object inference

## Acceptance criteria

- `FunctionDocumentationService` becomes a facade
- cache/index/build/tag parsing have explicit owners
- production `FunctionDocumentationService` instantiation is composition-root only
- `npx tsc --noEmit` passes
- `npm test -- --runInBand` passes
