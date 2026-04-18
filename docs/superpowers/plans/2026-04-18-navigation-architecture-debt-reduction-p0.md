# Navigation Architecture Debt Reduction P0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the retired `Workspace*` navigation subsystem from the active codebase, preserve the current inherited-navigation behavior, and align docs/specs with the real `0.45.1` navigation architecture.

**Architecture:** First extract the only still-needed shared helper (`normalizeWorkspaceUri`) into a neutral navigation util and lock its behavior with new tests. Then migrate the active inherited-navigation path to the new util, delete the retired workspace navigation implementation/tests, and finally mark the old workspace-navigation docs as superseded while tightening the public README/design wording.

**Tech Stack:** TypeScript, Jest, VS Code API test doubles, ripgrep, Markdown docs

---

## File Map

### Create

- `src/language/services/navigation/navigationPathUtils.ts`
  - neutral URI normalization utility used by live navigation code
- `src/language/services/navigation/__tests__/navigationPathUtils.test.ts`
  - low-level protection for URI canonicalization behavior
- `docs/superpowers/plans/2026-04-18-navigation-architecture-debt-reduction-p0.md`
  - this implementation plan

### Modify

- `src/language/services/navigation/InheritedSymbolRelationService.ts`
  - switch from retired `WorkspaceSymbolOwnerResolver` helper import to the new neutral util
- `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`
  - keep current inherited-path protection green; add one explicit assertion if needed after code search
- `README.md`
  - ensure the public navigation wording no longer implies a still-live workspace navigation stack
- `docs/object-inference-design.md`
  - record that the workspace-wide navigation experiment is retired and the current path is inherited-only
- `docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md`
  - add a clear superseded banner pointing at the narrowing spec and the new debt-reduction roadmap
- `docs/superpowers/plans/2026-04-18-workspace-references-rename.md`
  - add a clear superseded banner pointing at the narrowing spec and the new debt-reduction roadmap

### Delete

- `src/language/services/navigation/WorkspaceSymbolRelationService.ts`
- `src/language/services/navigation/WorkspaceSemanticIndexService.ts`
- `src/language/services/navigation/WorkspaceReferenceCollector.ts`
- `src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts`
- `src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts`
- `src/language/services/navigation/workspaceSymbolTypes.ts`
- `src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts`
- `src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts`
- `src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts`
- `src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts`

### Keep Unchanged

- `src/language/services/navigation/LanguageReferenceService.ts`
- `src/language/services/navigation/LanguageRenameService.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/lsp/server/handlers/**`
- all parser / syntax / semantic / scoped / object-inference behavior

---

## Chunk 1: Shared Util Extraction And Live-Path Protection

### Task 1: Create an isolated worktree and capture the live dependency surface

**Files:**
- Modify: none

- [ ] **Step 1: Create a dedicated worktree**

Run:

```bash
git worktree add .worktrees/navigation-architecture-debt-p0 -b codex/navigation-architecture-debt-p0
```

Expected:
- new worktree created at `D:\code\lpc-support\.worktrees\navigation-architecture-debt-p0`
- branch `codex/navigation-architecture-debt-p0` checked out there

- [ ] **Step 2: Verify the root workspace dirty files are not being used for implementation**

Run:

```bash
git -C D:\code\lpc-support status --short
git -C D:\code\lpc-support\.worktrees\navigation-architecture-debt-p0 status --short
```

Expected:
- root workspace still shows the user's existing release/doc changes
- worktree starts clean

- [ ] **Step 3: Inventory all remaining code references to the retired subsystem**

Run:

```bash
rg -n "WorkspaceSymbolRelationService|WorkspaceSemanticIndexService|WorkspaceReferenceCollector|WorkspaceReferenceCandidateEnumerator|WorkspaceSymbolOwnerResolver|workspaceSymbolTypes|normalizeWorkspaceUri" src tests docs
```

Expected:
- live code hit in `src/language/services/navigation/InheritedSymbolRelationService.ts`
- retired implementation/test files plus doc/spec references

- [ ] **Step 4: Commit nothing yet**

Expected:
- no commit for inventory-only work

### Task 2: Add low-level failing tests for the neutral URI helper

**Files:**
- Create: `src/language/services/navigation/__tests__/navigationPathUtils.test.ts`
- Test: `src/language/services/navigation/__tests__/navigationPathUtils.test.ts`

- [ ] **Step 1: Write the failing util tests**

```ts
import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { normalizeWorkspaceUri } from '../navigationPathUtils';

describe('navigationPathUtils.normalizeWorkspaceUri', () => {
    test('normalizes four-slash Windows file URIs to the canonical three-slash form', () => {
        expect(normalizeWorkspaceUri('file:////D:/workspace/room.c')).toBe('file:///D:/workspace/room.c');
        expect(normalizeWorkspaceUri(vscode.Uri.parse('file:////D:/workspace/room.c'))).toBe('file:///D:/workspace/room.c');
    });

    test('leaves canonical file URIs and non-file URIs unchanged', () => {
        expect(normalizeWorkspaceUri('file:///D:/workspace/room.c')).toBe('file:///D:/workspace/room.c');
        expect(normalizeWorkspaceUri('untitled:room.c')).toBe('untitled:room.c');
    });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationPathUtils.test.ts
```

