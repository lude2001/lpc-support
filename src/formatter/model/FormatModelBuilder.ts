import { ParsedDocument } from '../../parser/types';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { FormatNode } from './formatNodes';

export class FormatModelBuilder {
    private readonly parseLineStartOffsets: number[];
    private readonly originalLineStartOffsets: number[];

    constructor(private readonly parsed: ParsedDocument) {
        this.parseLineStartOffsets = buildLineStartOffsets(parsed.parseText);
        this.originalLineStartOffsets = buildLineStartOffsets(parsed.text);
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
        const source = this.getTextSource(node);
        const startOffset = this.offsetAt(node.range.start.line, node.range.start.character, source.lineStartOffsets, source.text.length);
        const endOffset = this.offsetAt(node.range.end.line, node.range.end.character, source.lineStartOffsets, source.text.length);
        return source.text.slice(startOffset, endOffset);
    }

    private getTextSource(node: SyntaxNode): { text: string; lineStartOffsets: number[] } {
        if (isPreprocessorSyntaxKind(node.kind)) {
            return {
                text: this.parsed.text,
                lineStartOffsets: this.originalLineStartOffsets
            };
        }

        return {
            text: this.parsed.parseText,
            lineStartOffsets: this.parseLineStartOffsets
        };
    }

    private offsetAt(line: number, character: number, lineStartOffsets: number[], textLength: number): number {
        const lineStart = lineStartOffsets[line] ?? textLength;
        return Math.min(lineStart + character, textLength);
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

function isPreprocessorSyntaxKind(kind: SyntaxKind): boolean {
    return kind === SyntaxKind.PreprocessorIncludeDirective
        || kind === SyntaxKind.MacroDefinitionDirective
        || kind === SyntaxKind.MacroUndefDirective
        || kind === SyntaxKind.ConditionalDirective
        || kind === SyntaxKind.PreprocessorDirective;
}
