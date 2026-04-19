# Completion Service Decomposition Design

Date: 2026-04-19
Owner: Codex
Status: Draft

## Goal

Reduce the architectural debt in
[src/language/services/completion/LanguageCompletionService.ts](/D:/code/lpc-support/.worktrees/analysis-ownership-normalization/src/language/services/completion/LanguageCompletionService.ts)
without changing user-visible completion behavior.

The target state is:

- `QueryBackedLanguageCompletionService` becomes a coordinator
- inherited index warming and readonly document loading have one owner
- candidate expansion and merge logic have one owner
- completion item presentation and resolve logic have one owner
- no new registry, singleton, or runtime-wide abstraction is introduced

## Problem

`QueryBackedLanguageCompletionService` is currently doing too much at once:

- request tracing and completion orchestration
- inherited index warming and refresh
- readonly document loading from disk
- inherited fallback candidate expansion
- object-member candidate discovery
- completion item creation
- completion item resolve and documentation materialization

That file is now the largest remaining application hotspot after the analysis-ownership cleanup. Its size is not just a cosmetic issue; it is holding multiple different responsibilities with different change rhythms in one place.

This has three concrete costs:

1. Completion behavior is harder to reason about because indexing, querying, and presentation are mixed.
2. Completion is more likely to grow a parallel infrastructure path because readonly document loading and index refresh are still private ad hoc machinery.
3. Tests have to reach into one oversized class instead of targeting smaller contracts with stable boundaries.

## Non-Goals

This package does **not**:

- change completion ordering or visible candidate behavior
- change `CompletionQueryEngine`
- change `ProjectSymbolIndex` semantics
- move readonly document loading into shared runtime infrastructure
- refactor `vscodeShim`
- redesign `ScopedMethodCompletionSupport`
- change completion context classification rules

## Approaches Considered

### 1. Split by completion source

Examples:

- `MemberCompletionResolver`
- `InheritedCompletionResolver`
- `ScopedCompletionResolver`
- `EfunCompletionResolver`

This was rejected because the same index and presentation logic would be copied across source-specific units. It would shrink one large file into several medium files with duplicated support behavior.

### 2. Split by responsibility layer

This is the chosen design.

Break the current service into:

- one collaborator for inherited index and readonly document loading
- one collaborator for candidate resolution and merging
- one collaborator for item presentation and resolve
- one thin coordinator that owns the request lifecycle

This keeps the behavior model stable while giving each unit a single job.

### 3. Introduce a more generic completion runtime graph

This was rejected as over-design. The repository has been moving away from wide “manager of managers” abstractions, and this package should continue that direction rather than creating another framework layer.

## Chosen Design

### 1. `QueryBackedLanguageCompletionService` becomes a coordinator

After this refactor, the service should only own:

- text-document extraction from `LanguageCapabilityContext`
- request instrumentation lifecycle
- `CompletionQueryEngine` invocation
- collaborator orchestration
- `handleDocumentChange`
- `clearCache`
- `scanInheritance`

It should no longer directly own:

- inherited index traversal
- disk-backed readonly document creation
- object-member candidate assembly
- fallback candidate expansion
- item documentation materialization

### 2. Add `CompletionInheritedIndexService`

New responsibility:

- keep inherited symbol indexing in sync with completion usage

This unit owns the current methods:

- `warmInheritedIndex(...)`
- `refreshInheritedIndex(...)`
- `indexMissingInheritedSnapshots(...)`
- `loadSnapshotFromUri(...)`
- `getOpenDocument(...)`
- `normalizeFilePath(...)`
- `createReadonlyDocumentFromUri(...)`
- `createReadonlyDocument(...)`
- `getDocumentForUri(...)`
- `getBestAvailableIndexSnapshot(...)`
- `getIndexSnapshot(...)`

This collaborator is intentionally completion-local. It should not be lifted into runtime/shared infrastructure in this package, because that would expand scope and re-open questions about a generic document host layer.

### 3. Add `CompletionCandidateResolver`

New responsibility:

- turn query results plus object inference plus inherited index state into final completion candidates

This unit owns:

- `resolveCompletionCandidates(...)`
- `appendInheritedFallbackCandidates(...)`
- `buildObjectMemberCandidates(...)`
- `collectObjectFunctions(...)`
- `mergeCandidatesByLabel(...)`

It consumes:

- `CompletionQueryEngine`
- `CompletionInheritedIndexService`
- `ObjectInferenceService`
- `ScopedMethodDiscoveryService`
- `ProjectSymbolIndex`

It does **not** create completion items and does **not** attach documentation.

### 4. Add `CompletionItemPresentationService`

New responsibility:

- convert `CompletionCandidate` values into final protocol-facing completion items
- resolve item documentation

