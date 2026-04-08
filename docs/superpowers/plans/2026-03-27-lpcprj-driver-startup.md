# LPCPRJ Driver Startup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy driver startup flow with a fixed `lpcprj config` command, remove all `lpc.driver.command` startup logic, and update docs/package outputs for version `0.32`.

**Architecture:** Introduce one shared runtime helper for detecting whether `lpcprj` is available on the system so both the command module and UI module can use the same rule. Keep the contributed `lpc.startDriver` command, but make it execute `lpcprj config` only when the command exists; otherwise, show a warning that directs users to GitHub for the preview development driver package. Remove the old startup setting and legacy migration references entirely.

**Tech Stack:** TypeScript, VS Code extension APIs, Jest, Node child_process, VSCE packaging

---

## Chunk 1: Test-first behavior change

### Task 1: Add failing command-module tests for the new startup flow

**Files:**
- Modify: `src/modules/__tests__/commandModule.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that cover:
- `lpc.startDriver` launches a terminal with `lpcprj config` when `lpcprj` is available
- `lpc.startDriver` shows the new warning and does not create a terminal when `lpcprj` is unavailable
- no test continues to depend on `lpc.driver.command`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts`
Expected: FAIL because the implementation still reads `lpc.driver.command`

### Task 2: Add failing UI-module tests for conditional status-bar exposure

**Files:**
- Modify: `src/modules/__tests__/uiModule.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that cover:
- status bar is shown and bound to `lpc.startDriver` when `lpcprj` is available
- status bar is hidden when `lpcprj` is unavailable

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --runInBand src/modules/__tests__/uiModule.test.ts`
Expected: FAIL because the current UI always shows the status bar

## Chunk 2: Shared helper and module changes

### Task 3: Implement the shared `lpcprj` availability helper

**Files:**
- Create: `src/utils/lpcprj.ts`
- Test: existing module tests consume the helper via mocks

- [ ] **Step 1: Write minimal implementation**

Implement a small helper that:
- checks command availability with the platform-appropriate lookup command
- returns a boolean for availability
- exposes the startup command string `lpcprj config`

- [ ] **Step 2: Run module tests**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts src/modules/__tests__/uiModule.test.ts`
Expected: still failing until modules are wired up

### Task 4: Update command and UI modules to use `lpcprj`

**Files:**
- Modify: `src/modules/commandModule.ts`
- Modify: `src/modules/uiModule.ts`

- [ ] **Step 1: Write minimal implementation**

Update command behavior to:
- stop reading `lpc.driver.command`
- call the helper
- launch `lpcprj config` from the workspace root when available
- show the new GitHub-directed warning when unavailable

Update UI behavior to:
- show the driver status bar only when `lpcprj` is available

- [ ] **Step 2: Run module tests to verify they pass**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts src/modules/__tests__/uiModule.test.ts`
Expected: PASS

## Chunk 3: Metadata and docs cleanup

### Task 5: Remove legacy startup config references

**Files:**
- Modify: `package.json`
- Modify: `src/projectConfig/projectConfigMigration.ts`

- [ ] **Step 1: Write the minimal cleanup**

Remove:
- contributed configuration item `lpc.driver.command`
- legacy migration detection tied to `driver.command`

- [ ] **Step 2: Run targeted checks**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts`
Expected: PASS

### Task 6: Update release docs and version

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: Update docs**

Document:
- startup now uses `lpcprj config`
- users without `lpcprj` must install the preview development driver environment from GitHub
- removal of the old startup setting
- changelog entry for `0.32`

- [ ] **Step 2: Update extension version**

Set package version to `0.32`

## Chunk 4: Verification and packaging

### Task 7: Run verification

**Files:**
- No code changes

- [ ] **Step 1: Run targeted tests**

Run: `npx jest --runInBand src/modules/__tests__/commandModule.test.ts src/modules/__tests__/uiModule.test.ts`
Expected: PASS

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Build and package**

Run: `npm run build`
Expected: PASS

Run: `npm run package`
Expected: PASS and a new `.vsix` in the repository root
