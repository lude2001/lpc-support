export interface EfunDoc {
    name: string;
    syntax: string;
    description: string;
    returnType?: string;
    returnValue?: string;
    returnObjects?: string[];
    example?: string;
    details?: string;
    reference?: string[];
    category?: string;
    lastUpdated?: number;
    isSimulated?: boolean;
    note?: string;
}

export interface BundledEfunDoc extends Omit<EfunDoc, 'name'> {
    name?: string;
}

export interface BundledEfunDocBundle {
    categories?: Record<string, string[]>;
    docs?: Record<string, BundledEfunDoc>;
}

export interface LegacyEfunConfigEntry {
    snippet?: string;
    detail?: string;
    description?: string;
    returnValue?: string;
    details?: string;
    reference?: string[];
    category?: string;
    note?: string;
}

export interface LegacyEfunConfig {
    efuns?: Record<string, LegacyEfunConfigEntry>;
}
