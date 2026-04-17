import * as vscode from 'vscode';
import { CompletionQueryContext } from './types';

const TYPE_KEYWORDS = new Set(['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer', 'struct', 'class']);
const MODIFIERS = new Set(['private', 'protected', 'public', 'static', 'nomask', 'varargs']);
const NON_CALL_PAREN_KEYWORDS = new Set(['return', 'if', 'while', 'for', 'switch', 'catch']);

interface ReceiverContext {
    receiverChain: string[];
    receiverExpression?: string;
}

interface ScopedContext {
    currentWord: string;
    receiverExpression: string;
}

export class CompletionContextAnalyzer {
    public analyze(document: vscode.TextDocument, position: vscode.Position): CompletionQueryContext {
        const lineText = document.lineAt(position).text;
        const linePrefix = lineText.slice(0, position.character);
        const documentPrefix = this.extractDocumentPrefix(document, position);
        const trimmedPrefix = linePrefix.trimLeft();
        const currentWord = this.extractCurrentWord(linePrefix);

        if (this.isIncludePathContext(trimmedPrefix)) {
            return {
                kind: 'include-path',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        if (this.isInheritPathContext(trimmedPrefix)) {
            return {
                kind: 'inherit-path',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        const scopedContext = this.extractScopedContext(linePrefix, documentPrefix);
        if (scopedContext) {
            return {
                kind: 'scoped-member',
                receiverChain: [],
                receiverExpression: scopedContext.receiverExpression,
                currentWord: scopedContext.currentWord,
                linePrefix
            };
        }

        const receiverContext = this.extractReceiverContext(linePrefix);
        if (receiverContext.receiverChain.length > 0 || receiverContext.receiverExpression) {
            return {
                kind: 'member',
                receiverChain: receiverContext.receiverChain,
                receiverExpression: receiverContext.receiverExpression,
                currentWord,
                linePrefix
            };
        }

        if (this.isPreprocessorContext(trimmedPrefix)) {
            return {
                kind: 'preprocessor',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        if (this.isTypePositionContext(linePrefix)) {
            return {
                kind: 'type-position',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        return {
            kind: 'identifier',
            receiverChain: [],
            currentWord,
            linePrefix
        };
    }

    private extractCurrentWord(linePrefix: string): string {
        const match = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
        return match ? match[1] : '';
    }

    private extractDocumentPrefix(document: vscode.TextDocument, position: vscode.Position): string {
        const lines: string[] = [];
        for (let line = 0; line < position.line; line += 1) {
            lines.push(document.lineAt(line).text);
        }

        lines.push(document.lineAt(position).text.slice(0, position.character));
        return lines.join('\n');
    }

    private extractScopedContext(linePrefix: string, documentPrefix: string): ScopedContext | undefined {
        const bareMatch = linePrefix.match(/(?:^|[\s([{\],;:=])::([A-Za-z_][A-Za-z0-9_]*)$/);
        if (bareMatch) {
            const scopedStart = bareMatch.index! + bareMatch[0].lastIndexOf('::');
            if (this.isInsideCallArguments(this.extractPrefixBeforeScoped(documentPrefix, linePrefix, scopedStart))) {
                return undefined;
            }

            return {
                currentWord: bareMatch[1],
                receiverExpression: '::'
            };
        }

        const namedMatch = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*)::([A-Za-z_][A-Za-z0-9_]*)$/);
        if (namedMatch) {
            const scopedStart = namedMatch.index!;
            if (this.isInsideCallArguments(this.extractPrefixBeforeScoped(documentPrefix, linePrefix, scopedStart))) {
                return undefined;
            }

            return {
                currentWord: namedMatch[2],
                receiverExpression: `${namedMatch[1]}::`
            };
        }

        return undefined;
    }

    private extractPrefixBeforeScoped(documentPrefix: string, linePrefix: string, scopedStart: number): string {
        const scopedSuffixLength = linePrefix.length - scopedStart;
        return documentPrefix.slice(0, documentPrefix.length - scopedSuffixLength);
    }

    private isInsideCallArguments(prefixBeforeScoped: string): boolean {
        for (const unmatchedParenIndex of this.findUnmatchedParenIndices(prefixBeforeScoped)) {
            if (this.isCallArgumentParen(prefixBeforeScoped, unmatchedParenIndex)) {
                return true;
            }
        }

        return false;
    }

    private isCallArgumentParen(text: string, openParenIndex: number): boolean {
        const beforeParen = text.slice(0, openParenIndex).trimEnd();
        if (!beforeParen) {
            return false;
        }

        const previousCharacter = beforeParen[beforeParen.length - 1];
        if (!/[A-Za-z0-9_\])}]/.test(previousCharacter)) {
            return false;
        }

        const tokenMatch = beforeParen.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
        if (!tokenMatch) {
            return true;
        }

        return !NON_CALL_PAREN_KEYWORDS.has(tokenMatch[1]);
    }

    private findUnmatchedParenIndices(text: string): number[] {
        const stack: number[] = [];
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            if (escaped) {
                escaped = false;
                continue;
            }

            if (character === '\\') {
                escaped = true;
                continue;
            }

            if (character === '\'' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
                continue;
            }

            if (character === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }

            if (inSingleQuote || inDoubleQuote) {
                continue;
            }

            if (character === '(') {
                stack.push(index);
                continue;
            }

            if (character === ')' && stack.length > 0) {
                stack.pop();
            }
        }

        return stack;
    }

    private extractReceiverContext(linePrefix: string): ReceiverContext {
        const match = linePrefix.match(/(.+)\s*->\s*[A-Za-z0-9_]*$/);
        if (!match) {
            return { receiverChain: [] };
        }

        const receiverExpression = match[1].trim();
        if (!receiverExpression) {
            return { receiverChain: [] };
        }

        if (/^[A-Za-z_][A-Za-z0-9_]*(?:\s*->\s*[A-Za-z_][A-Za-z0-9_]*)*$/.test(receiverExpression)) {
            return {
                receiverChain: receiverExpression.split('->').map(part => part.trim()).filter(Boolean)
            };
        }

        return {
            receiverChain: [],
            receiverExpression
        };
    }

    private isPreprocessorContext(trimmedPrefix: string): boolean {
        return /^#/.test(trimmedPrefix);
    }

    private isInheritPathContext(trimmedPrefix: string): boolean {
        return /^inherit\s+/.test(trimmedPrefix);
    }

    private isIncludePathContext(trimmedPrefix: string): boolean {
        return /^(#\s*)?include\s+/.test(trimmedPrefix);
    }

    private isTypePositionContext(linePrefix: string): boolean {
        const trimmed = linePrefix.trim();
        if (!trimmed || /[;=(),>#]/.test(trimmed)) {
            return false;
        }

        const tokens = trimmed.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            return false;
        }

        let index = 0;
        while (index < tokens.length && MODIFIERS.has(tokens[index])) {
            index += 1;
        }

        if (index >= tokens.length) {
            return false;
        }

        const token = tokens[index];
        if (TYPE_KEYWORDS.has(token)) {
            return true;
        }

        return token === 'class' || token === 'struct';
    }
}
