import * as vscode from 'vscode';
import {
    ConditionalEvaluationResult,
    InactiveRange,
    MacroDefinitionFact,
    PreprocessorDiagnostic,
    PreprocessorDirective
} from './types';
import { positionAt } from './PreprocessorScanner';

interface ConditionalFrame {
    parentActive: boolean;
    branchActive: boolean;
    anyBranchTaken: boolean;
    inactiveStartOffset?: number;
    inactiveReason?: InactiveRange['reason'];
    openingDirective: PreprocessorDirective;
}

export class PreprocessorConditionEvaluator {
    public evaluate(
        text: string,
        directives: PreprocessorDirective[],
        definedMacros: Array<string | MacroDefinitionFact> = []
    ): ConditionalEvaluationResult {
        const lineStartOffsets = buildLineStartOffsets(text);
        const macroNames = new Set(definedMacros.map((macro) => typeof macro === 'string' ? macro : macro.name));
        const inactiveRanges: InactiveRange[] = [];
        const diagnostics: PreprocessorDiagnostic[] = [];
        const stack: ConditionalFrame[] = [];

        for (const directive of directives) {
            switch (directive.kind) {
                case 'if':
                case 'ifdef':
                case 'ifndef':
                    this.enterConditional(text, lineStartOffsets, directive, stack, inactiveRanges, macroNames);
                    break;
                case 'elif':
                    this.switchConditionalBranch(text, lineStartOffsets, directive, stack, inactiveRanges, macroNames);
                    break;
                case 'else':
                    this.switchElseBranch(text, lineStartOffsets, directive, stack, inactiveRanges, diagnostics);
                    break;
                case 'endif':
                    this.closeConditional(text, lineStartOffsets, directive, stack, inactiveRanges, diagnostics);
                    break;
                case 'define': {
                    const name = (directive.body.match(/^([A-Za-z_][A-Za-z0-9_]*)/) || [])[1];
                    if (name && this.isCurrentActive(stack)) {
                        macroNames.add(name);
                    }
                    break;
                }
                case 'undef': {
                    const name = (directive.body.match(/^([A-Za-z_][A-Za-z0-9_]*)/) || [])[1];
                    if (name && this.isCurrentActive(stack)) {
                        macroNames.delete(name);
                    }
                    break;
                }
                default:
                    break;
            }
        }

        for (const frame of stack.reverse()) {
            if (!frame.branchActive && frame.inactiveStartOffset !== undefined) {
                inactiveRanges.push(this.createInactiveRange(
                    text,
                    lineStartOffsets,
                    frame.inactiveStartOffset,
                    text.length,
                    frame.inactiveReason ?? 'condition-false'
                ));
            }
            diagnostics.push({
                code: 'preprocessor.unclosedConditional',
                message: 'Unclosed preprocessor conditional.',
                severity: vscode.DiagnosticSeverity.Error,
                range: frame.openingDirective.range
            });
        }

        return { inactiveRanges, diagnostics };
    }

    private enterConditional(
        text: string,
        lineStartOffsets: number[],
        directive: PreprocessorDirective,
        stack: ConditionalFrame[],
        inactiveRanges: InactiveRange[],
        macroNames: Set<string>
    ): void {
        const parentActive = this.isCurrentActive(stack);
        const conditionActive = parentActive && this.evaluateDirectiveCondition(directive, macroNames);
        const frame: ConditionalFrame = {
            parentActive,
            branchActive: conditionActive,
            anyBranchTaken: conditionActive,
            openingDirective: directive
        };

        if (!conditionActive) {
            frame.inactiveStartOffset = nextLineStart(text, directive.endOffset);
            frame.inactiveReason = parentActive ? 'condition-false' : 'parent-inactive';
        }

        stack.push(frame);
        void inactiveRanges;
        void lineStartOffsets;
    }

    private switchConditionalBranch(
        text: string,
        lineStartOffsets: number[],
        directive: PreprocessorDirective,
        stack: ConditionalFrame[],
        inactiveRanges: InactiveRange[],
        macroNames: Set<string>
    ): void {
        const frame = stack[stack.length - 1];
        if (!frame) {
            return;
        }

        this.closeInactiveRangeIfNeeded(text, lineStartOffsets, directive, frame, inactiveRanges);
        const branchActive = frame.parentActive
            && !frame.anyBranchTaken
            && this.evaluateDirectiveCondition(directive, macroNames);

        frame.branchActive = branchActive;
        frame.anyBranchTaken = frame.anyBranchTaken || branchActive;
        if (!branchActive) {
            frame.inactiveStartOffset = nextLineStart(text, directive.endOffset);
            frame.inactiveReason = frame.parentActive ? 'condition-false' : 'parent-inactive';
        }
    }

