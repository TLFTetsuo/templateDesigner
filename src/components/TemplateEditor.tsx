import React, { useState, useRef } from 'react';
import { Template, TemplateEditorProps } from '../types';

// Canvas item types from AdvancedCanvasEditor
interface BaseItem {
  id: number;
  type: string;
  x: number;
  y: number;
  color: string;
  zIndex?: number;
}

interface RectItem extends BaseItem {
  type: "rect";
  width: number;
  height: number;
}

interface CircleItem extends BaseItem {
  type: "circle";
  radius: number;
}

interface TextItem extends BaseItem {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily?: string;
}

type CanvasItem = RectItem | CircleItem | TextItem;

const initialCanvasItems: CanvasItem[] = [
  { id: 1, type: "text", x: 100, y: 50, text: "Product Title", color: "#000", fontSize: 18, fontFamily: 'Arial, sans-serif' },
  { id: 2, type: "text", x: 100, y: 80, text: "Description", color: "#666", fontSize: 12, fontFamily: 'Arial, sans-serif' },
  { id: 3, type: "text", x: 100, y: 120, text: "$0.00", color: "#e74c3c", fontSize: 16, fontFamily: 'Arial, sans-serif' }
];

function getItemBounds(item: CanvasItem) {
  if (item.type === "rect") {
    return { x: item.x, y: item.y, width: item.width, height: item.height };
  }
  if (item.type === "circle") {
    return { x: item.x - item.radius, y: item.y - item.radius, width: item.radius * 2, height: item.radius * 2 };
  }
  if (item.type === "text") {
    return { x: item.x, y: item.y - item.fontSize, width: item.text.length * item.fontSize * 0.6, height: item.fontSize };
  }
  return {};
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onTemplateChange }) => {
    // Defensive check to ensure template is defined
    if (!template) {
        return <div>Loading...</div>;
    }

    // Canvas state
    const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(initialCanvasItems);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dragging, setDragging] = useState<boolean>(false);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [editingText, setEditingText] = useState<number | null>(null);
    const [showCanvasControls, setShowCanvasControls] = useState<boolean>(false);

    // Update canvas items when template changes
    React.useEffect(() => {
        setCanvasItems(prev => prev.map(item => {
            if (item.type === "text") {
                if (item.text === "Product Title" || item.id === 1) {
                    return { ...item, text: template.title || "Product Title" };
                }
                if (item.text.includes("Description") || item.id === 2) {
                    return { ...item, text: template.description || "Description" };
                }
                if (item.text.includes("$") || item.id === 3) {
                    return { ...item, text: template.price || "$0.00" };
                }
            }
            return item;
        }));
    }, [template.title, template.description, template.price]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        onTemplateChange({
            ...template,
            [name]: value
        });
    };

    // Canvas event handlers
    function handleMouseDown(e: React.MouseEvent, id: number) {
        setSelectedId(id);
        setDragging(true);
        const item = canvasItems.find(i => i.id === id);
        if (!item) return;
        
        const bounds = getItemBounds(item);
        const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
        if (!rect) return;
        
        setDragOffset({
            x: (e.clientX - rect.left) - (bounds.x || 0),
            y: (e.clientY - rect.top) - (bounds.y || 0)
        });
    }

    function handleMouseMove(e: MouseEvent) {
        if (dragging && selectedId !== null) {
            const rect = document.querySelector('.template-canvas')?.getBoundingClientRect();
            if (!rect) return;
            
            setCanvasItems(items =>
                items.map(item =>
                    item.id === selectedId
                        ? {
                            ...item,
                            x: (e.clientX - rect.left) - dragOffset.x,
                            y: (e.clientY - rect.top) - dragOffset.y
                        }
                        : item
                )
            );
        }
    }

    function handleMouseUp() {
        setDragging(false);
    }

    // Add mouse event listeners
    React.useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [dragging, selectedId, dragOffset]);

    const addElement = (type: string) => {
        const newId = Math.max(...canvasItems.map(item => item.id)) + 1;
        let newItem: CanvasItem;
        
        switch (type) {
            case 'rect':
                newItem = { id: newId, type: 'rect', x: 50, y: 50, width: 100, height: 60, color: '#3498db' };
                break;
            case 'circle':
                newItem = { id: newId, type: 'circle', x: 100, y: 100, radius: 30, color: '#e74c3c' };
                break;
            case 'text':
                newItem = { id: newId, type: 'text', x: 50, y: 50, text: 'New Text', fontSize: 14, color: '#000', fontFamily: 'Arial, sans-serif' };
                break;
            default:
                return;
        }
        
        setCanvasItems([...canvasItems, newItem]);
    };

    return (
        <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
            {/* Form Controls */}
            <div style={{ flex: '0 0 300px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h2>Template Properties</h2>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Title:</label>
                        <input 
                            type="text" 
                            name="title" 
                            value={template.title} 
                            onChange={handleChange}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description:</label>
                        <textarea 
                            name="description" 
                            value={template.description} 
                            onChange={handleChange}
                            rows={4}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', resize: 'vertical' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Price:</label>
                        <input 
                            type="text" 
                            name="price" 
                            value={template.price} 
                            onChange={handleChange}
                            placeholder="e.g., $9.99"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Image URL:</label>
                        <input 
                            type="url" 
                            name="imageUrl" 
                            value={template.imageUrl} 
                            onChange={handleChange}
                            placeholder="https://example.com/image.jpg"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                        />
                    </div>
                </form>

                {/* Canvas Controls */}
                <div>
                    <button 
                        onClick={() => setShowCanvasControls(!showCanvasControls)}
                        style={{ 
                            width: '100%', 
                            padding: '10px', 
                            backgroundColor: '#3498db', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px',
                            marginBottom: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        {showCanvasControls ? 'Hide' : 'Show'} Canvas Controls
                    </button>
                    
                    {showCanvasControls && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{ margin: '10px 0', fontSize: '16px' }}>Add Elements</h3>
                            <button onClick={() => addElement('rect')} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}>
                                Add Rectangle
                            </button>
                            <button onClick={() => addElement('circle')} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}>
                                Add Circle
                            </button>
                            <button onClick={() => addElement('text')} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}>
                                Add Text
                            </button>
                            
                            {selectedId && (
                                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '4px' }}>
                                    <h4>Selected Element</h4>
                                    <p>ID: {selectedId}</p>
                                    <input 
                                        type="color" 
                                        value={canvasItems.find(item => item.id === selectedId)?.color || '#000000'} 
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    item.id === selectedId ? { ...item, color: e.target.value } : item
                                                )
                                            );
                                        }}
                                        style={{ width: '100%', height: '40px' }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Canvas Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h2>Template Canvas</h2>
                <div style={{ 
                    flex: 1, 
                    border: '2px solid #ddd', 
                    borderRadius: '8px', 
                    backgroundColor: 'white',
                    position: 'relative',
                    minHeight: '400px'
                }}>
                    <svg 
                        className="template-canvas"
                        width="100%" 
                        height="100%" 
                        style={{ cursor: dragging ? 'grabbing' : 'default' }}
                    >
                        {/* Background grid */}
                        <defs>
                            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                        
                        {/* Canvas Items */}
                        {canvasItems.map(item => {
                            if (item.type === "rect") {
                                return (
                                    <rect
                                        key={item.id}
                                        x={item.x}
                                        y={item.y}
                                        width={item.width}
                                        height={item.height}
                                        fill={item.color}
                                        stroke={selectedId === item.id ? "#007bff" : "none"}
                                        strokeWidth={selectedId === item.id ? 2 : 0}
                                        style={{ cursor: "grab" }}
                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                    />
                                );
                            }
                            if (item.type === "circle") {
                                return (
                                    <circle
                                        key={item.id}
                                        cx={item.x}
                                        cy={item.y}
                                        r={item.radius}
                                        fill={item.color}
                                        stroke={selectedId === item.id ? "#007bff" : "none"}
                                        strokeWidth={selectedId === item.id ? 2 : 0}
                                        style={{ cursor: "grab" }}
                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                    />
                                );
                            }
                            if (item.type === "text") {
                                return (
                                    <text
                                        key={item.id}
                                        x={item.x}
                                        y={item.y}
                                        fill={item.color}
                                        fontSize={item.fontSize}
                                        style={{ cursor: "grab", userSelect: "none" }}
                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                    >
                                        {item.text}
                                    </text>
                                );
                            }
                            return null;
                        })}
                        
                        {/* Template Image */}
                        {template.imageUrl && (
                            <image
                                href={template.imageUrl}
                                x="20"
                                y="20"
                                width="100"
                                height="100"
                                style={{ opacity: 0.8 }}
                            />
                        )}
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditor;