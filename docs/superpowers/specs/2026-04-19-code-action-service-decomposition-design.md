# Code Action Service Decomposition Design

Date: 2026-04-19

## Goal

Decompose `src/language/services/codeActions/LanguageCodeActionService.ts` into focused collaborators so code actions follow the same coordinator/support pattern already applied to definition, hover, completion, and signature help.

## Non-Goals

- no changes to code-action product behavior
- no new quick-fix kinds or command ids
- no diagnostics pipeline changes
- no attempt to unify code actions with rename/navigation infrastructure

## Current Problem

`LanguageCodeActionService.ts` currently mixes:

1. top-level request filtering and dispatch
2. unused-variable quick-fix building
3. variable-position quick-fix building
4. document/line/range helper logic
5. naming conversion helpers (`snake_case`, `camelCase`)
6. block/function-start movement helpers

The service works, but the file shape is still a monolith:

- the coordinator owns all action-construction details
- text/range helpers are hidden inside the service instead of having an explicit owner
- there is no ownership guard preventing the file from growing again

## Approaches Considered

### 1. Leave the file as-is

Pros:

- zero refactor risk

Cons:

- leaves another service-level monolith in place
- keeps action-building logic coupled to request orchestration

### 2. Split by diagnostic family

Extract:

- one builder for unused-variable actions
- one builder for variable-position actions
- one narrow support/helper for common document/range utilities

Pros:

- mirrors the actual current responsibility split
- keeps request orchestration very small
- preserves current behavior with minimal surface change

Cons:

- still leaves multiple code-action specific files

### 3. Build a generic fix-rule framework

Pros:

- could look more abstract

Cons:

- over-design for the current debt
- higher regression risk
- unnecessary abstraction for a small fixed action set

## Recommended Approach

Approach 2.

## Proposed Design

### Public surface

Keep these stable:

- `LanguageCodeActionService`
- `LanguageCodeActionRequest`
- `LanguageCodeAction`
- `createLanguageCodeActionService()`

The public service remains, but becomes a coordinator.

### New collaborators

#### `CodeActionDocumentSupport`

Owns only the shared helper layer:

- workspace edit creation
- line range creation
- line-break range creation
- indentation lookup
- naming conversion helpers
- block/function-start search helpers
- variable-declaration heuristics

It must remain narrow and not become a generic text utility bucket.

#### `UnusedVariableCodeActionBuilder`

Owns quick fixes for:

- remove unused variable
- comment unused variable
- mark as global
- rename to snake_case
- rename to camelCase

It depends on `CodeActionDocumentSupport` for shared text/range manipulation.

#### `VariablePositionCodeActionBuilder`

Owns quick fixes for:

- move declaration to block start
- move declaration to function start

It also depends on `CodeActionDocumentSupport`.

## Coordinator Shape

After decomposition, `DefaultLanguageCodeActionService` should keep only:

1. `only`-kind filtering
2. request iteration over diagnostics
3. dispatch to the correct builder family
4. action list aggregation

It should no longer own inline action-construction details or shared document/range helpers.

## File Boundaries

### New files

- `src/language/services/codeActions/CodeActionDocumentSupport.ts`
- `src/language/services/codeActions/UnusedVariableCodeActionBuilder.ts`
- `src/language/services/codeActions/VariablePositionCodeActionBuilder.ts`

### Modified files

- `src/language/services/codeActions/LanguageCodeActionService.ts`
- `src/language/services/codeActions/__tests__/LanguageCodeActionService.test.ts`
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Failure Semantics

Behavior must remain equivalent:

- unsupported `only` kinds still return `[]`
- missing or malformed diagnostic payloads still return no action for that builder
- supported diagnostics still return the same edits/commands/titles

This package must not widen action applicability.

## Testing Strategy

### Keep existing integration guard

- `src/language/services/codeActions/__tests__/LanguageCodeActionService.test.ts`

### Add focused unit tests

- `CodeActionDocumentSupport.test.ts`
  - range creation
  - indentation lookup
  - case conversion
  - block/function-start search
- `UnusedVariableCodeActionBuilder.test.ts`
  - remove/comment/global/rename actions
- `VariablePositionCodeActionBuilder.test.ts`
  - move-to-block-start
  - move-to-function-start

### Ownership guard

Add a guard proving `LanguageCodeActionService.ts` no longer contains:

- inline remove/comment/global/rename action builders
- inline move-to-block/function-start builders
- inline naming/range helper functions

## Acceptance Criteria

- `LanguageCodeActionService.ts` is reduced to a coordinator
- unused-variable and variable-position action families have explicit owners
- shared document/range helpers have one narrow owner
- current code-action behavior remains unchanged
- ownership guard prevents the monolith from regrowing