Expected:
- FAIL because `../navigationPathUtils` does not exist yet

- [ ] **Step 3: Implement the neutral util**

Create `src/language/services/navigation/navigationPathUtils.ts`:

```ts
import * as vscode from 'vscode';

export function normalizeWorkspaceUri(target: vscode.Uri | string): string {
    const rawUri = typeof target === 'string' ? target : target.toString();
    return rawUri.replace(/^file:\/{4}(?=[A-Za-z]:)/, 'file:///');
}
```

- [ ] **Step 4: Run the util test to verify it passes**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationPathUtils.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the new low-level protection**

Run:

```bash
git add src/language/services/navigation/navigationPathUtils.ts src/language/services/navigation/__tests__/navigationPathUtils.test.ts
git commit -m "test(navigation): lock workspace uri normalization"
```

### Task 3: Migrate the live inherited-navigation path to the neutral util

**Files:**
- Modify: `src/language/services/navigation/InheritedSymbolRelationService.ts`
- Modify: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`
- Test: `src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts`

- [ ] **Step 1: Replace the retired-helper import in the live service**

In `src/language/services/navigation/InheritedSymbolRelationService.ts`, change:

```ts
import { normalizeWorkspaceUri } from './WorkspaceSymbolOwnerResolver';
```

to:

```ts
import { normalizeWorkspaceUri } from './navigationPathUtils';
```

- [ ] **Step 2: Add one explicit inherited-path assertion only if code search shows no existing util-backed protection**

If `InheritedSymbolRelationService.test.ts` still has no test that exercises normalized URI dedupe/identity through the live service, add one small case that proves the active inherited-path logic still dedupes canonicalized URIs rather than depending on the deleted file.

Preferred target:

```ts
test('collectInheritedReferences keeps canonical inherited matches stable after uri normalization', async () => {
    // build a tiny parent/child fixture
    // feed one family document through a four-slash file URI
    // assert the returned matches contain the canonical URI only once
});
```

If existing assertions already cover this exact seam after the import swap, skip this step and note that in the execution log.

- [ ] **Step 3: Run the live-path targeted tests**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationPathUtils.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/language/services/navigation/__tests__/navigationServices.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Commit the live-path migration**

Run:

```bash
git add src/language/services/navigation/InheritedSymbolRelationService.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts
git commit -m "refactor(navigation): extract shared uri normalization"
```

---

## Chunk 2: Retired Subsystem Removal And Documentation Alignment

### Task 4: Delete the retired `Workspace*` implementation and test subtree

**Files:**
- Delete: `src/language/services/navigation/WorkspaceSymbolRelationService.ts`
- Delete: `src/language/services/navigation/WorkspaceSemanticIndexService.ts`
- Delete: `src/language/services/navigation/WorkspaceReferenceCollector.ts`
- Delete: `src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts`
- Delete: `src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts`
- Delete: `src/language/services/navigation/workspaceSymbolTypes.ts`
- Delete: `src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts`
- Delete: `src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts`
- Delete: `src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts`
- Delete: `src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts`

- [ ] **Step 1: Re-run the code search before deletion**

Run:

```bash
rg -n "WorkspaceSymbolRelationService|WorkspaceSemanticIndexService|WorkspaceReferenceCollector|WorkspaceReferenceCandidateEnumerator|WorkspaceSymbolOwnerResolver|workspaceSymbolTypes" src
```

Expected:
- only hits in the retired subtree and possibly comments/docs
- no live production import outside the subtree

- [ ] **Step 2: Delete the retired implementation files**

Run:

```bash
git rm src/language/services/navigation/WorkspaceSymbolRelationService.ts src/language/services/navigation/WorkspaceSemanticIndexService.ts src/language/services/navigation/WorkspaceReferenceCollector.ts src/language/services/navigation/WorkspaceReferenceCandidateEnumerator.ts src/language/services/navigation/WorkspaceSymbolOwnerResolver.ts src/language/services/navigation/workspaceSymbolTypes.ts
```

- [ ] **Step 3: Delete the retired tests**

Run:

```bash
git rm src/language/services/navigation/__tests__/WorkspaceSymbolRelationService.test.ts src/language/services/navigation/__tests__/WorkspaceSemanticIndexService.test.ts src/language/services/navigation/__tests__/WorkspaceReferenceCollector.test.ts src/language/services/navigation/__tests__/WorkspaceSymbolOwnerResolver.test.ts
```

- [ ] **Step 4: Verify no code import path still points at the retired subsystem**

Run:

```bash
rg -n "WorkspaceSymbolRelationService|WorkspaceSemanticIndexService|WorkspaceReferenceCollector|WorkspaceReferenceCandidateEnumerator|WorkspaceSymbolOwnerResolver|workspaceSymbolTypes" src
```

Expected:
- no hits in `src/`

- [ ] **Step 5: Run the active navigation regression set**

Run:

```bash
npx jest --runInBand src/language/services/navigation/__tests__/navigationServices.test.ts src/language/services/navigation/__tests__/InheritedSymbolRelationService.test.ts src/lsp/server/__tests__/navigationHandlers.test.ts src/lsp/__tests__/spawnedRuntime.integration.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit the retired-subsystem removal**

