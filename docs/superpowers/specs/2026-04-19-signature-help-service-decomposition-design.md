# Signature Help Service Decomposition Design

Date: 2026-04-19

## Goal

Decompose `src/language/services/signatureHelp/LanguageSignatureHelpService.ts` into focused collaborators so signature help follows the same architecture shape already established for definition, hover, and completion:

- thin coordinator
- explicit collaborators
- narrow shared support
- no behavior changes

## Non-Goals

- no changes to signature-help product semantics
- no changes to callable discovery priority or fallback order
- no new navigation framework shared with hover/definition
- no object inference or scoped method resolution changes
- no runtime or document-context rewrites

## Current Problem

`LanguageSignatureHelpService.ts` is currently a single 800+ line file that mixes:

1. call-site syntax analysis
2. callable target discovery across:
   - local/current file
   - inherited/include
   - object methods
   - scoped methods
   - simul_efun / efun
3. callable-doc resolution and materialization
4. target dedupe, signature grouping, and rendering
5. argument-index computation and token-walking helpers
6. default host construction

The behavior is already good, but the architecture is not yet clean:

- multiple collaborators are hidden as inline classes in one file
- pure presentation logic and syntax-walking helpers live beside production orchestration
- there is no ownership guard preventing the service from growing again

## Approaches Considered

### 1. Leave the file as-is

Pros:

- zero refactor risk

Cons:

- keeps the last major language-service monolith in place
- does not match the coordinator shape now used by definition/hover/completion
- makes future changes to signature help harder to reason about

### 2. Split by call kind

Create separate signature-help services for:

- function calls
- object methods
- scoped methods

Pros:

- user-facing categories are obvious

Cons:

- would duplicate callable-doc resolution and grouping logic
- would spread call-site analysis across multiple services
- would make wiring in `createProductionLanguageServices.ts` noisier

### 3. Split by responsibility

Keep `LanguageSignatureHelpService` public and stable, but extract focused collaborators for:

- call-site analysis
- callable target discovery
- callable-doc resolution
- result assembly/presentation

Pros:

- mirrors the proven cleanup pattern already used elsewhere
- preserves all external wiring
- keeps behavior fixed while removing the monolithic file shape

Cons:

- still leaves multiple signature-help specific files
- does not attempt long-term unification with hover/definition

## Recommended Approach

Approach 3.

The objective here is not to invent a bigger abstraction, but to reduce `LanguageSignatureHelpService` to a coordinator and make each existing responsibility explicit and testable.

## Proposed Design

### Public Surface

Keep these public types stable:

- `LanguageSignatureHelpService`
- `LanguageSignatureHelpRequest`
- `LanguageSignatureHelpResult`
- `CallableDiscoveryRequest`
- `ResolvedCallableTarget`
- `CallableTargetDiscoveryService`
- `CallableDocResolver`

`LanguageSignatureHelpService` remains the public entrypoint, but it becomes an orchestration layer only.

### New Collaborators

#### `SyntaxAwareCallSiteAnalyzer`

Move the syntax-driven call-site detection into its own file.

Responsibilities:

- find the active call expression at the cursor
- determine call kind:
  - function
  - object method
  - scoped method
- compute lookup position
- compute the active argument index boundary inputs

It must not:

- discover callable targets
- resolve docs
- render final signature-help payloads

#### `DefaultCallableTargetDiscoveryService`

Move callable-target discovery into its own file.

Responsibilities:

- local/inherited callable discovery
- include callable discovery
- object-method callable discovery
- scoped-method callable discovery
- simul_efun / efun callable discovery

It must preserve current priority/fallback order and current unsupported semantics.

It must not:

- resolve callable docs
- assemble final signature-help results

#### `DefaultCallableDocResolver`

Move callable-doc materialization into its own file.

Responsibilities:

- resolve callable docs from discovered targets
- open source documents when declaration-backed docs are needed
- materialize simul_efun compatibility docs

It must not:

- discover targets
- decide active parameter/signature

#### `SignatureHelpPresentationSupport`

Extract the pure helper layer that currently lives as free functions at the bottom of the file.

Responsibilities:

- target dedupe
- signature-group merging
- signature-help result flattening
- active-signature selection
- source-label merging
- small pure helpers like range-size comparison and parameter-label formatting

This support should stay narrow and must not become a generic navigation utility bucket.

## Coordinator Shape

After decomposition, `LanguageSignatureHelpService` should keep only:

1. request entrypoint
2. document/position adaptation
3. call-site analysis delegation
4. target collection delegation
5. doc materialization delegation
6. result assembly delegation

It should no longer own:

- inline analyzer classes
- inline discovery classes
- inline doc resolver classes
- large pure helper blocks for grouping/render selection

## File Boundaries

### New Files

- `src/language/services/signatureHelp/SyntaxAwareCallSiteAnalyzer.ts`
- `src/language/services/signatureHelp/DefaultCallableTargetDiscoveryService.ts`
- `src/language/services/signatureHelp/DefaultCallableDocResolver.ts`
- `src/language/services/signatureHelp/SignatureHelpPresentationSupport.ts`

### Modified Files

- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
  - reduced to coordinator
- `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
  - keep external behavior locked
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
  - wiring remains stable, but imports may update
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
  - keep runtime wiring stable
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
  - add a guard proving the signature-help service no longer owns inline analyzer/discovery/doc/presentation logic

## Failure Semantics

Behavior must stay equivalent to current production semantics.

- no analyzed call site: `undefined`
- no callable targets: `undefined`
- no callable docs materialized: `undefined`
- unsupported scoped/object resolution: preserved
- dedupe/group ordering: preserved
- active parameter/signature selection: preserved

This package must not widen callable discovery or invent new fallbacks.

## Testing Strategy

### Keep Existing External Guards

- `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`

### Add Focused New Tests

- `SyntaxAwareCallSiteAnalyzer.test.ts`
  - nested call-site selection
  - object/scoped/function kind classification
  - active parameter boundary cases
- `DefaultCallableTargetDiscoveryService.test.ts`
  - local/inherited/include
  - object method
  - scoped method
  - efun/simul_efun ordering
- `DefaultCallableDocResolver.test.ts`
  - declaration-backed docs
  - simul_efun compatibility docs
  - efun docs
- `SignatureHelpPresentationSupport.test.ts`
  - dedupe ordering
  - merge grouping
  - active-signature selection
  - rendered result flattening metadata

### Ownership Guard

Add a coordinator guard so `LanguageSignatureHelpService.ts` no longer contains:

- `class SyntaxAwareCallSiteAnalyzer`
- `class DefaultCallableTargetDiscoveryService`
- `class DefaultCallableDocResolver`
- large inline helper functions for grouping/flattening/selection

## Acceptance Criteria

- `LanguageSignatureHelpService.ts` is reduced to coordinator responsibilities
- analyzer/discovery/doc-resolution/presentation each have explicit owners
- `createProductionLanguageServices.ts` still wires one signature-help service
- current signature-help behavior remains unchanged
- new ownership guard prevents the monolith from regrowing
