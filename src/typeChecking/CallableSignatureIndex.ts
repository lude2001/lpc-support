export interface CallableSignatureLike {
    name: string;
}

export interface CallableSignatureLookup<TSignature extends CallableSignatureLike> {
    get(name: string | undefined): readonly TSignature[];
    has(name: string | undefined): boolean;
}

const EMPTY_SIGNATURES: readonly CallableSignatureLike[] = [];

export class CallableSignatureIndex<TSignature extends CallableSignatureLike>
implements CallableSignatureLookup<TSignature> {
    private readonly byName = new Map<string, TSignature[]>();

    public constructor(signatures: readonly TSignature[] = []) {
        for (const signature of signatures) {
            const existing = this.byName.get(signature.name);
            if (existing) {
                existing.push(signature);
                continue;
            }

            this.byName.set(signature.name, [signature]);
        }
    }

    public get(name: string | undefined): readonly TSignature[] {
        if (!name) {
            return EMPTY_SIGNATURES as readonly TSignature[];
        }

        return this.byName.get(name) ?? (EMPTY_SIGNATURES as readonly TSignature[]);
    }

    public has(name: string | undefined): boolean {
        return Boolean(name && this.byName.has(name));
    }
}
