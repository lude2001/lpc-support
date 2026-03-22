import { LpcResolvedConfig } from './LpcProjectConfig';

const FIELD_MAP: Record<string, keyof LpcResolvedConfig> = {
    'name': 'name',
    'mudlib directory': 'mudlibDirectory',
    'binary directory': 'binaryDirectory',
    'include directories': 'includeDirectories',
    'simulated efun file': 'simulatedEfunFile',
    'master file': 'masterFile',
    'global include file': 'globalIncludeFile'
};

export function parseConfigHell(source: string): LpcResolvedConfig {
    const result: LpcResolvedConfig = {};

    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const mappedField = FIELD_MAP[key];

        if (!mappedField) {
            continue;
        }

        if (mappedField === 'includeDirectories') {
            const directories = rawValue
                .split(':')
                .map((value) => value.trim())
                .filter(Boolean);

            if (directories.length > 0) {
                result.includeDirectories = directories;
            }
            continue;
        }

        if (rawValue) {
            result[mappedField] = rawValue as never;
        }
    }

    return result;
}
