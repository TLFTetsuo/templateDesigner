import React from 'react';
import { generateYaml } from '../utils/yamlGenerator';

const YamlExporter: React.FC<{ templateData: any }> = ({ templateData }) => {
    const exportYaml = () => {
        const yamlContent = generateYaml(templateData);
        const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'template.yaml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <button onClick={exportYaml}>Export as YAML</button>
        </div>
    );
};

export default YamlExporter;