# Test Plan: Core Subset of LPC Tree-sitter Grammar

## 1. Objectives of Testing

*   **Verify AST Correctness:** Ensure that valid LPC code (within the implemented core subset) produces the expected Abstract Syntax Tree (AST) structure. This includes checking node types, field names, and nesting.
*   **Keyword Recognition:** Confirm that LPC keywords (e.g., `if`, `while`, `int`, `string`) are correctly identified as such and not as generic identifiers in their respective contexts.
*   **Operator Precedence & Associativity:** For the implemented arithmetic operators (`+`, `-`, `*`, `/`, `%`) and assignment (`=`), verify that their precedence and associativity are correctly handled in expressions.
*   **Basic Error Handling:** Observe how the parser handles simple syntactic errors within the core subset. While robust error recovery is a larger goal, the parser should ideally not crash and should mark erroneous regions (e.g., with an `ERROR` node).
*   **Boundary Conditions:** Test with empty files, files with only comments, and constructs at their simplest (e.g., empty blocks, functions with no arguments).
*   **Modifier Recognition:** Ensure type modifiers (`static`, `private`, `nosave`, etc.) are correctly parsed where applicable.

## 2. Testing Tools/Methods (Conceptual)

*   **`tree-sitter parse <file.lpc>`:** This command-line tool will be used to generate and visually inspect the AST for individual LPC code snippets saved in `.lpc` files. This is useful for initial manual verification and debugging of the grammar.
*   **`tree-sitter test`:** This is the primary method for automated testing. It involves creating test files (typically `.txt` or specific test suite files) containing LPC code snippets annotated with the expected S-expression (AST) output.
    *   **Inline S-expressions:** Tests will be written directly in test files, like:
        ```
        ==================
        Test Case Name
        ==================
        int i = 10;
        ---
        (source_file
          (variable_declaration
            (type (primitive_type))
            (_variable_declarator
              (identifier)
              (initializer (number_literal)))
            (.)))
        ```
    *   **Error Tests:** `tree-sitter test` can also be used to verify that specific syntax errors produce `ERROR` nodes in the AST, for example:
        ```
        ==================
        Test Missing Semicolon
        ==================
        int i = 10
        ---
        (source_file
          (variable_declaration
            (type (primitive_type))
            (_variable_declarator
              (identifier)
              (initializer (number_literal)))
            (ERROR))) // Expecting an error node
        ```
*   **Visual Studio Code with Tree-sitter Extension:** For interactive exploration of the grammar's parsing behavior on larger examples and for easier visualization of syntax highlighting (which is derived from the grammar).

## 3. Test Case Categories

Below are categories of LPC code snippets. For each, 1-2 small examples are provided.

### 3.1. Comments

*   **Objective:** Verify comments are correctly identified and typically excluded from the main AST (or placed in `extras`).
*   **Examples:**
    1.  Line Comment: `// This is a line comment`
    2.  Block Comment: `/* This is a block comment \n with multiple lines */`
    3.  Mixed: `int i; // Var i \n /* Block */ int j;`

### 3.2. Preprocessor Directives

*   **Objective:** Check parsing of `#include` and simple `#define`.
*   **Examples:**
    1.  Include System: `#include <std.h>`
    2.  Include Local: `#include "local.c"`
    3.  Define Simple: `#define MAX_USERS 10`
    4.  Define With Value: `#define GREETING "Hello"`
    5.  Define Macro Function (simple): `#define ADD(a,b) a+b`

### 3.3. Type Declarations and Variable Declarations

*   **Objective:** Verify parsing of various types, modifiers, initializers, and basic array declarations.
*   **Examples:**
    1.  Simple Int: `int i;`
    2.  String with Init: `string s = "test";`
    3.  Mixed Array: `mixed *arr;`
    4.  With Modifier: `static nosave int count = 0;`
    5.  Multiple Declarators: `float x, y = 1.0, z;` (Note: float literal parsing might be basic in core subset)

### 3.4. Function Definitions

