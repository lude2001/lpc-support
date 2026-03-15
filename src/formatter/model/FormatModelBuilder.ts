import { ParsedDocument } from '../../parser/types';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { FormatNode } from './formatNodes';

export class FormatModelBuilder {
    private readonly lineStartOffsets: number[];

    constructor(private readonly parsed: ParsedDocument) {
        this.lineStartOffsets = buildLineStartOffsets(parsed.text);
    }

    public build(): FormatNode {
        const syntax = new SyntaxBuilder(this.parsed).build();
        return this.toFormatNode(syntax.root);
    }

    public buildFromSyntaxNode(node: SyntaxNode): FormatNode {
        return this.toFormatNode(node);
    }

    private toFormatNode(node: SyntaxNode): FormatNode {
        return {
            kind: mapSyntaxKindToFormatKind(node.kind),
            syntaxKind: node.kind,
            text: this.readNodeText(node),
            children: node.children.map((child) => this.toFormatNode(child)),
            name: node.name,
            metadata: node.metadata,
            leadingTrivia: node.leadingTrivia.map((trivia) => trivia.text),
            trailingTrivia: node.trailingTrivia.map((trivia) => trivia.text)
        };
    }

    private readNodeText(node: SyntaxNode): string {
        const startOffset = this.offsetAt(node.range.start.line, node.range.start.character);
        const endOffset = this.offsetAt(node.range.end.line, node.range.end.character);
        return this.parsed.text.slice(startOffset, endOffset);
    }

    private offsetAt(line: number, character: number): number {
        const lineStart = this.lineStartOffsets[line] ?? this.parsed.text.length;
        return Math.min(lineStart + character, this.parsed.text.length);
    }
}

function mapSyntaxKindToFormatKind(kind: SyntaxKind): string {
    switch (kind) {
        case SyntaxKind.SourceFile:
            return 'file';
        case SyntaxKind.FunctionDeclaration:
            return 'function';
        case SyntaxKind.Block:
            return 'block';
        case SyntaxKind.IfStatement:
            return 'if';
        case SyntaxKind.ExpressionStatement:
            return 'statement';
        case SyntaxKind.ReturnStatement:
            return 'return';
        case SyntaxKind.AnonymousFunctionExpression:
            return 'anonymous-function';
        default:
            return kind;
    }
}

function buildLineStartOffsets(text: string): number[] {
    const offsets = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            offsets.push(index + 1);
        }
    }

    return offsets;
}
