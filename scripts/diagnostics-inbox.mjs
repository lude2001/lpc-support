// Test harness state: diagnostics from dependency refreshes may interleave with
// the document under test. Never identify a document by notification order.
export class DiagnosticsInbox {
    #documents = new Map();
    #waiters = new Set();

    accept(params) {
        if (typeof params?.uri !== 'string' || !Number.isInteger(params.version)) return;
        const previous = this.#documents.get(params.uri);
        if (previous && previous.version > params.version) return;
        this.#documents.set(params.uri, params);
        for (const waiter of [...this.#waiters]) {
            if (waiter.uri === params.uri && waiter.version === params.version) {
                this.#waiters.delete(waiter);
                clearTimeout(waiter.timer);
                waiter.resolve(params);
            }
        }
    }

    waitFor(uri, version, timeoutMs = 10_000) {
        const current = this.#documents.get(uri);
        if (current?.version === version) return Promise.resolve(current);
        if (current && current.version > version) {
            return Promise.reject(new Error(`Diagnostics version ${version} was superseded by ${current.version}`));
        }
        return new Promise((resolve, reject) => {
            const waiter = { uri, version, resolve, reject };
            waiter.timer = setTimeout(() => {
                this.#waiters.delete(waiter);
                reject(new Error(`Timed out waiting for diagnostics for ${uri} at version ${version}`));
            }, timeoutMs);
            this.#waiters.add(waiter);
        });
    }

    dispose() {
        for (const waiter of this.#waiters) {
            clearTimeout(waiter.timer);
            waiter.reject(new Error('Diagnostics inbox disposed'));
        }
        this.#waiters.clear();
        this.#documents.clear();
    }
}
