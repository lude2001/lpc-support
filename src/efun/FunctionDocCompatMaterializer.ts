import type { CallableDoc, CallableSignature, DocumentCallableDocs } from '../language/documentation/types';
import type {
    FunctionDocLookup,
    FunctionDocSourceGroup,
    MaterializedFunctionDocLookup,
    RawFunctionDocLookup,
    RawFunctionDocSource
} from './FunctionDocLookupTypes';
import type { EfunDoc } from './types';

export class FunctionDocCompatMaterializer {
    public materializeLookup(rawLookup: RawFunctionDocLookup): MaterializedFunctionDocLookup {
        const currentFile = this.materializeSourceGroup(rawLookup.currentFile);
        const inheritedGroups = rawLookup.inheritedGroups.map((source) => this.materializeSourceGroup(source));
        const includeGroups = rawLookup.includeGroups.map((source) => this.materializeSourceGroup(source));

        return {
            inheritedFiles: [...rawLookup.inheritedFiles],
            currentFileDocs: currentFile.docs,
            inheritedFileDocs: this.materializeGroupedMaps(inheritedGroups),
            includeFileDocs: this.materializeGroupedMaps(includeGroups),
            lookup: {
                currentFile,
                inheritedGroups,
                includeGroups
            }
        };
    }

    public materializeSourceGroup(source: RawFunctionDocSource): FunctionDocSourceGroup {
        return {
            source: source.source,
            filePath: source.filePath,
            docs: this.materializeDocMap(source.docs, source.source)
        };
    }

    public materializeDocMap(documentDocs: DocumentCallableDocs, category: string): Map<string, EfunDoc> {
        const docs = new Map<string, EfunDoc>();

        for (const [name, declarationKeys] of documentDocs.byName.entries()) {
            const preferredDeclarationKey = declarationKeys[0];
            if (!preferredDeclarationKey || docs.has(name)) {
                continue;
            }

            const callableDoc = documentDocs.byDeclaration.get(preferredDeclarationKey);
            if (!callableDoc) {
                continue;
            }

            docs.set(name, this.materializeCompatDoc(callableDoc, category));
        }

        return docs;
    }

    private materializeGroupedMaps(
        groups: FunctionDocSourceGroup[]
    ): Map<string, Map<string, EfunDoc>> {
        return new Map(groups.map((group) => [group.filePath, group.docs]));
    }

    private materializeCompatDoc(callableDoc: CallableDoc, category: string): EfunDoc {
        return {
            name: callableDoc.name,
            syntax: callableDoc.signatures.map((signature) => signature.label).join('\n'),
            description: callableDoc.summary ?? '',
            sourceFile: callableDoc.sourcePath,
            sourceRange: callableDoc.sourceRange,
            returnType: deriveCompatReturnType(callableDoc.signatures),
            returnValue: callableDoc.returns?.description,
            returnObjects: callableDoc.returnObjects ? [...callableDoc.returnObjects] : undefined,
            details: callableDoc.details,
            note: callableDoc.note,
            category,
            lastUpdated: Date.now(),
            signatures: callableDoc.signatures.map((signature) => ({
                label: signature.label,
                returnType: signature.returnType,
                isVariadic: signature.isVariadic,
                parameters: signature.parameters.map((parameter) => ({
                    name: parameter.name,
                    type: parameter.type,
                    description: parameter.description,
                    optional: parameter.optional,
                    variadic: parameter.variadic
                }))
            }))
        };
    }
}

function deriveCompatReturnType(signatures: CallableSignature[]): string | undefined {
    if (signatures.length === 0) {
        return undefined;
    }

    if (signatures.length === 1) {
        return signatures[0].returnType;
    }

    const returnTypes = signatures.map((signature) => signature.returnType?.trim()).filter(Boolean);
    if (returnTypes.length !== signatures.length) {
        return undefined;
    }

    const [firstReturnType, ...restReturnTypes] = returnTypes;
    return restReturnTypes.every((returnType) => returnType === firstReturnType)
        ? firstReturnType
        : undefined;
}