    private switchElseBranch(
        text: string,
        lineStartOffsets: number[],
        directive: PreprocessorDirective,
        stack: ConditionalFrame[],
        inactiveRanges: InactiveRange[],
        diagnostics: PreprocessorDiagnostic[]
    ): void {
        const frame = stack[stack.length - 1];
        if (!frame) {
            diagnostics.push({
                code: 'preprocessor.unmatchedElse',
                message: 'Unmatched preprocessor else.',
                severity: vscode.DiagnosticSeverity.Error,
                range: directive.range
            });
            return;
        }

        this.closeInactiveRangeIfNeeded(text, lineStartOffsets, directive, frame, inactiveRanges);
        const branchActive = frame.parentActive && !frame.anyBranchTaken;
        frame.branchActive = branchActive;
        frame.anyBranchTaken = true;
        if (!branchActive) {
            frame.inactiveStartOffset = nextLineStart(text, directive.endOffset);
            frame.inactiveReason = frame.parentActive ? 'condition-false' : 'parent-inactive';
        }
    }

    private closeConditional(
        text: string,
        lineStartOffsets: number[],
        directive: PreprocessorDirective,
        stack: ConditionalFrame[],
        inactiveRanges: InactiveRange[],
        diagnostics: PreprocessorDiagnostic[]
    ): void {
        const frame = stack.pop();
        if (!frame) {
            diagnostics.push({
                code: 'preprocessor.unmatchedEndif',
                message: 'Unmatched preprocessor endif.',
                severity: vscode.DiagnosticSeverity.Error,
                range: directive.range
            });
            return;
        }

        this.closeInactiveRangeIfNeeded(text, lineStartOffsets, directive, frame, inactiveRanges);
    }

    private closeInactiveRangeIfNeeded(
        text: string,
        lineStartOffsets: number[],
        directive: PreprocessorDirective,
        frame: ConditionalFrame,
        inactiveRanges: InactiveRange[]
    ): void {
        if (frame.inactiveStartOffset === undefined) {
            return;
        }

        inactiveRanges.push(this.createInactiveRange(
            text,
            lineStartOffsets,
            frame.inactiveStartOffset,
            lineStartOffsetAtOrBefore(lineStartOffsets, directive.startOffset),
            frame.inactiveReason ?? 'condition-false'
        ));
        frame.inactiveStartOffset = undefined;
        frame.inactiveReason = undefined;
    }

    private createInactiveRange(
        text: string,
        lineStartOffsets: number[],
        startOffset: number,
        endOffset: number,
        reason: InactiveRange['reason']
    ): InactiveRange {
        const normalizedStart = Math.max(0, Math.min(startOffset, text.length));
        const normalizedEnd = Math.max(normalizedStart, Math.min(endOffset, text.length));
        return {
            reason,
            startOffset: normalizedStart,
            endOffset: normalizedEnd,
            range: new vscode.Range(
                positionAt(lineStartOffsets, normalizedStart),
                positionAt(lineStartOffsets, normalizedEnd)
            )
        };
    }

    private isCurrentActive(stack: ConditionalFrame[]): boolean {
        return stack.every((frame) => frame.branchActive);
    }

    private evaluateDirectiveCondition(directive: PreprocessorDirective, macroNames: Set<string>): boolean {
        const body = directive.body.trim();
        switch (directive.kind) {
            case 'ifdef':
                return macroNames.has(body);
            case 'ifndef':
                return !macroNames.has(body);
            case 'if':
            case 'elif':
                return evaluateConstantCondition(body, macroNames);
            default:
                return true;
        }
    }
}

function evaluateConstantCondition(body: string, macroNames: Set<string>): boolean {
    const trimmed = body.trim();
    if (trimmed === '0' || trimmed === '') {
        return false;
    }
    if (trimmed === '1') {
        return true;
    }

    const definedMatch = trimmed.match(/^defined\s*\(?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)?$/);
    if (definedMatch) {
        return macroNames.has(definedMatch[1]);
    }

    return macroNames.has(trimmed);
}

function nextLineStart(text: string, offset: number): number {
    const newlineIndex = text.indexOf('\n', offset);
    return newlineIndex < 0 ? text.length : newlineIndex + 1;
}

function buildLineStartOffsets(text: string): number[] {
    const offsets = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            offsets.push(index + 1);
        }
    }
    return offsets;
}

function lineStartOffsetAtOrBefore(lineStartOffsets: number[], offset: number): number {
    let candidate = 0;
    for (const lineStart of lineStartOffsets) {
        if (lineStart > offset) {
            break;
        }
        candidate = lineStart;
    }
    return candidate;
}
