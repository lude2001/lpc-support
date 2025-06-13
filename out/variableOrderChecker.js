"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectVariableDefinitionOrderDiagnostics = collectVariableDefinitionOrderDiagnostics;
const vscode = __importStar(require("vscode"));
// Helper to get the text of a node
function getNodeText(node, document) {
    return document.getText(new vscode.Range(document.positionAt(node.startIndex), document.positionAt(node.endIndex)));
}
function getRangeFromNode(document, node) {
    return new vscode.Range(document.positionAt(node.startIndex), document.positionAt(node.endIndex));
}
/**
 * Collects diagnostics for variable declarations that are not at the top of their block.
 * @param rootNode The root node of the AST to analyze.
 * @param document The text document being analyzed.
 * @param diagnostics An array to push new diagnostics into.
 */
function collectVariableDefinitionOrderDiagnostics(rootNode, document, diagnostics, lpcLanguage // Pass the loaded Language object
) {
    if (!lpcLanguage) {
        console.warn("VariableOrderChecker: LpcLanguage not available, skipping check.");
        return;
    }
    // Query for block statements. This might need to be adjusted based on your grammar.js.
    // Common block containers: function_definition, if_statement, else_clause, while_statement, for_statement, do_statement
    // The direct child of these that is a 'block_statement' or '{ ... }' is what we need.
    // In the provided grammar.js, `block_statement` is the node type for `{ ... }`.
    const blockQueryString = `(block_statement) @block`;
    let blockQuery;
    try {
        blockQuery = lpcLanguage.query(blockQueryString);
    }
    catch (e) {
        console.error("Error creating Tree-sitter query for blocks:", e);
        return;
    }
    // 新增：变量声明查询，用于检测未使用的变量
    const varDeclQueryString = `(variable_declaration (_variable_declarator name: (identifier) @var.name))`;
    let varDeclQuery;
    try {
        varDeclQuery = lpcLanguage.query(varDeclQueryString);
    }
    catch (e) {
        console.error("Error creating Tree-sitter query for variable declarations:", e);
    }
    const blockMatches = blockQuery.matches(rootNode);
    for (const match of blockMatches) {
        const blockNode = match.captures.find(c => c.name === 'block')?.node;
        if (!blockNode)
            continue;
        let foundNonDeclarationStatement = false;
        const statements = blockNode.namedChildren; // 块内的所有语句节点
        for (let idx = 0; idx < statements.length; idx++) {
            const statementNode = statements[idx];
            if (statementNode.type === 'variable_declaration') {
                // 变量声明顺序检查
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
                        }
                        else {
                            // 回退：找第一个 identifier
                            const idNodes = statementNode.descendantsOfType('identifier');
                            if (idNodes && idNodes.length > 0) {
                                firstVarName = getNodeText(idNodes[0], document);
                            }
                        }
                    }
                    catch (e) {
                        // 如果 Query 失败，回退到简单遍历 identifier
                        const idNodes = statementNode.descendantsOfType('identifier');
                        if (idNodes && idNodes.length > 0) {
                            firstVarName = getNodeText(idNodes[0], document);
                        }
                    }
                    diagnostics.push(new vscode.Diagnostic(getRangeFromNode(document, statementNode), `变量声明 '${firstVarName}' 不在块的顶部。LPC 要求所有局部变量声明在块内任何其他语句之前。`, vscode.DiagnosticSeverity.Warning));
                }
                // 新增：检查变量未使用
                if (varDeclQuery) {
                    const varCaptures = varDeclQuery.captures(statementNode).filter(c => c.name === 'var.name');
                    for (const cap of varCaptures) {
                        const varNode = cap.node;
                        const varName = getNodeText(varNode, document);
                        // 在后续语句中查找同名 identifier
                        let used = false;
                        for (let j = idx + 1; j < statements.length; j++) {
                            const sibling = statements[j];
                            const idNodes = sibling.descendantsOfType('identifier');
                            for (const idNode of idNodes) {
                                if (getNodeText(idNode, document) === varName) {
                                    used = true;
                                    break;
                                }
                            }
                            if (used)
                                break;
                        }
                        if (!used) {
                            diagnostics.push(new vscode.Diagnostic(getRangeFromNode(document, varNode), `变量 '${varName}' 已定义，但未被使用。`, vscode.DiagnosticSeverity.Warning));
                        }
                    }
                }
            }
            else if (statementNode.type !== 'comment' &&
                statementNode.type !== 'line_comment' &&
                statementNode.type !== 'block_comment' &&
                statementNode.type !== 'ERROR' &&
                !statementNode.type.startsWith('preproc_')) {
                foundNonDeclarationStatement = true;
            }
        }
    }
}
//# sourceMappingURL=variableOrderChecker.js.map