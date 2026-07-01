import type { LpcType } from './LpcType';

export interface TypeCheckingPosition {
    line: number;
    character: number;
}

export interface TypeNarrowingLookup {
    getNarrowedType(name: string, position: TypeCheckingPosition): LpcType | undefined;
}
