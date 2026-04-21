import { SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { literalValue, unknownValue } from '../valueFactories';

export function getMetadataText(node: SyntaxNode): string | undefined {
    const text = node.metadata?.text;
    return typeof text === 'string' ? text : undefined;
}

export function evaluateLpcLiteralNode(node: SyntaxNode): SemanticValue {
    const text = getMetadataText(node);
    if (!text) {
        return unknownValue();
    }

    if (text.startsWith('"') && text.endsWith('"')) {
        return literalValue(text.slice(1, -1));
    }

    if (text.startsWith("'") && text.endsWith("'")) {
        return literalValue(text.slice(1, -1));
    }

    if (text === 'true' || text === 'false') {
        return literalValue(text === 'true', 'boolean');
    }

    if (/^-?\d+$/.test(text)) {
        return literalValue(Number.parseInt(text, 10), 'int');
    }

    if (/^-?\d+\.\d+$/.test(text)) {
        return literalValue(Number.parseFloat(text), 'float');
    }

    return unknownValue();
}
