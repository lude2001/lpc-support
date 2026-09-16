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
    availability?: StructuredEfunAvailability;
    signatures: StructuredEfunSignature[];
}

export interface StructuredEfunAvailability {
    package: string;
    condition: string;
    source?: string;
}

export interface StructuredEfunSignature {
    label: string;
    returnType?: string;
    isVariadic: boolean;
    arity?: {
        min: number;
        max?: number | null;
    };
    parameters: StructuredEfunParameter[];
}

export interface StructuredEfunParameter {
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    variadic?: boolean;
}
