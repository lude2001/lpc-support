export interface AttachedDocComment {
    kind: 'javadoc';
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    text: string;
}
