# File Function Doc Tracker Decomposition Plan

## Files

- `src/efun/FileFunctionDocTracker.ts`
- new helper/service files under `src/efun/`
- function-doc related tests and ownership guards as needed

## Steps

- [ ] Extract lookup/traversal builder for current/inherited/include function-doc groups and make it the single lookup truth source for all tracker public APIs
- [ ] Remove tracker-owned workspace-root resolution and route all root/path decisions through shared document-path support
- [ ] Extract compat materializer for `CallableDoc -> EfunDoc` maps and source groups
- [ ] Reduce `FileFunctionDocTracker` to cache/update/facade orchestration
- [ ] Add or update focused tracker ownership guards/tests that prove tracker no longer owns root-resolution, traversal, or compat materialization bodies and that `forceFresh` / cache semantics remain intact
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm test -- --runInBand`

Expected: PASS
