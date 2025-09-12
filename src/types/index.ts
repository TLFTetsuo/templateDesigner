export interface Template {
    id?: string;
    title: string;
    description: string;
    imageUrl: string;
    price: string; // Changed from number to string to match current usage
    currency?: string;
    additionalInfo?: Record<string, any>;
}

export interface TemplateEditorProps {
    template: Template;
    onTemplateChange: (template: Template) => void;
}

export interface PreviewPanelProps {
    template: Template;
}

export interface YamlExport {
    templates: Template[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}