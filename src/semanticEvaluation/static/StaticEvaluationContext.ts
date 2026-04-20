import type { FunctionSummary } from '../../semantic/documentSemanticTypes';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import type { SyntaxDocument } from '../../syntax/types';
import {
    createValueEnvironment,
    ValueEnvironment
} from './StaticEvaluationState';

export interface StaticEvaluationBudget {
    maxCallDepth: number;
    maxStatements: number;
    maxBranches: number;
    maxUnionSize: number;
}

export interface StaticEvaluationMetadata {
    documentUri: string;
    functionName: string;
    callDepth: number;
}

export interface StaticEvaluationContext {
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    functionSummary?: FunctionSummary;
    budget: StaticEvaluationBudget;
    metadata: StaticEvaluationMetadata;
    initialEnvironment: ValueEnvironment;
}

export interface CreateStaticEvaluationContextOptions {
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    functionSummary?: FunctionSummary;
    budget?: Partial<StaticEvaluationBudget>;
    metadata: StaticEvaluationMetadata;
    initialEnvironment?: ValueEnvironment;
}

const DEFAULT_STATIC_EVALUATION_BUDGET: StaticEvaluationBudget = {
    maxCallDepth: 4,
    maxStatements: 256,
    maxBranches: 32,
    maxUnionSize: 8
};

export function createStaticEvaluationBudget(
    overrides: Partial<StaticEvaluationBudget> = {}
): StaticEvaluationBudget {
    return {
        ...DEFAULT_STATIC_EVALUATION_BUDGET,
        ...overrides
    };
}

export function createStaticEvaluationContext(
    options: CreateStaticEvaluationContextOptions
): StaticEvaluationContext {
    return {
        syntax: options.syntax,
        semantic: options.semantic,
        functionSummary: options.functionSummary,
        budget: createStaticEvaluationBudget(options.budget),
        metadata: options.metadata,
        initialEnvironment: options.initialEnvironment ?? createValueEnvironment()
    };
}
