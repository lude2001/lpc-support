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
