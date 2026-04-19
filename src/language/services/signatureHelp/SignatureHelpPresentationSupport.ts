import * as vscode from 'vscode';
import { CallableDocRenderer } from '../../documentation/CallableDocRenderer';
import type { CallableDoc, CallableParameter } from '../../documentation/types';
import type { LanguageSignatureHelpResult, ResolvedCallableTarget } from './LanguageSignatureHelpService';

export interface DedupedCallableTarget extends ResolvedCallableTarget {
    additionalSourceLabels: string[];
}

export interface MergedCallableDocGroup {
    doc: CallableDoc;
    sourceLabel: string;
    additionalSourceLabels: string[];
}

export function dedupeTargets(targets: ResolvedCallableTarget[]): DedupedCallableTarget[] {
    const deduped = new Map<string, DedupedCallableTarget>();

    for (const target of targets) {
        const existing = deduped.get(target.targetKey);
        if (!existing) {
            deduped.set(target.targetKey, {
                ...target,
                additionalSourceLabels: []
            });
            continue;
        }

        if (compareTargetOrder(target, existing) < 0) {
            const replacement: DedupedCallableTarget = {
                ...target,
                additionalSourceLabels: mergeSourceLabels(
                    [existing.sourceLabel, ...existing.additionalSourceLabels],
                    []
                )
            };
            deduped.set(target.targetKey, replacement);
            continue;
        }

        existing.additionalSourceLabels = mergeSourceLabels(existing.additionalSourceLabels, [target.sourceLabel]);
    }

    return [...deduped.values()].sort(compareTargetOrder);
}

export function mergeCallableDocGroups(
    candidates: Array<{
        target: DedupedCallableTarget;
        doc: CallableDoc;
    }>
): MergedCallableDocGroup[] {
    const groups: MergedCallableDocGroup[] = [];

    for (const candidate of candidates) {
        const existing = groups.find((group) => areSameSignatureGroup(group.doc, candidate.doc));
        if (existing) {
            existing.additionalSourceLabels = mergeSourceLabels(
                existing.additionalSourceLabels,
                [candidate.target.sourceLabel, ...candidate.target.additionalSourceLabels]
            );
            continue;
        }

        groups.push({
            doc: candidate.doc,
            sourceLabel: candidate.target.sourceLabel,
            additionalSourceLabels: [...candidate.target.additionalSourceLabels]
        });
    }

    return groups;
}

export function flattenMergedGroups(
    groups: MergedCallableDocGroup[],
    renderer: CallableDocRenderer,
    activeParameter: number
): LanguageSignatureHelpResult['signatures'] {
    return groups.flatMap((group) => group.doc.signatures.map((signature, signatureIndex) => {
        const summary = renderer.renderSignatureSummary(group.doc, signatureIndex, activeParameter);
        const documentation = buildSignatureDocumentation(
            summary.documentation,
            group.sourceLabel,
            group.additionalSourceLabels
        );

        return {
            label: summary.label,
            documentation,
            sourceLabel: group.sourceLabel,
            additionalSourceLabels: group.additionalSourceLabels.length > 0
                ? [...group.additionalSourceLabels]
                : undefined,
            parameters: signature.parameters.map((parameter, parameterIndex) => ({
                label: formatParameterLabel(parameter),
                documentation: summary.parameterDocs[parameterIndex]
            }))
        };
    }));
}

export function selectActiveSignature(doc: CallableDoc, activeParameter: number): number {
    const exactParameterCount = activeParameter + 1;
    const exactMatchIndex = doc.signatures.findIndex((signature) => signature.parameters.length === exactParameterCount);
    if (exactMatchIndex >= 0) {
        return exactMatchIndex;
    }

    const variadicMatchIndex = doc.signatures.findIndex((signature) =>
        canVariadicSignatureAcceptIndex(signature.parameters.length, signature, activeParameter)
    );
    if (variadicMatchIndex >= 0) {
        return variadicMatchIndex;
    }

    return 0;
}

export function compareRangeSize(left: vscode.Range, right: vscode.Range): number {
    return toRangeSize(left) - toRangeSize(right);
}

export function buildDeclarationKey(
    uri: string,
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    }
): string {
    return `${uri}#${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
}

export function fromVsCodeRange(range: vscode.Range): {
    start: { line: number; character: number };
    end: { line: number; character: number };
} {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

function buildSignatureDocumentation(
    documentation: string | undefined,
    sourceLabel: string,
    additionalSourceLabels: string[]
): string {
    const parts = [`Source: ${sourceLabel}`];

    if (additionalSourceLabels.length > 0) {
        parts.push(`Also from: ${additionalSourceLabels.join(', ')}`);
    }

    if (documentation) {
        parts.push(documentation);
    }

    return parts.join('\n\n');
}

function canVariadicSignatureAcceptIndex(
    parameterCount: number,
    docSignature: CallableDoc['signatures'][number],
    activeParameter: number
): boolean {
    return docSignature.isVariadic
        && parameterCount > 0
        && activeParameter >= parameterCount - 1;
}

function areSameSignatureGroup(left: CallableDoc, right: CallableDoc): boolean {
    if (left.name !== right.name || left.signatures.length !== right.signatures.length) {
        return false;
    }

    return left.signatures.every((signature, index) => signature.label === right.signatures[index]?.label);
}

function mergeSourceLabels(existing: string[], incoming: string[]): string[] {
    const merged = [...existing];

    for (const label of incoming) {
        if (!merged.includes(label)) {
            merged.push(label);
        }
    }

    return merged;
}

function compareTargetOrder(left: ResolvedCallableTarget, right: ResolvedCallableTarget): number {
    if (left.priority !== right.priority) {
        return left.priority - right.priority;
    }

    return left.targetKey.localeCompare(right.targetKey);
}

function formatParameterLabel(parameter: CallableParameter): string {
    return [parameter.type, parameter.name].filter(Boolean).join(' ').trim() || parameter.name;
}

function toRangeSize(range: vscode.Range): number {
    return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
}
