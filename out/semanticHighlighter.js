"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCSemanticTokensProvider = exports.legend = void 0;
const vscode = require("vscode");
const Parser = require("web-tree-sitter"); // Assuming web-tree-sitter is available
// Forward declaration for Tree-sitter Language object (assuming it's loaded elsewhere)
// In a real VS Code extension, the Language object would be properly initialized.
let LpcLanguage = undefined;
// Placeholder for initializing the parser and language.
// This would typically be done in the extension's activate function.
// For this subtask, we'll assume `LpcLanguage` is initialized before use.
async function getParser() {
    if (!LpcLanguage) {
        // In a real extension, you would load the wasm file for the LPC grammar
        // await Parser.init();
        // const lpcGrammarPath = 'path/to/tree-sitter-lpc.wasm';
        // LpcLanguage = await Parser.Language.load(lpcGrammarPath);
        console.warn('LPC Language not initialized. Semantic highlighting will be limited.');
        return undefined;
    }
    const parser = new Parser();
    parser.setLanguage(LpcLanguage);
    return parser;
}
// 2. Define Tree-sitter Queries
const lpcHighlightingQueries = {
    // Keywords
    keywords: `
      (return_statement "return" @keyword.control)
      (if_statement "if" @keyword.control)
      (else_clause "else" @keyword.control)
      (while_statement "while" @keyword.control)
      ((_type_identifier) @keyword.type)
      ((type_modifiers) @keyword.modifier) ; static, private, etc.
      ("inherit" @keyword.control)
    `,
    // Identifiers (general, and specific uses)
    identifiers: `
      (identifier) @variable ; Default to variable, specific uses below
      (function_definition name: (identifier) @function.definition)
      (parameter_declaration name: (identifier) @parameter)
      (_variable_declarator name: (identifier) @variable.declaration)
      (call_expression function: (identifier) @function.call)
      (member_access_expression member: (identifier) @property) ; Style 'member' as a property
      (call_expression ; For obj->func() calls
        function: (member_access_expression
          member: (identifier) @function.call))
    `,
    // Literals
    literals: `
      (string_literal) @string
      (number_literal) @number
      (char_literal) @character ; if char_literal is distinct from number_literal in grammar
      (heredoc_literal "@" @string.special)
      (heredoc_literal start_delimiter: (identifier) @string.special)
      (heredoc_literal end_delimiter: (identifier) @string.special)
      (heredoc_line) @string ; Captures content lines of heredocs
    `,
    // Comments
    comments: `
      (line_comment) @comment
      (block_comment) @comment
    `,
    // Types
    types: `
      (parameter_declaration type: (_type) @type)
      (variable_declaration type: (_type) @type)
      (function_definition return_type: (_type) @type.return)
      ; Specific type identifiers if needed, but (_type_identifier) handled by keywords query
      ((_type_identifier) @type.builtin) ; e.g. int, string
      (array_type element_type: (_type) @type)
      (array_type "*" @operator) ; The '*' in array types
    `,
    // Preprocessor / Macros
    macros: `
      (preproc_define name: (identifier) @macro.definition)
      (preproc_include path: (_) @string.special) ; path in include
      ((preprocessor_directive) @macro) ; #define, #include itself
    `,
    // Operators
    operators: `
      (binary_expression operator: [
        "||" "&&" "|" "^" "&" "==" "!="
        "<" "<=" ">" ">=" "<<" ">>"
        "+" "-" "*" "/" "%"
      ] @operator)
      (assignment_expression operator: [
        "=" "+=" "-=" "*=" "/=" "%="
        "<<=" ">>=" "&=" "|=" "^="
      ] @operator)
      (member_access_expression "->" @operator)
      ; The '*' in array_type is already captured in the 'types' query if needed
    `,
    // Punctuation (optional, but can be useful)
    punctuation: `
      (";" @punctuation.delimiter)
      ("," @punctuation.delimiter)
      ("(" @punctuation.bracket)
      (")" @punctuation.bracket)
      ("{" @punctuation.bracket)
      ("}" @punctuation.bracket)
      ("([" @punctuation.bracket) ; for mapping literals
      ("])" @punctuation.bracket)
      ("({" @punctuation.bracket) ; for array literals
      ("})" @punctuation.bracket)
      (subscript_expression "[" @punctuation.bracket)
      (subscript_expression "]" @punctuation.bracket)
    `
};
// Combine all queries into one string for simplicity in this example
const combinedQueries = Object.values(lpcHighlightingQueries).join('\n');
// 3. Define Semantic Token Legend and Mapping
// Standard token types and modifiers recognized by VS Code.
const tokenTypes = [
    'comment', // For comments
    'string', // For string literals
    'keyword', // For language keywords (if, else, int, void)
    'number', // For number literals
    'type', // For type names (int, string, custom types)
    'class', // For class names
    'interface', // For interface names
    'struct', // For struct names
    'typeParameter', // For type parameters
    'function', // For function names
    'method', // For method names
    'macro', // For macro names
    'variable', // For variable names
    'parameter', // For parameter names
    'property', // For property names
    'label', // For labels
    'operator', // For operators (+, -, =)
    'modifier', // For modifiers (static, private)
    'event', // For events
    // Custom or more specific types if needed (ensure VS Code theme support)
    'string.special', // For include paths or special strings
    'punctuation' // For delimiters, brackets
];
const tokenModifiers = [
    'declaration', // For declarations of symbols
    'definition', // For definitions of symbols
    'readonly', // For readonly variables
    'static', // For static members
    'deprecated', // For deprecated symbols
    'abstract', // For abstract symbols
    'async', // For async functions
    'modification', // For modified data
    'documentation', // For documentation comments
    'defaultLibrary', // For symbols from a default library
];
exports.legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
// Mapping from Tree-sitter query capture names to legend token type indices and modifiers
// Note: Modifiers are optional.
const captureNameToTokenType = {
    '@comment': { type: 'comment' },
    '@string': { type: 'string' },
    '@string.special': { type: 'string.special' }, // e.g. include paths
    '@keyword': { type: 'keyword' },
    '@keyword.control': { type: 'keyword' }, // Could be more specific if theme supports 'controlKeyword'
    '@keyword.type': { type: 'keyword' }, // 'int', 'void' are keywords but also types
    '@keyword.modifier': { type: 'modifier' },
    '@number': { type: 'number' },
    '@character': { type: 'number' }, // Often styled like numbers
    '@type': { type: 'type' },
    '@type.builtin': { type: 'type' }, // Could also be 'keyword' or a custom 'builtinType'
    '@type.return': { type: 'type' },
    '@type.definition': { type: 'type', modifiers: ['declaration', 'definition'] },
    '@function': { type: 'function' },
    '@function.definition': { type: 'function', modifiers: ['declaration', 'definition'] },
    '@function.call': { type: 'function' },
    '@macro': { type: 'macro' },
    '@macro.definition': { type: 'macro', modifiers: ['declaration', 'definition'] },
    '@variable': { type: 'variable' },
    '@variable.declaration': { type: 'variable', modifiers: ['declaration'] },
    '@parameter': { type: 'parameter', modifiers: ['declaration'] },
    '@operator': { type: 'operator' },
    '@punctuation.delimiter': { type: 'punctuation' },
    '@punctuation.bracket': { type: 'punctuation' },
    '@property': { type: 'method' }, // Members accessed via -> are often methods
    // Fallback for general identifiers if not more specifically caught
    '@identifier': { type: 'variable' },
};
class LPCSemanticTokensProvider {
    constructor() {
        // In a real scenario, the parser would be more robustly initialized and passed.
        // For now, we attempt to initialize it here or use a global one.
        getParser().then(p => this.parser = p).catch(err => console.error("LPC Parser init failed:", err));
    }
    async provideDocumentSemanticTokens(document, token) {
        const builder = new vscode.SemanticTokensBuilder(exports.legend);
        if (!this.parser) {
            console.warn("LPC Parser not available for semantic highlighting.");
            // Optionally, provide very basic regex-based highlighting as a fallback here.
            return builder.build();
        }
        const text = document.getText();
        let tree;
        try {
            tree = this.parser.parse(text);
        }
        catch (e) {
            console.error("Error parsing document for semantic tokens:", e);
            return builder.build(); // Return empty on parse error
        }
        // Create a query object. In a real extension, you might compile the query once.
        let query;
        try {
            if (!LpcLanguage) { // Guard again
                console.warn("LPC Language object not available for query.");
                return builder.build();
            }
            query = LpcLanguage.query(combinedQueries);
        }
        catch (e) {
            console.error("Error creating Tree-sitter query:", e);
            return builder.build();
        }
        const matches = query.matches(tree.rootNode);
        for (const match of matches) {
            if (token.isCancellationRequested) {
                console.log("Semantic tokenization cancelled.");
                return builder.build();
            }
            for (const capture of match.captures) {
                const captureName = capture.name; // e.g., "@keyword", "@function.definition"
                const node = capture.node;
                const tokenTypeInfo = captureNameToTokenType[captureName];
                if (tokenTypeInfo) {
                    const tokenTypeIndex = exports.legend.tokenTypes.indexOf(tokenTypeInfo.type);
                    if (tokenTypeIndex !== -1) {
                        let tokenModifiersMask = 0;
                        if (tokenTypeInfo.modifiers) {
                            for (const modifier of tokenTypeInfo.modifiers) {
                                const modifierIndex = exports.legend.tokenModifiers.indexOf(modifier);
                                if (modifierIndex !== -1) {
                                    tokenModifiersMask |= (1 << modifierIndex);
                                }
                            }
                        }
                        // Add token: VS Code expects multi-line tokens to be broken down.
                        // Tree-sitter nodes have startPosition and endPosition.
                        // For simplicity, we'll handle single-line tokens here.
                        // A robust implementation needs to iterate over lines for multi-line tokens.
                        builder.push(node.startPosition.row, node.startPosition.column, node.endPosition.column - node.startPosition.column, // Length on the line
                        tokenTypeIndex, tokenModifiersMask);
                    }
                }
            }
        }
        return builder.build();
    }
    // Optional: provideDocumentSemanticTokensEdits for incremental updates
    // async provideDocumentSemanticTokensEdits?(document: vscode.TextDocument, previousResultId: string, edits: readonly vscode.TextEdit[], token: vscode.CancellationToken): Promise<vscode.SemanticTokens | vscode.SemanticTokensEdits> {
    //     // Requires more complex tree update logic
    //     return this.provideDocumentSemanticTokens(document, token); // Fallback to full reparse
    // }
    // Helper to set the language (e.g., after it's loaded in extension.ts)
    static setLanguage(lang) {
        LpcLanguage = lang;
        console.log("LPC Language set for Semantic Highlighter.");
    }
}
exports.LPCSemanticTokensProvider = LPCSemanticTokensProvider;
//# sourceMappingURL=semanticHighlighter.js.map