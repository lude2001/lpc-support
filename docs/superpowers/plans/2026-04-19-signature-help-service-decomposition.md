# Signature Help Service Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `LanguageSignatureHelpService` to a coordinator by extracting explicit owners for call-site analysis, callable target discovery, callable-doc resolution, and result assembly while preserving all current signature-help behavior.

**Architecture:** Keep the public signature-help service and runtime wiring stable. Move inline classes and pure helper blocks into dedicated files, then add ownership guards so signature help cannot collapse back into a monolith.

**Tech Stack:** TypeScript, Jest, VS Code API shims, callable documentation services, object inference, scoped method resolution

---

## File Map

### New files

- `src/language/services/signatureHelp/SyntaxAwareCallSiteAnalyzer.ts`
- `src/language/services/signatureHelp/DefaultCallableTargetDiscoveryService.ts`
- `src/language/services/signatureHelp/DefaultCallableDocResolver.ts`
- `src/language/services/signatureHelp/SignatureHelpPresentationSupport.ts`
- `src/language/services/signatureHelp/__tests__/SyntaxAwareCallSiteAnalyzer.test.ts`
- `src/language/services/signatureHelp/__tests__/DefaultCallableTargetDiscoveryService.test.ts`
- `src/language/services/signatureHelp/__tests__/DefaultCallableDocResolver.test.ts`
- `src/language/services/signatureHelp/__tests__/SignatureHelpPresentationSupport.test.ts`

### Modified files

- `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
- `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
- `src/lsp/server/runtime/createProductionLanguageServices.ts`
- `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
- `src/__tests__/documentAnalysisOwnershipGuard.test.ts`

## Chunk 1: Extract presentation support and analyzer

### Task 1: Add failing tests for presentation support

- [ ] Write focused tests for:
  - target dedupe order
  - merged callable-doc grouping
  - active-signature selection
  - final signature flattening source labels
- [ ] Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/SignatureHelpPresentationSupport.test.ts
```

Expected: FAIL because the support file does not exist yet.

- [ ] Create `src/language/services/signatureHelp/SignatureHelpPresentationSupport.ts`
  - move pure helper logic out of `LanguageSignatureHelpService.ts`
  - keep exported surface narrow
- [ ] Re-run the focused presentation tests
- [ ] Commit:

```bash
git add src/language/services/signatureHelp/SignatureHelpPresentationSupport.ts src/language/services/signatureHelp/__tests__/SignatureHelpPresentationSupport.test.ts
git commit -m "refactor(signature-help): extract presentation support"
```

### Task 2: Add failing tests for call-site analysis

- [ ] Write focused tests for:
  - nested call selection
  - function/object/scoped call-kind detection
  - callee lookup position
  - active parameter boundary inputs
- [ ] Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/SyntaxAwareCallSiteAnalyzer.test.ts
```

Expected: FAIL because the analyzer file does not exist yet.

- [ ] Create `src/language/services/signatureHelp/SyntaxAwareCallSiteAnalyzer.ts`
  - move syntax-driven call-site analysis out of `LanguageSignatureHelpService.ts`
  - preserve current call-kind and token-boundary semantics
- [ ] Re-run the focused analyzer tests
- [ ] Commit:

```bash
git add src/language/services/signatureHelp/SyntaxAwareCallSiteAnalyzer.ts src/language/services/signatureHelp/__tests__/SyntaxAwareCallSiteAnalyzer.test.ts
git commit -m "refactor(signature-help): extract call-site analyzer"
```

## Chunk 2: Extract discovery and doc resolution

### Task 3: Add failing tests for callable target discovery

- [ ] Write focused tests for:
  - local/inherited callable targets
  - include callable targets
  - object-method callable targets
  - scoped-method callable targets
  - simul_efun / efun ordering
- [ ] Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/DefaultCallableTargetDiscoveryService.test.ts
```

Expected: FAIL because the discovery file does not exist yet.

- [ ] Create `src/language/services/signatureHelp/DefaultCallableTargetDiscoveryService.ts`
  - move target discovery logic out of `LanguageSignatureHelpService.ts`
  - preserve current priorities and unsupported semantics
- [ ] Re-run the focused discovery tests
- [ ] Commit:

```bash
git add src/language/services/signatureHelp/DefaultCallableTargetDiscoveryService.ts src/language/services/signatureHelp/__tests__/DefaultCallableTargetDiscoveryService.test.ts
git commit -m "refactor(signature-help): extract target discovery"
```

### Task 4: Add failing tests for callable-doc resolution

- [ ] Write focused tests for:
  - efun doc materialization
  - simul_efun compatibility docs
  - declaration-backed callable docs from source documents
- [ ] Run:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/DefaultCallableDocResolver.test.ts
```

Expected: FAIL because the resolver file does not exist yet.

- [ ] Create `src/language/services/signatureHelp/DefaultCallableDocResolver.ts`
  - move doc-resolution/materialization logic out of `LanguageSignatureHelpService.ts`
  - preserve source-kind tagging semantics
- [ ] Re-run the focused doc-resolver tests
- [ ] Commit:

```bash
git add src/language/services/signatureHelp/DefaultCallableDocResolver.ts src/language/services/signatureHelp/__tests__/DefaultCallableDocResolver.test.ts
git commit -m "refactor(signature-help): extract doc resolver"
```

## Chunk 3: Reduce service to coordinator and add guards

### Task 5: Rewire `LanguageSignatureHelpService` to delegate fully

- [ ] Update `src/language/services/signatureHelp/LanguageSignatureHelpService.ts`
  - keep only orchestration
  - wire defaults to the extracted collaborators
  - remove inline class definitions and large pure helper blocks
- [ ] Update `src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts`
  - keep external behavior stable
- [ ] Update `src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts`
  - keep runtime wiring stable
- [ ] Add ownership guard coverage in `src/__tests__/documentAnalysisOwnershipGuard.test.ts`
  - fail if `LanguageSignatureHelpService.ts` regains analyzer/discovery/doc/presentation ownership
- [ ] Run focused regression pack:

```bash
npx jest --runInBand src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/language/services/signatureHelp/__tests__/SyntaxAwareCallSiteAnalyzer.test.ts src/language/services/signatureHelp/__tests__/DefaultCallableTargetDiscoveryService.test.ts src/language/services/signatureHelp/__tests__/DefaultCallableDocResolver.test.ts src/language/services/signatureHelp/__tests__/SignatureHelpPresentationSupport.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
```

Expected: PASS

- [ ] Run full verification:

```bash
npx tsc --noEmit
npm test -- --runInBand
```

Expected: PASS

- [ ] Commit:

```bash
git add src/language/services/signatureHelp/LanguageSignatureHelpService.ts src/language/services/signatureHelp/__tests__/LanguageSignatureHelpService.test.ts src/language/services/signatureHelp/__tests__/SyntaxAwareCallSiteAnalyzer.test.ts src/language/services/signatureHelp/__tests__/DefaultCallableTargetDiscoveryService.test.ts src/language/services/signatureHelp/__tests__/DefaultCallableDocResolver.test.ts src/language/services/signatureHelp/__tests__/SignatureHelpPresentationSupport.test.ts src/lsp/server/runtime/__tests__/createProductionLanguageServices.test.ts src/__tests__/documentAnalysisOwnershipGuard.test.ts
git commit -m "refactor(signature-help): reduce service to coordinator"
```

## Completion Criteria

- `LanguageSignatureHelpService.ts` is a thin coordinator
- analyzer/discovery/doc/presentation responsibilities have explicit owners
- current signature-help behavior remains unchanged
- runtime wiring remains unchanged
- ownership guard prevents the monolith from regrowing
