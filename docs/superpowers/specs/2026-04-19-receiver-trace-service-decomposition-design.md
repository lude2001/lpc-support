# Receiver Trace Service Decomposition Design

## Goal

Decompose `src/objectInference/ReceiverTraceService.ts` into smaller owner units while preserving current object-inference behavior.

## Problem

`ReceiverTraceService` currently mixes:

- containing-function discovery
- visible binding lookup
- control-flow source-expression collection
- branch merge behavior
- recursive expression resolution
- fallback coordination with global/inherited binding resolvers and return resolvers

That makes it the main remaining “god service” inside object inference.

## Scope

### In scope

- internal decomposition of `ReceiverTraceService`
- new support/resolver units under `src/objectInference/`
- tests that lock current tracing semantics

### Out of scope

- changing object inference behavior
- adding new receiver categories
- changing global/inherited binding semantics
- changing completion/definition/hover/signature-help product behavior

## Recommended design

Keep `ReceiverTraceService` as a thin coordinator with the two existing public entrypoints:

- `traceIdentifier(...)`
- `traceExpressionOutcome(...)`

Move its internal responsibilities into smaller units:

1. `ReceiverFunctionLocator`
   - containing-function lookup
2. `ReceiverBindingResolver`
   - visible binding lookup for locals/parameters/declarations
3. `ReceiverFlowCollector`
   - source-expression collection and branch merge
4. `ReceiverExpressionResolver`
   - recursive resolution of traced expressions through:
   - return-object resolver
   - object-method return resolver
   - same-file global binding resolver
   - inherited global binding resolver

## Rules

- No behavior expansion
- No new text-scanning fallback
- No new parser truth source
- Branch-merging and conservative unknown semantics must remain identical

## Tests

- keep current `ObjectInferenceService` regression coverage green
- add focused unit tests for the new internal units only where they lock real boundary behavior
- preserve current public object-inference outputs

## Acceptance criteria

- `ReceiverTraceService` becomes a coordinator
- internal responsibilities have explicit owners
- `npx tsc --noEmit` passes
- `npm test -- --runInBand` passes
