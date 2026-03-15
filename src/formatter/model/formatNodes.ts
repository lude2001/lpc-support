import { SyntaxKind } from '../../syntax/types';

export interface FormatNode {
    kind: string;
    syntaxKind: SyntaxKind;
    text: string;
    children: FormatNode[];
    name?: string;
    metadata?: Readonly<Record<string, unknown>>;
    leadingTrivia: string[];
    trailingTrivia: string[];
}
