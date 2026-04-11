import type { Location, MarkupContent, Position, Range } from 'vscode-languageserver/node';
import type { LanguageLocation, LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import type { LanguageMarkupContent } from '../../contracts/LanguageMarkup';

export function toLspPosition(position: LanguagePosition): Position {
    return {
        line: position.line,
        character: position.character
    };
}

export function toLspRange(range: LanguageRange): Range {
    return {
        start: toLspPosition(range.start),
        end: toLspPosition(range.end)
    };
}

export function toLspLocation(location: LanguageLocation): Location {
    return {
        uri: location.uri,
        range: toLspRange(location.range)
    };
}

export function toLspMarkupContent(content: LanguageMarkupContent): MarkupContent {
    return {
        kind: content.kind === 'plaintext' ? 'plaintext' : 'markdown',
        value: content.value
    };
}
