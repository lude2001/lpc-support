export interface StoredDocument {
    readonly uri: string;
    readonly version: number;
    readonly text: string;
}

export class DocumentStore {
    private readonly documents = new Map<string, StoredDocument>();

    public open(uri: string, version: number, text: string): void {
        this.documents.set(uri, { uri, version, text });
    }

    public applyFullChange(uri: string, version: number, text: string): void {
        this.documents.set(uri, { uri, version, text });
    }

    public get(uri: string): Readonly<StoredDocument> | undefined {
        const document = this.documents.get(uri);
        if (!document) {
            return undefined;
        }

        return {
            uri: document.uri,
            version: document.version,
            text: document.text
        };
    }

    public list(): Readonly<StoredDocument>[] {
        return Array.from(this.documents.values()).map((document) => ({
            uri: document.uri,
            version: document.version,
            text: document.text
        }));
    }

    public close(uri: string): void {
        this.documents.delete(uri);
    }

    public count(): number {
        return this.documents.size;
    }
}
