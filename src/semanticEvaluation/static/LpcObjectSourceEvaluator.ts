import { SemanticValue } from '../types';
import { joinSemanticValues } from '../valueJoin';
import { objectValue, unknownValue } from '../valueFactories';
import { collectStaticStringSet } from './LpcContainerShapeEvaluator';

export function isLpcObjectSourceCallName(name: string | undefined): name is 'load_object' | 'find_object' {
    return name === 'load_object' || name === 'find_object';
}

export function evaluateLpcObjectSourceValue(targetValue: SemanticValue): SemanticValue {
    const targetPaths = collectStaticStringSet(targetValue);
    if (targetPaths?.length) {
        return joinSemanticValues(targetPaths.map((targetPath) => objectValue(targetPath)));
    }

    return unknownValue();
}
