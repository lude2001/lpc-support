# Hover Service Decomposition Design

Date: 2026-04-19

## Goal

Decompose `src/language/services/navigation/LanguageHoverService.ts` so the hover path is split into focused collaborators with clear ownership, while preserving all current hover behavior.

This package targets the current hotspot inside `ObjectInferenceLanguageHoverService`, which still mixes:

- scoped-method hover gating
- object-inference hover resolution
- callable-doc loading and rendering
- synthetic documentation document shimming
- multi-candidate hover aggregation

The result should mirror the architecture cleanup already completed for definition and completion:

- thin coordinator
- explicit collaborators
- shared support only where the behavior is truly common
- no behavior changes

## Non-Goals

- no changes to `UnifiedLanguageHoverService` product semantics
- no changes to `EfunLanguageHoverService` behavior
- no changes to object inference itself
- no changes to scoped method resolution semantics
- no runtime/document-shim rewrite
- no attempt to unify hover, definition, and signature-help into one larger navigation framework

## Current Problem

`ObjectInferenceLanguageHoverService` currently owns too many distinct responsibilities in one file:

1. it decides whether the cursor is on a scoped method identifier
2. it resolves scoped targets and loads callable docs
3. it resolves object-access hover through inferred receiver candidates
4. it discovers method docs from resolved implementation files
5. it renders single-target, merged-target, and fallback hover text
6. it carries synthetic text-document completion helpers inline

This shape is still understandable, but it is now the next likely file to turn back into a navigation god object as hover grows.

## Approaches Considered

### 1. Split by data source

Create separate hover services for:

- scoped hover
- object-method hover
- efun hover

Then let the unified layer choose between them.

Pros:

- conceptually simple
- matches user-visible hover sources

Cons:

- would duplicate shared callable-doc rendering and related-candidate aggregation logic
- would push too much dispatch logic into `UnifiedLanguageHoverService`

### 2. Split `ObjectInferenceLanguageHoverService` by responsibility

Keep the current public service shape, but move the heavy internal responsibilities into explicit collaborators:

- one collaborator for scoped hover resolution
- one collaborator for object-method hover resolution
- one support/helper for documentation text-document normalization

Pros:

- smallest behavior-preserving refactor
- mirrors the successful definition/completion cleanup pattern
- keeps `UnifiedLanguageHoverService` stable

Cons:

- does not solve every hover concern in one pass
- still leaves multiple hover-facing services in the repo

### 3. Build a generic navigation hover/discovery framework

Extract a reusable graph for target discovery, doc lookup, and rendering that hover/signature-help/definition could all share.

Pros:

- maximally abstract
- could reduce duplication long term

Cons:

- over-design for the current debt
- high regression risk
- too likely to blur already-clean boundaries

## Recommended Approach

Approach 2.

This package should clean the current hover hotspot without widening scope or re-opening solved architecture boundaries.

## Proposed Design

### Public surface

Keep these public classes/interfaces stable:

- `LanguageHoverService`
- `ObjectInferenceLanguageHoverService`
- `UnifiedLanguageHoverService`

`ObjectInferenceLanguageHoverService` remains the public entrypoint for object/scoped hover, but becomes a coordinator.

### New collaborators

#### `ScopedMethodHoverResolver`

Responsibilities:

- determine whether the cursor is actually on the scoped method identifier
- resolve scoped targets through the existing `ScopedMethodResolver`
- load callable docs by declaration key
- render merged scoped hover markdown when multiple targets resolve

It must preserve current failure semantics:

- qualifier hover returns `undefined`
- argument hover returns `undefined`
- `unknown` / `unsupported` scoped resolution returns `undefined`

It must not:

- perform object inference
- resolve object-method implementations

#### `ObjectMethodHoverResolver`

Responsibilities:

- resolve object access through injected object inference
- verify the cursor is on the hovered member name
- resolve implementation docs from target files
- dedupe related candidate paths
- render:
  - single implementation hover
  - multi-implementation merged hover
  - fallback “multiple candidates” hover text

It must not:

- handle scoped method resolution
- know about unified hover composition

#### `HoverDocumentationSupport`

Responsibilities:

- convert resolved method payloads into documentation-capable `TextDocument` shims
- hold synthetic document helper functions currently embedded in `LanguageHoverService.ts`

This support is intentionally narrow. It should own only:

- `toDocumentationTextDocument(...)`
- `isCompleteTextDocument(...)`
- `createCompletedTextDocumentShim(...)`
- `createSyntheticDocumentHash(...)`
- `createSyntheticDocumentationUri(...)`

It should not become a general navigation utility bucket.

## Coordinator Shape

After decomposition, `ObjectInferenceLanguageHoverService` should keep only:

1. request entrypoint
2. document adaptation
3. short-circuit order:
   - scoped hover first
   - object-method hover second
4. final result return

It should no longer own:

- inline scoped hover rendering
- method-doc aggregation loops
- synthetic text-document creation helpers

## File Boundaries

### New files

- `src/language/services/navigation/hover/ScopedMethodHoverResolver.ts`
- `src/language/services/navigation/hover/ObjectMethodHoverResolver.ts`
- `src/language/services/navigation/hover/HoverDocumentationSupport.ts`

### Modified files

- `src/language/services/navigation/LanguageHoverService.ts`
  - reduced to coordinator + existing lightweight adapters
- `src/language/services/navigation/__tests__/navigationServices.test.ts`
  - keep current behavior; add ordering/boundary coverage if needed
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
  - keep LSP hover wiring stable

## Failure Semantics

Behavior must remain equivalent to current production semantics.

### Scoped path

- cursor not on method identifier: `undefined`
- scoped resolution `unknown` / `unsupported`: `undefined`
- no callable doc materialized: `undefined`

### Object-method path

- no object access: `undefined`
- object inference `unknown` / `unsupported`: `undefined`
- cursor not on member name: `undefined`
- no resolved callable docs:
  - if multiple candidates remain, return the current multi-candidate summary hover
  - otherwise `undefined`

## Testing Strategy

### Existing protection that must stay green

- `src/language/services/navigation/__tests__/navigationServices.test.ts`
- `src/lsp/server/__tests__/navigationHandlers.test.ts`
- `src/__tests__/providerIntegration.test.ts`

### New focused tests

Add small unit tests for:

- `ScopedMethodHoverResolver`
  - identifier gating
  - unknown/unsupported downgrade
  - merged scoped target rendering
- `ObjectMethodHoverResolver`
  - member-name gating
  - single implementation hover
  - deduped merged implementation hover
  - fallback multiple-candidate summary
- `HoverDocumentationSupport`
  - complete document passthrough
  - synthetic shim creation for partial/non-standard resolved documents

## Acceptance Criteria

- `ObjectInferenceLanguageHoverService` is a coordinator rather than a behavior-heavy service
- scoped hover logic has one owner
- object-method hover logic has one owner
- synthetic documentation document shims are no longer embedded in the main hover service file
- all current hover integration tests remain green
- no user-visible hover behavior changes

## Follow-Up

If this package lands cleanly, the next hover-related debt should be evaluated only after re-checking:

- `LanguageSignatureHelpService`
- any remaining duplicated callable-doc discovery logic between hover and signature help

That follow-up is out of scope for this package.
