import { SemanticValue } from '../types';
import { unknownValue } from '../valueFactories';
import { joinSemanticValues } from '../valueJoin';

export interface ValueEnvironment {
    bindings: ReadonlyMap<string, SemanticValue>;
}

export type ControlFlowTermination =
    | 'none'
    | 'return'
    | 'terminated';

export interface ControlFlowState {
    reachable: boolean;
    hasReturned: boolean;
    termination: ControlFlowTermination;
}

export interface ReturnAccumulator {
    values: readonly SemanticValue[];
    result: SemanticValue;
}

export interface StaticEvaluationState {
    environment: ValueEnvironment;
    controlFlow: ControlFlowState;
    returns: ReturnAccumulator;
}

export interface CreateStaticEvaluationStateOptions {
    environment?: ValueEnvironment;
    controlFlow?: ControlFlowState;
    returns?: ReturnAccumulator;
}

export function createValueEnvironment(
    bindings?: Readonly<Record<string, SemanticValue>> | ReadonlyMap<string, SemanticValue>
): ValueEnvironment {
    if (!bindings) {
        return {
            bindings: new Map()
        };
    }

    if (bindings instanceof Map) {
        return {
            bindings: new Map(bindings)
        };
    }

    return {
        bindings: new Map(Object.entries(bindings))
    };
}

export function bindEnvironmentValue(
    environment: ValueEnvironment,
    symbolName: string,
    value: SemanticValue
): ValueEnvironment {
    const nextBindings = new Map(environment.bindings);
    nextBindings.set(symbolName, value);
    return {
        bindings: nextBindings
    };
}

export function getEnvironmentValue(
    environment: ValueEnvironment,
    symbolName: string
): SemanticValue | undefined {
    return environment.bindings.get(symbolName);
}

export function createControlFlowState(
    state: Partial<ControlFlowState> = {}
): ControlFlowState {
    return {
        reachable: state.reachable ?? true,
        hasReturned: state.hasReturned ?? false,
        termination: state.termination ?? 'none'
    };
}

export function createReturnAccumulator(
    values: readonly SemanticValue[] = []
): ReturnAccumulator {
    const nextValues = values.slice();
    return {
        values: nextValues,
        result: nextValues.length > 0 ? joinSemanticValues(nextValues) : unknownValue()
    };
}

export function appendReturnValue(
    accumulator: ReturnAccumulator,
    value: SemanticValue
): ReturnAccumulator {
    return createReturnAccumulator([
        ...accumulator.values,
        value
    ]);
}

export function createStaticEvaluationState(
    options: CreateStaticEvaluationStateOptions = {}
): StaticEvaluationState {
    return {
        environment: options.environment ?? createValueEnvironment(),
        controlFlow: options.controlFlow ?? createControlFlowState(),
        returns: options.returns ?? createReturnAccumulator()
    };
}

function joinValueEnvironments(states: readonly StaticEvaluationState[]): ValueEnvironment {
    if (states.length === 0) {
        return createValueEnvironment();
    }

    const valuesBySymbol = new Map<string, SemanticValue[]>();
    const symbolCounts = new Map<string, number>();

    for (const state of states) {
        for (const [symbolName, value] of state.environment.bindings.entries()) {
            const existingValues = valuesBySymbol.get(symbolName) ?? [];
            existingValues.push(value);
            valuesBySymbol.set(symbolName, existingValues);
            symbolCounts.set(symbolName, (symbolCounts.get(symbolName) ?? 0) + 1);
        }
    }

    const joinedBindings = new Map<string, SemanticValue>();
    for (const [symbolName, values] of valuesBySymbol.entries()) {
        if (symbolCounts.get(symbolName) !== states.length) {
            continue;
        }

        joinedBindings.set(symbolName, joinSemanticValues(values));
    }

    return {
        bindings: joinedBindings
    };
}

function joinControlFlowStates(states: readonly StaticEvaluationState[]): ControlFlowState {
    if (states.length === 0) {
        return createControlFlowState();
    }

    const firstTermination = states[0].controlFlow.termination;
    const sameTermination = states.every(
        (state) => state.controlFlow.termination === firstTermination
    );

    return {
        reachable: states.some((state) => state.controlFlow.reachable),
        hasReturned: states.every((state) => state.controlFlow.hasReturned),
        termination: sameTermination ? firstTermination : 'none'
    };
}

function joinReturnAccumulators(states: readonly StaticEvaluationState[]): ReturnAccumulator {
    return createReturnAccumulator(
        states.flatMap((state) => state.returns.values)
    );
}

export function joinStaticEvaluationStates(
    states: readonly StaticEvaluationState[]
): StaticEvaluationState {
    if (states.length === 0) {
        return createStaticEvaluationState();
    }

    return {
        environment: joinValueEnvironments(states),
        controlFlow: joinControlFlowStates(states),
        returns: joinReturnAccumulators(states)
    };
}
