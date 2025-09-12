import React, { useState } from 'react';
import { Template } from '../types';
import styles from '../styles/EslDesigner.module.css';

interface SidebarSection {
  id: string;
  name: string;
  icon: string;
}

const sidebarSections: SidebarSection[] = [
  { id: 'templates', name: 'Templates', icon: '📄' },
  { id: 'text', name: 'Text', icon: '📝' },
  { id: 'elements', name: 'Elements', icon: '🔲' },
  { id: 'images', name: 'Images', icon: '🖼️' },
  { id: 'background', name: 'Background', icon: '🎨' }
];

const EslDesigner = () => {
  const [activeSection, setActiveSection] = useState('templates');
  const [template, setTemplate] = useState<Template>({
    title: '',
    description: '',
    price: '',
    imageUrl: ''
  });

  const renderSidebarContent = () => {
    switch (activeSection) {
      case 'templates':
        return (
          <div className={styles.sidebarContent}>
            <h3>Template Library</h3>
            <div className={styles.templateGrid}>
              <div className={styles.templateItem}>Basic Layout</div>
              <div className={styles.templateItem}>Product Card</div>
              <div className={styles.templateItem}>Price Tag</div>
            </div>
          </div>
        );
      case 'text':
        return (
          <div className={styles.sidebarContent}>
            <h3>Text Elements</h3>
            <div className={styles.textControls}>
              <label>
                Title:
                <input 
                  type="text" 
                  value={template.title} 
                  onChange={(e) => setTemplate({...template, title: e.target.value})}
                />
              </label>
              <label>
                Description:
                <textarea 
                  value={template.description} 
                  onChange={(e) => setTemplate({...template, description: e.target.value})}
                />
              </label>
              <label>
                Price:
                <input 
                  type="text" 
                  value={template.price} 
                  onChange={(e) => setTemplate({...template, price: e.target.value})}
                />
              </label>
            </div>
          </div>
        );
      case 'elements':
        return (
          <div className={styles.sidebarContent}>
            <h3>Design Elements</h3>
            <div className={styles.elementGrid}>
              <div className={styles.elementItem}>Rectangle</div>
              <div className={styles.elementItem}>Circle</div>
              <div className={styles.elementItem}>Line</div>
              <div className={styles.elementItem}>QR Code</div>
            </div>
          </div>
        );
      case 'images':
        return (
          <div className={styles.sidebarContent}>
            <h3>Images</h3>
            <label>
              Image URL:
              <input 
                type="url" 
                value={template.imageUrl} 
                onChange={(e) => setTemplate({...template, imageUrl: e.target.value})}
                placeholder="https://example.com/image.jpg"
              />
            </label>
            <div className={styles.imageLibrary}>
              <div className={styles.imagePlaceholder}>Upload Image</div>
            </div>
          </div>
        );
      case 'background':
        return (
          <div className={styles.sidebarContent}>
            <h3>Background</h3>
            <div className={styles.backgroundOptions}>
              <div className={`${styles.bgOption} ${styles.white}`}>White</div>
              <div className={`${styles.bgOption} ${styles.black}`}>Black</div>
              <div className={`${styles.bgOption} ${styles.transparent}`}>Transparent</div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.eslDesigner}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>ESL Template Designer</span>
        </div>
      </div>

      <div className={styles.mainLayout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <nav className={styles.sidebarNav}>
            {sidebarSections.map(section => (
              <button
                key={section.id}
                className={`${styles.sidebarItem} ${activeSection === section.id ? styles.active : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className={styles.sidebarIcon}>{section.icon}</span>
                <span className={styles.sidebarLabel}>{section.name}</span>
              </button>
            ))}
          </nav>
          
          {/* Sidebar Content */}
          <div className={styles.sidebarPanel}>
            {renderSidebarContent()}
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className={styles.canvasArea}>
          <div className={styles.canvasToolbar}>
            <div className={styles.canvasInfo}>
              <span className={styles.canvasType}>Type: 200x200_BW</span>
            </div>
            <div className={styles.canvasControls}>
              <button className={styles.btnSecondary}>Preview</button>
              <button className={styles.btnPrimary}>Export YAML</button>
            </div>
          </div>
          
          <div className={styles.canvasContainer}>
            <div className={styles.canvas} style={{ width: '200px', height: '200px' }}>
              {/* ESL Preview */}
              <div className={styles.eslPreview}>
                <div className={styles.eslContent}>
                  {template.title && (
                    <h2 className={styles.eslTitle}>{template.title}</h2>
                  )}
                  {template.description && (
                    <p className={styles.eslDescription}>{template.description}</p>
                  )}
                  {template.price && (
                    <div className={styles.eslPrice}>{template.price}</div>
                  )}
                  {template.imageUrl && (
                    <img 
                      src={template.imageUrl} 
                      alt="Product" 
                      className={styles.eslImage}
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EslDesigner;
