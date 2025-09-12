import React, { useState, useRef, useCallback } from 'react';
import styles from '../styles/EslDesigner.module.css';

// Canvas item types from AdvancedCanvasEditor
interface BaseItem {
  id: number;
  type: string;
  x: number;
  y: number;
  color: string;
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
}

interface LineItem extends BaseItem {
  type: "line";
  x2: number;
  y2: number;
  strokeWidth: number;
}

interface BarcodeItem extends BaseItem {
  type: "barcode";
  width: number;
  height: number;
  data: string;
}

interface QRCodeItem extends BaseItem {
  type: "qrcode";
  size: number;
  data: string;
}

type CanvasItem = RectItem | CircleItem | TextItem | LineItem | BarcodeItem | QRCodeItem;

// ESL Designer menu sections
interface SidebarSection {
  id: string;
  name: string;
  icon: string;
}

const sidebarSections: SidebarSection[] = [
  { id: 'templates', name: 'Canvas', icon: '📄' },
  { id: 'elements', name: 'Elements', icon: '🔲' }
];

const propertiesSections: SidebarSection[] = [
  { id: 'properties', name: 'Properties', icon: '⚙️' }
];

const initialCanvasItems: CanvasItem[] = [
  { id: 1, type: "text", x: 100, y: 50, text: "Product Title", color: "#000000", fontSize: 18 },
  { id: 2, type: "text", x: 100, y: 80, text: "Description", color: "#000000", fontSize: 12 },
  { id: 3, type: "text", x: 100, y: 120, text: "$0.00", color: "#ff0000", fontSize: 16 }
];

