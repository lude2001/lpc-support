import type { AttachedDocComment } from '../language/documentation/types';
import { ParsedDocument } from '../parser/types';
import {
    SyntaxNode as BaseSyntaxNode,
    getTokenRangeKey,
    SourceFileSyntaxNode as BaseSourceFileSyntaxNode
} from './syntaxNode';
import { SyntaxTrivia } from './trivia';

export interface SyntaxDocumentMetadata {
    createdAt: number;
    nodeCount: number;
    opaqueNodeCount: number;
    missingNodeCount: number;
}

export interface SyntaxNode extends BaseSyntaxNode {
    attachedDocComment?: AttachedDocComment;
}

export type SourceFileSyntaxNode = BaseSourceFileSyntaxNode;

export interface SyntaxDocument {
    uri: string;
    version: number;
    parsed: ParsedDocument;
    root: SourceFileSyntaxNode;
    nodes: readonly SyntaxNode[];
    nodesByTokenRange: Map<string, SyntaxNode>;
    metadata: SyntaxDocumentMetadata;
}

export interface CreateSyntaxDocumentOptions {
    parsed: ParsedDocument;
    root: SourceFileSyntaxNode;
    nodes?: readonly SyntaxNode[];
    createdAt?: number;
}

export function createSyntaxDocument(options: CreateSyntaxDocumentOptions): SyntaxDocument {
    const nodes = options.nodes ?? flattenSyntaxTree(options.root);
    const nodesByTokenRange = new Map<string, SyntaxNode>();

    for (const node of nodes) {
        nodesByTokenRange.set(getTokenRangeKey(node.tokenRange), node);
    }

    return {
        uri: options.parsed.uri,
        version: options.parsed.version,
        parsed: options.parsed,
        root: options.root,
        nodes,
        nodesByTokenRange,
        metadata: {
            createdAt: options.createdAt ?? Date.now(),
            nodeCount: nodes.length,
            opaqueNodeCount: nodes.filter((node) => node.isOpaque).length,
            missingNodeCount: nodes.filter((node) => node.isMissing).length
        }
    };
}

export function flattenSyntaxTree(root: SyntaxNode): SyntaxNode[] {
    const nodes: SyntaxNode[] = [];
    const queue: SyntaxNode[] = [root];

    while (queue.length > 0) {
        const current = queue.shift()!;
        nodes.push(current);
        queue.push(...current.children);
    }

    return nodes;
}

export function collectSyntaxTrivia(nodes: readonly SyntaxNode[]): SyntaxTrivia[] {
    return nodes.flatMap((node) => [...node.leadingTrivia, ...node.trailingTrivia]);
}

export {
    createSyntaxNode,
    createTokenRange,
    getTokenRangeKey,
    inferSyntaxNodeCategory,
    isSourceFileSyntaxNode,
    SyntaxKind
} from './syntaxNode';

export {
    createSyntaxTrivia,
    createSyntaxTriviaList,
    syntaxTriviaFromParsedTrivia
} from './trivia';

export type {
    SyntaxNodeCategory,
    TokenRange
} from './syntaxNode';

export type {
    SyntaxTrivia,
    SyntaxTriviaKind,
    SyntaxTriviaList,
    SyntaxTriviaPlacement
} from './trivia';
