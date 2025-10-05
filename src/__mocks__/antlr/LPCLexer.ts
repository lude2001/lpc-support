/**
 * Mock LPCLexer for testing
 */

export class LPCLexer {
    constructor(input: any) {
        this.input = input;
    }

    private input: any;

    getAllTokens(): any[] {
        return [];
    }
}
