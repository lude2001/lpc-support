# M5 loader and guard independent review

Reviewer: `/root/m1_snippet_locale_review`. Reviewed the current working tree on 2026-10-27. This is a code and contract review, not a second translation review.

## Scope and method

- TypeScript: `src/efun/BundledEfunLoader.ts`, `types.ts`, `BundledEfunDocsProvider.ts`, the loader tests, locale resolver, and the projection into the function-documentation panel.
- Rust: `lpc-language-server/src/efun_docs.rs`, its development catalogue exporter, initialization in `main.rs`, `ExternalFunction::documentation`, hover/completion/signature-help callers, and indexed-cache serialization in `lpc-analysis/src/lib.rs`.
- Checks: `scripts/localization/check-efun-localization.mjs`, its tests, `efun-baseline.mjs`, `check-efun-consumers.mjs`, the efun assertions in `rust-localization-smoke.mjs`, and package/CI integration.

No production implementation, resources, ledgers, or game workspace was changed for this review. No driver, build, full consumer check, or previously passed test suite was run. Small, in-memory calls to the exported translation validator reproduced the guard boundaries below and confirmed the G1 fix. They did not modify repository data.

## Findings

### G1 — whole-field retained-fragment exemption (resolved during review)

Original location: the retained-fragment validation and removal loop. Current fix: `scripts/localization/check-efun-localization.mjs:18-23,98-119`.

The original validator checked that each fragment occurred in both the original field and English translation, and that its reason was one of three strings. It did not constrain a fragment to a code example, code literal, or proper name. It then removed every occurrence before checking for untranslated Han text.

An English field containing the complete original Chinese natural-language sentence passes when that complete sentence is declared as a `proper-name` fragment. An in-memory fixture with source and English summary `这里是完整的中文自然语言说明。`, matching current hashes, and that whole summary in `retainedFragments` returned `[]` from `validateDocumentTranslations`.

This was a machine-guard gap, not a finding that current catalogue exceptions were incorrect. Matching review hashes detect later edits; they do not validate the scope of an exception originally approved with those hashes.

The root agent fixed it during this review: complete trimmed-field exemptions are rejected; code-literal/example reasons require matching syntax; proper names require an explicit exception set, currently empty. The new regression test covers all three reason labels. I independently re-read the fix and repeated the original in-memory probe for all three reasons; each now reports an invalid retained source fragment. No further G1 change is requested.

### G2 — unfenced examples rely on cross-agent independent review and current hashes (documented boundary)

Location: `scripts/localization/check-efun-localization.mjs:13-17,84-92`.

The guard protects triple-backtick fenced blocks, inline tokens/expressions, and URLs. It does not extract unfenced, indented examples. An in-memory source summary `示例：\n\n   write("original");` and English summary `Example:\n\n   write("changed");`, with matching current hashes and no exceptions, returned `[]` from `validateDocumentTranslations`.

This does not demonstrate an incorrect current example. The automatic comparison across original and translated text covers fenced blocks, inline tokens, and URLs. The evidence for all examples additionally consists of cross-agent independent content review by different AI agents and current author plus independent hashes of every complete field, including unfenced code. These hashes reject changes after review; changing only the author hash still leaves the independent hash stale. This review does not claim human proofreading.

The scope decision is to retain this boundary rather than introduce a second parser or classify all indented prose as code. The unfenced typo changes in this migration are explicitly documented source corrections and were independently reviewed. A useful additional whole-catalogue regression test would mutate unfenced code and update only the author hash, then confirm that the independent hash rejects it. The guard must not be described as a regex proof of every example's semantic preservation.

## Confirmed behavior

- Optional translation read/parse failures are caught separately from structural loading in both implementations. Missing files, non-object JSON, wrong field types, and empty fields fall back per field to English. If both text resources fail, structural signatures remain present. Structural-file corruption has different pre-existing failure policies (TS skips a record; Rust returns an error); this is separate from optional translation failures.
- TS `selectText` and Rust `select_text` use trimming to test availability but return the original selected string. Neither rewrites code indentation, line breaks, or trailing newlines in the stored body. The TS provider and panel projection carry `summary`, `details`, and `note` separately without dropping them.
- Rust `ExternalFunction::documentation` includes all three body fields. Details receive a localized heading; notes become Markdown blockquotes with each source line prefixed. Both ordinary and `efun::` hover, completion, and signature help use this method. Native locale smoke checks actual selected bodies in these three routes, including note quoting. It was pending at review time and was subsequently executed by the root agent; see [the acceptance record](i18n-acceptance.md).
- TS locale is fixed per loader/provider instance. Rust initialization loads the selected body using the same session locale passed to `AnalysisDatabase`. External-function text is not serialized by `export_indexed_cache`; the cache contains indexed files. No production cross-locale cache contamination path was found. Changing only `AnalysisDatabase::set_locale` would change headings, not reload external bodies; the current session initialization does not do that.
- The baseline guard compares names, category identities/membership, signatures, parameter facts, arity, and references independently of prose. Source-text provenance and both review hashes are checked. Protected corrections require concrete before/after tokens and evidence rather than exempting a whole document from code checks.
- The consumer script bundles the production TS loader and invokes the production Rust loader through a development-only example. It compares both locales' loaded name/body/signature projections for all 413 functions. This proves loader agreement when run; it does not replace native LSP rendering smoke or semantic translation review.
- Current packaging includes `config/efun-docs/**`, covering both locale directories. During this review, `check:l10n` and `test:l10n` were updated to include the new guard and its tests; the earlier integration gap is no longer present in the inspected package scripts.

## CI placement

Run `check:l10n` and `test:l10n` after dependency installation. Run the full TS/Rust consumer comparison after Rust tests in the main job: `cargo run --example` may compile that development example on first use and reuses Cargo artifacts, but does not build or replace `dist/bin`. Run native locale smoke after the existing `build:rust` step and after packaged-sidecar smoke in the platform jobs. The locale smoke starts the existing sidecar and never builds it automatically. The consumer comparison need not be repeated in every packaging matrix entry.

## Result

No blocking production-loader regression was found in the inspected paths. G1 was reproduced and then independently confirmed fixed. G2 records the agreed automatic-check boundary and the complementary cross-agent independent content review/hash evidence. Full consumer execution and native locale smoke were pending at the time of this review. The root agent subsequently executed the acceptance checks; see [the acceptance record](i18n-acceptance.md). This reviewer did not run them and does not claim that execution as its own.
