import React from 'react';
import { saveAs } from 'file-saver';
import { generateYaml } from '../utils/yamlGenerator';

const YamlExporter: React.FC<{ templateData: any }> = ({ templateData }) => {
    const exportYaml = () => {
        const yamlContent = generateYaml(templateData);
        const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
        saveAs(blob, 'template.yaml');
    };

    return (
        <div>
            <button onClick={exportYaml}>Export as YAML</button>
        </div>
    );
};

export default YamlExporter;