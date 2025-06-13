import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';

// Helper to get the text of a node
function getNodeText(node: Parser.SyntaxNode, document: vscode.TextDocument): string {
    return document.getText(new vscode.Range(
        document.positionAt(node.startIndex),
        document.positionAt(node.endIndex)
    ));
}

function getRangeFromNode(document: vscode.TextDocument, node: Parser.SyntaxNode): vscode.Range {
    return new vscode.Range(document.positionAt(node.startIndex), document.positionAt(node.endIndex));
}

/**
 * Collects diagnostics for variable declarations that are not at the top of their block.
 * @param rootNode The root node of the AST to analyze.
 * @param document The text document being analyzed.
 * @param diagnostics An array to push new diagnostics into.
 */
export function collectVariableDefinitionOrderDiagnostics(
    rootNode: Parser.SyntaxNode,
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[],
    lpcLanguage: Parser.Language | undefined // Pass the loaded Language object
): void {
    if (!lpcLanguage) {
        console.warn("VariableOrderChecker: LpcLanguage not available, skipping check.");
        return;
    }

    // Query for block statements. This might need to be adjusted based on your grammar.js.
    // Common block containers: function_definition, if_statement, else_clause, while_statement, for_statement, do_statement
    // The direct child of these that is a 'block_statement' or '{ ... }' is what we need.
    // In the provided grammar.js, `block_statement` is the node type for `{ ... }`.
    const blockQueryString = `(block_statement) @block`;
    let blockQuery: Parser.Query;
    try {
        blockQuery = lpcLanguage.query(blockQueryString);
    } catch (e) {
        console.error("Error creating Tree-sitter query for blocks:", e);
        return;
    }

    const blockMatches = blockQuery.matches(rootNode);

    for (const match of blockMatches) {
        const blockNode = match.captures.find(c => c.name === 'block')?.node;
        if (!blockNode) continue;

        let foundNonDeclarationStatement = false;
        // Iterate over named children of the block statement
        for (const statementNode of blockNode.namedChildren) { // Use namedChildren to get actual statements
            if (statementNode.type === 'variable_declaration') {
                if (foundNonDeclarationStatement) {
                    // Try to get the name of the first variable declared in this statement for a better message
                    let firstVarName = "A variable";
                    // 尝试通过 Query 获取声明名
                    try {
                        const varDeclQueryString = `(variable_declaration (_variable_declarator name: (identifier) @var.name))`;
                        const varDeclQuery = lpcLanguage.query(varDeclQueryString);
                        const varCaptures = varDeclQuery.captures(statementNode);
                        const varNameNodeFromQuery = varCaptures.find(c => c.name === 'var.name')?.node;
                        if (varNameNodeFromQuery) {
                            firstVarName = getNodeText(varNameNodeFromQuery, document);
                        } else {
                            // 回退：找第一个 identifier
                            const idNodes = statementNode.descendantsOfType('identifier');
                            if (idNodes && idNodes.length > 0) {
                                firstVarName = getNodeText(idNodes[0], document);
                            }
                        }
                    } catch (e) {
                        // 如果 Query 失败，回退到简单遍历 identifier
                        const idNodes = statementNode.descendantsOfType('identifier');
                        if (idNodes && idNodes.length > 0) {
                            firstVarName = getNodeText(idNodes[0], document);
                        }
                    }

                    diagnostics.push(
                        new vscode.Diagnostic(
                            getRangeFromNode(document, statementNode),
                            `变量声明 '${firstVarName}' 不在块的顶部。LPC 要求所有局部变量声明在块内任何其他语句之前。`,
                            vscode.DiagnosticSeverity.Warning
                        )
                    );
                }
            } else if (
                statementNode.type !== 'comment' &&
                statementNode.type !== 'line_comment' &&
                statementNode.type !== 'block_comment' &&
                statementNode.type !== 'ERROR' &&
                !statementNode.type.startsWith('preproc_')
            ) {
                foundNonDeclarationStatement = true;
            }
        }
    }
}
