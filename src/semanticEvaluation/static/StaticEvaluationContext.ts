import type { ResolvedCallTarget } from '../calls/CallTargetResolver';
import type { FunctionSummary } from '../../semantic/documentSemanticTypes';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import type { SyntaxDocument } from '../../syntax/types';
import type { SemanticValue } from '../types';
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
    resolvedDirectCalls?: ReadonlyMap<string, ResolvedCallTarget>;
    resolvedEnvironmentCalls?: ReadonlyMap<string, SemanticValue>;
    budget: StaticEvaluationBudget;
    metadata: StaticEvaluationMetadata;
    initialEnvironment: ValueEnvironment;
}

export interface CreateStaticEvaluationContextOptions {
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    functionSummary?: FunctionSummary;
    resolvedDirectCalls?: ReadonlyMap<string, ResolvedCallTarget>;
    resolvedEnvironmentCalls?: ReadonlyMap<string, SemanticValue>;
    budget?: Partial<StaticEvaluationBudget>;
    metadata: StaticEvaluationMetadata;
    initialEnvironment?: ValueEnvironment;
}

export function createResolvedEnvironmentCallKey(
    documentUri: string,
    calleeName: string,
    argumentCount: number
): string {
    return `${documentUri}|${calleeName}|${argumentCount}`;
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
        resolvedDirectCalls: options.resolvedDirectCalls,
        resolvedEnvironmentCalls: options.resolvedEnvironmentCalls,
        budget: createStaticEvaluationBudget(options.budget),
        metadata: options.metadata,
        initialEnvironment: options.initialEnvironment ?? createValueEnvironment()
    };
}
