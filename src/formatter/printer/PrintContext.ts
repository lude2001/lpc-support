export class PrintContext {
    constructor(
        public readonly indentSize: number,
        public readonly indentLevel: number = 0
    ) {}

    public indent(): string {
        return ' '.repeat(this.indentLevel * this.indentSize);
    }

    public nested(): PrintContext {
        return new PrintContext(this.indentSize, this.indentLevel + 1);
    }
}