const TemplateEditor: React.FC = () => {

    // Move getItemBounds inside component to fix Fast Refresh issues
    const getItemBounds = useCallback((item: CanvasItem) => {
        if (item.type === "rect") {
            return { x: item.x, y: item.y, width: item.width, height: item.height };
        }
        if (item.type === "circle") {
            return { x: item.x - item.radius, y: item.y - item.radius, width: item.radius * 2, height: item.radius * 2 };
        }
        if (item.type === "text") {
            return { x: item.x, y: item.y - item.fontSize, width: item.text.length * item.fontSize * 0.6, height: item.fontSize };
        }
        if (item.type === "line") {
            const minX = Math.min(item.x, item.x2);
            const minY = Math.min(item.y, item.y2);
            const maxX = Math.max(item.x, item.x2);
            const maxY = Math.max(item.y, item.y2);
            return { x: minX, y: minY, width: maxX - minX || item.strokeWidth, height: maxY - minY || item.strokeWidth };
        }
        if (item.type === "barcode") {
            return { x: item.x, y: item.y, width: item.width, height: item.height };
        }
        if (item.type === "qrcode") {
            return { x: item.x, y: item.y, width: item.size, height: item.size };
        }
        return {};
    }, []);

    // Helper function for preset button styling
    const getPresetButtonStyle = useCallback((isActive: boolean) => ({
        padding: '10px 12px', 
        fontSize: '13px', 
        fontWeight: '600',
        border: '2px solid #d0d7de', 
        borderRadius: '6px',
        background: isActive 
            ? 'linear-gradient(145deg, #e3f2fd, #bbdefb)' 
            : 'linear-gradient(145deg, #ffffff, #f6f8fa)',
        boxShadow: isActive
            ? '0 3px 6px rgba(25, 118, 210, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.7)'
            : '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        cursor: 'pointer',
        textAlign: 'center' as const,
        transition: 'all 0.2s ease',
        color: isActive ? '#1565c0' : '#24292f'
    }), []);

    const getPresetButtonHandlers = useCallback((isActive: boolean) => ({
        onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = isActive
                ? '0 4px 8px rgba(25, 118, 210, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                : '0 3px 6px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
        },
        onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isActive
                ? '0 3px 6px rgba(25, 118, 210, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.7)'
                : '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
        },
        onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = 'translateY(0)';
        }
    }), []);

    // Helper function for element button styling
    const getElementButtonStyle = useCallback(() => ({
        padding: '15px 10px',
        fontSize: '12px',
        fontWeight: '600',
        border: '2px solid #d0d7de',
        borderRadius: '6px',
        background: 'linear-gradient(145deg, #ffffff, #f6f8fa)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        cursor: 'pointer',
        textAlign: 'center' as const,
        transition: 'all 0.2s ease',
        color: '#24292f',
        width: '100%',
        display: 'block'
    }), []);

    const getElementButtonHandlers = useCallback(() => ({
        onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
        },
        onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
        },
        onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = 'translateY(0)';
        }
    }), []);

    // ESL Designer state
    const [activeSection, setActiveSection] = useState<string | null>('templates');
    const [activePropertiesSection, setActivePropertiesSection] = useState('properties');

    // Canvas state
    const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(initialCanvasItems);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dragging, setDragging] = useState<boolean>(false);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [editingText, setEditingText] = useState<number | null>(null);
    
    // Resize state
    const [resizing, setResizing] = useState<boolean>(false);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
    
    // Canvas dimensions state
    const [canvasWidth, setCanvasWidth] = useState<number>(250);
    const [canvasHeight, setCanvasHeight] = useState<number>(122);

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

    // Font size input state (for delayed updates)
    const [fontSizeInput, setFontSizeInput] = useState<string>('');
    const [isFontSizeEditing, setIsFontSizeEditing] = useState<boolean>(false);

    // Delete selected item function
    const deleteSelectedItem = useCallback(() => {
        if (selectedId !== null) {
            setCanvasItems(items => items.filter(item => item.id !== selectedId));
            setSelectedId(null);
        }
    }, [selectedId]);

    // Zoom functions
    const zoomIn = useCallback(() => {
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex < zoomLevels.length - 1) {
            setZoomLevel(zoomLevels[currentIndex + 1]);
        }
    }, [zoomLevel, zoomLevels]);

    const zoomOut = useCallback(() => {
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex > 0) {
            setZoomLevel(zoomLevels[currentIndex - 1]);
        }
    }, [zoomLevel, zoomLevels]);

    const resetZoom = useCallback(() => {
        setZoomLevel(1);
    }, []);

    const setSpecificZoom = useCallback((zoom: number) => {
        setZoomLevel(zoom);
    }, []);

    // Font size input handlers
    const handleFontSizeInputFocus = useCallback((currentFontSize: number) => {
        setFontSizeInput(currentFontSize.toString());
        setIsFontSizeEditing(true);
    }, []);

    const handleFontSizeInputChange = useCallback((value: string) => {
        setFontSizeInput(value);
    }, []);

    const handleFontSizeInputSubmit = useCallback(() => {
        const inputValue = fontSizeInput.trim();
        
        // Only update if we have a valid, non-empty input
        if (inputValue !== '') {
            const parsedFontSize = parseInt(inputValue);
            
            if (!isNaN(parsedFontSize)) {
                const clampedFontSize = Math.max(8, Math.min(200, parsedFontSize));
                
                setCanvasItems(items =>
                    items.map(item =>
                        item.id === selectedId && item.type === 'text' 
                            ? { ...item, fontSize: clampedFontSize } 
                            : item
                    )
                );
            }
        }
        
        // Always exit editing mode
        setIsFontSizeEditing(false);
        setFontSizeInput('');
    }, [fontSizeInput, selectedId]);

    const handleFontSizeInputBlur = useCallback(() => {
        // Simply submit whatever is in the input
        handleFontSizeInputSubmit();
    }, [handleFontSizeInputSubmit]);

    const handleFontSizeKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleFontSizeInputSubmit();
        } else if (e.key === 'Escape') {
            setIsFontSizeEditing(false);
            setFontSizeInput('');
        }
    }, [handleFontSizeInputSubmit]);

    // Reset font size editing state when selected element changes
    React.useEffect(() => {
        setIsFontSizeEditing(false);
        setFontSizeInput('');
    }, [selectedId]);

    // Selected Element Controls Component
    const renderSelectedElementControls = useCallback(() => {
        if (!selectedId) return null;

        const selectedItem = canvasItems.find(item => item.id === selectedId);
        if (!selectedItem) return null;

        return (
            <div style={{ marginTop: '10px' }}>
                {/* Position Controls */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                        Position (pixels):
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>X:</label>
                            <input 
                                type="number" 
                                step="1"
                                value={selectedItem.x}
                                onChange={(e) => {
                                    const newX = parseInt(e.target.value) || 0;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId 
                                                ? { ...item, x: Math.max(0, Math.min(canvasWidth - 10, newX)) }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>Y:</label>
                            <input 
                                type="number" 
                                step="1"
                                value={selectedItem.y}
                                onChange={(e) => {
                                    const newY = parseInt(e.target.value) || 0;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId 
                                                ? { ...item, y: Math.max(0, Math.min(canvasHeight - 10, newY)) }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
                        Canvas: {canvasWidth} × {canvasHeight} px
                    </div>
                </div>

                {/* Color Control */}
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                        Color:
                    </label>
                    <select 
                        value={selectedItem.color}
                        onChange={(e) => {
                            setCanvasItems(items =>
                                items.map(item =>
                                    item.id === selectedId 
                                        ? { ...item, color: e.target.value }
                                        : item
                                )
                            );
                        }}
                        style={{ width: '100%', height: '35px', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'white' }}
                    >
                        <option value="#000000">Black</option>
                        <option value="#ffffff">White</option>
                        <option value="#ff0000">Red</option>
                        <option value="#ffff00">Yellow</option>
                    </select>
                </div>

                {/* Type-specific controls */}
                {selectedItem.type === 'text' && (
                    <>
                        {/* Text Content */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Text Content:
                            </label>
                            <input 
                                type="text" 
                                value={(selectedItem as any).text || ''}
                                onChange={(e) => {
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'text'
                                                ? { ...item, text: e.target.value }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '6px 8px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>

                        {/* Font Size Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Font Size:
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="8"
                                max="200"
                                value={isFontSizeEditing ? fontSizeInput : ((selectedItem as any).fontSize || 16)}
                                onFocus={() => handleFontSizeInputFocus((selectedItem as any).fontSize || 16)}
                                onChange={(e) => handleFontSizeInputChange(e.target.value)}
                                onBlur={handleFontSizeInputBlur}
                                onKeyDown={handleFontSizeKeyDown}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
                                Range: 8px - 200px {isFontSizeEditing && '• Press Enter to apply'}
                            </div>
                        </div>
                    </>
                )}

                {selectedItem.type === 'rect' && (
                    <>
                        {/* Width Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Width:
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="1"
                                value={(selectedItem as any).width || 50}
                                onChange={(e) => {
                                    const newWidth = parseInt(e.target.value) || 50;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'rect'
                                                ? { ...item, width: Math.max(1, newWidth) }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>

                        {/* Height Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Height:
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="1"
                                value={(selectedItem as any).height || 50}
                                onChange={(e) => {
                                    const newHeight = parseInt(e.target.value) || 50;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'rect'
                                                ? { ...item, height: Math.max(1, newHeight) }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                    </>
                )}

                {selectedItem.type === 'circle' && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                            Radius:
                        </label>
                        <input 
                            type="number" 
                            step="1"
                            min="1"
                            value={(selectedItem as any).radius || 25}
                            onChange={(e) => {
                                const newRadius = parseInt(e.target.value) || 25;
                                setCanvasItems(items =>
                                    items.map(item =>
                                        item.id === selectedId && item.type === 'circle'
                                            ? { ...item, radius: Math.max(1, newRadius) }
                                            : item
                                    )
                                );
                            }}
                            style={{ 
                                width: '100%', 
                                padding: '4px 6px', 
                                fontSize: '12px',
                                border: '1px solid #ddd',
                                borderRadius: '3px'
                            }}
                        />
                    </div>
                )}

                {/* Line Properties */}
                {selectedItem.type === 'line' && (
                    <>
                        {/* End Position Controls */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                End Position (pixels):
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>X2:</label>
                                    <input 
                                        type="number" 
                                        step="1"
                                        value={(selectedItem as any).x2 || 0}
                                        onChange={(e) => {
                                            const newX2 = parseInt(e.target.value) || 0;
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    item.id === selectedId && item.type === 'line'
                                                        ? { ...item, x2: Math.max(0, Math.min(canvasWidth, newX2)) }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ 
                                            width: '100%', 
                                            padding: '4px 6px', 
                                            fontSize: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>Y2:</label>
                                    <input 
                                        type="number" 
                                        step="1"
                                        value={(selectedItem as any).y2 || 0}
                                        onChange={(e) => {
                                            const newY2 = parseInt(e.target.value) || 0;
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    item.id === selectedId && item.type === 'line'
                                                        ? { ...item, y2: Math.max(0, Math.min(canvasHeight, newY2)) }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ 
                                            width: '100%', 
                                            padding: '4px 6px', 
                                            fontSize: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Stroke Width Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Line Width:
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="1"
                                value={(selectedItem as any).strokeWidth || 1}
                                onChange={(e) => {
                                    const newStrokeWidth = parseInt(e.target.value) || 1;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'line'
                                                ? { ...item, strokeWidth: Math.max(1, newStrokeWidth) }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Barcode Properties */}
                {selectedItem.type === 'barcode' && (
                    <>
                        {/* Width & Height Controls */}
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>Width:</label>
                                    <input 
                                        type="number" 
                                        step="1"
                                        min="1"
                                        value={(selectedItem as any).width || 100}
                                        onChange={(e) => {
                                            const newWidth = parseInt(e.target.value) || 100;
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    item.id === selectedId && item.type === 'barcode'
                                                        ? { ...item, width: Math.max(1, newWidth) }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ 
                                            width: '100%', 
                                            padding: '4px 6px', 
                                            fontSize: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>Height:</label>
                                    <input 
                                        type="number" 
                                        step="1"
                                        min="1"
                                        value={(selectedItem as any).height || 30}
                                        onChange={(e) => {
                                            const newHeight = parseInt(e.target.value) || 30;
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    item.id === selectedId && item.type === 'barcode'
                                                        ? { ...item, height: Math.max(1, newHeight) }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ 
                                            width: '100%', 
                                            padding: '4px 6px', 
                                            fontSize: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '3px'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Barcode Data Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Barcode Data:
                            </label>
                            <input 
                                type="text"
                                value={(selectedItem as any).data || ''}
                                onChange={(e) => {
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'barcode'
                                                ? { ...item, data: e.target.value }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                    </>
                )}

                {/* QR Code Properties */}
                {selectedItem.type === 'qrcode' && (
                    <>
                        {/* Size Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Size:
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="10"
                                value={(selectedItem as any).size || 50}
                                onChange={(e) => {
                                    const newSize = parseInt(e.target.value) || 50;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'qrcode'
                                                ? { ...item, size: Math.max(10, newSize) }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                        
                        {/* QR Data Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                QR Code Data:
                            </label>
                            <input 
                                type="text"
                                value={(selectedItem as any).data || ''}
                                onChange={(e) => {
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            item.id === selectedId && item.type === 'qrcode'
                                                ? { ...item, data: e.target.value }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Delete Button */}
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <button
                        onClick={deleteSelectedItem}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                        onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#c82333'}
                        onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#dc3545'}
                    >
                        Delete Element
                    </button>
                </div>

                {/* Keyboard Controls Help */}
                <div style={{ marginTop: '15px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '3px', fontSize: '10px', color: '#666' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Keyboard Controls:</div>
                    <div>• Arrow keys: Move element (1px)</div>
                    <div>• Shift + Arrow keys: Move element (10px)</div>
                    <div>• Delete/Backspace: Remove element</div>
                    <div>• Ctrl/Cmd + Plus: Zoom in</div>
                    <div>• Ctrl/Cmd + Minus: Zoom out</div>
                    <div>• Ctrl/Cmd + 0: Reset zoom</div>
                </div>
            </div>
        );
    }, [selectedId, canvasItems, canvasWidth, canvasHeight, deleteSelectedItem, isFontSizeEditing, fontSizeInput, handleFontSizeInputFocus, handleFontSizeInputChange, handleFontSizeInputBlur, handleFontSizeKeyDown]);

    // ESL Designer sidebar content renderer
    const renderSidebarContent = useCallback(() => {
        switch (activeSection) {
            case 'templates':
                return (
                    <div className={styles.sidebarContent}>
                        <h3>Canvas Presets</h3>
                        
                        {/* Canvas Dimension Presets */}
                        <div style={{ marginBottom: '20px' }}>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <button 
                                    onClick={() => setPresetDimensions(200, 200)}
                                    style={getPresetButtonStyle(canvasWidth === 200 && canvasHeight === 200)}
                                    {...getPresetButtonHandlers(canvasWidth === 200 && canvasHeight === 200)}
                                >
                                    200 × 200
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(250, 122)}
                                    style={getPresetButtonStyle(canvasWidth === 250 && canvasHeight === 122)}
                                    {...getPresetButtonHandlers(canvasWidth === 250 && canvasHeight === 122)}
                                >
                                    250 × 122
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(296, 152)}
                                    style={getPresetButtonStyle(canvasWidth === 296 && canvasHeight === 152)}
                                    {...getPresetButtonHandlers(canvasWidth === 296 && canvasHeight === 152)}
                                >
                                    296 × 152
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(296, 128)}
                                    style={getPresetButtonStyle(canvasWidth === 296 && canvasHeight === 128)}
                                    {...getPresetButtonHandlers(canvasWidth === 296 && canvasHeight === 128)}
                                >
                                    296 × 128
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(384, 184)}
                                    style={getPresetButtonStyle(canvasWidth === 384 && canvasHeight === 184)}
                                    {...getPresetButtonHandlers(canvasWidth === 384 && canvasHeight === 184)}
                                >
                                    384 × 184
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(400, 300)}
                                    style={getPresetButtonStyle(canvasWidth === 400 && canvasHeight === 300)}
                                    {...getPresetButtonHandlers(canvasWidth === 400 && canvasHeight === 300)}
                                >
                                    400 × 300
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(416, 240)}
                                    style={getPresetButtonStyle(canvasWidth === 416 && canvasHeight === 240)}
                                    {...getPresetButtonHandlers(canvasWidth === 416 && canvasHeight === 240)}
                                >
                                    416 × 240
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(648, 480)}
                                    style={getPresetButtonStyle(canvasWidth === 648 && canvasHeight === 480)}
                                    {...getPresetButtonHandlers(canvasWidth === 648 && canvasHeight === 480)}
                                >
                                    648 × 480
                                </button>
                                <button 
                                    onClick={() => setPresetDimensions(800, 480)}
                                    style={getPresetButtonStyle(canvasWidth === 800 && canvasHeight === 480)}
                                    {...getPresetButtonHandlers(canvasWidth === 800 && canvasHeight === 480)}
                                >
                                    800 × 480
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'elements':
                return (
                    <div className={styles.sidebarContent}>
                        <h3>Design Elements</h3>
                        <div className={styles.elementGrid}>
                            <button 
                                onClick={() => addElement('text')}
                                style={getElementButtonStyle()}
                                {...getElementButtonHandlers()}
                            >
                                Text/Variable
                            </button>
                            <button 
                                onClick={() => addElement('rect')}
                                style={getElementButtonStyle()}
                                {...getElementButtonHandlers()}
                            >
                                Rectangle
                            </button>
                            <button 
                                onClick={() => addElement('line')}
                                style={getElementButtonStyle()}
                                {...getElementButtonHandlers()}
                            >
                                Line
                            </button>
                            <button 
                                onClick={() => addElement('barcode')}
                                style={getElementButtonStyle()}
                                {...getElementButtonHandlers()}
                            >
                                Barcode
                            </button>
                            <button 
                                onClick={() => addElement('qrcode')}
                                style={getElementButtonStyle()}
                                {...getElementButtonHandlers()}
                            >
                                QR Code
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }, [activeSection, canvasWidth, canvasHeight]);

    // Properties sidebar content renderer
    const renderPropertiesContent = useCallback(() => {
        const selectedItem = selectedId ? canvasItems.find(item => item.id === selectedId) : null;
        
        switch (activePropertiesSection) {
            case 'properties':
                return (
                    <div className={styles.sidebarContent}>
                        {selectedItem ? (
                            <div>
                                <h3>Element Properties</h3>
                                <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                                    <strong>Type:</strong> {selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1)}
                                </div>
                                {renderSelectedElementControls()}
                            </div>
                        ) : (
                            <div>
                                <h3>Element Properties</h3>
                                <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                                    Select an element on the canvas to edit its properties
                                </p>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    }, [activePropertiesSection, selectedId, canvasItems, renderSelectedElementControls]);

    // Canvas dimension handlers
    const handleCanvasWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const width = parseInt(e.target.value) || 1;
        setCanvasWidth(Math.max(1, width)); // Min 1px
    }, []);

    const handleCanvasHeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const height = parseInt(e.target.value) || 1;
        setCanvasHeight(Math.max(1, height)); // Min 1px
    }, []);

    // Preset dimension handlers
    const setPresetDimensions = useCallback((width: number, height: number) => {
        setCanvasWidth(width);
        setCanvasHeight(height);
    }, []);

    // Canvas event handlers
    const handleMouseDown = useCallback((e: React.MouseEvent, id: number) => {
        if (resizing) return; // Don't start dragging if we're resizing
        
        setSelectedId(id);
        setDragging(true);
        const item = canvasItems.find(i => i.id === id);
        if (!item) return;
        
        // Get SVG canvas bounds
        const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
        if (!rect) return;
        
        // Calculate mouse position relative to canvas, accounting for zoom
        const mouseX = (e.clientX - rect.left) / zoomLevel;
        const mouseY = (e.clientY - rect.top) / zoomLevel;
        
        // Calculate offset from mouse to element's top-left corner
        setDragOffset({
            x: mouseX - item.x,
            y: mouseY - item.y
        });
    }, [resizing, canvasItems, zoomLevel]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (dragging && selectedId !== null) {
            const rect = document.querySelector('.template-canvas')?.getBoundingClientRect();
            if (!rect) return;
            
            setCanvasItems(items =>
                items.map(item => {
                    if (item.id === selectedId) {
                        const newX = Math.round(((e.clientX - rect.left) / zoomLevel) - dragOffset.x);
                        const newY = Math.round(((e.clientY - rect.top) / zoomLevel) - dragOffset.y);
                        
                        if (item.type === 'line') {
                            // For lines, move both start and end points by the same delta
                            const deltaX = newX - item.x;
                            const deltaY = newY - item.y;
                            return {
                                ...item,
                                x: newX,
                                y: newY,
                                x2: item.x2 + deltaX,
                                y2: item.y2 + deltaY
                            };
                        } else {
                            // For other elements, just update x and y
                            return {
                                ...item,
                                x: newX,
                                y: newY
                            };
                        }
                    }
                    return item;
                })
            );
        }
    }, [dragging, selectedId, dragOffset, zoomLevel]);

    const handleMouseUp = useCallback(() => {
        setDragging(false);
        setResizing(false);
        setResizeHandle(null);
    }, []);

    // Resize event handlers
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        if (!selectedId) return;
        
        const item = canvasItems.find(i => i.id === selectedId);
        if (!item || (item.type !== 'rect' && item.type !== 'text' && item.type !== 'line')) return; // Rectangles, text, and lines can be resized
        
        setResizing(true);
        setResizeHandle(handle);
        
        if (item.type === 'rect') {
            setResizeStart({
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height
            });
        } else if (item.type === 'text') {
            // For text, we'll use fontSize as both width and height for resize reference
            setResizeStart({
                x: item.x,
                y: item.y,
                width: item.fontSize,
                height: item.fontSize
            });
        } else if (item.type === 'line') {
            // For lines, store both endpoints
            setResizeStart({
                x: item.x,
                y: item.y,
                width: item.x2,
                height: item.y2
            });
        }
    }, [selectedId, canvasItems]);

    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (resizing && selectedId !== null && resizeHandle) {
            const rect = document.querySelector('.template-canvas')?.getBoundingClientRect();
            if (!rect) return;
            
            const mouseX = (e.clientX - rect.left) / zoomLevel;
            const mouseY = (e.clientY - rect.top) / zoomLevel;
            
            setCanvasItems(items =>
                items.map(item => {
                    if (item.id !== selectedId || (item.type !== 'rect' && item.type !== 'text' && item.type !== 'line')) return item;
                    
                    if (item.type === 'rect') {
                        let newX = item.x;
                        let newY = item.y;
                        let newWidth = item.width;
                        let newHeight = item.height;
                        
                        switch (resizeHandle) {
                            case 'nw': // Northwest
                                newWidth = resizeStart.width + (resizeStart.x - mouseX);
                                newHeight = resizeStart.height + (resizeStart.y - mouseY);
                                newX = resizeStart.x + resizeStart.width - newWidth;
                                newY = resizeStart.y + resizeStart.height - newHeight;
                                break;
                            case 'ne': // Northeast
                                newWidth = mouseX - resizeStart.x;
                                newHeight = resizeStart.height + (resizeStart.y - mouseY);
                                newX = resizeStart.x;
                                newY = resizeStart.y + resizeStart.height - newHeight;
                                break;
                            case 'sw': // Southwest
                                newWidth = resizeStart.width + (resizeStart.x - mouseX);
                                newHeight = mouseY - resizeStart.y;
                                newX = resizeStart.x + resizeStart.width - newWidth;
                                newY = resizeStart.y;
                                break;
                            case 'se': // Southeast
                                newWidth = mouseX - resizeStart.x;
                                newHeight = mouseY - resizeStart.y;
                                newX = resizeStart.x;
                                newY = resizeStart.y;
                                break;
                            case 'n': // North
                                newHeight = resizeStart.height + (resizeStart.y - mouseY);
                                newX = resizeStart.x;
                                newY = resizeStart.y + resizeStart.height - newHeight;
                                break;
                            case 's': // South
                                newHeight = mouseY - resizeStart.y;
                                newX = resizeStart.x;
                                newY = resizeStart.y;
                                break;
                            case 'w': // West
                                newWidth = resizeStart.width + (resizeStart.x - mouseX);
                                newX = resizeStart.x + resizeStart.width - newWidth;
                                newY = resizeStart.y;
                                break;
                            case 'e': // East
                                newWidth = mouseX - resizeStart.x;
                                newX = resizeStart.x;
                                newY = resizeStart.y;
                                break;
                        }
                        
                        // Handle negative dimensions by flipping
                        if (newWidth < 0) {
                            newX = newX + newWidth;
                            newWidth = Math.abs(newWidth);
                        }
                        if (newHeight < 0) {
                            newY = newY + newHeight;
                            newHeight = Math.abs(newHeight);
                        }
                        
                        // Ensure minimum size
                        newWidth = Math.max(10, newWidth);
                        newHeight = Math.max(10, newHeight);
                        
                        return {
                            ...item,
                            x: Math.round(newX),
                            y: Math.round(newY),
                            width: Math.round(newWidth),
                            height: Math.round(newHeight)
                        };
                    } else if (item.type === 'text') {
                        // For text, adjust fontSize based on resize handle direction
                        let newFontSize = resizeStart.width; // Start with original fontSize
                        
                        switch (resizeHandle) {
                            case 'se': // Southeast - drag away to increase, towards to decrease
                                const deltaX_se = mouseX - (item.x + 50); // 50 is estimated text width
                                const deltaY_se = mouseY - (item.y + 20); // 20 is estimated text height
                                const avgDelta_se = (deltaX_se + deltaY_se) / 2;
                                newFontSize = resizeStart.width + (avgDelta_se * 0.2);
                                break;
                            case 'ne': // Northeast
                                const deltaX_ne = mouseX - (item.x + 50);
                                const deltaY_ne = (item.y - 20) - mouseY; // Negative Y direction
                                const avgDelta_ne = (deltaX_ne + deltaY_ne) / 2;
                                newFontSize = resizeStart.width + (avgDelta_ne * 0.2);
                                break;
                            case 'sw': // Southwest
                                const deltaX_sw = (item.x - 50) - mouseX; // Negative X direction
                                const deltaY_sw = mouseY - (item.y + 20);
                                const avgDelta_sw = (deltaX_sw + deltaY_sw) / 2;
                                newFontSize = resizeStart.width + (avgDelta_sw * 0.2);
                                break;
                            case 'nw': // Northwest
                                const deltaX_nw = (item.x - 50) - mouseX; // Negative X direction
                                const deltaY_nw = (item.y - 20) - mouseY; // Negative Y direction
                                const avgDelta_nw = (deltaX_nw + deltaY_nw) / 2;
                                newFontSize = resizeStart.width + (avgDelta_nw * 0.2);
                                break;
                            case 'e': // East - drag right to increase, left to decrease
                                const deltaX_e = mouseX - (item.x + 50);
                                newFontSize = resizeStart.width + (deltaX_e * 0.2);
                                break;
                            case 'w': // West - drag left to increase, right to decrease
                                const deltaX_w = (item.x - 50) - mouseX;
                                newFontSize = resizeStart.width + (deltaX_w * 0.2);
                                break;
                            case 'n': // North - drag up to increase, down to decrease
                                const deltaY_n = (item.y - 20) - mouseY;
                                newFontSize = resizeStart.width + (deltaY_n * 0.2);
                                break;
                            case 's': // South - drag down to increase, up to decrease
                                const deltaY_s = mouseY - (item.y + 20);
                                newFontSize = resizeStart.width + (deltaY_s * 0.2);
                                break;
                        }
                        
                        // Ensure font size stays within reasonable bounds
                        newFontSize = Math.max(8, Math.min(200, newFontSize));
                        
                        return {
                            ...item,
                            fontSize: Math.round(newFontSize)
                        };
                    } else if (item.type === 'line') {
                        // For lines, adjust endpoints based on handle
                        let newX = item.x;
                        let newY = item.y;
                        let newX2 = item.x2;
                        let newY2 = item.y2;
                        
                        switch (resizeHandle) {
                            case 'start': // Start point handle
                                newX = mouseX;
                                newY = mouseY;
                                break;
                            case 'end': // End point handle
                                newX2 = mouseX;
                                newY2 = mouseY;
                                break;
                        }
                        
                        return {
                            ...item,
                            x: Math.round(newX),
                            y: Math.round(newY),
                            x2: Math.round(newX2),
                            y2: Math.round(newY2)
                        };
                    }
                    
                    return item;
                })
            );
        }
    }, [resizing, selectedId, resizeHandle, resizeStart, zoomLevel]);

    // Add mouse event listeners
    React.useEffect(() => {
        if (dragging || resizing) {
            const mouseMoveHandler = resizing ? handleResizeMouseMove : handleMouseMove;
            window.addEventListener("mousemove", mouseMoveHandler);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", mouseMoveHandler);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [dragging, resizing, handleResizeMouseMove, handleMouseMove, handleMouseUp]);

    // Keyboard event handler for delete and arrow key movement
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Check if user is currently typing in an input field
        // This prevents keyboard shortcuts from interfering with text input
        const activeElement = document.activeElement as HTMLElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.contentEditable === 'true'
        );

        // If user is typing in an input field, don't handle keyboard shortcuts
        if (isTyping) return;

        // Handle zoom shortcuts (Ctrl/Cmd + and -, Ctrl/Cmd + 0)
        if (e.ctrlKey || e.metaKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                zoomIn();
                return;
            }
            if (e.key === '-') {
                e.preventDefault();
                zoomOut();
                return;
            }
            if (e.key === '0') {
                e.preventDefault();
                resetZoom();
                return;
            }
        }

        if (!selectedId) return;

        // Handle delete functionality
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedItem();
            return;
        }

        // Handle arrow key movement
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault(); // Prevent page scrolling
            
            const moveDistance = e.shiftKey ? 10 : 1; // Hold Shift for larger movements
            let deltaX = 0;
            let deltaY = 0;

            switch (e.key) {
                case 'ArrowUp':
                    deltaY = -moveDistance;
                    break;
                case 'ArrowDown':
                    deltaY = moveDistance;
                    break;
                case 'ArrowLeft':
                    deltaX = -moveDistance;
                    break;
                case 'ArrowRight':
                    deltaX = moveDistance;
                    break;
            }

            // Update the selected item's position
            setCanvasItems(prevItems =>
                prevItems.map(item => {
                    if (item.id === selectedId) {
                        const newX = Math.max(0, Math.min(canvasWidth - 10, item.x + deltaX));
                        const newY = Math.max(0, Math.min(canvasHeight - 10, item.y + deltaY));
                        return { ...item, x: newX, y: newY };
                    }
                    return item;
                })
            );
        }
    }, [selectedId, canvasWidth, canvasHeight, deleteSelectedItem, zoomIn, zoomOut, resetZoom]);

    // Add keyboard event listener for delete functionality and arrow key movement
    React.useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // Render resize handles for selected rectangle, text, or line
    const renderResizeHandles = useCallback((item: RectItem | TextItem | LineItem) => {
        let handleSize = 8; // Default handle size for rectangles
        let handles: Array<{ id: string; x: number; y: number; cursor: string }> = [];
        
        if (item.type === 'rect') {
            handles = [
                { id: 'nw', x: item.x - handleSize/2, y: item.y - handleSize/2, cursor: 'nw-resize' },
                { id: 'ne', x: item.x + item.width - handleSize/2, y: item.y - handleSize/2, cursor: 'ne-resize' },
                { id: 'sw', x: item.x - handleSize/2, y: item.y + item.height - handleSize/2, cursor: 'sw-resize' },
                { id: 'se', x: item.x + item.width - handleSize/2, y: item.y + item.height - handleSize/2, cursor: 'se-resize' },
                { id: 'n', x: item.x + item.width/2 - handleSize/2, y: item.y - handleSize/2, cursor: 'n-resize' },
                { id: 's', x: item.x + item.width/2 - handleSize/2, y: item.y + item.height - handleSize/2, cursor: 's-resize' },
                { id: 'w', x: item.x - handleSize/2, y: item.y + item.height/2 - handleSize/2, cursor: 'w-resize' },
                { id: 'e', x: item.x + item.width - handleSize/2, y: item.y + item.height/2 - handleSize/2, cursor: 'e-resize' }
            ];
        } else if (item.type === 'text') {
            // For text, find the sweet spot that properly surrounds the text
            const estimatedWidth = item.text.length * (item.fontSize * 0.42); // Increased from 0.35 to properly surround text
            const estimatedHeight = item.fontSize * 0.8; // Reduced from 1.0 to fit closer
            
            // Make handles slightly larger and proportional to text height
            handleSize = Math.max(4, Math.min(item.fontSize * 0.25, 10));
            
            // Position handles just outside the text boundaries
            // Text baseline is at item.y, so text extends upward
            const textTop = item.y - estimatedHeight;
            const textBottom = item.y + (item.fontSize * 0.1); // Small padding below baseline
            const textLeft = item.x - (handleSize * 0.2); // Small padding to left
            const textRight = item.x + estimatedWidth + (handleSize * 0.2); // Small padding to right
            
            handles = [
                { id: 'nw', x: textLeft - handleSize/2, y: textTop - handleSize/2, cursor: 'nw-resize' },
                { id: 'ne', x: textRight - handleSize/2, y: textTop - handleSize/2, cursor: 'ne-resize' },
                { id: 'sw', x: textLeft - handleSize/2, y: textBottom - handleSize/2, cursor: 'sw-resize' },
                { id: 'se', x: textRight - handleSize/2, y: textBottom - handleSize/2, cursor: 'se-resize' }
            ];
        } else if (item.type === 'line') {
            // For lines, provide handles at both endpoints
            handleSize = 10; // Slightly larger for easier grabbing
            
            handles = [
                { id: 'start', x: item.x - handleSize/2, y: item.y - handleSize/2, cursor: 'move' },
                { id: 'end', x: item.x2 - handleSize/2, y: item.y2 - handleSize/2, cursor: 'move' }
            ];
        }

        return handles.map(handle => (
            <rect
                key={handle.id}
                x={handle.x}
                y={handle.y}
                width={handleSize}
                height={handleSize}
                fill="#007bff"
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: handle.cursor }}
                onMouseDown={(e) => handleResizeMouseDown(e, handle.id)}
            />
        ));
    }, [handleResizeMouseDown]);

    const addElement = useCallback((type: string) => {
        setCanvasItems(prevItems => {
            const newId = prevItems.length > 0 ? Math.max(...prevItems.map(item => item.id)) + 1 : 1;
            let newItem: CanvasItem;
            
            switch (type) {
                case 'rect':
                    newItem = { id: newId, type: 'rect', x: 50, y: 50, width: 100, height: 60, color: '#000000' };
                    break;
                case 'circle':
                    newItem = { id: newId, type: 'circle', x: 100, y: 100, radius: 30, color: '#ff0000' };
                    break;
                case 'text':
                    newItem = { id: newId, type: 'text', x: 50, y: 50, text: 'New Text', fontSize: 14, color: '#000000' };
                    break;
                case 'line':
                    newItem = { id: newId, type: 'line', x: 50, y: 50, x2: 150, y2: 50, strokeWidth: 2, color: '#000000' };
                    break;
                case 'barcode':
                    newItem = { id: newId, type: 'barcode', x: 50, y: 50, width: 100, height: 30, data: '123456789', color: '#000000' };
                    break;
                case 'qrcode':
                    newItem = { id: newId, type: 'qrcode', x: 50, y: 50, size: 50, data: 'https://example.com', color: '#000000' };
                    break;
                default:
                    return prevItems;
            }
            
            return [...prevItems, newItem];
        });
    }, []);

    // YAML Export function based on ESL template structure
    const exportToYAML = useCallback(() => {
        // Helper function to convert color hex to fill value (0 or 1)
        const colorToFill = (color: string) => {
            // Map specific colors to fill values: black=0, white=1, yellow=2, red=3
            switch (color.toLowerCase()) {
                case '#000000':
                case '#000':
                case 'black':
                    return 0;
                case '#ffffff':
                case '#fff':
                case 'white':
                    return 1;
                case '#ffff00':
                case '#ff0':
                case 'yellow':
                    return 2;
                case '#ff0000':
                case '#f00':
                case 'red':
                    return 3;
                default:
                    return 0; // Default to black if unknown color
            }
        };

        // Create a font for each unique font size used in text elements
        // Each text element gets its own font assignment using FreeMonoRegular.ttf
        const usedFontSizes = new Set<number>();
        const textElements = canvasItems.filter(item => item.type === 'text') as TextItem[];
        
        // Collect all unique font sizes from user-defined text elements
        textElements.forEach(item => {
            usedFontSizes.add(item.fontSize);
        });

        // Always include a default font size (16) for template variables if not already present
        if (!usedFontSizes.has(16)) {
            usedFontSizes.add(16);
        }

        // Generate fonts array with FreeMonoRegular.ttf for each unique size
        // This ensures each text element uses the exact font size set by the user
        const fonts: any[] = [];
        const fontSizeToIndex = new Map<number, number>();
        
        Array.from(usedFontSizes).sort((a, b) => a - b).forEach((fontSize, index) => {
            fonts.push({
                type: 'FreeMonoRegular.ttf',
                size: fontSize
            });
            fontSizeToIndex.set(fontSize, index);
        });

        // Get the index for default font size (16) for template variables
        const defaultFontIndex = fontSizeToIndex.get(16) || 0;

        // Generate the YAML structure
        const yamlData: any = {
            fontbase: 'fonts/',
            fonts: fonts,
            type: 'bwry',
            el: [] as any[]
        };

        // Convert canvas items to ESL elements
        canvasItems.forEach((item, index) => {
            if (item.type === 'text') {
                // Check if text contains brackets indicating a variable
                const bracketMatch = item.text.match(/^\[(.+)\]$/);
                
                if (bracketMatch) {
                    // Text is in format [variableName] - create a var element
                    const varName = bracketMatch[1];
                    const element = {
                        type: 'var',
                        fill: colorToFill(item.color),
                        var: varName,
                        x: item.x,
                        y: item.y,
                        anchor: 'ls',
                        font: fontSizeToIndex.get(item.fontSize) || 0
                    };
                    yamlData.el.push(element);
                } else {
                    // Regular text element
                    const element = {
                        type: 'text',
                        fill: colorToFill(item.color),
                        text: item.text,
                        x: item.x,
                        y: item.y,
                        anchor: 'ls', // left-start anchor as default
                        font: fontSizeToIndex.get(item.fontSize) || 0
                    };
                    yamlData.el.push(element);
                }
            } else if (item.type === 'rect') {
                // Convert rectangles to rect elements with x1,y1,x2,y2 format
                const element = {
                    type: 'rect',
                    fill: colorToFill(item.color),
                    x1: item.x,
                    y1: item.y,
                    x2: item.x + item.width,
                    y2: item.y + item.height
                };
                yamlData.el.push(element);
            }
        });

        // Convert to YAML string
        const yamlString = convertToYAMLString(yamlData);
        
        // Create and download file
        const blob = new Blob([yamlString], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'esl-template.yaml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [canvasItems, canvasWidth, canvasHeight]);

    // Export to JPG function with pixel-accurate rendering
    const exportToJPG = useCallback(() => {
        // Create a canvas for rendering
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Set canvas size to exact template dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Disable anti-aliasing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;
        ctx.textBaseline = 'top';
        
        // Fill background with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Helper function to get exact color values
        const getExactColor = (color: string): string => {
            switch (color.toLowerCase()) {
                case '#000000':
                case '#000':
                case 'black':
                    return '#000000';
                case '#ffffff':
                case '#fff':
                case 'white':
                    return '#ffffff';
                case '#ffff00':
                case '#ff0':
                case 'yellow':
                    return '#ffff00';
                case '#ff0000':
                case '#f00':
                case 'red':
                    return '#ff0000';
                default:
                    return '#000000';
            }
        };
        
        // Render each element
        canvasItems.forEach((item) => {
            const exactColor = getExactColor(item.color);
            
            if (item.type === 'rect') {
                ctx.fillStyle = exactColor;
                ctx.fillRect(
                    Math.round(item.x),
                    Math.round(item.y),
                    Math.round(item.width),
                    Math.round(item.height)
                );
            } else if (item.type === 'text') {
                ctx.fillStyle = exactColor;
                ctx.font = `${Math.round(item.fontSize)}px monospace`;
                ctx.fillText(
                    item.text,
                    Math.round(item.x),
                    Math.round(item.y)
                );
            } else if (item.type === 'line') {
                ctx.strokeStyle = exactColor;
                ctx.lineWidth = Math.round(item.strokeWidth);
                ctx.lineCap = 'butt'; // No rounded ends for pixel accuracy
                ctx.beginPath();
                ctx.moveTo(Math.round(item.x), Math.round(item.y));
                ctx.lineTo(Math.round(item.x2), Math.round(item.y2));
                ctx.stroke();
            } else if (item.type === 'barcode') {
                // Render barcode as solid rectangle with bars
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(
                    Math.round(item.x),
                    Math.round(item.y),
                    Math.round(item.width),
                    Math.round(item.height)
                );
                
                // Draw barcode bars
                ctx.fillStyle = exactColor;
                const barWidth = Math.max(1, Math.round(item.width / 15));
                for (let i = 0; i < 10; i++) {
                    const barX = Math.round(item.x + 5 + i * (item.width - 10) / 10);
                    ctx.fillRect(
                        barX,
                        Math.round(item.y + 3),
                        barWidth,
                        Math.round(item.height - 6)
                    );
                }
            } else if (item.type === 'qrcode') {
                // Render QR code as grid pattern
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(
                    Math.round(item.x),
                    Math.round(item.y),
                    Math.round(item.size),
                    Math.round(item.size)
                );
                
                // Draw QR pattern
                ctx.fillStyle = exactColor;
                const cellSize = Math.max(1, Math.round(item.size / 25));
                for (let row = 0; row < 25; row++) {
                    for (let col = 0; col < 25; col++) {
                        // Simple QR pattern simulation
                        if ((row + col) % 3 === 0 || (row < 7 && col < 7) || (row < 7 && col > 17) || (row > 17 && col < 7)) {
                            ctx.fillRect(
                                Math.round(item.x + col * cellSize),
                                Math.round(item.y + row * cellSize),
                                cellSize,
                                cellSize
                            );
                        }
                    }
                }
            }
        });
        
        // Get the image data and quantize to exact 4 colors
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imageData.data;
        
        // Define exact RGB values for our 4 colors
        const colors = {
            black: [0, 0, 0],
            white: [255, 255, 255],
            red: [255, 0, 0],
            yellow: [255, 255, 0]
        };
        
        // Function to find closest exact color
        const getClosestColor = (r: number, g: number, b: number): number[] => {
            let minDistance = Infinity;
            let closestColor = colors.black;
            
            Object.values(colors).forEach(color => {
                const distance = Math.sqrt(
                    Math.pow(r - color[0], 2) +
                    Math.pow(g - color[1], 2) +
                    Math.pow(b - color[2], 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    closestColor = color;
                }
            });
            
            return closestColor;
        };
        
        // Quantize every pixel to exact colors
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const exactColor = getClosestColor(r, g, b);
            data[i] = exactColor[0];     // R
            data[i + 1] = exactColor[1]; // G
            data[i + 2] = exactColor[2]; // B
            data[i + 3] = 255;           // A (full opacity)
        }
        
        // Put the quantized data back
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to JPG and download
        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'esl-template.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        }, 'image/jpeg', 1.0); // Maximum quality
    }, [canvasItems, canvasWidth, canvasHeight]);

    // Helper function to convert object to YAML string
    const convertToYAMLString = (data: any): string => {
        let yaml = '';
        
        // Add fontbase
        yaml += `fontbase: ${data.fontbase}\n`;
        
        // Add fonts array
        yaml += 'fonts:\n';
        data.fonts.forEach((font: any) => {
            yaml += `  - type: ${font.type}\n`;
            yaml += `    size: ${font.size}\n`;
        });
        
        // Add type
        yaml += `type: ${data.type}\n`;
        
        // Add elements array
        yaml += 'el:\n';
        data.el.forEach((element: any) => {
            yaml += `  - type: ${element.type}\n`;
            if (element.fill !== undefined) {
                yaml += `    fill: ${element.fill}\n`;
            }
            if (element.var) {
                yaml += `    var: ${element.var}\n`;
            }
            if (element.text) {
                yaml += `    text: "${element.text}"\n`;
            }
            
            // Handle coordinates based on element type
            if (element.type === 'rect') {
                // Rectangle uses x1, y1, x2, y2 format
                yaml += `    x1: ${element.x1}\n`;
                yaml += `    y1: ${element.y1}\n`;
                yaml += `    x2: ${element.x2}\n`;
                yaml += `    y2: ${element.y2}\n`;
            } else {
                // Other elements use x, y format
                yaml += `    x: ${element.x}\n`;
                yaml += `    y: ${element.y}\n`;
            }
            
            if (element.anchor) {
                yaml += `    anchor: ${element.anchor}\n`;
            }
            if (element.font !== undefined) {
                yaml += `    font: ${element.font}\n`;
            }
            yaml += '\n';
        });
        
        return yaml;
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
                {/* Left Sidebar with Navigation */}
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
                            <span className={styles.canvasType}>ESL Template Designer</span>
                        </div>
                        <div className={styles.canvasControls}>
                            <button className={styles.btnSecondary}>Preview</button>
                            <button className={styles.btnPrimary} onClick={exportToYAML}>Export YAML</button>
                            <button className={styles.btnPrimary} onClick={exportToJPG}>Export JPG</button>
                        </div>
                    </div>
                    
                    {/* Canvas Dimension Controls */}
                    <div style={{ 
                        padding: '15px 20px', 
                        backgroundColor: '#fff', 
                        borderBottom: '1px solid #e5e5e5',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>Canvas Dimensions</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '500' }}>
                                Width (px):
                                <input 
                                    type="number" 
                                    value={canvasWidth}
                                    onChange={handleCanvasWidthChange}
                                    min="1"
                                    style={{ 
                                        marginLeft: '5px',
                                        width: '80px', 
                                        padding: '4px 8px', 
                                        border: '1px solid #ddd', 
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                />
                            </label>
                            <span style={{ color: '#666' }}>×</span>
                            <label style={{ fontSize: '14px', fontWeight: '500' }}>
                                Height (px):
                                <input 
                                    type="number" 
                                    value={canvasHeight}
                                    onChange={handleCanvasHeightChange}
                                    min="1"
                                    style={{ 
                                        marginLeft: '5px',
                                        width: '80px', 
                                        padding: '4px 8px', 
                                        border: '1px solid #ddd', 
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                />
                            </label>
                        </div>
                        <div style={{ 
                            fontSize: '12px', 
                            color: '#666',
                            backgroundColor: '#f8f9fa',
                            padding: '4px 8px',
                            borderRadius: '4px'
                        }}>
                            Size: {canvasWidth} × {canvasHeight} px
                        </div>

                        {/* Zoom Controls */}
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            marginTop: '10px',
                            padding: '8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e9ecef'
                        }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#333' }}>Zoom:</span>
                            <button 
                                onClick={zoomOut}
                                disabled={zoomLevel === zoomLevels[0]}
                                style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: zoomLevel === zoomLevels[0] ? '#f5f5f5' : 'white',
                                    cursor: zoomLevel === zoomLevels[0] ? 'not-allowed' : 'pointer',
                                    color: zoomLevel === zoomLevels[0] ? '#999' : '#333'
                                }}
                            >
                                −
                            </button>
                            <select 
                                value={zoomLevel}
                                onChange={(e) => setSpecificZoom(parseFloat(e.target.value))}
                                style={{ 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: 'white'
                                }}
                            >
                                {zoomLevels.map(level => (
                                    <option key={level} value={level}>
                                        {Math.round(level * 100)}%
                                    </option>
                                ))}
                            </select>
                            <button 
                                onClick={zoomIn}
                                disabled={zoomLevel === zoomLevels[zoomLevels.length - 1]}
                                style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: zoomLevel === zoomLevels[zoomLevels.length - 1] ? '#f5f5f5' : 'white',
                                    cursor: zoomLevel === zoomLevels[zoomLevels.length - 1] ? 'not-allowed' : 'pointer',
                                    color: zoomLevel === zoomLevels[zoomLevels.length - 1] ? '#999' : '#333'
                                }}
                            >
                                +
                            </button>
                            <button 
                                onClick={resetZoom}
                                style={{ 
                                    padding: '4px 8px', 
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: 'white',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                    
                    <div className={styles.canvasContainer}>
                        <div 
                            className={styles.canvas} 
                            style={{ 
                                width: `${canvasWidth * zoomLevel}px`, 
                                height: `${canvasHeight * zoomLevel}px`,
                                overflow: 'auto',
                                border: '1px solid #ddd',
                                backgroundColor: '#f8f9fa'
                            }}
                        >
                            {/* ESL Preview */}
                            <div className={styles.eslPreview}>
                                <svg 
                                    className="template-canvas"
                                    width={canvasWidth * zoomLevel} 
                                    height={canvasHeight * zoomLevel} 
                                    viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                                    style={{ 
                                        cursor: dragging ? 'grabbing' : 'default', 
                                        display: 'block', 
                                        outline: 'none',
                                        backgroundColor: 'white'
                                    }}
                                    tabIndex={0}
                                >
                                    <rect width="100%" height="100%" fill="white"/>
                                    
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
                                        if (item.type === "line") {
                                            return (
                                                <g key={item.id}>
                                                    {/* Selection outline for selected line */}
                                                    {selectedId === item.id && (
                                                        <line
                                                            x1={item.x}
                                                            y1={item.y}
                                                            x2={item.x2}
                                                            y2={item.y2}
                                                            stroke="#007acc"
                                                            strokeWidth={Math.max(item.strokeWidth + 2, 3)}
                                                            opacity={0.5}
                                                        />
                                                    )}
                                                    <line
                                                        x1={item.x}
                                                        y1={item.y}
                                                        x2={item.x2}
                                                        y2={item.y2}
                                                        stroke={item.color}
                                                        strokeWidth={item.strokeWidth}
                                                        style={{ cursor: "grab" }}
                                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                    />
                                                </g>
                                            );
                                        }
                                        if (item.type === "barcode") {
                                            return (
                                                <g key={item.id}>
                                                    <rect
                                                        x={item.x}
                                                        y={item.y}
                                                        width={item.width}
                                                        height={item.height}
                                                        fill="white"
                                                        stroke={item.color}
                                                        strokeWidth={1}
                                                        style={{ cursor: "grab" }}
                                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                    />
                                                    {/* Barcode bars simulation */}
                                                    {Array.from({ length: 10 }, (_, i) => (
                                                        <rect
                                                            key={i}
                                                            x={item.x + 5 + i * (item.width - 10) / 10}
                                                            y={item.y + 3}
                                                            width={Math.max(1, (item.width - 10) / 15)}
                                                            height={item.height - 6}
                                                            fill={item.color}
                                                            style={{ pointerEvents: "none" }}
                                                        />
                                                    ))}
                                                    <text
                                                        x={item.x + item.width / 2}
                                                        y={item.y + item.height + 12}
                                                        fill={item.color}
                                                        fontSize="8"
                                                        textAnchor="middle"
                                                        style={{ pointerEvents: "none" }}
                                                    >
                                                        {item.data}
                                                    </text>
                                                </g>
                                            );
                                        }
                                        if (item.type === "qrcode") {
                                            return (
                                                <g key={item.id}>
                                                    <rect
                                                        x={item.x}
                                                        y={item.y}
                                                        width={item.size}
                                                        height={item.size}
                                                        fill="white"
                                                        stroke={item.color}
                                                        strokeWidth={1}
                                                        style={{ cursor: "grab" }}
                                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                    />
                                                    {/* QR code pattern simulation */}
                                                    {Array.from({ length: 7 }, (_, row) =>
                                                        Array.from({ length: 7 }, (_, col) => (
                                                            <rect
                                                                key={`${row}-${col}`}
                                                                x={item.x + 3 + col * (item.size - 6) / 7}
                                                                y={item.y + 3 + row * (item.size - 6) / 7}
                                                                width={(item.size - 6) / 9}
                                                                height={(item.size - 6) / 9}
                                                                fill={(row + col) % 2 === 0 ? item.color : "transparent"}
                                                                style={{ pointerEvents: "none" }}
                                                            />
                                                        ))
                                                    )}
                                                </g>
                                            );
                                        }
                                        return null;
                                    })}
                                    
                                    {/* Resize Handles for Selected Elements */}
                                    {selectedId && (() => {
                                        const selectedItem = canvasItems.find(item => item.id === selectedId);
                                        if (selectedItem?.type === 'rect') {
                                            return renderResizeHandles(selectedItem as RectItem);
                                        } else if (selectedItem?.type === 'text') {
                                            return renderResizeHandles(selectedItem as TextItem);
                                        } else if (selectedItem?.type === 'line') {
                                            return renderResizeHandles(selectedItem as LineItem);
                                        }
                                        return null;
                                    })()}
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Properties sidebar on the right */}
                <div className={styles.propertiesSidebar}>
                    <div className={styles.sidebarContent}>
                        {propertiesSections.map(section => (
                            <div key={section.id} className={styles.sidebarSection}>
                                <div 
                                    className={`${styles.sectionHeader} ${styles.active}`}
                                >
                                    <span>{section.name}</span>
                                    <span className={styles.sectionToggle}>−</span>
                                </div>
                                <div className={styles.sectionContent}>
                                    {section.id === 'properties' && renderPropertiesContent()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditor;
