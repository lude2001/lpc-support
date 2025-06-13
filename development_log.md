```markdown
# Development Log

## LPC Parser Development (Phase 1)
- Selected Tree-sitter as the parsing technology due to its suitability for IDE integration (incremental parsing, error recovery).
- Implemented a core LPC grammar (`grammar.js`) based on `doc/lpc语言语法大纲.md`, covering fundamental constructs.
- Created a conceptual test plan (`lpc_grammar_test_plan.md`) for the core grammar.

## AST-based Syntax Highlighting (Phase 2)
- Implemented `LPCSemanticTokensProvider` in `src/semanticHighlighter.ts` using Tree-sitter queries to map AST nodes to semantic token types.
- Integrated this provider into the extension via `src/extension.ts`.
- Disabled the old TextMate grammar (`syntaxes/lpc.tmLanguage.json`) to allow the new semantic highlighting to take precedence.

## AST-based Diagnostic Features (Phase 3)
- **Unused Variable Check:** Successfully refactored the logic in `src/diagnostics.ts` to use Tree-sitter AST analysis for identifying unused global variables, parameters, and local variables.
- **Variable Definition Order Check:** Successfully implemented this new diagnostic feature using AST analysis. The core logic resides in `src/variableOrderChecker.ts` and is integrated into `src/diagnostics.ts`.

## Integration and Refactoring (Phases 4 & 5)
- **Integration:** Ensured the Tree-sitter parser, semantic highlighter, and updated diagnostics are correctly initialized and integrated in `src/extension.ts`.
- **`LPCDefinitionProvider` Refactoring:** Partially refactored to use Tree-sitter AST for more accurate "Go to Definition" for LPC functions, including initial support for 1-level inherited functions.
- **`LPCCompletionItemProvider` Refactoring:**
    - Successfully set up to receive the Tree-sitter language object.
    - Core logic for current-file functions, parameters, local variables, and global variables was refactored to use AST queries for improved accuracy.
    - (The subtask for inherited function completions using AST was also reported as successful).
- **Tooling Limitations:** Encountered persistent "Edit failed" errors when attempting substantial modifications to existing complex files like `src/diagnostics.ts` and `src/completionProvider.ts`. This limited the extent of AST-based refactoring in some areas, sometimes necessitating workarounds like using new helper files or making very incremental changes. The issue with non-ASCII filenames also prevented direct writing to the original `开发日志.md` file.
```
