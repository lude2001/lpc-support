# Tasks Document: LPC Code Formatter

- [ ] 1. Create formatter configuration interface and utilities
  - File: src/formatting/FormatterConfig.ts
  - Define TypeScript interfaces for formatting options extending VS Code's FormattingOptions
  - Create configuration management utilities
  - Purpose: Establish type-safe configuration system for formatter
  - _Leverage: src/config.ts (LPCConfigManager pattern)_
  - _Requirements: 5.1, 5.2_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer specializing in configuration systems and type safety | Task: Create comprehensive FormatterConfig.ts implementing FormattingOptions interface and configuration utilities following requirements 5.1 and 5.2, leveraging existing config patterns from src/config.ts | Restrictions: Must extend VS Code FormattingOptions, maintain backward compatibility with existing config system, follow project naming conventions | _Leverage: src/config.ts for configuration patterns, VS Code API for base FormattingOptions | _Requirements: Requirements 5.1 (configurable formatting rules), 5.2 (different configuration options) | Success: All interfaces compile without errors, configuration manager properly extends existing patterns, supports all LPC-specific formatting options | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 2. Create formatting utilities and helper functions
  - File: src/formatting/FormattingUtils.ts
  - Implement text manipulation utilities for whitespace normalization and text edit generation
  - Add comment preservation and string literal handling
  - Purpose: Provide common utilities for all formatting operations
  - _Leverage: existing text processing utilities in project_
  - _Requirements: 6.1, 6.2_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Utility Developer with expertise in string processing and text manipulation | Task: Create comprehensive FormattingUtils.ts with text manipulation utilities following requirements 6.1 and 6.2, implementing whitespace normalization, comment preservation, and VS Code TextEdit generation | Restrictions: Must preserve code semantics, handle edge cases gracefully, ensure functions are pure and testable | _Leverage: VS Code TextEdit API, existing string utilities in codebase | _Requirements: Requirements 6.1 (error handling), 6.2 (graceful error recovery) | Success: All utility functions are robust and well-tested, properly handle edge cases including malformed code, efficient text processing performance | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 3. Implement core indentation formatter
  - File: src/formatting/IndentationFormatter.ts
  - Create indentation logic for different LPC constructs (functions, blocks, control structures)
  - Support both tab and space indentation with configurable sizing
  - Purpose: Handle all indentation-related formatting rules
  - _Leverage: src/formatting/FormattingUtils.ts, ANTLR ParseTree nodes_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Code Formatting Specialist with expertise in indentation algorithms and AST processing | Task: Implement IndentationFormatter.ts with comprehensive indentation logic following requirements 2.1 and 2.2, supporting tab/space indentation for all LPC constructs including nested structures | Restrictions: Must preserve logical code structure, handle mixed indentation scenarios, maintain consistent indentation levels | _Leverage: FormattingUtils.ts for base operations, ANTLR4 ParseTree API for AST traversal | _Requirements: Requirements 2.1 (indentation and spaces), 2.2 (nested structures) | Success: Correctly handles all LPC constructs indentation, supports configurable tab/space options, maintains consistency across complex nested code | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 4. Implement spacing formatter for operators and punctuation
  - File: src/formatting/SpacingFormatter.ts
  - Create spacing rules for operators, punctuation, and delimiters
  - Handle special LPC operators and syntax elements
  - Purpose: Manage all space-related formatting around code elements
  - _Leverage: src/formatting/FormattingUtils.ts, LPC grammar rules_
  - _Requirements: 2.3, 2.4_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Language Syntax Specialist with expertise in operator spacing and punctuation rules | Task: Create SpacingFormatter.ts implementing comprehensive spacing rules following requirements 2.3 and 2.4, handling all LPC operators, punctuation, and delimiters with configurable spacing options | Restrictions: Must maintain operator precedence clarity, handle complex expressions correctly, preserve string literal content | _Leverage: FormattingUtils.ts for spacing operations, LPC grammar from grammar/ directory | _Requirements: Requirements 2.3 (operator spacing), 2.4 (punctuation and delimiters) | Success: All operators and punctuation correctly spaced, handles complex nested expressions, configurable spacing preferences work correctly | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 5. Implement LPC-specific syntax formatter
  - File: src/formatting/LPCSpecificFormatter.ts
  - Create formatting rules for LPC-unique constructs: function pointers (: :), mappings, foreach loops, range matching
  - Handle array literals, struct/class definitions, and inherit statements
  - Purpose: Handle all LPC-specific syntax that differs from standard C formatting
  - _Leverage: src/formatting/FormattingUtils.ts, LPC grammar definitions_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: LPC Language Expert with deep knowledge of LPC syntax and semantic differences from C | Task: Implement LPCSpecificFormatter.ts with comprehensive formatting for all LPC-unique constructs following requirements 3.1-3.5, including function pointers, mappings, foreach, range matching, and array literals | Restrictions: Must preserve LPC semantic meaning, handle nested complex structures, maintain compatibility with different LPC dialects | _Leverage: FormattingUtils.ts, LPC grammar files from grammar/ directory, LPC language documentation | _Requirements: Requirements 3.1-3.5 (all LPC-specific syntax formatting) | Success: All LPC-unique syntax elements are correctly formatted, maintains semantic correctness, handles edge cases and nested structures | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 6. Implement block and brace style formatter
  - File: src/formatting/BlockFormatter.ts
  - Create logic for different brace styles (Allman, K&R, GNU, Whitesmiths)
  - Handle function definitions, control structures, and nested blocks
  - Purpose: Manage block structure and brace placement according to style preferences
  - _Leverage: src/formatting/FormattingUtils.ts, FormatterConfig for style options_
  - _Requirements: 4.1, 4.2_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Code Style Specialist with expertise in different brace placement conventions and block formatting | Task: Create BlockFormatter.ts implementing multiple brace styles following requirements 4.1 and 4.2, supporting Allman, K&R, GNU, and Whitesmiths styles for all block constructs | Restrictions: Must maintain code logic integrity, handle deeply nested blocks correctly, ensure consistent style application | _Leverage: FormattingUtils.ts for block operations, FormatterConfig.ts for style preferences | _Requirements: Requirements 4.1 (function and class formatting), 4.2 (multi-line parameters and alignment) | Success: All brace styles implemented correctly, handles complex nested structures, consistent application across all block types | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 7. Create AST formatting visitor
  - File: src/formatting/FormattingVisitor.ts
  - Implement ANTLR visitor pattern to traverse AST and apply formatting rules
  - Coordinate all formatter components and manage formatting context
  - Purpose: Orchestrate the formatting process across the entire AST
  - _Leverage: src/antlr/LPCParserVisitor.ts, all formatter components_
  - _Requirements: All formatting requirements_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: AST Processing Expert with deep knowledge of visitor patterns and tree traversal algorithms | Task: Create FormattingVisitor.ts implementing ANTLR visitor pattern to orchestrate all formatting operations, coordinating IndentationFormatter, SpacingFormatter, LPCSpecificFormatter, and BlockFormatter | Restrictions: Must preserve AST structure integrity, handle malformed parse trees gracefully, maintain formatting context throughout traversal | _Leverage: LPCParserVisitor.ts as base, all formatter components (IndentationFormatter, SpacingFormatter, LPCSpecificFormatter, BlockFormatter), FormattingUtils.ts | _Requirements: All formatting requirements (coordinates all formatter components) | Success: Successfully traverses and formats complete AST, integrates all formatters seamlessly, handles partial/malformed trees gracefully | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 8. Implement core LPC formatter engine
  - File: src/formatting/LPCFormatter.ts
  - Create main formatter class that uses ASTManager and FormattingVisitor
  - Implement document and range formatting methods
  - Add error handling and recovery mechanisms
  - Purpose: Provide the core formatting engine that coordinates all components
  - _Leverage: src/ast/astManager.ts, src/formatting/FormattingVisitor.ts, src/formatting/FormatterConfig.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Software Engineer specializing in language processing and error-resilient systems | Task: Create LPCFormatter.ts as the core formatting engine following requirements 1.1-1.4 and 6.1-6.4, integrating ASTManager, FormattingVisitor, and robust error handling | Restrictions: Must handle syntax errors gracefully, preserve original code when formatting fails, ensure idempotent formatting operations | _Leverage: ASTManager for AST operations, FormattingVisitor for tree processing, FormatterConfig for configuration, FormattingUtils for utilities | _Requirements: Requirements 1.1-1.4 (core formatting), 6.1-6.4 (error handling) | Success: Reliably formats valid and partially-invalid LPC code, integrates seamlessly with existing AST infrastructure, provides clear error messages and recovery | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 9. Create VS Code document formatting provider
  - File: src/formatting/LPCDocumentFormattingProvider.ts
  - Implement VS Code DocumentFormattingProvider interface
  - Integrate with LPCFormatter and handle VS Code specific requirements
  - Purpose: Provide VS Code integration for full document formatting
  - _Leverage: src/formatting/LPCFormatter.ts, VS Code API patterns from other providers_
  - _Requirements: 1.1, 1.2_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: VS Code Extension Developer with expertise in Language Server Protocol and VS Code API integration | Task: Create LPCDocumentFormattingProvider.ts implementing VS Code DocumentFormattingProvider interface following requirements 1.1 and 1.2, integrating with LPCFormatter engine | Restrictions: Must follow VS Code API contracts exactly, handle large documents efficiently, provide proper progress feedback | _Leverage: LPCFormatter.ts for core formatting, existing provider patterns from src/completionProvider.ts and similar files | _Requirements: Requirements 1.1 (format document command), 1.2 (format on save) | Success: Successfully integrates with VS Code formatting system, handles all document types correctly, provides responsive user experience | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 10. Create VS Code range formatting provider
  - File: src/formatting/LPCDocumentRangeFormattingProvider.ts
  - Implement VS Code DocumentRangeFormattingProvider interface
  - Handle selection-based formatting with proper range handling
  - Purpose: Provide VS Code integration for selected text formatting
  - _Leverage: src/formatting/LPCFormatter.ts, VS Code range handling utilities_
  - _Requirements: 1.3_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: VS Code Extension Developer specializing in text range processing and editor integration | Task: Create LPCDocumentRangeFormattingProvider.ts implementing VS Code DocumentRangeFormattingProvider interface following requirement 1.3, handling selection-based formatting with intelligent range expansion | Restrictions: Must respect user selection boundaries, handle partial syntax trees correctly, maintain formatting context around selection | _Leverage: LPCFormatter.ts for core engine, VS Code Range and Position APIs, existing range handling patterns in codebase | _Requirements: Requirement 1.3 (format selected text) | Success: Accurately formats selected ranges while maintaining surrounding code integrity, intelligently expands ranges when needed for syntax completeness | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 11. Register formatting providers in extension
  - File: src/extension.ts (modify existing)
  - Register both document and range formatting providers with VS Code
  - Configure provider activation and language associations
  - Purpose: Integrate formatting functionality into the extension activation
  - _Leverage: existing provider registration patterns in src/extension.ts_
  - _Requirements: 1.1, 1.2, 1.3_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: VS Code Extension Developer with expertise in extension lifecycle and provider registration | Task: Modify src/extension.ts to register LPCDocumentFormattingProvider and LPCDocumentRangeFormattingProvider following requirements 1.1-1.3, using existing provider registration patterns | Restrictions: Must follow existing activation patterns, ensure proper cleanup on deactivation, maintain compatibility with existing providers | _Leverage: existing extension.ts patterns, VS Code languages.register* APIs, established provider registration code | _Requirements: Requirements 1.1-1.3 (integrate all formatting providers) | Success: Formatting providers are properly registered and activated, work seamlessly with existing extension functionality, proper cleanup implemented | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 12. Add formatting configuration to package.json
  - File: package.json (modify existing)
  - Add configuration contributions for formatting options
  - Define user-configurable settings with proper defaults
  - Purpose: Expose formatting configuration options to VS Code settings
  - _Leverage: existing configuration patterns in package.json_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: VS Code Extension Configuration Specialist with expertise in extension manifests and settings schema | Task: Modify package.json to add comprehensive formatting configuration contributions following requirements 5.1-5.4, defining all user-configurable formatting options with appropriate defaults and descriptions | Restrictions: Must follow VS Code configuration schema exactly, provide clear setting descriptions, ensure backward compatibility | _Leverage: existing package.json configuration patterns, VS Code configuration contribution schema | _Requirements: Requirements 5.1-5.4 (all configuration requirements) | Success: All formatting options are properly exposed in VS Code settings UI, settings have clear descriptions and appropriate defaults, schema validation passes | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 13. Create comprehensive unit tests for formatting utilities
  - File: tests/formatting/FormattingUtils.test.ts
  - Test all utility functions with various input scenarios
  - Cover edge cases, malformed input, and boundary conditions
  - Purpose: Ensure reliability of core formatting utilities
  - _Leverage: existing test patterns and utilities from tests/ directory_
  - _Requirements: 6.1, 6.2, 6.3_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer with expertise in utility function testing and edge case coverage | Task: Create comprehensive unit tests for FormattingUtils.ts following requirements 6.1-6.3, covering all utility functions with various scenarios including malformed input and boundary conditions | Restrictions: Must test both success and failure scenarios, ensure test isolation, do not test external dependencies directly | _Leverage: existing test patterns from tests/ directory, Jest testing framework, test utilities | _Requirements: Requirements 6.1-6.3 (error handling and reliability) | Success: All utility functions thoroughly tested with good coverage, edge cases and error conditions properly tested, tests run reliably and independently | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 14. Create unit tests for all formatter components
  - File: tests/formatting/Formatters.test.ts
  - Test IndentationFormatter, SpacingFormatter, LPCSpecificFormatter, and BlockFormatter
  - Include tests for different configuration options and LPC syntax variants
  - Purpose: Validate all individual formatter components work correctly
  - _Leverage: existing test patterns, sample LPC code for testing_
  - _Requirements: 2.1-2.4, 3.1-3.5, 4.1-4.2_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer specializing in component testing and LPC language features | Task: Create comprehensive tests for all formatter components covering requirements 2.1-4.2, testing IndentationFormatter, SpacingFormatter, LPCSpecificFormatter, and BlockFormatter with various LPC code samples and configurations | Restrictions: Must test each formatter in isolation, use realistic LPC code samples, cover all configuration permutations | _Leverage: existing test patterns, sample LPC files from project, formatter component interfaces | _Requirements: Requirements 2.1-4.2 (all individual formatter requirements) | Success: All formatter components thoroughly tested individually, various LPC syntax patterns covered, configuration options properly tested | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 15. Create integration tests for complete formatting scenarios
  - File: tests/formatting/Integration.test.ts
  - Test end-to-end formatting with real LPC files and various configurations
  - Include performance tests and memory usage validation
  - Purpose: Validate complete formatting pipeline works correctly
  - _Leverage: sample LPC files, existing integration test patterns_
  - _Requirements: All requirements (integration validation)_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Integration Test Engineer with expertise in end-to-end testing and performance validation | Task: Create comprehensive integration tests covering all formatting requirements, testing complete pipeline with real LPC files, various configurations, and performance characteristics | Restrictions: Must test realistic LPC code samples, validate formatting idempotency, ensure tests are reliable and maintainable | _Leverage: sample LPC files from project or create representative samples, existing integration test patterns, performance testing utilities | _Requirements: All formatting requirements (complete integration validation) | Success: End-to-end formatting works correctly for all LPC constructs, performance meets requirements, formatting results are consistent and idempotent | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 16. Create VS Code extension integration tests
  - File: tests/extension/FormattingProviders.test.ts
  - Test VS Code provider integration with mock VS Code environment
  - Validate provider registration and command handling
  - Purpose: Ensure VS Code integration works correctly
  - _Leverage: existing extension tests, VS Code test utilities_
  - _Requirements: 1.1, 1.2, 1.3_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: VS Code Extension Test Engineer with expertise in provider testing and VS Code API mocking | Task: Create integration tests for VS Code formatting providers following requirements 1.1-1.3, testing provider registration, command handling, and VS Code editor integration | Restrictions: Must use proper VS Code testing patterns, mock VS Code environment appropriately, ensure tests work in CI environment | _Leverage: existing extension test patterns, VS Code test utilities, mock VS Code environment setup | _Requirements: Requirements 1.1-1.3 (VS Code integration requirements) | Success: All VS Code integration points properly tested, providers work correctly in mock environment, tests validate user interaction scenarios | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 17. Add formatting examples and documentation
  - File: docs/formatting.md
  - Create documentation with before/after formatting examples
  - Document all configuration options and their effects
  - Purpose: Provide user documentation for the formatting feature
  - _Leverage: existing documentation patterns from docs/ directory_
  - _Requirements: All requirements (user documentation)_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Technical Writer with expertise in developer documentation and code formatting examples | Task: Create comprehensive formatting documentation with before/after examples covering all formatting features and configuration options, following existing documentation patterns | Restrictions: Must use accurate LPC code examples, ensure documentation is clear and comprehensive, maintain consistency with existing docs | _Leverage: existing documentation structure and patterns, real LPC code examples for illustrations | _Requirements: All formatting requirements (comprehensive user documentation) | Success: Documentation is complete and accurate, provides clear examples of all formatting features, configuration options well explained with examples | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._

- [ ] 18. Performance optimization and finalization
  - Files: All formatting components (optimization pass)
  - Optimize AST traversal performance and memory usage
  - Add caching for repeated formatting operations
  - Finalize error handling and edge case coverage
  - Purpose: Ensure production-ready performance and reliability
  - _Leverage: existing performance optimization patterns, profiling tools_
  - _Requirements: Performance and reliability requirements_
  - _Prompt: Implement the task for spec lpc-code-formatter, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Performance Engineer with expertise in JavaScript/TypeScript optimization and memory management | Task: Optimize all formatting components for production use, implementing caching strategies, memory optimization, and final error handling improvements | Restrictions: Must maintain formatting accuracy, ensure optimizations don't break existing functionality, profile before and after optimization | _Leverage: existing performance patterns in codebase, profiling tools, caching strategies | _Requirements: Performance and reliability requirements from all sections | Success: Formatting performance meets or exceeds requirements, memory usage is optimized, all edge cases properly handled, production-ready quality achieved | Instructions: Mark this task as in-progress in tasks.md when starting, then mark as complete when finished._