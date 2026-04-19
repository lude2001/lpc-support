# Receiver Trace Service Decomposition Plan

## Files

- `src/objectInference/ReceiverTraceService.ts`
- new helper/resolver files under `src/objectInference/`
- object inference tests as needed

## Steps

- [ ] Extract containing-function and visible-binding lookup owners
- [ ] Extract flow/source-expression collection owner
- [ ] Extract recursive expression-resolution owner
- [ ] Reduce `ReceiverTraceService` to coordinator orchestration
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm test -- --runInBand`

Expected: PASS
