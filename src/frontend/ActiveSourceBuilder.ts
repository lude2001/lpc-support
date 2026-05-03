import {
    InactiveRange,
    PreprocessedSourceView,
    PreprocessorDirective,
    PreprocessorSourceMapEntry,
    SourceOffsetRange
} from './types';

export class ActiveSourceBuilder {
    public build(
        text: string,
        directives: PreprocessorDirective[],
        inactiveRanges: InactiveRange[]
    ): PreprocessedSourceView {
        const chars = Array.from(text);
        const ranges: SourceOffsetRange[] = [...directives, ...inactiveRanges]
            .sort((left, right) => left.startOffset - right.startOffset);

        for (const range of ranges) {
            this.blankRange(chars, range.startOffset, range.endOffset);
        }

        return {
            text: chars.join(''),
            sourceMap: this.buildIdentitySourceMap(text)
        };
    }

    private blankRange(chars: string[], startOffset: number, endOffset: number): void {
        const start = Math.max(0, Math.min(startOffset, chars.length));
        const end = Math.max(start, Math.min(endOffset, chars.length));

        for (let index = start; index < end; index += 1) {
            if (chars[index] !== '\r' && chars[index] !== '\n') {
                chars[index] = ' ';
            }
        }
    }

    private buildIdentitySourceMap(text: string): PreprocessorSourceMapEntry[] {
        return [{ originalStartOffset: 0, activeStartOffset: 0, length: text.length }];
    }
}
