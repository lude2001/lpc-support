import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';

let parser: Parser;
let LpcLanguage: Parser.Language;

// Helper function to check for syntax errors
function assertNoSyntaxErrors(tree: Parser.Tree) {
    assert.ok(!tree.rootNode.hasError(), `Syntax errors found: ${tree.rootNode.toString()}`);
    function findErrorNode(node: Parser.SyntaxNode) {
        if (node.type === 'ERROR' || node.isMissing()) {
            assert.fail(`Syntax error node found: Type: ${node.type}, Text: "${node.text}" at ${node.startPosition}-${node.endPosition}`);
        }
        for (const child of node.namedChildren) {
            findErrorNode(child);
        }
    }
    findErrorNode(tree.rootNode);
}


suite('LPC Grammar Tests', function () {
    this.timeout(5000); // Timeout for WASM loading

    suiteSetup(async () => {
        await Parser.init();
        parser = new Parser();

        const wasmPath = path.join(__dirname, '../../parser/tree-sitter-lpc.wasm');

        if (!fs.existsSync(wasmPath)) {
            console.error(`WASM file not found at: ${wasmPath}`);
            const altWasmPath = path.join(__dirname, '../../../../parser/tree-sitter-lpc.wasm');
            if (!fs.existsSync(altWasmPath)) {
                throw new Error(`LPC grammar WASM not found at ${wasmPath} or ${altWasmPath}. Adjust path in test setup.`);
            }
            LpcLanguage = await Parser.Language.load(altWasmPath);
        } else {
            LpcLanguage = await Parser.Language.load(wasmPath);
        }
        parser.setLanguage(LpcLanguage);
    });

    function parseAndGetRoot(code: string): Parser.SyntaxNode {
        const tree = parser.parse(code);
        assertNoSyntaxErrors(tree);
        return tree.rootNode;
    }

    test('for_statement - full', () => {
        const code = "void main() { for (int i = 0; i < 10; i++) { write(i); } }";
        const root = parseAndGetRoot(code);
        const forNode = root.descendantsOfType('for_statement')[0];
        assert.ok(forNode, "for_statement node not found");

        const initializer = forNode.childForFieldName('initializer');
        assert.ok(initializer, "initializer not found in for_statement");
        // Example check, specific type depends on grammar detail (_for_initializer -> seq -> variable_declaration)
        assert.ok(initializer.descendantsOfType('identifier').some(n => n.text === 'i'), "initializer variable 'i' not found");

        const condition = forNode.childForFieldName('condition');
        assert.ok(condition, "condition not found in for_statement");
        assert.strictEqual(condition.type, 'binary_expression', "Condition should be a binary_expression");

        const update = forNode.childForFieldName('update');
        assert.ok(update, "update not found in for_statement");
        assert.strictEqual(update.type, 'postfix_expression', "Update should be a postfix_expression");
    });

    test('for_statement - declaration, no condition/update', () => {
        const code = "void main() { for (int i = 0; ; ) {} }";
        const root = parseAndGetRoot(code);
        const forNode = root.descendantsOfType('for_statement')[0];
        assert.ok(forNode, "for_statement node not found");
        const initializer = forNode.childForFieldName('initializer');
        assert.ok(initializer, "initializer not found");
        // Check for the structure of the initializer: _for_initializer -> seq -> ... -> identifier
        assert.ok(initializer.descendantsOfType('identifier').some(id => id.text === 'i'), "variable 'i' in initializer not found");
        assert.strictEqual(forNode.childForFieldName('condition'), null, "condition should be null");
        assert.strictEqual(forNode.childForFieldName('update'), null, "update should be null");
    });

    test('foreach_statement - single variable', () => {
        const code = "void main() { foreach (item in items_array) { } }";
        const root = parseAndGetRoot(code);
        const foreachNode = root.descendantsOfType('foreach_statement')[0];
        assert.ok(foreachNode, "foreach_statement node not found");
        const variablesNode = foreachNode.childForFieldName('variables');
        assert.ok(variablesNode, "variables node not found");
        assert.strictEqual(variablesNode.childForFieldName('variable')?.text, "item");
        assert.strictEqual(foreachNode.childForFieldName('iterable')?.text, "items_array");
    });

    test('foreach_statement - key, value pair', () => {
        const code = "void main() { foreach (string key, mixed val in my_mapping) { } }";
        const root = parseAndGetRoot(code);
        const foreachNode = root.descendantsOfType('foreach_statement')[0];
        assert.ok(foreachNode, "foreach_statement node not found");
        const variablesNode = foreachNode.childForFieldName('variables');
        assert.ok(variablesNode, "variables node not found");
        const varIdentifiers = variablesNode.children.filter(c => c.type === 'identifier');
        assert.strictEqual(varIdentifiers.length, 2, "Expected two identifiers for key and value");
        assert.strictEqual(varIdentifiers[0].text, "key");
        assert.strictEqual(varIdentifiers[1].text, "val");
    });

    test('switch_statement - simple', () => {
        const code = "void main() { switch (x) { case 1: break; default: foo(); } }";
        const root = parseAndGetRoot(code);
        const switchNode = root.descendantsOfType('switch_statement')[0];
        assert.ok(switchNode, "switch_statement node not found");
        const caseClauses = switchNode.descendantsOfType('case_clause');
        assert.strictEqual(caseClauses.length, 2, "Expected 2 case_clauses");
        assert.ok(caseClauses.some(c => c.childForFieldName('value')?.text === '1'), "case 1 not found");
        assert.ok(caseClauses.some(c => c.text.startsWith('default')), "default case not found");
    });

    test('switch_statement - range case', () => {
        const code = "void main() { switch (y) { case 2..5: return; } }";
        const root = parseAndGetRoot(code);
        const switchNode = root.descendantsOfType('switch_statement')[0];
        assert.ok(switchNode, "switch_statement node not found");
        const caseClause = switchNode.descendantsOfType('case_clause')[0];
        assert.ok(caseClause, "case_clause not found");
        assert.strictEqual(caseClause.childForFieldName('value')?.text, "2", "Range start value incorrect");
        assert.strictEqual(caseClause.childForFieldName('upper_value')?.text, "5", "Range end value incorrect");
    });


    test('do_while_statement', () => {
        const code = "void main() { do { x++; } while (x < 10); }";
        const root = parseAndGetRoot(code);
        const doWhileNode = root.descendantsOfType('do_while_statement')[0];
        assert.ok(doWhileNode, "do_while_statement node not found");
        assert.ok(doWhileNode.childForFieldName('body')?.type.includes('statement'), "Body not found"); // Can be block_statement or other
        assert.strictEqual(doWhileNode.childForFieldName('condition')?.type, 'binary_expression', "Condition not a binary_expression");
    });

    test('unary_expression and postfix_expression', () => {
        const code = "void main() { int x, y, z, i, j; y = -x; z = !y; i++; ++j; }";
        const root = parseAndGetRoot(code);
        const unaryNodes = root.descendantsOfType('unary_expression');
        const postfixNodes = root.descendantsOfType('postfix_expression');

        assert.ok(unaryNodes.some(n => n.text === '-x'), "Unary minus -x not found");
        assert.ok(unaryNodes.some(n => n.text === '!y'), "Unary not !y not found");
        assert.ok(postfixNodes.some(n => n.text === 'i++'), "Postfix i++ not found");
        assert.ok(unaryNodes.some(n => n.text === '++j'), "Prefix ++j not found");
    });

    test('conditional_expression (ternary)', () => {
        const code = "void main() { int a,b,c; a = b > c ? b : c; }";
        const root = parseAndGetRoot(code);
        const condExprNode = root.descendantsOfType('conditional_expression')[0];
        assert.ok(condExprNode, "conditional_expression node not found");
        assert.ok(condExprNode.childForFieldName('condition'), "Condition field missing");
        assert.ok(condExprNode.childForFieldName('consequence'), "Consequence field missing");
        assert.ok(condExprNode.childForFieldName('alternative'), "Alternative field missing");
    });

    test('function_pointer_literal - identifier', () => {
        const code = "void main() { function f; f = (: my_func :); }";
        const root = parseAndGetRoot(code);
        const fpNode = root.descendantsOfType('function_pointer_literal')[0];
        assert.ok(fpNode, "function_pointer_literal node not found");
        assert.strictEqual(fpNode.childForFieldName('function_name')?.text, 'my_func');
    });

    test('function_pointer_literal - expression', () => {
        const code = "void main() { function g; g = (: $1 + $2 :); }";
        const root = parseAndGetRoot(code);
        const fpNode = root.descendantsOfType('function_pointer_literal')[0];
        assert.ok(fpNode, "function_pointer_literal node not found");
        assert.ok(fpNode.childForFieldName('code_block')?.type === 'binary_expression', "Code block expression not found");
    });

    test('heredoc_literal - string', () => {
        const code = "void main() { string str; str = @END\ncontent\nEND; }";
        const root = parseAndGetRoot(code);
        const heredocNode = root.descendantsOfType('string_heredoc')[0]; // Specific type
        assert.ok(heredocNode, "string_heredoc node not found");
        assert.strictEqual(heredocNode.childForFieldName('delimiter_name')?.text, "END", "Delimiter name incorrect");
        // Content check is tricky due to its broad token; focus on structure
        assert.ok(heredocNode.childForFieldName('content'), "Content node missing");
        assert.strictEqual(heredocNode.childForFieldName('end_delimiter_name')?.text, "END", "End delimiter name incorrect");
    });

    test('heredoc_literal - array', () => {
        const code = "void main() { string *arr; arr = @@DELIM\nline1\nDELIM; }";
        const root = parseAndGetRoot(code);
        const heredocNode = root.descendantsOfType('array_heredoc')[0]; // Specific type
        assert.ok(heredocNode, "array_heredoc node not found");
        assert.strictEqual(heredocNode.childForFieldName('delimiter_name')?.text, "DELIM", "Delimiter name incorrect");
        assert.ok(heredocNode.childForFieldName('content'), "Content node missing");
        assert.strictEqual(heredocNode.childForFieldName('end_delimiter_name')?.text, "DELIM", "End delimiter name incorrect");
    });

});
