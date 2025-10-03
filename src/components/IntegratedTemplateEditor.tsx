import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from '../styles/EslDesigner.module.css';

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
  anchor?: 'lt' | 'mt' | 'rt' | 'ls' | 'ms' | 'rs';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface LineItem extends BaseItem {
  type: "line";
  x2: number;
  y2: number;
  strokeWidth: number;
  thickness?: number; // Pixel thickness of the line (default 1)
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

// Available fonts for text elements
const availableFonts = [
  { label: 'System Default', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', eslFont: 'FreeMonoRegular.ttf' },
  { label: 'Arial', value: 'Arial, sans-serif', eslFont: 'Arial.ttf' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif', eslFont: 'Helvetica.ttf' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif', eslFont: 'TimesNewRoman.ttf' },
  { label: 'Georgia', value: 'Georgia, serif', eslFont: 'Georgia.ttf' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif', eslFont: 'Verdana.ttf' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace', eslFont: 'CourierNew.ttf' },
  { label: 'Monaco', value: 'Monaco, "Lucida Console", monospace', eslFont: 'Monaco.ttf' },
  { label: 'Impact', value: 'Impact, "Arial Black", sans-serif', eslFont: 'Impact.ttf' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive', eslFont: 'ComicSansMS.ttf' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Arial, sans-serif', eslFont: 'TrebuchetMS.ttf' },
  { label: 'Palatino', value: 'Palatino, "Palatino Linotype", serif', eslFont: 'Palatino.ttf' }
];

// Function to get ESL font filename from web font family
const getEslFontFromWebFont = (webFontFamily: string): string => {
  const font = availableFonts.find(f => f.value === webFontFamily);
  return font ? font.eslFont : 'FreeMonoRegular.ttf'; // Default fallback
};

const initialCanvasItems: CanvasItem[] = [];

const TemplateEditor: React.FC = () => {

    // Helper function to estimate text width for different font families
    const estimateTextWidth = useCallback((text: string, fontSize: number, fontFamily?: string): number => {
        const family = fontFamily || availableFonts[0].value;
        
        // Ensure text is a string
        const safeText = String(text || '');
        
        // Handle multi-line text by finding the longest line
        const lines = safeText.split('\n');
        let maxWidth = 0;
        
        // Different font families have different character width ratios
        let widthRatio = 0.6; // Default for monospace
        
        if (family.includes('Arial') || family.includes('Helvetica') || family.includes('sans-serif')) {
            widthRatio = 0.55; // Sans-serif fonts are typically narrower
        } else if (family.includes('Times') || family.includes('Georgia') || family.includes('serif')) {
            widthRatio = 0.5; // Serif fonts are typically narrower
        } else if (family.includes('Courier') || family.includes('Monaco') || family.includes('monospace')) {
            widthRatio = 0.6; // Monospace fonts
        } else if (family.includes('Impact')) {
            widthRatio = 0.45; // Impact is condensed
        } else if (family.includes('Comic Sans')) {
            widthRatio = 0.58; // Comic Sans is wider
        } else if (family.includes('Verdana')) {
            widthRatio = 0.6; // Verdana is wider
        }
        
        // Calculate width for each line and return the maximum
        lines.forEach(line => {
            const lineWidth = line.length * (fontSize * widthRatio);
            if (lineWidth > maxWidth) {
                maxWidth = lineWidth;
            }
        });
        
        return maxWidth;
    }, []);

    // Move getItemBounds inside component to fix Fast Refresh issues
    const getItemBounds = useCallback((item: CanvasItem) => {
        if (item.type === "rect") {
            return { x: item.x, y: item.y, width: item.width, height: item.height };
        }
        if (item.type === "circle") {
            return { x: item.x - item.radius, y: item.y - item.radius, width: item.radius * 2, height: item.radius * 2 };
        }
        if (item.type === "text") {
            // Use font-aware width calculation
            // item.y is the top edge, text baseline is at item.y + fontSize
            const text = String(item.text || '');
            const estimatedWidth = estimateTextWidth(text, item.fontSize, (item as TextItem).fontFamily);
            // Calculate height based on number of lines
            const lines = text.split('\n');
            const lineHeight = item.fontSize * 1.2;
            const estimatedHeight = lines.length * lineHeight;
            return { x: item.x, y: item.y, width: estimatedWidth, height: estimatedHeight };
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
    }, [estimateTextWidth]);

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
    const [selectedIds, setSelectedIds] = useState<number[]>([]); // Changed to support multiple selection
    const [dragging, setDragging] = useState<boolean>(false);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [editingText, setEditingText] = useState<number | null>(null);
    
    // Selection box state for drag-to-select
    const [selectingBox, setSelectingBox] = useState<boolean>(false);
    const [selectionBoxStart, setSelectionBoxStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [selectionBoxEnd, setSelectionBoxEnd] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    
    // Resize state
    const [resizing, setResizing] = useState<boolean>(false);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
    
    // Canvas dimensions state
    const [canvasWidth, setCanvasWidth] = useState<number>(250);
    const [canvasHeight, setCanvasHeight] = useState<number>(122);
    const [templateFilename, setTemplateFilename] = useState<string>('New template');
    const [lastSavedFilename, setLastSavedFilename] = useState<string>('');
    
    // ESL configuration state
    const [eslType, setEslType] = useState<'bw' | 'bwry'>('bwry');
    const [eslAxis, setEslAxis] = useState<0 | 1>(0);
    
    // Menu dropdown state
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [showAboutDialog, setShowAboutDialog] = useState<boolean>(false);
    const [showEslConfigDialog, setShowEslConfigDialog] = useState<boolean>(false);
    
    // Zoom controls drag state
    const [zoomControlsPosition, setZoomControlsPosition] = useState({ x: 20, y: 20 }); // x from right, y from bottom
    const [isDraggingZoomControls, setIsDraggingZoomControls] = useState(false);
    const [zoomDragStart, setZoomDragStart] = useState({ x: 0, y: 0 });
    
    // Text editing on canvas state
    const [editingTextId, setEditingTextId] = useState<number | null>(null);
    const [editingTextValue, setEditingTextValue] = useState<string>('');

    // Input field editing state - tracks temporary values during editing
    const [editingFields, setEditingFields] = useState<{[key: string]: string}>({});

    // Helper function to constrain element position within canvas bounds
    const constrainToCanvas = useCallback((item: CanvasItem, newX: number, newY: number, newWidth?: number, newHeight?: number): { x: number, y: number, width?: number, height?: number } => {
        const bounds = getItemBounds(item);
        const elementWidth = newWidth !== undefined ? newWidth : bounds.width || 0;
        const elementHeight = newHeight !== undefined ? newHeight : bounds.height || 0;
        
        let constrainedX = newX;
        let constrainedY = newY;
        let constrainedWidth = elementWidth;
        let constrainedHeight = elementHeight;
        
        if (item.type === 'text') {
            // For text: constrain so the RIGHT EDGE of text doesn't exceed canvas boundary
            const textWidth = estimateTextWidth(item.text, item.fontSize, (item as TextItem).fontFamily);
            const textHeight = item.fontSize * 0.8;
            
            // Constrain X: only left boundary - allow text to extend beyond right edge
            constrainedX = Math.max(0, newX);
            
            // Constrain Y: allow minimum of 0 (top edge) and within canvas height
            constrainedY = Math.max(0, Math.min(canvasHeight, newY));
            
        } else if (item.type === 'circle') {
            // Circles: x,y is center, constrain by radius
            const radius = item.radius;
            constrainedX = Math.max(radius, Math.min(canvasWidth - radius, newX));
            constrainedY = Math.max(radius, Math.min(canvasHeight - radius, newY));
            
        } else if (item.type === 'line') {
            // Lines: constrain both endpoints
            constrainedX = Math.max(0, Math.min(canvasWidth, newX));
            constrainedY = Math.max(0, Math.min(canvasHeight, newY));
            
        } else {
            // Rectangles, barcodes, QR codes: x,y is top-left corner
            constrainedX = Math.max(0, Math.min(canvasWidth - elementWidth, newX));
            constrainedY = Math.max(0, Math.min(canvasHeight - elementHeight, newY));
            
            // Constrain dimensions if provided
            if (newWidth !== undefined) {
                constrainedWidth = Math.max(1, Math.min(canvasWidth - constrainedX, newWidth));
            }
            if (newHeight !== undefined) {
                constrainedHeight = Math.max(1, Math.min(canvasHeight - constrainedY, newHeight));
            }
        }
        
        return {
            x: constrainedX,
            y: constrainedY,
            ...(newWidth !== undefined && { width: constrainedWidth }),
            ...(newHeight !== undefined && { height: constrainedHeight })
        };
    }, [getItemBounds, canvasWidth, canvasHeight, estimateTextWidth]);

    // Helper functions for number input fields with Enter-to-apply behavior
    const getInputValue = useCallback((fieldKey: string, actualValue: number): string => {
        // Return editing value if field is being edited, otherwise return actual value
        return editingFields[fieldKey] !== undefined ? editingFields[fieldKey] : actualValue.toString();
    }, [editingFields]);

    const handleNumberInputChange = useCallback((fieldKey: string, value: string) => {
        // Store the raw input value (allows partial editing like "1" before typing "12")
        setEditingFields(prev => ({ ...prev, [fieldKey]: value }));
    }, []);

    const handleNumberInputBlur = useCallback((fieldKey: string) => {
        // Clear editing state when field loses focus
        setEditingFields(prev => {
            const newState = { ...prev };
            delete newState[fieldKey];
            return newState;
        });
    }, []);

    const handleNumberInputKeyDown = useCallback((e: React.KeyboardEvent, fieldKey: string, applyValue: () => void) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyValue();
            // Clear editing state after applying
            setEditingFields(prev => {
                const newState = { ...prev };
                delete newState[fieldKey];
                return newState;
            });
        } else if (e.key === 'Escape') {
            // Cancel editing and revert to actual value
            setEditingFields(prev => {
                const newState = { ...prev };
                delete newState[fieldKey];
                return newState;
            });
            (e.target as HTMLInputElement).blur();
        }
    }, []);

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

    // Font size input state (for delayed updates)
    const [fontSizeInput, setFontSizeInput] = useState<string>('');
    const [isFontSizeEditing, setIsFontSizeEditing] = useState<boolean>(false);

    // Watch for font size input changes and update canvas immediately
    useEffect(() => {
        if (isFontSizeEditing && selectedIds.length === 1 && fontSizeInput) {
            const selectedId = selectedIds[0];
            const newFontSize = parseInt(fontSizeInput);
            if (!isNaN(newFontSize) && newFontSize >= 8 && newFontSize <= 200) {
                setCanvasItems(items =>
                    items.map(item =>
                        selectedIds.includes(item.id) && item.type === 'text' 
                            ? { ...item, fontSize: newFontSize } as TextItem
                            : item
                    )
                );
            }
        }
    }, [fontSizeInput, selectedIds, isFontSizeEditing]);

    // Delete selected item function - now handles multiple selections
    const deleteSelectedItem = useCallback(() => {
        if (selectedIds.length > 0) {
            setCanvasItems(items => items.filter(item => !selectedIds.includes(item.id)));
            setSelectedIds([]);
        }
    }, [selectedIds]);

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
                        selectedIds.includes(item.id) && item.type === 'text' 
                            ? { ...item, fontSize: clampedFontSize } 
                            : item
                    )
                );
            }
        }
        
        // Always exit editing mode
        setIsFontSizeEditing(false);
        setFontSizeInput('');
    }, [fontSizeInput, selectedIds]);

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
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); // Prevent default number input behavior
            
            if (selectedIds.length !== 1) return;
            
            const currentItem = canvasItems.find(item => selectedIds.includes(item.id));
            if (!currentItem || currentItem.type !== 'text') return;
            
            const textItem = currentItem as TextItem;
            const currentFontSize = textItem.fontSize || 16;
            const increment = e.shiftKey ? 5 : 1; // Hold Shift for larger increments
            const newFontSize = e.key === 'ArrowUp' 
                ? Math.min(200, currentFontSize + increment)
                : Math.max(8, currentFontSize - increment);
            
            // Update the canvas item immediately for real-time feedback
            setCanvasItems(items =>
                items.map(item =>
                    selectedIds.includes(item.id) && item.type === 'text' 
                        ? { ...item, fontSize: newFontSize } as TextItem
                        : item
                )
            );
            
            // Update the input field value to reflect the change
            setFontSizeInput(newFontSize.toString());
            setIsFontSizeEditing(true);
        }
    }, [handleFontSizeInputSubmit, selectedIds, canvasItems]);

    // Reset font size editing state when selected element changes
    React.useEffect(() => {
        setIsFontSizeEditing(false);
        setFontSizeInput('');
    }, [selectedIds]);

    // Selected Element Controls Component
    const renderSelectedElementControls = useCallback(() => {
        // Don't show properties panel if multiple items are selected
        if (selectedIds.length === 0) return null;
        if (selectedIds.length > 1) {
            return (
                <div style={{ marginTop: '10px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '15px' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                            {selectedIds.length} elements selected.
                        </p>
                    </div>
                    
                    {/* Delete Button for Multiple Selection */}
                    <div style={{ marginBottom: '15px' }}>
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
                            Delete {selectedIds.length} Elements
                        </button>
                    </div>
                    
                    {/* Keyboard Controls Help */}
                    <div style={{ marginTop: '15px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '3px', fontSize: '10px', color: '#666' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Keyboard Controls:</div>
                        <div>• Delete/Backspace: Remove elements</div>
                        <div>• Ctrl/Cmd + Click: Add/remove from selection</div>
                        <div>• Click + Drag on canvas: Select multiple</div>
                    </div>
                </div>
            );
        }

        const selectedId = selectedIds[0];
        const selectedItem = canvasItems.find(item => selectedIds.includes(item.id));
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
                                    const value = e.target.value;
                                    const newX = value === '' ? 0 : parseInt(value);
                                    if (!isNaN(newX)) {
                                        setCanvasItems(items =>
                                            items.map(item => {
                                                if (selectedIds.includes(item.id)) {
                                                    const constrained = constrainToCanvas(item, newX, item.y);
                                                    return { ...item, x: constrained.x };
                                                }
                                                return item;
                                            })
                                        );
                                    }
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
                                    const value = e.target.value;
                                    const newY = value === '' ? 0 : parseInt(value);
                                    if (!isNaN(newY)) {
                                        setCanvasItems(items =>
                                            items.map(item => {
                                                if (selectedIds.includes(item.id)) {
                                                    const constrained = constrainToCanvas(item, item.x, newY);
                                                    return { ...item, y: constrained.y };
                                                }
                                                return item;
                                            })
                                        );
                                    }
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
                                    selectedIds.includes(item.id) 
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
                            <textarea 
                                value={(selectedItem as any).text || ''}
                                onChange={(e) => {
                                    // Close canvas editing if active
                                    if (editingTextId !== null) {
                                        setEditingTextId(null);
                                        setEditingTextValue('');
                                    }
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            selectedIds.includes(item.id) && item.type === 'text'
                                                ? { ...item, text: e.target.value }
                                                : item
                                        )
                                    );
                                }}
                                rows={3}
                                style={{ 
                                    width: '100%', 
                                    padding: '6px 8px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* Font Family Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Font:
                            </label>
                            <select 
                                value={(selectedItem as any).fontFamily || availableFonts[0].value}
                                onChange={(e) => {
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            selectedIds.includes(item.id) && item.type === 'text'
                                                ? { ...item, fontFamily: e.target.value }
                                                : item
                                        )
                                    );
                                }}
                                style={{ 
                                    width: '100%', 
                                    padding: '6px 8px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                {availableFonts.map((font, index) => (
                                    <option key={index} value={font.value} style={{ fontFamily: font.value }}>
                                        {font.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Text Formatting Controls */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Formatting:
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {/* Bold Button */}
                                <button
                                    onClick={() => {
                                        setCanvasItems(items =>
                                            items.map(item =>
                                                selectedIds.includes(item.id) && item.type === 'text'
                                                    ? { ...item, bold: !(item as TextItem).bold }
                                                    : item
                                            )
                                        );
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        border: '2px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: ((selectedItem as TextItem).bold ?? false) ? '#007bff' : 'white',
                                        color: ((selectedItem as TextItem).bold ?? false) ? 'white' : '#333',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!((selectedItem as TextItem).bold ?? false)) {
                                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!((selectedItem as TextItem).bold ?? false)) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }
                                    }}
                                >
                                    B
                                </button>

                                {/* Italic Button */}
                                <button
                                    onClick={() => {
                                        setCanvasItems(items =>
                                            items.map(item =>
                                                selectedIds.includes(item.id) && item.type === 'text'
                                                    ? { ...item, italic: !(item as TextItem).italic }
                                                    : item
                                            )
                                        );
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        fontStyle: 'italic',
                                        fontWeight: 'bold',
                                        border: '2px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: ((selectedItem as TextItem).italic ?? false) ? '#007bff' : 'white',
                                        color: ((selectedItem as TextItem).italic ?? false) ? 'white' : '#333',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!((selectedItem as TextItem).italic ?? false)) {
                                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!((selectedItem as TextItem).italic ?? false)) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }
                                    }}
                                >
                                    I
                                </button>

                                {/* Underline Button */}
                                <button
                                    onClick={() => {
                                        setCanvasItems(items =>
                                            items.map(item =>
                                                selectedIds.includes(item.id) && item.type === 'text'
                                                    ? { ...item, underline: !(item as TextItem).underline }
                                                    : item
                                            )
                                        );
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        textDecoration: 'underline',
                                        border: '2px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: ((selectedItem as TextItem).underline ?? false) ? '#007bff' : 'white',
                                        color: ((selectedItem as TextItem).underline ?? false) ? 'white' : '#333',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!((selectedItem as TextItem).underline ?? false)) {
                                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!((selectedItem as TextItem).underline ?? false)) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }
                                    }}
                                >
                                    U
                                </button>
                            </div>
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
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    handleFontSizeInputChange(newValue);
                                    setIsFontSizeEditing(true); // Ensure editing state is set for useEffect
                                }}
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
                                Range: 8px - 200px • Use ↑↓ arrows or spinner buttons for real-time adjustment {isFontSizeEditing && '• Press Enter to apply'}
                            </div>
                        </div>

                        {/* Anchor Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Anchor:
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '8px',
                                maxWidth: '200px'
                            }}>
                                {/* Top row */}
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: (selectedItem as any).anchor === 'lt' ? '#e3f2fd' : 'white'
                                }}>
                                    <input 
                                        type="radio"
                                        name="anchor"
                                        value="lt"
                                        checked={(selectedItem as any).anchor === 'lt' || !(selectedItem as any).anchor}
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    selectedIds.includes(item.id) && item.type === 'text'
                                                        ? { ...item, anchor: e.target.value as any }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ marginRight: '4px' }}
                                    />
                                    Top-L
                                </label>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: (selectedItem as any).anchor === 'mt' ? '#e3f2fd' : 'white'
                                }}>
                                    <input 
                                        type="radio"
                                        name="anchor"
                                        value="mt"
                                        checked={(selectedItem as any).anchor === 'mt'}
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    selectedIds.includes(item.id) && item.type === 'text'
                                                        ? { ...item, anchor: e.target.value as any }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ marginRight: '4px' }}
                                    />
                                    Top-M
                                </label>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: (selectedItem as any).anchor === 'rt' ? '#e3f2fd' : 'white'
                                }}>
                                    <input 
                                        type="radio"
                                        name="anchor"
                                        value="rt"
                                        checked={(selectedItem as any).anchor === 'rt'}
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    selectedIds.includes(item.id) && item.type === 'text'
                                                        ? { ...item, anchor: e.target.value as any }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ marginRight: '4px' }}
                                    />
                                    Top-R
                                </label>
                                
                                {/* Bottom row */}
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: (selectedItem as any).anchor === 'ls' ? '#e3f2fd' : 'white'
                                }}>
                                    <input 
                                        type="radio"
                                        name="anchor"
                                        value="ls"
                                        checked={(selectedItem as any).anchor === 'ls'}
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    selectedIds.includes(item.id) && item.type === 'text'
                                                        ? { ...item, anchor: e.target.value as any }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ marginRight: '4px' }}
                                    />
                                    Bot-L
                                </label>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: (selectedItem as any).anchor === 'ms' ? '#e3f2fd' : 'white'
                                }}>
                                    <input 
                                        type="radio"
                                        name="anchor"
                                        value="ms"
                                        checked={(selectedItem as any).anchor === 'ms'}
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    selectedIds.includes(item.id) && item.type === 'text'
                                                        ? { ...item, anchor: e.target.value as any }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ marginRight: '4px' }}
                                    />
                                    Bot-M
                                </label>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    backgroundColor: (selectedItem as any).anchor === 'rs' ? '#e3f2fd' : 'white'
                                }}>
                                    <input 
                                        type="radio"
                                        name="anchor"
                                        value="rs"
                                        checked={(selectedItem as any).anchor === 'rs'}
                                        onChange={(e) => {
                                            setCanvasItems(items =>
                                                items.map(item =>
                                                    selectedIds.includes(item.id) && item.type === 'text'
                                                        ? { ...item, anchor: e.target.value as any }
                                                        : item
                                                )
                                            );
                                        }}
                                        style={{ marginRight: '4px' }}
                                    />
                                    Bot-R
                                </label>
                            </div>
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
                                Choose the anchor point for text positioning
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
                                value={getInputValue(`rect-width-${selectedId}`, (selectedItem as any).width || 50)}
                                onChange={(e) => {
                                    handleNumberInputChange(`rect-width-${selectedId}`, e.target.value);
                                }}
                                onBlur={() => handleNumberInputBlur(`rect-width-${selectedId}`)}
                                onKeyDown={(e) => handleNumberInputKeyDown(e, `rect-width-${selectedId}`, () => {
                                    const newWidth = parseInt(getInputValue(`rect-width-${selectedId}`, (selectedItem as any).width || 50)) || 50;
                                    setCanvasItems(items =>
                                        items.map(item => {
                                            if (selectedIds.includes(item.id) && item.type === 'rect') {
                                                const constrained = constrainToCanvas(item, item.x, item.y, newWidth, item.height);
                                                return { ...item, width: constrained.width || newWidth };
                                            }
                                            return item;
                                        })
                                    );
                                })}
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
                                value={getInputValue(`rect-height-${selectedId}`, (selectedItem as any).height || 50)}
                                onChange={(e) => {
                                    handleNumberInputChange(`rect-height-${selectedId}`, e.target.value);
                                }}
                                onBlur={() => handleNumberInputBlur(`rect-height-${selectedId}`)}
                                onKeyDown={(e) => handleNumberInputKeyDown(e, `rect-height-${selectedId}`, () => {
                                    const newHeight = parseInt(getInputValue(`rect-height-${selectedId}`, (selectedItem as any).height || 50)) || 50;
                                    setCanvasItems(items =>
                                        items.map(item => {
                                            if (selectedIds.includes(item.id) && item.type === 'rect') {
                                                const constrained = constrainToCanvas(item, item.x, item.y, item.width, newHeight);
                                                return { ...item, height: constrained.height || newHeight };
                                            }
                                            return item;
                                        })
                                    );
                                })}
                                style={{ 
                                    width: '100%', 
                                    padding: '4px 6px', 
                                    fontSize: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                }}
                            />
                        </div>

                        {/* X2 and Y2 Coordinates */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                End Position (X2, Y2):
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '11px', color: '#666', marginBottom: '3px', display: 'block' }}>X2:</label>
                                    <input 
                                        type="number" 
                                        step="1"
                                        value={selectedItem.x + ((selectedItem as any).width || 50)}
                                        onChange={(e) => {
                                            const newX2 = parseInt(e.target.value) || (selectedItem.x + 50);
                                            const newWidth = Math.max(1, newX2 - selectedItem.x);
                                            setCanvasItems(items =>
                                                items.map(item => {
                                                    if (selectedIds.includes(item.id) && item.type === 'rect') {
                                                        const constrained = constrainToCanvas(item, item.x, item.y, newWidth, item.height);
                                                        return { ...item, width: constrained.width || newWidth };
                                                    }
                                                    return item;
                                                })
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
                                        value={selectedItem.y + ((selectedItem as any).height || 50)}
                                        onChange={(e) => {
                                            const newY2 = parseInt(e.target.value) || (selectedItem.y + 50);
                                            const newHeight = Math.max(1, newY2 - selectedItem.y);
                                            setCanvasItems(items =>
                                                items.map(item => {
                                                    if (selectedIds.includes(item.id) && item.type === 'rect') {
                                                        const constrained = constrainToCanvas(item, item.x, item.y, item.width, newHeight);
                                                        return { ...item, height: constrained.height || newHeight };
                                                    }
                                                    return item;
                                                })
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
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
                                X2 = X + Width, Y2 = Y + Height
                            </div>
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
                                    items.map(item => {
                                        if (selectedIds.includes(item.id) && item.type === 'circle') {
                                            const constrained = constrainToCanvas(item, item.x, item.y);
                                            // For circles, we need to check if the new radius fits within bounds
                                            const maxRadius = Math.min(item.x, item.y, canvasWidth - item.x, canvasHeight - item.y);
                                            const finalRadius = Math.max(1, Math.min(maxRadius, newRadius));
                                            return { ...item, radius: finalRadius };
                                        }
                                        return item;
                                    })
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
                                                    selectedIds.includes(item.id) && item.type === 'line'
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
                                                    selectedIds.includes(item.id) && item.type === 'line'
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
                        
                        {/* Thickness Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Thickness (pixels):
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="1"
                                value={(selectedItem as any).thickness || 1}
                                onChange={(e) => {
                                    const newThickness = parseInt(e.target.value) || 1;
                                    setCanvasItems(items =>
                                        items.map(item =>
                                            selectedIds.includes(item.id) && item.type === 'line'
                                                ? { ...item, thickness: Math.max(1, newThickness) }
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
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
                                Width of the line in pixels
                            </div>
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
                                                items.map(item => {
                                                    if (selectedIds.includes(item.id) && item.type === 'barcode') {
                                                        const constrained = constrainToCanvas(item, item.x, item.y, newWidth, item.height);
                                                        return { ...item, width: constrained.width || newWidth };
                                                    }
                                                    return item;
                                                })
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
                                                items.map(item => {
                                                    if (selectedIds.includes(item.id) && item.type === 'barcode') {
                                                        const constrained = constrainToCanvas(item, item.x, item.y, item.width, newHeight);
                                                        return { ...item, height: constrained.height || newHeight };
                                                    }
                                                    return item;
                                                })
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
                                            selectedIds.includes(item.id) && item.type === 'barcode'
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
                                        items.map(item => {
                                            if (selectedIds.includes(item.id) && item.type === 'qrcode') {
                                                const constrained = constrainToCanvas(item, item.x, item.y, newSize, newSize);
                                                return { ...item, size: constrained.width || newSize };
                                            }
                                            return item;
                                        })
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
                                            selectedIds.includes(item.id) && item.type === 'qrcode'
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
    }, [selectedIds, canvasItems, canvasWidth, canvasHeight, deleteSelectedItem, isFontSizeEditing, fontSizeInput, handleFontSizeInputFocus, handleFontSizeInputChange, handleFontSizeInputBlur, handleFontSizeKeyDown]);

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
        const selectedItem = selectedIds.length === 1 ? canvasItems.find(item => selectedIds.includes(item.id)) : null;
        
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
                                
                                {/* Layer Controls */}
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                        Layer:
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {(() => {
                                            const currentZIndex = selectedItem.zIndex || 0;
                                            const maxZIndex = Math.max(...canvasItems.map(item => item.zIndex || 0));
                                            const minZIndex = Math.min(...canvasItems.map(item => item.zIndex || 0));
                                            const canMoveUp = currentZIndex < maxZIndex;
                                            const canMoveDown = currentZIndex > minZIndex;
                                            
                                            return (
                                                <>
                                                    <button
                                                        onClick={() => moveElementUp(selectedItem.id)}
                                                        disabled={!canMoveUp}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px 12px',
                                                            fontSize: '12px',
                                                            border: `1px solid ${canMoveUp ? '#007bff' : '#ccc'}`,
                                                            borderRadius: '4px',
                                                            backgroundColor: canMoveUp ? '#f8f9fa' : '#f5f5f5',
                                                            cursor: canMoveUp ? 'pointer' : 'not-allowed',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            color: canMoveUp ? '#007bff' : '#999',
                                                            fontWeight: '500',
                                                            transition: 'all 0.2s ease',
                                                            opacity: canMoveUp ? 1 : 0.6
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (canMoveUp) {
                                                                e.currentTarget.style.backgroundColor = '#007bff';
                                                                e.currentTarget.style.color = 'white';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (canMoveUp) {
                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                                e.currentTarget.style.color = '#007bff';
                                                            }
                                                        }}
                                                    >
                                                        ↑ Move up
                                                    </button>
                                                    <button
                                                        onClick={() => moveElementDown(selectedItem.id)}
                                                        disabled={!canMoveDown}
                                                        style={{
                                                            flex: 1,
                                                            padding: '8px 12px',
                                                            fontSize: '12px',
                                                            border: `1px solid ${canMoveDown ? '#007bff' : '#ccc'}`,
                                                            borderRadius: '4px',
                                                            backgroundColor: canMoveDown ? '#f8f9fa' : '#f5f5f5',
                                                            cursor: canMoveDown ? 'pointer' : 'not-allowed',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            color: canMoveDown ? '#007bff' : '#999',
                                                            fontWeight: '500',
                                                            transition: 'all 0.2s ease',
                                                            opacity: canMoveDown ? 1 : 0.6
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (canMoveDown) {
                                                                e.currentTarget.style.backgroundColor = '#007bff';
                                                                e.currentTarget.style.color = 'white';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (canMoveDown) {
                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                                e.currentTarget.style.color = '#007bff';
                                                            }
                                                        }}
                                                    >
                                                        ↓ Move down
                                                    </button>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#888', marginTop: '3px', textAlign: 'center' }}>
                                        Layer {(selectedItem.zIndex || 0) + 1} of {canvasItems.length}
                                    </div>
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
    }, [activePropertiesSection, selectedIds, canvasItems, renderSelectedElementControls]);

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
        
        // Prevent event from bubbling to canvas background handler
        e.stopPropagation();
        
        // Support multi-selection with Ctrl/Cmd key
        if (e.ctrlKey || e.metaKey) {
            setSelectedIds(prev => {
                if (prev.includes(id)) {
                    // Deselect if already selected
                    return prev.filter(sid => sid !== id);
                } else {
                    // Add to selection
                    return [...prev, id];
                }
            });
        } else {
            // Single selection (replace current selection)
            setSelectedIds([id]);
        }
        
        setDragging(true);
        const item = canvasItems.find(i => i.id === id);
        if (!item) return;
        
        // Get SVG canvas bounds
        const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
        if (!rect) return;
        
        // Calculate mouse position relative to canvas, accounting for zoom
        const mouseX = (e.clientX - rect.left) / zoomLevel;
        const mouseY = (e.clientY - rect.top) / zoomLevel;
        
        // Calculate offset from mouse to element's position
        // For lines, we use the actual starting point (x, y) not the rendered rectangle position
        setDragOffset({
            x: mouseX - item.x,
            y: mouseY - item.y
        });
    }, [resizing, canvasItems, zoomLevel]);

    // Double-click handler for text editing on canvas
    const handleTextDoubleClick = useCallback((e: React.MouseEvent, item: TextItem) => {
        e.stopPropagation();
        setEditingTextId(item.id);
        setEditingTextValue(item.text);
        setSelectedIds([item.id]);
    }, []);

    // Finish editing text
    const finishTextEditing = useCallback(() => {
        if (editingTextId !== null && editingTextValue !== undefined) {
            setCanvasItems(prev => prev.map(item => 
                item.id === editingTextId && item.type === 'text'
                    ? { ...item, text: editingTextValue }
                    : item
            ));
        }
        setEditingTextId(null);
        setEditingTextValue('');
    }, [editingTextId, editingTextValue]);

    // Canvas background click handler for drag-to-select
    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        // Only handle if clicking on the canvas background (not on an element)
        const target = e.target as Element;
        
        // Check if we clicked on the canvas background (svg element or background rect)
        const isSvgElement = target.tagName === 'svg';
        const isBackgroundRect = target.tagName === 'rect' && target.classList.contains('canvas-background');
        const isGenericBackgroundRect = target.tagName === 'rect' && target.getAttribute('width') === '100%' && target.getAttribute('height') === '100%';
        
        if (isSvgElement || isBackgroundRect || isGenericBackgroundRect) {
            e.stopPropagation(); // Prevent container handler from also firing
            
            // Get SVG canvas bounds for calculating position
            const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
            if (!rect) return;
            
            // Calculate mouse position relative to canvas, accounting for zoom
            const mouseX = (e.clientX - rect.left) / zoomLevel;
            const mouseY = (e.clientY - rect.top) / zoomLevel;
            
            // Start drag-to-select
            setSelectingBox(true);
            setSelectionBoxStart({ x: mouseX, y: mouseY });
            setSelectionBoxEnd({ x: mouseX, y: mouseY });
            
            // Clear selection if not holding Ctrl/Cmd
            if (!e.ctrlKey && !e.metaKey) {
                setSelectedIds([]);
            }
            
            // Stop any dragging
            setDragging(false);
        }
    }, [zoomLevel]);

    // Container mousedown handler - allows starting selection from outside canvas
    const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as Element;
        
        // Don't start selection if clicking on SVG elements (shapes, text, etc.)
        const clickedOnSvgElement = target.tagName === 'rect' || target.tagName === 'circle' || 
                                     target.tagName === 'text' || target.tagName === 'line' ||
                                     target.tagName === 'g' || target.tagName === 'path';
        
        // Don't interfere with element selection
        if (clickedOnSvgElement) {
            return;
        }
        
        // Start selection from anywhere in the container (including gray area)
        // Find the SVG element to get proper coordinates
        const svg = document.querySelector('.template-canvas');
        if (!svg) return;
        
        const rect = svg.getBoundingClientRect();
        
        // Calculate mouse position relative to canvas, accounting for zoom
        const mouseX = (e.clientX - rect.left) / zoomLevel;
        const mouseY = (e.clientY - rect.top) / zoomLevel;
        
        // Start drag-to-select
        setSelectingBox(true);
        setSelectionBoxStart({ x: mouseX, y: mouseY });
        setSelectionBoxEnd({ x: mouseX, y: mouseY });
        
        // Clear selection if not holding Ctrl/Cmd
        if (!e.ctrlKey && !e.metaKey) {
            setSelectedIds([]);
        }
        
        // Stop any dragging
        setDragging(false);
    }, [zoomLevel]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        // Handle drag-to-select box
        if (selectingBox) {
            const rect = document.querySelector('.template-canvas')?.getBoundingClientRect();
            if (!rect) return;
            
            const mouseX = (e.clientX - rect.left) / zoomLevel;
            const mouseY = (e.clientY - rect.top) / zoomLevel;
            
            setSelectionBoxEnd({ x: mouseX, y: mouseY });
            return;
        }
        
        if (dragging && selectedIds.length > 0) {
            const rect = document.querySelector('.template-canvas')?.getBoundingClientRect();
            if (!rect) return;
            
            setCanvasItems(items =>
                items.map(item => {
                    if (selectedIds.includes(item.id)) {
                        const newX = Math.round(((e.clientX - rect.left) / zoomLevel) - dragOffset.x);
                        const newY = Math.round(((e.clientY - rect.top) / zoomLevel) - dragOffset.y);
                        
                        if (item.type === 'line') {
                            // For lines, move both endpoints together smoothly
                            const deltaX = newX - item.x;
                            const deltaY = newY - item.y;
                            
                            // Calculate new positions for both endpoints
                            let newX1 = newX;
                            let newY1 = newY;
                            let newX2 = item.x2 + deltaX;
                            let newY2 = item.y2 + deltaY;
                            
                            // Calculate the bounding box of the line
                            const minX = Math.min(newX1, newX2);
                            const maxX = Math.max(newX1, newX2);
                            const minY = Math.min(newY1, newY2);
                            const maxY = Math.max(newY1, newY2);
                            
                            // Check if the line would exceed boundaries
                            let adjustX = 0;
                            let adjustY = 0;
                            
                            if (minX < 0) adjustX = -minX;
                            if (maxX > canvasWidth) adjustX = canvasWidth - maxX;
                            if (minY < 0) adjustY = -minY;
                            if (maxY > canvasHeight) adjustY = canvasHeight - maxY;
                            
                            // Apply adjustments to keep the entire line within bounds
                            newX1 += adjustX;
                            newX2 += adjustX;
                            newY1 += adjustY;
                            newY2 += adjustY;
                            
                            return {
                                ...item,
                                x: newX1,
                                y: newY1,
                                x2: newX2,
                                y2: newY2
                            };
                        } else {
                            // For other elements, use the constraint function
                            const constrained = constrainToCanvas(item, newX, newY);
                            return {
                                ...item,
                                x: constrained.x,
                                y: constrained.y
                            };
                        }
                    }
                    return item;
                })
            );
        }
    }, [dragging, selectingBox, selectedIds, dragOffset, zoomLevel, constrainToCanvas, canvasWidth, canvasHeight]);

    const handleMouseUp = useCallback(() => {
        // Handle drag-to-select completion
        if (selectingBox) {
            // Calculate selection box bounds
            const minX = Math.min(selectionBoxStart.x, selectionBoxEnd.x);
            const maxX = Math.max(selectionBoxStart.x, selectionBoxEnd.x);
            const minY = Math.min(selectionBoxStart.y, selectionBoxEnd.y);
            const maxY = Math.max(selectionBoxStart.y, selectionBoxEnd.y);
            
            // Find all items within the selection box
            const itemsInBox = canvasItems.filter(item => {
                const bounds = getItemBounds(item);
                
                // Skip if bounds are invalid
                if (bounds.x === undefined || bounds.y === undefined) return false;
                
                // Check if item overlaps with selection box
                const itemMinX = bounds.x;
                const itemMaxX = bounds.x + (bounds.width || 0);
                const itemMinY = bounds.y;
                const itemMaxY = bounds.y + (bounds.height || 0);
                
                // Check for overlap (not just containment, for better UX)
                return !(itemMaxX < minX || itemMinX > maxX || itemMaxY < minY || itemMinY > maxY);
            });
            
            // Add the items to selection (or replace if not holding Ctrl/Cmd)
            const newSelection = itemsInBox.map(item => item.id);
            setSelectedIds(prev => {
                // If user was holding Ctrl/Cmd when starting selection, add to existing selection
                // This would need to be tracked from the initial mousedown event
                // For now, just replace the selection
                return newSelection;
            });
            
            setSelectingBox(false);
        }
        
        setDragging(false);
        setResizing(false);
        setResizeHandle(null);
    }, [selectingBox, selectionBoxStart, selectionBoxEnd, canvasItems, getItemBounds]);

    // Resize event handlers
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        if (selectedIds.length !== 1) return;
        
        const item = canvasItems.find(i => i.id === selectedIds[0]);
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
    }, [selectedIds, canvasItems]);

    const handleResizeMouseMove = useCallback((e: MouseEvent) => {
        if (resizing && selectedIds.length > 0 && resizeHandle) {
            const rect = document.querySelector('.template-canvas')?.getBoundingClientRect();
            if (!rect) return;
            
            const mouseX = (e.clientX - rect.left) / zoomLevel;
            const mouseY = (e.clientY - rect.top) / zoomLevel;
            
            setCanvasItems(items =>
                items.map(item => {
                    if (!selectedIds.includes(item.id) || (item.type !== 'rect' && item.type !== 'text' && item.type !== 'line')) return item;
                    
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
                        
                        // Apply canvas boundary constraints
                        const constrained = constrainToCanvas(item, newX, newY, newWidth, newHeight);
                        
                        return {
                            ...item,
                            x: Math.round(constrained.x),
                            y: Math.round(constrained.y),
                            width: Math.round(constrained.width || newWidth),
                            height: Math.round(constrained.height || newHeight)
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
                        // Constrain to horizontal or vertical movement only, but allow switching orientation
                        let newX = item.x;
                        let newY = item.y;
                        let newX2 = item.x2;
                        let newY2 = item.y2;
                        
                        switch (resizeHandle) {
                            case 'start': // Start point handle
                                // Calculate deltas from the fixed end point
                                const deltaXFromEnd = mouseX - item.x2;
                                const deltaYFromEnd = mouseY - item.y2;
                                
                                // Determine which direction has more movement
                                if (Math.abs(deltaXFromEnd) > Math.abs(deltaYFromEnd)) {
                                    // More horizontal movement - make it horizontal
                                    newX = mouseX;
                                    newY = item.y2; // Align with end point Y
                                    newY2 = item.y2; // Keep end point Y the same
                                } else {
                                    // More vertical movement - make it vertical
                                    newX = item.x2; // Align with end point X
                                    newY = mouseY;
                                    newX2 = item.x2; // Keep end point X the same
                                }
                                break;
                            case 'end': // End point handle
                                // Calculate deltas from the fixed start point
                                const deltaXFromStart = mouseX - item.x;
                                const deltaYFromStart = mouseY - item.y;
                                
                                // Determine which direction has more movement
                                if (Math.abs(deltaXFromStart) > Math.abs(deltaYFromStart)) {
                                    // More horizontal movement - make it horizontal
                                    newX2 = mouseX;
                                    newY2 = item.y; // Align with start point Y
                                    newY = item.y; // Keep start point Y the same
                                } else {
                                    // More vertical movement - make it vertical
                                    newX2 = item.x; // Align with start point X
                                    newY2 = mouseY;
                                    newX = item.x; // Keep start point X the same
                                }
                                break;
                        }
                        
                        // Apply canvas boundary constraints to line endpoints
                        const constrainedX = Math.max(0, Math.min(canvasWidth, newX));
                        const constrainedY = Math.max(0, Math.min(canvasHeight, newY));
                        const constrainedX2 = Math.max(0, Math.min(canvasWidth, newX2));
                        const constrainedY2 = Math.max(0, Math.min(canvasHeight, newY2));
                        
                        return {
                            ...item,
                            x: Math.round(constrainedX),
                            y: Math.round(constrainedY),
                            x2: Math.round(constrainedX2),
                            y2: Math.round(constrainedY2)
                        };
                    }
                    
                    return item;
                })
            );
        }
    }, [resizing, selectedIds, resizeHandle, resizeStart, zoomLevel, constrainToCanvas, canvasWidth, canvasHeight]);

    // Add mouse event listeners
    React.useEffect(() => {
        if (dragging || resizing || selectingBox) {
            const mouseMoveHandler = resizing ? handleResizeMouseMove : handleMouseMove;
            window.addEventListener("mousemove", mouseMoveHandler);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", mouseMoveHandler);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [dragging, resizing, selectingBox, handleResizeMouseMove, handleMouseMove, handleMouseUp]);

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

        // Handle escape key to deselect elements
        if (e.key === 'Escape') {
            setSelectedIds([]);
            setDragging(false);
            return;
        }

        // Handle delete functionality - works for single or multiple selections
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedIds.length > 0) {
                deleteSelectedItem();
            }
            return;
        }

        if (selectedIds.length !== 1) return;

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
                    if (selectedIds.includes(item.id)) {
                        const newX = Math.max(0, Math.min(canvasWidth - 10, item.x + deltaX));
                        const newY = Math.max(0, Math.min(canvasHeight - 10, item.y + deltaY));
                        return { ...item, x: newX, y: newY };
                    }
                    return item;
                })
            );
        }
    }, [selectedIds, canvasWidth, canvasHeight, deleteSelectedItem, zoomIn, zoomOut, resetZoom]);

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
            const estimatedWidth = estimateTextWidth(item.text, item.fontSize, (item as TextItem).fontFamily);
            const estimatedHeight = item.fontSize; // Use fontSize as the height
            
            // Make handles slightly larger and proportional to text height
            handleSize = Math.max(4, Math.min(item.fontSize * 0.25, 10));
            
            // Position handles exactly at the text boundaries
            // item.y is the top edge, text baseline is at item.y + fontSize
            const textTop = item.y; // Top edge of text at item.y
            const textBottom = item.y + estimatedHeight; // Bottom edge
            const textLeft = item.x; // Exact left edge of text
            const textRight = item.x + estimatedWidth; // Exact right edge of text
            
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
    }, [handleResizeMouseDown, estimateTextWidth]);

    const addElement = useCallback((type: string) => {
        setCanvasItems(prevItems => {
            const newId = prevItems.length > 0 ? Math.max(...prevItems.map(item => item.id)) + 1 : 1;
            const newZIndex = prevItems.length > 0 ? Math.max(...prevItems.map(item => item.zIndex || 0)) + 1 : 0;
            let newItem: CanvasItem;
            
            switch (type) {
                case 'rect':
                    newItem = { id: newId, type: 'rect', x: 50, y: 50, width: 100, height: 60, color: '#000000', zIndex: newZIndex };
                    break;
                case 'circle':
                    newItem = { id: newId, type: 'circle', x: 100, y: 100, radius: 30, color: '#ff0000', zIndex: newZIndex };
                    break;
                case 'text':
                    newItem = { id: newId, type: 'text', x: 50, y: 50, text: 'New Text', fontSize: 14, color: '#000000', fontFamily: availableFonts[0].value, bold: false, italic: false, underline: false, zIndex: newZIndex };
                    break;
                case 'line':
                    newItem = { id: newId, type: 'line', x: 50, y: 50, x2: 150, y2: 50, strokeWidth: 2, thickness: 1, color: '#000000', zIndex: newZIndex };
                    break;
                case 'barcode':
                    newItem = { id: newId, type: 'barcode', x: 50, y: 50, width: 100, height: 30, data: '123456789', color: '#000000', zIndex: newZIndex };
                    break;
                case 'qrcode':
                    newItem = { id: newId, type: 'qrcode', x: 50, y: 50, size: 50, data: 'https://example.com', color: '#000000', zIndex: newZIndex };
                    break;
                default:
                    return prevItems;
            }
            
            return [...prevItems, newItem];
        });
    }, []);

    // Layer management functions
    const moveElementUp = useCallback((elementId: number) => {
        setCanvasItems(prevItems => {
            const currentItem = prevItems.find(item => item.id === elementId);
            if (!currentItem) return prevItems;
            
            const currentZIndex = currentItem.zIndex || 0;
            const itemsAbove = prevItems.filter(item => (item.zIndex || 0) > currentZIndex);
            
            if (itemsAbove.length === 0) return prevItems; // Already at top
            
            // Find the lowest zIndex above current item
            const nextZIndex = Math.min(...itemsAbove.map(item => item.zIndex || 0));
            
            return prevItems.map(item => {
                if (item.id === elementId) {
                    return { ...item, zIndex: nextZIndex };
                } else if (item.zIndex === nextZIndex) {
                    return { ...item, zIndex: currentZIndex };
                }
                return item;
            });
        });
    }, []);

    const moveElementDown = useCallback((elementId: number) => {
        setCanvasItems(prevItems => {
            const currentItem = prevItems.find(item => item.id === elementId);
            if (!currentItem) return prevItems;
            
            const currentZIndex = currentItem.zIndex || 0;
            const itemsBelow = prevItems.filter(item => (item.zIndex || 0) < currentZIndex);
            
            if (itemsBelow.length === 0) return prevItems; // Already at bottom
            
            // Find the highest zIndex below current item
            const nextZIndex = Math.max(...itemsBelow.map(item => item.zIndex || 0));
            
            return prevItems.map(item => {
                if (item.id === elementId) {
                    return { ...item, zIndex: nextZIndex };
                } else if (item.zIndex === nextZIndex) {
                    return { ...item, zIndex: currentZIndex };
                }
                return item;
            });
        });
    }, []);

    // YAML Export function based on ESL template structure
    const exportToYAML = useCallback(async () => {
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

        // Create a font for each unique font family + size combination used in text elements
        const usedFontCombinations = new Set<string>();
        const textElements = canvasItems.filter(item => item.type === 'text') as TextItem[];
        
        // Collect all unique font family + size combinations from user-defined text elements
        textElements.forEach(item => {
            const fontFamily = item.fontFamily || availableFonts[0].value;
            const combinationKey = `${fontFamily}|${item.fontSize}`;
            usedFontCombinations.add(combinationKey);
        });

        // Always include a default font combination for template variables if not already present
        const defaultCombination = `${availableFonts[0].value}|16`;
        if (!usedFontCombinations.has(defaultCombination)) {
            usedFontCombinations.add(defaultCombination);
        }

        // Generate fonts array with appropriate ESL font files for each combination
        const fonts: any[] = [];
        const fontCombinationToIndex = new Map<string, number>();
        
        Array.from(usedFontCombinations).sort().forEach((combination, index) => {
            const [fontFamily, fontSize] = combination.split('|');
            fonts.push({
                type: getEslFontFromWebFont(fontFamily),
                size: parseInt(fontSize)
            });
            fontCombinationToIndex.set(combination, index);
        });

        // Get the index for default font combination for template variables
        const defaultFontIndex = fontCombinationToIndex.get(defaultCombination) || 0;

        // Generate the YAML structure with new fields
        const yamlData: any = {
            fontbase: 'fonts/',
            fonts: fonts,
            type: eslType,
            x_res: canvasWidth,
            y_res: canvasHeight,
            axis: eslAxis,
            el: [] as any[]
        };

        // Convert canvas items to ESL elements
        canvasItems.forEach((item, index) => {
            if (item.type === 'text') {
                // Check if text contains brackets indicating a variable
                const safeText = String(item.text || '');
                const bracketMatch = safeText.match(/^\[(.+)\]$/);
                
                if (bracketMatch) {
                    // Text is in format [variableName] - create a var element
                    const varName = bracketMatch[1];
                    const fontFamily = item.fontFamily || availableFonts[0].value;
                    const combinationKey = `${fontFamily}|${item.fontSize}`;
                    const element = {
                        type: 'var',
                        fill: colorToFill(item.color),
                        var: varName,
                        x: item.x,
                        y: item.y,
                        anchor: item.anchor || 'ls',
                        font: fontCombinationToIndex.get(combinationKey) || 0
                    };
                    yamlData.el.push(element);
                } else {
                    // Regular text element
                    const fontFamily = item.fontFamily || availableFonts[0].value;
                    const combinationKey = `${fontFamily}|${item.fontSize}`;
                    const element: any = {
                        type: 'text',
                        fill: colorToFill(item.color),
                        text: item.text,
                        x: item.x,
                        y: item.y,
                        anchor: item.anchor || 'ls',
                        font: fontCombinationToIndex.get(combinationKey) || 0
                    };
                    
                    // Add formatting flags as comments (for reference, ESL may not support these)
                    if (item.bold || item.italic || item.underline) {
                        element._formatting = {
                            bold: item.bold || false,
                            italic: item.italic || false,
                            underline: item.underline || false
                        };
                    }
                    
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
            } else if (item.type === 'line') {
                // Convert lines to rect elements using the line's thickness
                // Determine if line is horizontal or vertical based on orientation
                const isHorizontal = Math.abs(item.x2 - item.x) > Math.abs(item.y2 - item.y);
                const thickness = item.thickness || 1;
                
                let x1, y1, x2, y2;
                
                if (isHorizontal) {
                    // Horizontal line - create a thin rectangle
                    x1 = Math.min(item.x, item.x2);
                    x2 = Math.max(item.x, item.x2);
                    y1 = Math.min(item.y, item.y2);
                    y2 = y1 + thickness;
                } else {
                    // Vertical line - create a thin rectangle
                    x1 = Math.min(item.x, item.x2);
                    x2 = x1 + thickness;
                    y1 = Math.min(item.y, item.y2);
                    y2 = Math.max(item.y, item.y2);
                }
                
                const element = {
                    type: 'rect',
                    fill: colorToFill(item.color),
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2
                };
                yamlData.el.push(element);
            }
        });

        // Convert to YAML string
        const yamlString = convertToYAMLString(yamlData);
        
        // Use File System Access API if available (Chrome/Edge), otherwise fallback to download
        if ('showSaveFilePicker' in window) {
            try {
                // Show native save dialog
                const defaultFilename = templateFilename === 'New template' ? 'esl-template' : templateFilename;
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: `${defaultFilename}.yaml`,
                    types: [{
                        description: 'YAML Files',
                        accept: { 'text/yaml': ['.yaml', '.yml'] }
                    }]
                });
                
                // Write the file
                const writable = await handle.createWritable();
                await writable.write(yamlString);
                await writable.close();
                
                // Extract filename without extension
                const savedFilename = handle.name.replace(/\.(yaml|yml)$/i, '');
                setTemplateFilename(savedFilename);
                setLastSavedFilename(savedFilename);
                
                alert('Template saved successfully!');
            } catch (error) {
                // User cancelled or error occurred
                if ((error as any).name !== 'AbortError') {
                    console.error('Error saving file:', error);
                    alert('Error saving file. Please try again.');
                }
            }
        } else {
            // Fallback for browsers without File System Access API
            const defaultFilename = templateFilename === 'New template' ? 'esl-template' : templateFilename;
            const userFilename = prompt('Enter filename (without extension):', defaultFilename);
            
            // If user cancels, don't download
            if (userFilename === null) {
                return;
            }
            
            // Use the provided filename or fallback to default
            const filename = userFilename.trim() || defaultFilename;
            
            // Check if overwriting an existing file
            if (filename === lastSavedFilename) {
                const confirmOverwrite = window.confirm(
                    `A file named "${filename}.yaml" was previously downloaded. Do you want to save it again?\n\n` +
                    `Note: Your browser may rename the new file (e.g., "${filename} (1).yaml") depending on your download settings. ` +
                    `To replace the existing file, you may need to manually delete the old one first or enable "Ask where to save each file before downloading" in your browser settings.`
                );
                if (!confirmOverwrite) {
                    return;
                }
            }
            
            // Update the template filename if it changed
            if (filename !== templateFilename && templateFilename === 'New template') {
                setTemplateFilename(filename);
            }
            
            // Track this as the last saved filename
            setLastSavedFilename(filename);
            
            // Create and download file
            const blob = new Blob([yamlString], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.yaml`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }, [canvasItems, canvasWidth, canvasHeight, templateFilename, lastSavedFilename, eslType, eslAxis]);

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
        ctx.textBaseline = 'alphabetic'; // Match SVG text baseline behavior
        
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
                
                // Use the same font family as in the SVG display
                const fontFamily = (item as TextItem).fontFamily || availableFonts[0].value;
                const fontWeight = ((item as TextItem).bold ?? false) ? 'bold' : 'normal';
                const fontStyle = ((item as TextItem).italic ?? false) ? 'italic' : 'normal';
                
                ctx.font = `${fontStyle} ${fontWeight} ${Math.round(item.fontSize)}px ${fontFamily}`;
                ctx.textBaseline = 'hanging'; // Use 'hanging' to match SVG's dominantBaseline="hanging"
                
                // Only constrain left boundary - allow text to extend beyond right edge
                const constrainedX = Math.max(0, item.x);
                
                // Handle multi-line text
                const text = String(item.text || '');
                const lines = text.split('\n');
                const lineHeight = item.fontSize * 1.2;
                
                lines.forEach((line, index) => {
                    const y = Math.round(item.y - 2 + (index * lineHeight));
                    ctx.fillText(
                        line,
                        Math.round(constrainedX - 1), // Offset by -1 for x-axis font spacing
                        y // Offset by -2 and add line spacing
                    );
                    
                    // Draw underline if enabled
                    if ((item as TextItem).underline ?? false) {
                        const textWidth = ctx.measureText(line).width;
                        const underlineY = y + item.fontSize + 1;
                        ctx.beginPath();
                        ctx.moveTo(Math.round(constrainedX - 1), underlineY);
                        ctx.lineTo(Math.round(constrainedX - 1 + textWidth), underlineY);
                        ctx.strokeStyle = exactColor;
                        ctx.lineWidth = Math.max(1, Math.round(item.fontSize / 12));
                        ctx.stroke();
                    }
                });
            } else if (item.type === 'line') {
                // Render line as a rectangle with specified thickness
                const thickness = item.thickness || 1;
                const isHorizontal = Math.abs(item.x2 - item.x) > Math.abs(item.y2 - item.y);
                const rectX = Math.min(item.x, item.x2);
                const rectY = Math.min(item.y, item.y2) - (isHorizontal ? thickness / 2 : 0);
                const rectWidth = isHorizontal ? Math.abs(item.x2 - item.x) : thickness;
                const rectHeight = isHorizontal ? thickness : Math.abs(item.y2 - item.y);
                
                ctx.fillStyle = exactColor;
                ctx.fillRect(
                    Math.round(rectX),
                    Math.round(rectY),
                    Math.round(rectWidth),
                    Math.round(rectHeight)
                );
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

    // Clear canvas function
    const clearCanvas = useCallback(() => {
        if (window.confirm('Are you sure you want to clear all elements from the canvas? This action cannot be undone.')) {
            setCanvasItems([]);
            setSelectedIds([]);
            setTemplateFilename('New template');
            setLastSavedFilename(''); // Reset last saved filename
        }
    }, []);

    // Import YAML template function
    const importTemplate = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.yaml,.yml';
        
        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                console.log('YAML file content:', text); // Debug log
                
                const parsedData = parseYAMLString(text);
                console.log('Parsed data:', parsedData); // Debug log
                
                if (!parsedData || !parsedData.el || !Array.isArray(parsedData.el) || parsedData.el.length === 0) {
                    alert('Invalid YAML file format. Could not find elements.');
                    console.error('Parsed data is invalid:', parsedData);
                    return;
                }
                
                // Helper function to convert fill value to color
                const fillToColor = (fill: number | undefined): string => {
                    if (fill === undefined || fill === null) return '#000000';
                    switch (fill) {
                        case 0: return '#000000'; // black
                        case 1: return '#ffffff'; // white
                        case 2: return '#ffff00'; // yellow
                        case 3: return '#ff0000'; // red
                        default: return '#000000';
                    }
                };
                
                // Convert YAML elements to canvas items
                const newItems: CanvasItem[] = [];
                let nextId = 1;
                
                parsedData.el.forEach((element: any) => {
                    try {
                        console.log('Processing element:', element); // Debug log
                        
                        if (!element || !element.type) {
                            console.warn('Skipping invalid element:', element);
                            return;
                        }
                    
                        if (element.type === 'text' || element.type === 'var') {
                            // Get font information with safe defaults
                            const fontIndex = typeof element.font === 'number' ? element.font : 0;
                            const fonts = Array.isArray(parsedData.fonts) ? parsedData.fonts : [];
                            const font = fonts[fontIndex] || { size: 16, type: 'DejaVuSans' };
                            
                            // Map ESL font back to web font
                            const webFont = getWebFontFromEslFont(font.type || 'DejaVuSans');
                            
                            // Safely extract formatting properties
                            const formatting = (element._formatting && typeof element._formatting === 'object') ? element._formatting : {};
                            
                            const textItem: TextItem = {
                                id: nextId++,
                                type: 'text',
                                x: typeof element.x === 'number' ? element.x : 0,
                                y: typeof element.y === 'number' ? element.y : 0,
                                text: element.type === 'var' ? `[${element.var || ''}]` : (element.text || ''),
                                color: fillToColor(element.fill),
                                fontSize: typeof font.size === 'number' ? font.size : 16,
                                fontFamily: webFont,
                                anchor: element.anchor || 'ls',
                                bold: formatting.bold === true,
                                italic: formatting.italic === true,
                                underline: formatting.underline === true,
                                zIndex: newItems.length
                            };
                            newItems.push(textItem);
                            console.log('Created text item:', textItem); // Debug log
                        } else if (element.type === 'rect') {
                        // Convert rect from x1,y1,x2,y2 to x,y,width,height
                        const x1 = element.x1 || 0;
                        const y1 = element.y1 || 0;
                        const x2 = element.x2 || 0;
                        const y2 = element.y2 || 0;
                        
                        const rectItem: RectItem = {
                            id: nextId++,
                            type: 'rect',
                            x: x1,
                            y: y1,
                            width: x2 - x1,
                            height: y2 - y1,
                            color: fillToColor(element.fill || 0),
                            zIndex: newItems.length
                        };
                        newItems.push(rectItem);
                        console.log('Created rect item:', rectItem); // Debug log
                    }
                    } catch (elementError) {
                        console.error('Error processing element:', element, elementError);
                        // Continue processing other elements
                    }
                });
                
                console.log('All items created:', newItems); // Debug log
                
                // Extract filename without extension
                const filenameWithoutExt = file.name.replace(/\.(yaml|yml)$/i, '');
                
                // Update canvas dimensions from YAML if available
                if (typeof parsedData.x_res === 'number' && parsedData.x_res > 0) {
                    setCanvasWidth(parsedData.x_res);
                }
                if (typeof parsedData.y_res === 'number' && parsedData.y_res > 0) {
                    setCanvasHeight(parsedData.y_res);
                }
                
                // Update ESL type from YAML if available
                if (parsedData.type === 'bw' || parsedData.type === 'bwry') {
                    setEslType(parsedData.type);
                }
                
                // Update ESL axis from YAML if available
                if (parsedData.axis === 0 || parsedData.axis === 1) {
                    setEslAxis(parsedData.axis);
                }
                
                // Update canvas with imported items and set filename
                setCanvasItems(newItems);
                setSelectedIds([]);
                setTemplateFilename(filenameWithoutExt);
                setLastSavedFilename(filenameWithoutExt); // Track as last saved since it was loaded
                
                alert(`Successfully imported ${newItems.length} element(s) from template.`);
            } catch (error) {
                console.error('Error importing template:', error);
                alert(`Error importing template: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        
        input.click();
    }, []);

    // Helper function to parse YAML string to object
    const parseYAMLString = (yamlString: string): any => {
        const lines = yamlString.split('\n');
        const result: any = { fonts: [], el: [] };
        let currentElement: any = null;
        let inFonts = false;
        let inElements = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            // Check for main keys
            if (trimmed.startsWith('fontbase:')) {
                result.fontbase = trimmed.split(':')[1].trim().replace(/['"]/g, '');
            } else if (trimmed === 'fonts:') {
                inFonts = true;
                inElements = false;
                currentElement = null;
            } else if (trimmed === 'el:') {
                // Save any pending font element
                if (currentElement && inFonts) {
                    result.fonts.push(currentElement);
                }
                inElements = true;
                inFonts = false;
                currentElement = null;
            } else if (trimmed.startsWith('type:') && !inFonts && !inElements) {
                // Root level type
                result.type = trimmed.split(':')[1].trim().replace(/['"]/g, '');
            } else if (trimmed.startsWith('x_res:')) {
                result.x_res = parseInt(trimmed.split(':')[1].trim());
            } else if (trimmed.startsWith('y_res:')) {
                result.y_res = parseInt(trimmed.split(':')[1].trim());
            } else if (trimmed.startsWith('axis:')) {
                result.axis = parseInt(trimmed.split(':')[1].trim());
            } else if (trimmed.startsWith('- ')) {
                // List item - start a new element
                if (currentElement) {
                    if (inFonts) {
                        result.fonts.push(currentElement);
                    } else if (inElements) {
                        result.el.push(currentElement);
                    }
                }
                currentElement = {};
                
                // Parse the property on the same line as the dash
                const content = trimmed.substring(2).trim();
                if (content) {
                    const match = content.match(/^(\w+):\s*(.+)$/);
                    if (match) {
                        const key = match[1];
                        let value: any = match[2].replace(/['"]/g, '');
                        if (!isNaN(Number(value))) {
                            value = Number(value);
                        }
                        currentElement[key] = value;
                    }
                }
            } else if (currentElement && (line.startsWith('    ') || line.startsWith('  '))) {
                // Property of current element (indented)
                const match = trimmed.match(/^(\w+):\s*(.+)$/);
                if (match) {
                    const key = match[1];
                    let value: any = match[2].replace(/['"]/g, '');
                    
                    // Convert numeric values
                    if (!isNaN(Number(value))) {
                        value = Number(value);
                    }
                    
                    currentElement[key] = value;
                }
            }
        }
        
        // Push the last element
        if (currentElement) {
            if (inFonts) {
                result.fonts.push(currentElement);
            } else if (inElements) {
                result.el.push(currentElement);
            }
        }
        
        console.log('Parsed YAML:', result); // Debug log
        return result;
    };

    // Helper function to convert ESL font to web font
    const getWebFontFromEslFont = (eslFont: string): string => {
        const fontMap: { [key: string]: string } = {
            'DejaVuSans': 'Arial, sans-serif',
            'DejaVuSans-Bold': 'Arial, sans-serif',
            'DejaVuSerif': 'Georgia, serif',
            'DejaVuSerif-Bold': 'Georgia, serif',
            'DejaVuSansMono': 'Courier New, monospace',
            'DejaVuSansMono-Bold': 'Courier New, monospace',
            'LiberationSans-Regular': 'Liberation Sans, sans-serif',
            'LiberationSans-Bold': 'Liberation Sans, sans-serif',
            'LiberationSerif-Regular': 'Liberation Serif, serif',
            'LiberationSerif-Bold': 'Liberation Serif, serif',
            'LiberationMono-Regular': 'Liberation Mono, monospace',
            'LiberationMono-Bold': 'Liberation Mono, monospace'
        };
        
        return fontMap[eslFont] || availableFonts[0].value;
    };

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
        
        // Add new ESL configuration fields
        yaml += `x_res: ${data.x_res}\n`;
        yaml += `y_res: ${data.y_res}\n`;
        yaml += `axis: ${data.axis}\n`;
        
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

    // Menu handlers
    const handleMenuClick = (menuName: string) => {
        setOpenMenu(openMenu === menuName ? null : menuName);
    };

    const handleMenuItemClick = (action: string) => {
        setOpenMenu(null);
        
        switch (action) {
            case 'load':
                importTemplate();
                break;
            case 'save':
                exportToYAML();
                break;
            case 'quit':
                if (confirm('Are you sure you want to quit? Any unsaved changes will be lost.')) {
                    window.close();
                }
                break;
            case 'selectAll':
                setSelectedIds(canvasItems.map(item => item.id));
                break;
            case 'selectNone':
                setSelectedIds([]);
                break;
            case 'clearCanvas':
                if (confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
                    setCanvasItems([]);
                    setSelectedIds([]);
                }
                break;
            case 'eslConfig':
                setShowEslConfigDialog(true);
                break;
            case 'zoomIn':
                zoomIn();
                break;
            case 'zoomOut':
                zoomOut();
                break;
            case 'resetZoom':
                resetZoom();
                break;
            case 'preview':
                exportToJPG();
                break;
            case 'about':
                setShowAboutDialog(true);
                break;
        }
    };

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => {
            if (openMenu) setOpenMenu(null);
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openMenu]);

    // Zoom controls drag handlers
    const handleZoomControlMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') {
            return; // Don't drag when clicking buttons
        }
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingZoomControls(true);
        setZoomDragStart({ x: e.clientX, y: e.clientY });
    };

    React.useEffect(() => {
        if (!isDraggingZoomControls) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = zoomDragStart.x - e.clientX; // Inverted because right: position
            const deltaY = zoomDragStart.y - e.clientY; // Inverted because bottom: position
            
            setZoomControlsPosition(prev => ({
                x: Math.max(10, prev.x + deltaX),
                y: Math.max(10, prev.y + deltaY)
            }));
            
            setZoomDragStart({ x: e.clientX, y: e.clientY });
        };

        const handleMouseUp = () => {
            setIsDraggingZoomControls(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingZoomControls, zoomDragStart]);

    // Menu item style
    const menuItemStyle: React.CSSProperties = {
        display: 'block',
        width: '100%',
        padding: '10px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#333',
        transition: 'background-color 0.2s'
    };

    return (
        <div className={styles.eslDesigner}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.logo}>
                    <span className={styles.logoText}>Template name: {templateFilename}</span>
                </div>
            </div>

            {/* Menu Bar */}
            <div style={{
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #ddd',
                padding: '0',
                display: 'flex',
                position: 'relative',
                zIndex: 1000
            }}>
                {/* File Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleMenuClick('file'); }}
                        onMouseEnter={() => { if (openMenu) setOpenMenu('file'); }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: openMenu === 'file' ? '#e9ecef' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#333'
                        }}
                    >
                        File
                    </button>
                    {openMenu === 'file' && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            minWidth: '180px',
                            zIndex: 1001
                        }}>
                            <button 
                                onClick={() => handleMenuItemClick('load')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Load template
                            </button>
                            <button 
                                onClick={() => handleMenuItemClick('save')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Save template
                            </button>
                            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                            <button 
                                onClick={() => handleMenuItemClick('quit')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Quit
                            </button>
                        </div>
                    )}
                </div>

                {/* Edit Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleMenuClick('edit'); }}
                        onMouseEnter={() => { if (openMenu) setOpenMenu('edit'); }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: openMenu === 'edit' ? '#e9ecef' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#333'
                        }}
                    >
                        Edit
                    </button>
                    {openMenu === 'edit' && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            minWidth: '180px',
                            zIndex: 1001
                        }}>
                            <button 
                                onClick={() => handleMenuItemClick('selectAll')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Select all
                            </button>
                            <button 
                                onClick={() => handleMenuItemClick('selectNone')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Select none
                            </button>
                            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                            <button 
                                onClick={() => handleMenuItemClick('clearCanvas')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Clear canvas
                            </button>
                            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                            <button 
                                onClick={() => handleMenuItemClick('eslConfig')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                ESL config
                            </button>
                        </div>
                    )}
                </div>

                {/* View Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleMenuClick('view'); }}
                        onMouseEnter={() => { if (openMenu) setOpenMenu('view'); }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: openMenu === 'view' ? '#e9ecef' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#333'
                        }}
                    >
                        View
                    </button>
                    {openMenu === 'view' && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            minWidth: '180px',
                            zIndex: 1001
                        }}>
                            <button 
                                onClick={() => handleMenuItemClick('zoomIn')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Zoom in
                            </button>
                            <button 
                                onClick={() => handleMenuItemClick('zoomOut')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Zoom out
                            </button>
                            <button 
                                onClick={() => handleMenuItemClick('resetZoom')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Reset
                            </button>
                            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                            <button 
                                onClick={() => handleMenuItemClick('preview')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                Preview
                            </button>
                        </div>
                    )}
                </div>

                {/* Help Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleMenuClick('help'); }}
                        onMouseEnter={() => { if (openMenu) setOpenMenu('help'); }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: openMenu === 'help' ? '#e9ecef' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#333'
                        }}
                    >
                        Help
                    </button>
                    {openMenu === 'help' && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            minWidth: '180px',
                            zIndex: 1001
                        }}>
                            <button 
                                onClick={() => handleMenuItemClick('about')} 
                                style={menuItemStyle}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                About
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* About Dialog */}
            {showAboutDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }} onClick={() => setShowAboutDialog(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        maxWidth: '400px',
                        textAlign: 'center'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#333' }}>About</h2>
                        <p style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#666' }}>
                            Eon Displays Template Designer v0.0.2
                        </p>
                        <button 
                            onClick={() => setShowAboutDialog(false)}
                            style={{
                                padding: '8px 24px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* ESL Config Dialog */}
            {showEslConfigDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }} onClick={() => setShowEslConfigDialog(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        maxWidth: '500px',
                        width: '90%'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 25px 0', fontSize: '20px', color: '#333' }}>ESL Configuration</h2>
                        
                        {/* Size Section */}
                        <div style={{ marginBottom: '25px' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#555', fontWeight: '600' }}>Canvas Size</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: '500', minWidth: '70px' }}>Width:</span>
                                    <input 
                                        type="number" 
                                        value={canvasWidth}
                                        onChange={handleCanvasWidthChange}
                                        min="1"
                                        style={{ 
                                            flex: 1,
                                            padding: '6px 10px', 
                                            border: '1px solid #ddd', 
                                            borderRadius: '4px',
                                            fontSize: '14px'
                                        }}
                                    />
                                    <span style={{ fontSize: '13px', color: '#666' }}>px</span>
                                </label>
                                <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: '500', minWidth: '70px' }}>Height:</span>
                                    <input 
                                        type="number" 
                                        value={canvasHeight}
                                        onChange={handleCanvasHeightChange}
                                        min="1"
                                        style={{ 
                                            flex: 1,
                                            padding: '6px 10px', 
                                            border: '1px solid #ddd', 
                                            borderRadius: '4px',
                                            fontSize: '14px'
                                        }}
                                    />
                                    <span style={{ fontSize: '13px', color: '#666' }}>px</span>
                                </label>
                            </div>
                        </div>

                        {/* ESL Configuration Section */}
                        <div style={{ marginBottom: '25px' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#555', fontWeight: '600' }}>ESL Settings</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: '500', minWidth: '70px' }}>Type:</span>
                                    <select 
                                        value={eslType}
                                        onChange={(e) => setEslType(e.target.value as 'bw' | 'bwry')}
                                        style={{ 
                                            flex: 1,
                                            padding: '6px 10px', 
                                            border: '1px solid #ddd', 
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            backgroundColor: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="bw">Black & White (bw)</option>
                                        <option value="bwry">Black, White, Red, Yellow (bwry)</option>
                                    </select>
                                </label>
                                <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: '500', minWidth: '70px' }}>Axis:</span>
                                    <select 
                                        value={eslAxis}
                                        onChange={(e) => setEslAxis(parseInt(e.target.value) as 0 | 1)}
                                        style={{ 
                                            flex: 1,
                                            padding: '6px 10px', 
                                            border: '1px solid #ddd', 
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            backgroundColor: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="0">Normal (0)</option>
                                        <option value="1">Inverted (1)</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowEslConfigDialog(false)}
                            style={{
                                width: '100%',
                                padding: '10px 24px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

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
                    <div 
                        className={styles.canvasContainer} 
                        style={{ 
                            position: 'relative', 
                            overflow: 'auto',
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'flex-start',
                            padding: '20px',
                            minHeight: 0 // Critical for flex child to enable scrolling
                        }}
                        onMouseDown={handleContainerMouseDown}
                    >
                        <div 
                            className={styles.canvas} 
                            style={{ 
                                width: `${canvasWidth * zoomLevel}px`, 
                                height: `${canvasHeight * zoomLevel}px`,
                                overflow: 'visible',
                                border: '1px solid #ddd',
                                position: 'relative'
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
                                        backgroundColor: 'white',
                                        overflow: 'visible'
                                    }}
                                    tabIndex={0}
                                    onMouseDown={handleCanvasMouseDown}
                                >
                                    <rect className="canvas-background" width="100%" height="100%" fill="white"/>
                                    
                                    {/* Canvas Items */}
                                    {canvasItems
                                        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                                        .map(item => {
                                        if (item.type === "rect") {
                                            return (
                                                <rect
                                                    key={item.id}
                                                    x={item.x}
                                                    y={item.y}
                                                    width={item.width}
                                                    height={item.height}
                                                    fill={item.color}
                                                    stroke={selectedIds.includes(item.id) ? "#007bff" : "none"}
                                                    strokeWidth={selectedIds.includes(item.id) ? 2 : 0}
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
                                                    stroke={selectedIds.includes(item.id) ? "#007bff" : "none"}
                                                    strokeWidth={selectedIds.includes(item.id) ? 2 : 0}
                                                    style={{ cursor: "grab" }}
                                                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                />
                                            );
                                        }
                                        if (item.type === "text") {
                                            const text = String(item.text || '');
                                            const lines = text.split('\n');
                                            const lineHeight = item.fontSize * 1.2;
                                            
                                            // If this text is being edited, show input instead
                                            if (editingTextId === item.id) {
                                                return (
                                                    <foreignObject
                                                        key={item.id}
                                                        x={item.x - 1}
                                                        y={item.y - 2}
                                                        width={Math.max(200, text.length * item.fontSize * 0.6)}
                                                        height={Math.max(item.fontSize * 1.5, lines.length * lineHeight + 10)}
                                                    >
                                                        <textarea
                                                            autoFocus
                                                            value={editingTextValue}
                                                            onChange={(e) => setEditingTextValue(e.target.value)}
                                                            onBlur={finishTextEditing}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    setEditingTextId(null);
                                                                    setEditingTextValue('');
                                                                } else if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    finishTextEditing();
                                                                }
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                fontSize: `${item.fontSize}px`,
                                                                fontFamily: (item as TextItem).fontFamily || availableFonts[0].value,
                                                                fontWeight: ((item as TextItem).bold ?? false) ? 'bold' : 'normal',
                                                                fontStyle: ((item as TextItem).italic ?? false) ? 'italic' : 'normal',
                                                                textDecoration: ((item as TextItem).underline ?? false) ? 'underline' : 'none',
                                                                border: '2px solid #007bff',
                                                                outline: 'none',
                                                                padding: '2px',
                                                                backgroundColor: 'white',
                                                                resize: 'none',
                                                                color: item.color
                                                            }}
                                                        />
                                                    </foreignObject>
                                                );
                                            }
                                            
                                            return (
                                                <text
                                                    key={item.id}
                                                    x={item.x - 1}
                                                    y={item.y - 2}
                                                    fill={item.color}
                                                    fontSize={item.fontSize}
                                                    dominantBaseline="hanging"
                                                    textAnchor="start"
                                                    style={{ 
                                                        cursor: "grab", 
                                                        userSelect: "none",
                                                        fontFamily: (item as TextItem).fontFamily || availableFonts[0].value,
                                                        lineHeight: 1,
                                                        fontWeight: ((item as TextItem).bold ?? false) ? 'bold' : 'normal',
                                                        fontStyle: ((item as TextItem).italic ?? false) ? 'italic' : 'normal',
                                                        textDecoration: ((item as TextItem).underline ?? false) ? 'underline' : 'none'
                                                    }}
                                                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                    onDoubleClick={(e) => handleTextDoubleClick(e, item as TextItem)}
                                                >
                                                    {lines.map((line, index) => (
                                                        <tspan
                                                            key={index}
                                                            x={item.x - 1}
                                                            dy={index === 0 ? 0 : lineHeight}
                                                        >
                                                            {line}
                                                        </tspan>
                                                    ))}
                                                </text>
                                            );
                                        }
                                        if (item.type === "line") {
                                            return (
                                                <g key={item.id}>
                                                    {(() => {
                                                        const thickness = item.thickness || 1;
                                                        const isHorizontal = Math.abs(item.x2 - item.x) > Math.abs(item.y2 - item.y);
                                                        const rectX = Math.min(item.x, item.x2);
                                                        const rectY = Math.min(item.y, item.y2) - (isHorizontal ? thickness / 2 : 0);
                                                        const rectWidth = isHorizontal ? Math.abs(item.x2 - item.x) : thickness;
                                                        const rectHeight = isHorizontal ? thickness : Math.abs(item.y2 - item.y);
                                                        
                                                        return (
                                                            <>
                                                                {/* Selection outline for selected line */}
                                                                {selectedIds.includes(item.id) && (
                                                                    <rect
                                                                        x={rectX - 1}
                                                                        y={rectY - 1}
                                                                        width={rectWidth + 2}
                                                                        height={rectHeight + 2}
                                                                        fill="none"
                                                                        stroke="#007acc"
                                                                        strokeWidth={2}
                                                                        opacity={0.5}
                                                                    />
                                                                )}
                                                                <rect
                                                                    x={rectX}
                                                                    y={rectY}
                                                                    width={rectWidth}
                                                                    height={rectHeight}
                                                                    fill={item.color}
                                                                    style={{ cursor: "grab" }}
                                                                    onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                                />
                                                            </>
                                                        );
                                                    })()}
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
                                    {(() => {
                                        // For single selection, show resize handles for rect, text, or line
                                        if (selectedIds.length === 1) {
                                            const selectedItem = canvasItems.find(item => selectedIds.includes(item.id));
                                            if (selectedItem?.type === 'rect') {
                                                return renderResizeHandles(selectedItem as RectItem);
                                            } else if (selectedItem?.type === 'text') {
                                                return renderResizeHandles(selectedItem as TextItem);
                                            } else if (selectedItem?.type === 'line') {
                                                return renderResizeHandles(selectedItem as LineItem);
                                            }
                                            return null;
                                        }
                                        
                                        // For multiple selection, show resize handles for all text elements
                                        if (selectedIds.length > 1) {
                                            const textItems = canvasItems.filter(item => 
                                                selectedIds.includes(item.id) && item.type === 'text'
                                            ) as TextItem[];
                                            
                                            return (
                                                <>
                                                    {textItems.map(textItem => (
                                                        <g key={`resize-${textItem.id}`}>
                                                            {renderResizeHandles(textItem)}
                                                        </g>
                                                    ))}
                                                </>
                                            );
                                        }
                                        
                                        return null;
                                    })()}
                                    
                                    {/* Drag-to-Select Box */}
                                    {selectingBox && (
                                        <rect
                                            x={Math.min(selectionBoxStart.x, selectionBoxEnd.x)}
                                            y={Math.min(selectionBoxStart.y, selectionBoxEnd.y)}
                                            width={Math.abs(selectionBoxEnd.x - selectionBoxStart.x)}
                                            height={Math.abs(selectionBoxEnd.y - selectionBoxStart.y)}
                                            fill="rgba(0, 123, 255, 0.1)"
                                            stroke="#007bff"
                                            strokeWidth={1}
                                            strokeDasharray="4 2"
                                            style={{ pointerEvents: "none" }}
                                        />
                                    )}
                                </svg>
                            </div>
                        </div>
                        
                        {/* Floating Zoom Controls - Bottom Right of dark area */}
                        <div 
                            onMouseDown={handleZoomControlMouseDown}
                            style={{
                                position: 'absolute',
                                bottom: `${zoomControlsPosition.y}px`,
                                right: `${zoomControlsPosition.x}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0',
                                backgroundColor: 'rgba(50, 50, 50, 0.9)',
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                zIndex: 100,
                                cursor: isDraggingZoomControls ? 'grabbing' : 'grab',
                                userSelect: 'none',
                                overflow: 'hidden'
                            }}
                        >
                                {/* Grab handle area */}
                                <div style={{
                                    padding: '8px',
                                    textAlign: 'center',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                                    fontSize: '10px',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    fontWeight: 'bold',
                                    letterSpacing: '1px'
                                }}>
                                    ZOOM
                                </div>
                                
                                {/* Buttons container */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '8px'
                                }}>
                                <button 
                                    onClick={zoomIn}
                                    disabled={zoomLevel === zoomLevels[zoomLevels.length - 1]}
                                    title="Zoom In"
                                    style={{ 
                                        width: '36px',
                                        height: '36px',
                                        padding: '0',
                                        fontSize: '20px',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: zoomLevel === zoomLevels[zoomLevels.length - 1] ? 'rgba(100, 100, 100, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                                        cursor: zoomLevel === zoomLevels[zoomLevels.length - 1] ? 'not-allowed' : 'pointer',
                                        color: zoomLevel === zoomLevels[zoomLevels.length - 1] ? '#666' : '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (zoomLevel !== zoomLevels[zoomLevels.length - 1]) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (zoomLevel !== zoomLevels[zoomLevels.length - 1]) {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                                        }
                                    }}
                                >
                                    +
                                </button>
                                
                                <button 
                                    onClick={resetZoom}
                                    title="Reset Zoom (100%)"
                                    style={{ 
                                        width: '36px',
                                        height: '36px',
                                        padding: '0',
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        cursor: 'pointer',
                                        color: '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'}
                                >
                                    ○
                                </button>
                                
                                <button 
                                    onClick={zoomOut}
                                    disabled={zoomLevel === zoomLevels[0]}
                                    title="Zoom Out"
                                    style={{ 
                                        width: '36px',
                                        height: '36px',
                                        padding: '0',
                                        fontSize: '20px',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: zoomLevel === zoomLevels[0] ? 'rgba(100, 100, 100, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                                        cursor: zoomLevel === zoomLevels[0] ? 'not-allowed' : 'pointer',
                                        color: zoomLevel === zoomLevels[0] ? '#666' : '#333',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (zoomLevel !== zoomLevels[0]) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (zoomLevel !== zoomLevels[0]) {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                                        }
                                    }}
                                >
                                    −
                                </button>
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



