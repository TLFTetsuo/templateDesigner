export function generateYaml(templateData: any): string {
    const yaml = require('js-yaml');
    return yaml.dump(templateData);
}