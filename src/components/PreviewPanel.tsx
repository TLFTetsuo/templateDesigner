import React from 'react';
import { Template, PreviewPanelProps } from '../types';

const PreviewPanel: React.FC<PreviewPanelProps> = ({ template }) => {
    // Defensive check to ensure template is defined
    if (!template) {
        return <div>Loading template preview...</div>;
    }

    return (
        <div className="preview-panel">
            <h2>Template Preview</h2>
            <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                <h3>{template.title || 'Untitled'}</h3>
                <p>{template.description || 'No description'}</p>
                <p><strong>Price:</strong> {template.price || 'N/A'}</p>
                {template.imageUrl && (
                    <div>
                        <strong>Image:</strong>
                        <br />
                        <img 
                            src={template.imageUrl} 
                            alt="Template preview" 
                            style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain' }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                )}
            </div>
            <details style={{ marginTop: '20px' }}>
                <summary>Raw Data (JSON)</summary>
                <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                    {JSON.stringify(template, null, 2)}
                </pre>
            </details>
        </div>
    );
};

export default PreviewPanel;