# Function Documentation Ownership Normalization Plan

## Files

- `src/language/documentation/FunctionDocumentationService.ts`
- new helper/owner files under `src/language/documentation/`
- production consumers that currently instantiate their own documentation service
- tests and ownership guards as needed

## Steps

- [ ] Extract document-index owner for cache/rebuild/invalidate policy
- [ ] Extract callable-doc builder owner for syntax-backed indexing and ordering
- [ ] Extract doc-comment tag parser owner
- [ ] Reduce `FunctionDocumentationService` to facade orchestration
- [ ] Register one shared documentation service through the extension `ServiceRegistry` and one shared runtime instance through `createProductionLanguageServices()`
- [ ] Remove production fallback instantiation and inject the shared documentation service through all top-level consumers and nested helpers
- [ ] Add or update focused ownership guards/tests for cache owners, parser/build owners, production-instantiation whitelist, shared-instance wiring, and cross-consumer `invalidate/forceFresh` consistency
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm test -- --runInBand`

Expected: PASS
