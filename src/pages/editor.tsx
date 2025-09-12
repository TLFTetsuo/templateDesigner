import React, { useState } from 'react';
import IntegratedTemplateEditor from '../components/IntegratedTemplateEditor';
import { Template } from '../types';

const EditorPage = () => {
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
                padding: '20px', 
                backgroundColor: '#f8f9fa', 
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h1 style={{ margin: 0 }}>Template Designer</h1>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    height: '60px' 
                }}>
                    <img 
                        src="/eon_displays-logo.webp" 
                        alt="EON DISPLAYS Logo" 
                        style={{ 
                            height: '50px',
                            objectFit: 'contain'
                        }}
                    />
                </div>
            </div>
            <div style={{ flex: 1, padding: '20px' }}>
                <IntegratedTemplateEditor />
            </div>
        </div>
    );
};

export default EditorPage;