This unit owns:

- `createCompletionItem(...)`
- `resolveCompletionItem(...)`
- `mapCompletionKind(...)`
- `getSortPrefix(...)`
- `getCandidateSortBucket(...)`
- `applyEfunDocumentation(...)`
- `applyMacroDocumentation(...)`
- `applyStructuredDocumentation(...)`
- `applyKeywordDocumentation(...)`
- `buildFunctionSnippet(...)`
- `findMemberDefinition(...)`

It consumes:

- `EfunDocsManager`
- `MacroManager`
- `ProjectSymbolIndex`
- `ScopedMethodCompletionSupport`

This keeps all “candidate to UI item” behavior in one place.

### 5. Preserve `ScopedMethodCompletionSupport` as a collaborator

`ScopedMethodCompletionSupport` already isolates scoped-completion-specific documentation behavior well enough. This package should not fold it back into a larger presentation class.

Instead:

- `CompletionItemPresentationService` should call into it for scoped item resolve
- `QueryBackedLanguageCompletionService` should continue to assemble it in one place

## Dependency Shape

The completion package after refactor should look like this:

- `QueryBackedLanguageCompletionService`
  - owns request lifecycle
  - depends on:
    - `CompletionQueryEngine`
    - `CompletionInheritedIndexService`
    - `CompletionCandidateResolver`
    - `CompletionItemPresentationService`

- `CompletionInheritedIndexService`
  - depends on:
    - `CompletionAnalysisService`
    - `ProjectSymbolIndex`
    - `InheritanceReporter`

- `CompletionCandidateResolver`
  - depends on:
    - `CompletionQueryEngine`
    - `CompletionInheritedIndexService`
    - `ProjectSymbolIndex`
    - `ObjectInferenceService`
    - `ScopedMethodDiscoveryService`
    - `MacroManager`

- `CompletionItemPresentationService`
  - depends on:
    - `EfunDocsManager`
    - `MacroManager`
    - `ProjectSymbolIndex`
    - `ScopedMethodCompletionSupport`

No new singleton or registry is introduced.

## Behavioral Invariants

This package must preserve:

- current completion candidate ordering
- current inherited fallback behavior
- current object-member completion semantics
- current scoped completion behavior
- current completion item resolve behavior
- current snippet generation behavior
- current `scanInheritance()` reporting behavior

Any change that improves structure by changing these outputs is out of scope.

## Testing Strategy

### Existing tests that must remain green

- [src/language/services/completion/__tests__/LanguageCompletionService.test.ts](/D:/code/lpc-support/.worktrees/analysis-ownership-normalization/src/language/services/completion/__tests__/LanguageCompletionService.test.ts)
- [src/__tests__/providerIntegration.test.ts](/D:/code/lpc-support/.worktrees/analysis-ownership-normalization/src/__tests__/providerIntegration.test.ts)
- [src/lsp/server/__tests__/completionHandler.test.ts](/D:/code/lpc-support/.worktrees/analysis-ownership-normalization/src/lsp/server/__tests__/completionHandler.test.ts)

Current note:

- [src/language/services/completion/__tests__/LanguageCompletionService.test.ts](/D:/code/lpc-support/.worktrees/analysis-ownership-normalization/src/language/services/completion/__tests__/LanguageCompletionService.test.ts)
  currently spies on `QueryBackedLanguageCompletionService` private presentation helpers.
- This package should update those tests to assert collaborator behavior or externally visible outputs instead of preserving direct spies on service-private methods.

### New unit tests to add

#### `CompletionInheritedIndexService`

Protect:

- inherited index warm/update behavior
- readonly document loading
- fallback to open document before disk document
- recursive inherit indexing without duplicate loops

#### `CompletionCandidateResolver`

Protect:

- inherited fallback candidate expansion
- member completion candidate merge semantics
- object-method candidate ranking for shared vs specific implementations
- scoped completion candidate generation pass-through

#### `CompletionItemPresentationService`

Protect:

- completion item creation shape
- sort prefix and bucket behavior
- scoped resolve delegation
- structured documentation materialization
- efun/macro/keyword documentation attachment

### Guard expectations

After the refactor:

- `QueryBackedLanguageCompletionService` should no longer contain readonly document construction
- `QueryBackedLanguageCompletionService` should no longer contain inherited index recursion helpers
- `QueryBackedLanguageCompletionService` should no longer contain documentation materialization helpers except trivial orchestration glue

These should be enforced by updating the architectural guard suite after implementation.

## Expected Outcome

After this package lands:

- completion behavior is unchanged
- completion infrastructure is more layered and explicit
- readonly document/index behavior has a single local owner
- presentation logic has a single local owner
- the next architectural hotspot can be assessed independently without completion still acting as a “mini framework”
