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

interface MacroConditionValue {
    name: string;
    replacement?: string;
}

export class PreprocessorConditionEvaluator {
    public evaluate(
        text: string,
        directives: PreprocessorDirective[],
        definedMacros: Array<string | MacroDefinitionFact> = []
    ): ConditionalEvaluationResult {
        const lineStartOffsets = buildLineStartOffsets(text);
        const macroValues = new Map<string, MacroConditionValue>();
        for (const macro of definedMacros) {
            if (typeof macro === 'string') {
                macroValues.set(macro, { name: macro, replacement: '1' });
            } else {
                macroValues.set(macro.name, { name: macro.name, replacement: macro.replacement });
            }
        }
        const inactiveRanges: InactiveRange[] = [];
        const diagnostics: PreprocessorDiagnostic[] = [];
        const stack: ConditionalFrame[] = [];

        for (const directive of directives) {
            switch (directive.kind) {
                case 'if':
                case 'ifdef':
                case 'ifndef':
                    this.enterConditional(text, lineStartOffsets, directive, stack, inactiveRanges, macroValues);
                    break;
                case 'elif':
                    this.switchConditionalBranch(text, lineStartOffsets, directive, stack, inactiveRanges, macroValues);
                    break;
                case 'else':
                    this.switchElseBranch(text, lineStartOffsets, directive, stack, inactiveRanges, diagnostics);
                    break;
                case 'endif':
                    this.closeConditional(text, lineStartOffsets, directive, stack, inactiveRanges, diagnostics);
                    break;
                case 'define': {
                    const macro = parseConditionMacro(directive.body);
                    const name = macro?.name;
                    if (name && this.isCurrentActive(stack)) {
                        macroValues.set(name, macro);
                    }
                    break;
                }
                case 'undef': {
                    const name = (directive.body.match(/^([A-Za-z_][A-Za-z0-9_]*)/) || [])[1];
                    if (name && this.isCurrentActive(stack)) {
                        macroValues.delete(name);
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
        macroValues: Map<string, MacroConditionValue>
    ): void {
        const parentActive = this.isCurrentActive(stack);
        const conditionActive = parentActive && this.evaluateDirectiveCondition(directive, macroValues);
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
        macroValues: Map<string, MacroConditionValue>
    ): void {
        const frame = stack[stack.length - 1];
        if (!frame) {
            return;
        }

        this.closeInactiveRangeIfNeeded(text, lineStartOffsets, directive, frame, inactiveRanges);
        const branchActive = frame.parentActive
            && !frame.anyBranchTaken
            && this.evaluateDirectiveCondition(directive, macroValues);

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

    private evaluateDirectiveCondition(directive: PreprocessorDirective, macroValues: Map<string, MacroConditionValue>): boolean {
        const body = directive.body.trim();
        switch (directive.kind) {
            case 'ifdef':
                return macroValues.has(body);
            case 'ifndef':
                return !macroValues.has(body);
            case 'if':
            case 'elif':
                return evaluateConstantCondition(body, macroValues);
            default:
                return true;
        }
    }
}

function evaluateConstantCondition(body: string, macroValues: Map<string, MacroConditionValue>): boolean {
    const trimmed = body.trim();
    if (trimmed === '') {
        return false;
    }

    return new ConditionExpressionParser(trimmed, macroValues).parse() !== 0;
}

function parseConditionMacro(body: string): MacroConditionValue | undefined {
    const match = body.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\([^)]*\))?\s*([\s\S]*)$/);
    if (!match) {
        return undefined;
    }

    return {
        name: match[1],
        replacement: (match[2] || '1').trim()
    };
}

type ConditionTokenKind = 'number' | 'identifier' | 'operator' | 'lparen' | 'rparen' | 'eof';

interface ConditionToken {
    kind: ConditionTokenKind;
    text: string;
}

class ConditionExpressionParser {
    private readonly tokens: ConditionToken[];
    private index = 0;

    constructor(
        expression: string,
        private readonly macroValues: Map<string, MacroConditionValue>
    ) {
        this.tokens = tokenizeConditionExpression(expression);
    }

    public parse(): number {
        return this.parseLogicalOr();
    }

    private parseLogicalOr(): number {
        let left = this.parseLogicalAnd();
        while (this.matchOperator('||')) {
            const right = this.parseLogicalAnd();
            left = truthy(left) || truthy(right) ? 1 : 0;
        }
        return left;
    }

    private parseLogicalAnd(): number {
        let left = this.parseBitwiseOr();
        while (this.matchOperator('&&')) {
            const right = this.parseBitwiseOr();
            left = truthy(left) && truthy(right) ? 1 : 0;
        }
        return left;
    }

    private parseBitwiseOr(): number {
        let left = this.parseBitwiseXor();
        while (this.matchOperator('|')) {
            left = left | this.parseBitwiseXor();
        }
        return left;
    }

    private parseBitwiseXor(): number {
        let left = this.parseBitwiseAnd();
        while (this.matchOperator('^')) {
            left = left ^ this.parseBitwiseAnd();
        }
        return left;
    }

    private parseBitwiseAnd(): number {
        let left = this.parseEquality();
        while (this.matchOperator('&')) {
            left = left & this.parseEquality();
        }
        return left;
    }

    private parseEquality(): number {
        let left = this.parseRelational();
        while (true) {
            if (this.matchOperator('==')) {
                left = left === this.parseRelational() ? 1 : 0;
                continue;
            }
            if (this.matchOperator('!=')) {
                left = left !== this.parseRelational() ? 1 : 0;
                continue;
            }
            return left;
        }
    }

    private parseRelational(): number {
        let left = this.parseShift();
        while (true) {
            if (this.matchOperator('<=')) {
                left = left <= this.parseShift() ? 1 : 0;
                continue;
            }
            if (this.matchOperator('>=')) {
                left = left >= this.parseShift() ? 1 : 0;
                continue;
            }
            if (this.matchOperator('<')) {
                left = left < this.parseShift() ? 1 : 0;
                continue;
            }
            if (this.matchOperator('>')) {
                left = left > this.parseShift() ? 1 : 0;
                continue;
            }
            return left;
        }
    }

    private parseShift(): number {
        let left = this.parseAdditive();
        while (true) {
            if (this.matchOperator('<<')) {
                left = left << this.parseAdditive();
                continue;
            }
            if (this.matchOperator('>>')) {
                left = left >> this.parseAdditive();
                continue;
            }
            return left;
        }
    }

    private parseAdditive(): number {
        let left = this.parseMultiplicative();
        while (true) {
            if (this.matchOperator('+')) {
                left += this.parseMultiplicative();
                continue;
            }
            if (this.matchOperator('-')) {
                left -= this.parseMultiplicative();
                continue;
            }
            return left;
        }
    }

    private parseMultiplicative(): number {
        let left = this.parseUnary();
        while (true) {
            if (this.matchOperator('*')) {
                left *= this.parseUnary();
                continue;
            }
            if (this.matchOperator('/')) {
                const right = this.parseUnary();
                left = right === 0 ? 0 : Math.trunc(left / right);
                continue;
            }
            if (this.matchOperator('%')) {
                const right = this.parseUnary();
                left = right === 0 ? 0 : left % right;
                continue;
            }
            return left;
        }
    }

    private parseUnary(): number {
        if (this.matchOperator('!')) {
            return truthy(this.parseUnary()) ? 0 : 1;
        }
        if (this.matchOperator('~')) {
            return ~this.parseUnary();
        }
        if (this.matchOperator('+')) {
            return this.parseUnary();
        }
        if (this.matchOperator('-')) {
            return -this.parseUnary();
        }
        return this.parsePrimary();
    }

    private parsePrimary(): number {
        const token = this.peek();
        if (this.matchKind('number')) {
            return parseIntegerToken(token.text);
        }
        if (this.matchIdentifier('defined')) {
            return this.parseDefined();
        }
        if (this.matchKind('identifier')) {
            return this.resolveIdentifier(token.text);
        }
        if (this.matchKind('lparen')) {
            const value = this.parseLogicalOr();
            this.matchKind('rparen');
            return value;
        }

        this.index += token.kind === 'eof' ? 0 : 1;
        return 0;
    }

    private parseDefined(): number {
        if (this.matchKind('lparen')) {
            const identifier = this.peek();
            const defined = identifier.kind === 'identifier' && this.macroValues.has(identifier.text);
            if (identifier.kind === 'identifier') {
                this.index += 1;
            }
            this.matchKind('rparen');
            return defined ? 1 : 0;
        }

        const identifier = this.peek();
        if (identifier.kind === 'identifier') {
            this.index += 1;
            return this.macroValues.has(identifier.text) ? 1 : 0;
        }
        return 0;
    }

    private resolveIdentifier(name: string): number {
        const macro = this.macroValues.get(name);
        if (!macro) {
            return 0;
        }

        const replacement = macro.replacement?.trim() || '1';
        if (/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[0-7_]+|[0-9][0-9_]*)$/.test(replacement)) {
            return parseIntegerToken(replacement);
        }
        return 1;
    }

    private matchOperator(text: string): boolean {
        const token = this.peek();
        if (token.kind === 'operator' && token.text === text) {
            this.index += 1;
            return true;
        }
        return false;
    }

    private matchIdentifier(text: string): boolean {
        const token = this.peek();
        if (token.kind === 'identifier' && token.text === text) {
            this.index += 1;
            return true;
        }
        return false;
    }

    private matchKind(kind: ConditionTokenKind): boolean {
        if (this.peek().kind === kind) {
            this.index += 1;
            return true;
        }
        return false;
    }

    private peek(): ConditionToken {
        return this.tokens[this.index] ?? { kind: 'eof', text: '' };
    }
}

function tokenizeConditionExpression(expression: string): ConditionToken[] {
    const tokens: ConditionToken[] = [];
    const tokenPattern = /\s+|0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[0-7_]+|[0-9][0-9_]*|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||==|!=|<=|>=|<<|>>|[!~+\-*/%<>&^|()]|./g;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(expression)) !== null) {
        const text = match[0];
        if (/^\s+$/.test(text)) {
            continue;
        }
        if (/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[0-7_]+|[0-9][0-9_]*)$/.test(text)) {
            tokens.push({ kind: 'number', text });
            continue;
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
            tokens.push({ kind: 'identifier', text });
            continue;
        }
        if (text === '(') {
            tokens.push({ kind: 'lparen', text });
            continue;
        }
        if (text === ')') {
            tokens.push({ kind: 'rparen', text });
            continue;
        }
        tokens.push({ kind: 'operator', text });
    }

    tokens.push({ kind: 'eof', text: '' });
    return tokens;
}

function parseIntegerToken(text: string): number {
    const normalized = text.replace(/_/g, '');
    if (/^0[bB]/.test(normalized)) {
        return parseInt(normalized.slice(2), 2);
    }
    if (/^0[xX]/.test(normalized)) {
        return parseInt(normalized.slice(2), 16);
    }
    if (/^0[0-7]/.test(normalized)) {
        return parseInt(normalized, 8);
    }
    return parseInt(normalized, 10);
}

function truthy(value: number): boolean {
    return value !== 0;
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
