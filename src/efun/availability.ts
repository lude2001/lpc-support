import type { StructuredEfunDoc } from './types';

export function materializeEfunNote(doc: StructuredEfunDoc): string | undefined {
    const parts = [doc.note];
    if (doc.availability) {
        parts.push(`可用性：${doc.availability.condition}`);
        if (doc.availability.source) {
            parts.push(`来源：FluffOS ${doc.availability.source}`);
        }
    }
    const materialized = parts.filter((part): part is string => Boolean(part?.trim()));
    return materialized.length > 0 ? materialized.join('\n\n') : undefined;
}
