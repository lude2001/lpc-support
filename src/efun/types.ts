export interface EfunDoc {
    name: string;
    syntax: string;
    description: string;
    sourceFile?: string;
    sourceRange?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
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
    signatures?: StructuredEfunSignature[];
}

export interface StructuredEfunDocBundle {
    generatedAt?: string;
    categories: Record<string, string[]>;
    docs: Record<string, StructuredEfunDoc>;
}

export interface StructuredEfunDoc {
    name: string;
    summary?: string;
    details?: string;
    note?: string;
    reference?: string[];
    category: string;
    signatures: StructuredEfunSignature[];
}

export interface StructuredEfunSignature {
    label: string;
    returnType?: string;
    isVariadic: boolean;
    parameters: StructuredEfunParameter[];
}

export interface StructuredEfunParameter {
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    variadic?: boolean;
}
