/**
 * Mock LPCParser for testing
 */

export class LPCParser {
    constructor(tokens: any) {
        this.tokens = tokens;
    }

    private tokens: any;
    private errorListeners: any[] = [];

    removeErrorListeners(): void {
        this.errorListeners = [];
    }

    addErrorListener(listener: any): void {
        this.errorListeners.push(listener);
    }

    sourceFile(): any {
        // 返回一个mock的AST树
        return {
            type: 'sourceFile',
            children: [],
            start: { line: 0, column: 0 },
            stop: { line: 0, column: 0 },
            getText: () => ''
        };
    }
}