*   **Objective:** Test function structure, parameters, and body.
*   **Examples:**
    1.  No Args, Empty Body: `void do_nothing() {}`
    2.  Multiple Args, Simple Body: `int add(int a, string b) { return a; }`
    3.  Void Return with Modifier: `public static void setup_npc() { /* ... */ }`
    4.  Function with local var: `void test() { int x = 5; }`

### 3.5. Statements

*   **Objective:** Verify core control flow and simple statements.
*   **Examples:**
    1.  Expression Statement (Func Call): `my_function_call();`
    2.  If Statement: `if (x > 0) y = 1;`
    3.  If/Else Statement: `if (name == "foo") tell_object(this_player(), "Hi"); else tell_object(this_player(), "Bye");`
    4.  While Loop: `while (i < 10) { i = i + 1; }`
    5.  Return Statement: `return 100;`
    6.  Return Void: `return;`

### 3.6. Expressions

*   **Objective:** Test parsing of literals, basic arithmetic, assignment, function calls, and parenthesizing.
*   **Examples:**
    1.  Integer Literals: `a = 123; b = 0xFF; c = 0b101; d = 'x';`
    2.  String Literal: `s = "hello\\nworld";`
    3.  Arithmetic: `c = a + b * 2; d = (a + b) * 2; e = a % 5;`
    4.  Assignment: `x = y;`
    5.  Function Call: `val = get_value(arg1, "two");`
    6.  Parenthesized: `z = (x + (y - 1));`
    7.  Simple Array Literal: `arr = ({ 1, "two", 3 });`
    8.  Simple Mapping Literal: `map = ([ "key1": val1, "key2": 100 ]);`
    9.  Empty Mapping Literal: `map = ([]);`

### 3.7. Combinations of Constructs

*   **Objective:** Ensure that different grammar rules compose correctly.
*   **Examples:**
    1.  Function with Locals and Control Flow:
        ```lpc
        int process_data(mixed *data) {
            int i = 0;
            if (sizeof(data) > 0) {
                while (i < sizeof(data)) {
                    do_something(data[i]); // Assuming index_expression is not fully in core, this is a simple call
                    i = i + 1;
                }
                return 1;
            } else {
                return 0;
            }
        }
        ```
    2.  Preprocessor within function (behavior might be platform-dependent, but test parsing):
        ```lpc
        void example() {
            #define LOCAL_MACRO 10
            int x = LOCAL_MACRO;
        }
        ```

### 3.8. Basic Negative Tests

*   **Objective:** Observe parser behavior with simple syntax errors; expect `ERROR` nodes.
*   **Examples:**
    1.  Missing Semicolon: `int i = 10`
    2.  Mismatched Bracket: `void func() { int x = 5;`
    3.  Incomplete If: `if (x > 0`
    4.  Invalid Define: `#define NO VALUE` (space in name)

## 4. Expected Outcomes/Success Criteria

*   **AST Matching:** For valid code snippets, the generated AST (S-expression) must exactly match the manually verified and defined expected S-expression in the test files.
*   **No Crashes:** The parser should not crash or hang on any of the test inputs, including those with syntax errors.
*   **Error Node Generation:** For negative test cases, the parser should produce an AST containing `ERROR` nodes at or near the point of the syntax error. The rest of the AST should be as correct as possible up to the error.
*   **Keyword Integrity:** Keywords should be parsed as their specific token types (e.g., `'if'`, `'int'`) and not as generic `identifier` nodes in contexts where they are keywords.
*   **Operator Precedence:** Expressions involving multiple implemented operators should resolve to an AST structure that reflects the correct operator precedence (e.g., `a + b * c` should show `*` as a child of `+`'s right operand, or structured according to precedence rules).
*   **Completeness for Subset:** All grammar rules defined in the core `grammar.js` should have at least one test case covering their basic usage.

This test plan provides a structured approach to verifying the correctness and robustness of the core LPC Tree-sitter grammar. Execution of these tests will provide confidence in the grammar's ability to parse the defined subset of the LPC language.
```
