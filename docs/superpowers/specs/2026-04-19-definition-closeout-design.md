# Definition Closeout Design

## Context

`LanguageDefinitionService` has already been decomposed into a coordinator plus focused resolvers. The primary architecture debt left in this area is no longer large-scale responsibility mixing, but cleanup debt:

- `LanguageDefinitionService` still carries stale scoped-method helper logic that was already moved into `ScopedMethodDefinitionResolver`
- scoped method identifier detection is still duplicated across definition and hover paths
- `DefinitionResolverSupport` contains cache invalidation behavior without direct regression tests

This package closes that residual debt without changing definition or hover behavior.

## Goals

- remove stale scoped helper code from `LanguageDefinitionService`
- collapse scoped method identifier detection into a single shared implementation
- lock `DefinitionResolverSupport` cache invalidation behavior with direct tests
- keep definition and hover results behaviorally unchanged

## Non-Goals

- no changes to `InheritedSymbolRelationService`
- no changes to `ASTManager`
- no changes to `DocumentSemanticSnapshotService`
- no expansion into signature help
- no user-visible behavior changes for definition or hover

## Approach

This closeout package keeps the existing routing order and resolver boundaries intact. It only removes residual duplication and strengthens the safety net.

Rejected alternatives:

- leave the duplicate scoped helpers in place and only delete dead code later
  - rejected because the architecture would still contain multiple sources of truth for the same scoped cursor rule
- combine this cleanup with `InheritedSymbolRelationService` debt reduction
  - rejected because it would mix two independent cleanup targets and blur verification
- perform only test additions without removing duplicated helpers
  - rejected because it would preserve architectural residue after the decomposition was already completed

## Architecture

### 1. `LanguageDefinitionService` remains a coordinator only

`AstBackedLanguageDefinitionService` keeps its current sequencing:

1. scoped method definition resolver
2. object method definition resolver
3. direct symbol definition resolver
4. function family definition resolver

After this closeout, it must no longer own scoped identifier-detection helpers such as:

- `isOnScopedMethodIdentifier`
- `findScopedMethodIdentifierAtPosition`
- `getScopedMethodIdentifier`
- `getRangeSize`

Those helpers are residual debt from before the decomposition and should be deleted from the service.

### 2. Introduce a shared scoped identifier helper

Create a small shared helper in `src/language/services/navigation/` or `src/language/services/navigation/definition/` whose only responsibility is to answer:

- what scoped method identifier node, if any, contains a given cursor position
- whether a given cursor position is on the resolved scoped method identifier

The helper should:

- consume `ASTManager` and existing syntax nodes
- understand both bare `::method()` and qualified `room::method()`
- preserve the current “smallest containing scoped call wins” behavior by keeping the existing range-size ordering semantics

This helper is intentionally narrow. It must not:

- resolve scoped method targets
- perform definition lookup
- load callable docs
- depend on `ScopedMethodResolver`

Its minimal API should stay equally narrow, for example:

- `findScopedMethodIdentifierAtPosition(document, position): SyntaxNode | undefined`
- `isOnScopedMethodIdentifier(document, position, methodName): boolean`

### 3. Consumers of the shared helper

The first two consumers are:

- `ScopedMethodDefinitionResolver`
- `LanguageHoverService`

Both should reuse the same helper instead of carrying their own scoped identifier search logic.

This package does not force signature help into the same seam. That remains outside scope until separately justified.

## Data Flow

### Definition

1. `LanguageDefinitionService` delegates scoped calls to `ScopedMethodDefinitionResolver`
2. `ScopedMethodDefinitionResolver` asks the shared helper whether the cursor is on the scoped method identifier matching the resolved method name
3. if yes, it converts `ScopedMethodResolver` targets to definition locations
4. if not, it returns `undefined` and the coordinator continues normally

Scoped status preservation:

- if `ScopedMethodResolver` returns `resolved` or `multiple` and the cursor is on the method identifier, definition returns the matching scoped target locations
- if `ScopedMethodResolver` returns `unknown` or `unsupported` and the cursor is on the method identifier, definition must continue to treat the scoped call as handled and preserve the current non-fallback behavior
- if the cursor is not on the scoped method identifier, the scoped resolver returns `undefined` and the coordinator continues normally

### Hover

1. `LanguageHoverService` asks `ScopedMethodResolver` for scoped call resolution
2. before rendering docs, it asks the shared helper whether the cursor is actually on the scoped method identifier
3. if yes, hover continues as today
4. if not, hover does not treat the position as a scoped method hover target

Scoped status preservation:

- if `ScopedMethodResolver` returns `resolved` or `multiple` and the cursor is on the method identifier, hover renders the existing scoped callable-doc path
- if `ScopedMethodResolver` returns `unknown` or `unsupported` and the cursor is on the method identifier, hover must stay non-rendering
- hover must not introduce fallback behavior for scoped `unknown` / `unsupported`

The helper therefore becomes the single source of truth for scoped identifier hit-testing in definition and hover.

## `DefinitionResolverSupport` Closeout

No cache semantics change in this package.

The current behavior must be explicitly preserved:

- header file changes invalidate that header’s `headerFunctionCache`
- header file changes also invalidate any `includeFileCache` entries that depend on that header
- non-header file changes invalidate only that file’s `includeFileCache` entry

This behavior already exists in production code. The debt is the lack of direct test coverage.

## Failure Semantics

- if the shared scoped helper cannot find a scoped identifier at the cursor position, definition and hover must behave exactly as they do today
- if `ScopedMethodResolver` returns `unknown` or `unsupported`, the shared helper must not invent fallback behavior
- if the syntax document is unavailable, the helper must return `undefined` rather than guessing
- no new fallback path may bypass existing navigation infrastructure

## Testing

### Shared helper tests

Add focused tests that cover:

- bare `::method()` detection
- qualified `room::method()` detection
- nested call ranges where the smallest containing scoped call should win
- non-method positions such as qualifier or argument positions returning no hit

### Definition/hover regression coverage

Retain existing behavior by exercising:

- scoped definition still works on method identifiers only
- scoped definition keeps the current handled-empty behavior for method-identifier positions that resolve to `unknown` or `unsupported`
- scoped hover still works on method identifiers only
- scoped hover stays empty for method-identifier positions that resolve to `unknown` or `unsupported`
- non-scoped positions still fall through as before

### `DefinitionResolverSupport` cache invalidation tests

Add direct regression tests for:

- `.h` document change invalidates `headerFunctionCache`
- `.h` document change invalidates dependent `includeFileCache` entries
- `.c` document change invalidates only that file’s include cache entry

### Verification set

Implementation planning and execution must keep the following suites or targeted commands green:

- `src/language/services/navigation/__tests__/LanguageDefinitionService.test.ts`
- `src/language/services/navigation/__tests__/ScopedMethodDefinitionResolver.test.ts`
- `src/language/services/navigation/__tests__/DefinitionResolverSupport.test.ts`
- `src/language/services/navigation/__tests__/navigationServices.test.ts`
- `src/__tests__/providerIntegration.test.ts`
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
- `npx tsc --noEmit`

## Acceptance Criteria

- `LanguageDefinitionService` contains no stale scoped helper logic
- scoped identifier hit-testing exists in only one shared implementation for definition and hover
- `DefinitionResolverSupport` cache invalidation behavior is directly covered by tests
- the verification set listed above passes without changing definition or hover semantics