Run:

```bash
git add -A
git commit -m "refactor(navigation): remove retired workspace relation stack"
```

### Task 5: Mark the old workspace-navigation docs as superseded and align the public docs

**Files:**
- Modify: `README.md`
- Modify: `docs/object-inference-design.md`
- Modify: `docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md`
- Modify: `docs/superpowers/plans/2026-04-18-workspace-references-rename.md`

- [ ] **Step 1: Add a superseded banner to the old workspace-navigation spec**

At the top of `docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md`, add a short banner like:

```md
> Superseded on 2026-04-18 by `2026-04-18-navigation-capability-narrowing-design.md` and `2026-04-18-navigation-architecture-debt-reduction-design.md`. The workspace-wide references/rename architecture described below is no longer the active production direction.
```

- [ ] **Step 2: Add the same superseded banner to the old workspace-navigation plan**

At the top of `docs/superpowers/plans/2026-04-18-workspace-references-rename.md`, add a matching banner that points at the same two replacement docs.

- [ ] **Step 3: Tighten `README.md` so it no longer implies a still-live workspace navigation stack**

Update the current-version sections so they consistently say:

- function `references` are current-file + provable inherit-chain only
- `rename` supports only locals / parameters / file-scope globals
- the old workspace-wide function/type rename model is retired

Do not widen any user-facing wording back toward “safe workspace rename”.

- [ ] **Step 4: Tighten `docs/object-inference-design.md` to record the architectural retirement explicitly**

Update the navigation-history note so it says:

- `0.45.0` introduced a workspace-wide navigation attempt
- `0.45.1` narrowed production behavior back to current-file + provable inherit-chain
- the old `Workspace*` relation stack is now retired and no longer part of the active production architecture

- [ ] **Step 5: Run a targeted docs sanity search**

Run:

```bash
rg -n "workspace-wide|WorkspaceSymbolRelationService|WorkspaceSemanticIndexService|safe rename|工作区级引用查找与安全重命名" README.md docs/object-inference-design.md docs/superpowers/specs docs/superpowers/plans
```

Expected:
- remaining hits are either superseded banners or historical context that clearly says “retired/superseded”

- [ ] **Step 6: Commit the docs alignment**

Run:

```bash
git add README.md docs/object-inference-design.md docs/superpowers/specs/2026-04-18-workspace-references-rename-design.md docs/superpowers/plans/2026-04-18-workspace-references-rename.md
git commit -m "docs(navigation): mark workspace relation design as retired"
```

### Task 6: Final verification and handoff

**Files:**
- Modify: none
- Test: full repo verification

- [ ] **Step 1: Run type-check**

Run:

```bash
npx tsc --noEmit
```

Expected:
- PASS

- [ ] **Step 2: Run the full serial test suite**

Run:

```bash
npm test -- --runInBand
```

Expected:
- PASS

- [ ] **Step 3: Run a final source-tree search to confirm the retired subsystem is gone from code**

Run:

```bash
rg -n "WorkspaceSymbolRelationService|WorkspaceSemanticIndexService|WorkspaceReferenceCollector|WorkspaceReferenceCandidateEnumerator|WorkspaceSymbolOwnerResolver|workspaceSymbolTypes" src
```

Expected:
- no hits in `src/`

- [ ] **Step 4: Summarize the outcome for handoff**

Record in the execution notes:

- which new util file was introduced
- which old files/tests were removed
- whether an extra inherited-service assertion was added or skipped
- which docs were marked superseded
- exact verification commands and results

- [ ] **Step 5: Create the final implementation commit if the previous task commits were squashed or adjusted**

Run only if needed:

```bash
git status --short
```

Expected:
- clean working tree

If not clean because of small fixups, create one final conventional commit with the remaining staged files.

---

## Local Chunk Review Notes

### Chunk 1 checklist

- New neutral util exists and is the only home of `normalizeWorkspaceUri(...)`
- `InheritedSymbolRelationService.ts` no longer imports from `WorkspaceSymbolOwnerResolver.ts`
- Low-level URI normalization behavior is locked by a dedicated test

### Chunk 2 checklist

- No `Workspace*` implementation/test file remains under `src/`
- Public docs describe the current inherited-only navigation path
- Old workspace-navigation spec/plan are explicitly marked superseded
- Full verification is green

---

## Acceptance Criteria

- `src/` contains no `WorkspaceSymbolRelationService`, `WorkspaceSemanticIndexService`, `WorkspaceReferenceCollector`, `WorkspaceReferenceCandidateEnumerator`, `WorkspaceSymbolOwnerResolver`, or `workspaceSymbolTypes`
- live inherited navigation uses `navigationPathUtils.ts` for URI normalization
- the repo still passes `npx tsc --noEmit` and `npm test -- --runInBand`
- README and design docs match the current `0.45.1` navigation behavior
- the old workspace-navigation spec and plan clearly tell future readers they are retired
