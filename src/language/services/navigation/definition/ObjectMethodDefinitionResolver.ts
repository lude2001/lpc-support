import * as vscode from 'vscode';
import { ObjectInferenceService } from '../../../../objectInference/ObjectInferenceService';
import { TargetMethodLookup } from '../../../../targetMethodLookup';
import { DefinitionResolverSupport } from './DefinitionResolverSupport';

interface ObjectMethodDefinitionResolverDependencies {
    support: DefinitionResolverSupport;
    objectInferenceService: Pick<ObjectInferenceService, 'inferObjectAccess'>;
    targetMethodLookup: Pick<TargetMethodLookup, 'findMethod'>;
}

export class ObjectMethodDefinitionResolver {
    public constructor(private readonly dependencies: ObjectMethodDefinitionResolverDependencies) {}

    public async resolve(
        document: vscode.TextDocument,
        position: vscode.Position,
        memberName: string
    ): Promise<vscode.Location[] | undefined> {
        const objectAccess = await this.dependencies.objectInferenceService.inferObjectAccess(document, position);
        if (!objectAccess || objectAccess.memberName !== memberName) {
            return undefined;
        }

        if (objectAccess.inference.status === 'unknown' || objectAccess.inference.status === 'unsupported') {
            return undefined;
        }

        const locations: vscode.Location[] = [];
        const seenLocations = new Set<string>();

        for (const candidate of objectAccess.inference.candidates) {
            const resolvedMethod = await this.dependencies.targetMethodLookup.findMethod(document, candidate.path, objectAccess.memberName);
            if (!resolvedMethod?.location) {
                continue;
            }

            const normalizedRange = this.dependencies.support.toVsCodeRange(resolvedMethod.location);
            const key = [
                resolvedMethod.location.uri.fsPath,
                normalizedRange.start.line,
                normalizedRange.start.character,
                normalizedRange.end.line,
                normalizedRange.end.character
            ].join(':');

            if (seenLocations.has(key)) {
                continue;
            }

            seenLocations.add(key);
            locations.push(resolvedMethod.location);
        }

        return locations.length > 0 ? locations : undefined;
    }
}
