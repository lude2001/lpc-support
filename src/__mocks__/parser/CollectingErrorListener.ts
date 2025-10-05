/**
 * Mock CollectingErrorListener for testing
 */

export class CollectingErrorListener {
    public diagnostics: any[] = [];

    constructor(document: any) {
        this.document = document;
    }

    private document: any;

    syntaxError(
        recognizer: any,
        offendingSymbol: any,
        line: number,
        charPositionInLine: number,
        msg: string,
        e: any
    ): void {
        // Mock实现不记录错误
    }
}
