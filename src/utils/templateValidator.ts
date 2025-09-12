export function validateTemplate(template: any): boolean {
    const requiredFields = ['title', 'price', 'description'];

    for (const field of requiredFields) {
        if (!template[field]) {
            console.error(`Validation error: Missing required field '${field}'`);
            return false;
        }
    }

    if (typeof template.price !== 'number' || template.price < 0) {
        console.error('Validation error: Price must be a non-negative number');
        return false;
    }

    return true;
}