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

interface ImageItem extends BaseItem {
  type: "image";
  width: number;
  height: number;
  filename: string;
  originalFilename?: string;
}

type CanvasItem = RectItem | CircleItem | TextItem | LineItem | BarcodeItem | QRCodeItem | ImageItem;

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

const IntegratedTemplateEditor: React.FC = () => {

    // Helper function to calculate text position based on anchor point
    const calculateAnchoredPosition = useCallback((item: TextItem, textWidth: number, textHeight: number) => {
        const anchor = item.anchor || 'lt'; // Default to left-top
        let x = item.x;
        let y = item.y;
        
        // Handle horizontal anchoring
        if (anchor.includes('m')) {
            // Middle horizontal
            x = item.x - (textWidth / 2);
        } else if (anchor.includes('r')) {
            // Right horizontal  
            x = item.x - textWidth;
        }
        // 'l' (left) uses x as-is
        
        // Handle vertical anchoring
        if (anchor.includes('s')) {
            // Bottom vertical
            y = item.y - textHeight;
        } else if (anchor === 'ms' || anchor === 'ls' || anchor === 'rs') {
            // Middle vertical (for anchors ending in 's' that mean bottom)
            y = item.y - textHeight;
        }
        // 't' (top) uses y as-is
        
        return { x, y };
    }, []);

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
    
    // Ref map to store actual SVG text elements for accurate dimension measurement
    const textElementRefs = useRef<Map<number, SVGTextElement>>(new Map());
    const [, forceUpdate] = useState({});
    
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
    
    // File browser dialog state
    const [showFileBrowserDialog, setShowFileBrowserDialog] = useState<boolean>(false);
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('');
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);
    const [browserLoading, setBrowserLoading] = useState<boolean>(false);
    
    // Save dialog state
    const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
    const [saveFolders, setSaveFolders] = useState<string[]>([]);
    const [saveSelectedFolder, setSaveSelectedFolder] = useState<string>('');
    const [saveFilename, setSaveFilename] = useState<string>('');
    const [saveLoading, setSaveLoading] = useState<boolean>(false);
    
    // Image browser dialog state
    const [showImageBrowserDialog, setShowImageBrowserDialog] = useState<boolean>(false);
    const [availableImages, setAvailableImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [imageBrowserLoading, setImageBrowserLoading] = useState<boolean>(false);
    
    // Preview dialog state
    const [showPreviewDialog, setShowPreviewDialog] = useState<boolean>(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
    const [previewZoom, setPreviewZoom] = useState<number>(1);
    const [previewCaseColor, setPreviewCaseColor] = useState<'black' | 'white'>('white');
    const [previewDialogSize, setPreviewDialogSize] = useState({ width: 800, height: 600 });
    const [isResizingPreview, setIsResizingPreview] = useState(false);
    const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
    const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
    
    // Helper function to get minimum zoom based on canvas size
    const getMinimumZoom = useCallback(() => {
        // For sizes larger than 296x128, allow zoom down to 25%
        // For 296x128 or smaller, minimum is 90%
        if (canvasWidth > 296 || canvasHeight > 128) {
            return 0.25;
        }
        return 0.9;
    }, [canvasWidth, canvasHeight]);
    
    // Zoom controls drag state
    // Position in canvas area: properties panel is ~300px wide, so start at 350px from left
    // This ensures zoom controls appear in the canvas area (right side) by default
    const [zoomControlsPosition, setZoomControlsPosition] = useState({ x: 350, y: 40 }); // x from left, y from bottom
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
            // For text: no constraints - allow text to be positioned anywhere, even beyond canvas
            constrainedX = newX;
            constrainedY = newY;
            
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
    const [zoomLevel, setZoomLevel] = useState<number>(2);
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

    // Force re-render of resize handles when text elements are mounted or canvas items change
    useEffect(() => {
        // Small delay to ensure text elements are rendered and refs are set
        const timer = setTimeout(() => {
            forceUpdate({});
        }, 50);
        return () => clearTimeout(timer);
    }, [canvasItems, selectedIds]);

    // Handle preview dialog resize
    useEffect(() => {
        if (!isResizingPreview) {
            // Re-enable text selection when not resizing
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            return;
        }

        // Disable text selection during resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'nwse-resize';

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            
            const deltaX = e.clientX - resizeStartPos.x;
            const deltaY = e.clientY - resizeStartPos.y;
            
            // Simple fixed minimum size - enforce strict minimum
            const minWidth = 300;
            const minHeight = 300;
            
            const newWidth = resizeStartSize.width + deltaX;
            const newHeight = resizeStartSize.height + deltaY;
            
            setPreviewDialogSize({
                width: newWidth < minWidth ? minWidth : newWidth,
                height: newHeight < minHeight ? minHeight : newHeight
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            setIsResizingPreview(false);
            // Reset cursor and selection
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Ensure cleanup
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizingPreview, resizeStartPos, resizeStartSize]);

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

                {/* Image Properties */}
                {selectedItem.type === 'image' && (
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
                                value={(selectedItem as ImageItem).width}
                                onChange={(e) => {
                                    const newWidth = parseInt(e.target.value) || 1;
                                    setCanvasItems(items =>
                                        items.map(item => {
                                            if (selectedIds.includes(item.id) && item.type === 'image') {
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

                        {/* Height Control */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                                Height:
                            </label>
                            <input 
                                type="number" 
                                step="1"
                                min="1"
                                value={(selectedItem as ImageItem).height}
                                onChange={(e) => {
                                    const newHeight = parseInt(e.target.value) || 1;
                                    setCanvasItems(items =>
                                        items.map(item => {
                                            if (selectedIds.includes(item.id) && item.type === 'image') {
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
                            <button 
                                onClick={() => openImageBrowser()}
                                style={getElementButtonStyle()}
                                {...getElementButtonHandlers()}
                            >
                                Image
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
        if (!item || (item.type !== 'rect' && item.type !== 'text' && item.type !== 'line' && item.type !== 'image')) return; // Rectangles, text, lines, and images can be resized
        
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
        } else if (item.type === 'image') {
            // For images, store position and dimensions like rectangles
            setResizeStart({
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height
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
                    if (!selectedIds.includes(item.id) || (item.type !== 'rect' && item.type !== 'text' && item.type !== 'line' && item.type !== 'image')) return item;
                    
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
                    } else if (item.type === 'image') {
                        // For images, resize similar to rectangles
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
                                newY = resizeStart.y + resizeStart.height - newHeight;
                                break;
                            case 's': // South
                                newHeight = mouseY - resizeStart.y;
                                break;
                            case 'e': // East
                                newWidth = mouseX - resizeStart.x;
                                break;
                            case 'w': // West
                                newWidth = resizeStart.width + (resizeStart.x - mouseX);
                                newX = resizeStart.x + resizeStart.width - newWidth;
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
                        // For text elements, allow unrestricted movement beyond canvas
                        if (item.type === 'text') {
                            return { ...item, x: item.x + deltaX, y: item.y + deltaY };
                        }
                        // For other elements, constrain within canvas bounds
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
    const renderResizeHandles = useCallback((item: RectItem | TextItem | LineItem | ImageItem) => {
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
            // For text, calculate exact dimensions matching the rendering logic
            const text = String(item.text || '');
            const lines = text.split('\n');
            const lineHeight = item.fontSize * 1.2;
            
            // Try to get actual rendered dimensions from ref
            const textElement = textElementRefs.current.get(item.id);
            let textLeft, textRight, textTop, textBottom;
            
            // Calculate anchored position for top edge reference
            const estimatedWidth = estimateTextWidth(text, item.fontSize, (item as TextItem).fontFamily);
            const estimatedHeight = lines.length * lineHeight;
            const anchoredPos = calculateAnchoredPosition(item as TextItem, estimatedWidth, estimatedHeight);
            
            if (textElement) {
                try {
                    const bbox = textElement.getBBox();
                    textLeft = bbox.x;
                    textRight = bbox.x + bbox.width;
                    // Use the actual y position from anchored calculation for top (with dominantBaseline="hanging")
                    textTop = anchoredPos.y;
                    textBottom = bbox.y + bbox.height;
                } catch (e) {
                    // Fallback to estimation if getBBox fails
                    textLeft = anchoredPos.x;
                    textRight = anchoredPos.x + estimatedWidth;
                    textTop = anchoredPos.y;
                    textBottom = anchoredPos.y + estimatedHeight;
                }
            } else {
                // Fallback to estimation if ref not available
                textLeft = anchoredPos.x;
                textRight = anchoredPos.x + estimatedWidth;
                textTop = anchoredPos.y;
                textBottom = anchoredPos.y + estimatedHeight;
            }
            
            // Make handles slightly larger and proportional to text height
            handleSize = Math.max(4, Math.min(item.fontSize * 0.25, 10));
            
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
        } else if (item.type === 'image') {
            // For images, use same handles as rectangles
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
    }, [handleResizeMouseDown, estimateTextWidth, calculateAnchoredPosition]);

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
                case 'image':
                    newItem = { id: newId, type: 'image', x: 50, y: 50, width: 100, height: 100, filename: '', originalFilename: '', color: '#000000', zIndex: newZIndex };
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

    // Generate YAML content as a string (helper function for both export and save)
    const generateYAMLContent = useCallback(async (): Promise<string> => {
        const colorToFill = (color: string) => {
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
                    return 0;
            }
        };

        const usedFontCombinations = new Set<string>();
        const textElements = canvasItems.filter(item => item.type === 'text') as TextItem[];
        
        textElements.forEach(item => {
            const fontFamily = item.fontFamily || availableFonts[0].value;
            const combinationKey = `${fontFamily}|${item.fontSize}`;
            usedFontCombinations.add(combinationKey);
        });

        const defaultCombination = `${availableFonts[0].value}|16`;
        if (!usedFontCombinations.has(defaultCombination)) {
            usedFontCombinations.add(defaultCombination);
        }

        const fonts: string[] = [];
        const fontCombinationToIndex = new Map<string, number>();
        let fontIndex = 0;

        usedFontCombinations.forEach(combination => {
            const [fontFamily, fontSize] = combination.split('|');
            const eslFontName = getEslFontFromWebFont(fontFamily);
            fonts.push(`${eslFontName}:${fontSize}`);
            fontCombinationToIndex.set(combination, fontIndex++);
        });

        const defaultFontIndex = fontCombinationToIndex.get(defaultCombination) || 0;

        const yamlData: any = {
            fontbase: 'fonts/',
            fonts: fonts,
            type: eslType,
            x_res: canvasWidth,
            y_res: canvasHeight,
            axis: eslAxis,
            el: [] as any[]
        };

        canvasItems.forEach((item, index) => {
            if (item.type === 'text') {
                const safeText = String(item.text || '');
                const bracketMatch = safeText.match(/^\[(.+)\]$/);
                
                const varName = bracketMatch ? bracketMatch[1] : undefined;
                const textValue = bracketMatch ? undefined : safeText;
                
                const fontFamily = (item as TextItem).fontFamily || availableFonts[0].value;
                const combinationKey = `${fontFamily}|${item.fontSize}`;
                const fontIdx = fontCombinationToIndex.get(combinationKey) || defaultFontIndex;
                
                const element: any = {
                    type: 'text',
                    font: fontIdx,
                    fill: colorToFill(item.color),
                    anchor: (item as TextItem).anchor || 'lt',
                    x: item.x,
                    y: item.y
                };
                
                if (varName) {
                    element.var = varName;
                } else if (textValue !== undefined) {
                    element.text = textValue;
                }
                
                yamlData.el.push(element);
            } else if (item.type === 'rect') {
                const element: any = {
                    type: 'rect',
                    fill: colorToFill(item.color),
                    x1: item.x,
                    y1: item.y,
                    x2: item.x + item.width,
                    y2: item.y + item.height
                };
                yamlData.el.push(element);
            } else if (item.type === 'line') {
                const element: any = {
                    type: 'line',
                    fill: colorToFill(item.color),
                    x1: item.x,
                    y1: item.y,
                    x2: (item as LineItem).x2,
                    y2: (item as LineItem).y2
                };
                yamlData.el.push(element);
            } else if (item.type === 'circle') {
                const element: any = {
                    type: 'circle',
                    fill: colorToFill(item.color),
                    x: item.x,
                    y: item.y,
                    r: (item as CircleItem).radius
                };
                yamlData.el.push(element);
            } else if (item.type === 'image') {
                const element: any = {
                    type: 'img',
                    filename: (item as ImageItem).filename || 'image.bmp',
                    size_x: item.width,
                    size_y: item.height,
                    x_pos: item.x,
                    y_pos: item.y
                };
                yamlData.el.push(element);
            } else if (item.type === 'barcode') {
                const safeData = String((item as BarcodeItem).data || '');
                const bracketMatch = safeData.match(/^\[(.+)\]$/);
                const varName = bracketMatch ? bracketMatch[1] : 'barcode';
                
                const element: any = {
                    type: 'code128',
                    var: varName,
                    x: item.x,
                    y: item.y,
                    height: item.height,
                    font: defaultFontIndex,
                    font_size: 3,
                    quiet_zone: 0,
                    write_text: true,
                    text_distance: -1
                };
                yamlData.el.push(element);
            } else if (item.type === 'qrcode') {
                const safeData = String((item as QRCodeItem).data || '');
                const bracketMatch = safeData.match(/^\[(.+)\]$/);
                const varName = bracketMatch ? bracketMatch[1] : 'qrdata';
                
                const element: any = {
                    type: 'qrcode',
                    var: varName,
                    x: item.x,
                    y: item.y,
                    scale: 1
                };
                yamlData.el.push(element);
            }
        });

        const yaml = await import('yaml');
        const yamlString = yaml.stringify(yamlData);

        return yamlString;
    }, [canvasItems, canvasWidth, canvasHeight, eslType, eslAxis]);

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
            } else if (item.type === 'barcode') {
                // Check if data contains brackets indicating a variable
                const safeData = String(item.data || '');
                const bracketMatch = safeData.match(/^\[(.+)\]$/);
                
                const varName = bracketMatch ? bracketMatch[1] : 'gtin';
                
                // Convert barcode to ESL barcode element
                const element: any = {
                    type: 'barcode',
                    variant: 'code128',
                    width: 0.1,
                    height: 1,
                    var: varName,
                    x: item.x,
                    y: item.y,
                    scale: 1,
                    font_size: 3,
                    quiet_zone: 0,
                    write_text: true,
                    text_distance: -1
                };
                yamlData.el.push(element);
            } else if (item.type === 'qrcode') {
                // Check if data contains brackets indicating a variable
                const safeData = String(item.data || '');
                const bracketMatch = safeData.match(/^\[(.+)\]$/);
                
                const varName = bracketMatch ? bracketMatch[1] : 'qrdata';
                
                // Convert QR code to ESL qrcode element
                const element: any = {
                    type: 'qrcode',
                    var: varName,
                    x: item.x,
                    y: item.y,
                    scale: 1
                };
                yamlData.el.push(element);
            } else if (item.type === 'image') {
                // Convert image to ESL image element
                // Use originalFilename if available, otherwise generate a filename
                let filename = (item as ImageItem).originalFilename || item.filename;
                
                // If filename is still a data URL, generate a default filename
                if (filename.startsWith('data:')) {
                    const extension = filename.includes('image/png') ? '.png' : '.bmp';
                    filename = `image_${item.width}x${item.height}${extension}`;
                }
                
                const element: any = {
                    type: 'image',
                    fill: 0,
                    filename: filename,
                    size_x: item.width,
                    size_y: item.height,
                    x_pos: item.x,
                    y_pos: item.y
                };
                
                console.log('Exporting image element:', element); // Debug log
                yamlData.el.push(element);
            }
        });

        // Convert to YAML string
        const yamlString = convertToYAMLString(yamlData);
        
        // Use File System Access API if available (Chrome/Edge), otherwise fallback to download
        if ('showSaveFilePicker' in window) {
            try {
                // Show native save dialog starting in templates directory
                const defaultFilename = templateFilename === 'New template' ? 'esl-template' : templateFilename;
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: `${defaultFilename}.yaml`,
                    startIn: 'documents', // Start in documents folder (closest to templates)
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
    const exportToJPG = useCallback(async () => {
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

        // Load all images first
        const imageElements: Map<number, HTMLImageElement> = new Map();
        const imagePromises = canvasItems
            .filter(item => item.type === 'image' && item.filename)
            .map(item => {
                return new Promise<void>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous'; // Allow cross-origin if needed
                    img.onload = () => {
                        imageElements.set(item.id, img);
                        resolve();
                    };
                    img.onerror = () => {
                        console.error(`Failed to load image: ${(item as ImageItem).filename}`);
                        resolve(); // Continue even if image fails to load
                    };
                    img.src = `/api/get-image?filename=${encodeURIComponent((item as ImageItem).filename)}`;
                });
            });

        // Wait for all images to load
        await Promise.all(imagePromises);
        
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
            } else if (item.type === 'image') {
                // Render image
                const img = imageElements.get(item.id);
                if (img) {
                    ctx.drawImage(
                        img,
                        Math.round(item.x),
                        Math.round(item.y),
                        Math.round(item.width),
                        Math.round(item.height)
                    );
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
        
        // Convert to data URL and show in dialog
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        setPreviewImageUrl(dataUrl);
        
        // Set initial zoom based on canvas size
        // For sizes larger than 296x128, start at 50% or lower
        // For 296x128 or smaller, start at 100%
        let initialZoom = 1;
        if (canvasWidth > 296 || canvasHeight > 128) {
            // Calculate zoom to fit in viewport
            // Assuming a reasonable preview area of ~800px wide and ~600px tall
            const zoomToFitWidth = 800 / canvasWidth;
            const zoomToFitHeight = 600 / canvasHeight;
            const zoomToFit = Math.min(zoomToFitWidth, zoomToFitHeight);
            // Use the smaller of 50% or zoom-to-fit
            initialZoom = Math.min(0.5, zoomToFit);
        }
        setPreviewZoom(initialZoom);
        
        // Set initial dialog size based on content
        const dialogWidth = Math.min(Math.max(800, canvasWidth * initialZoom + 200), window.innerWidth * 0.9);
        const dialogHeight = Math.min(Math.max(600, canvasHeight * initialZoom + 250), window.innerHeight * 0.9);
        setPreviewDialogSize({ width: dialogWidth, height: dialogHeight });
        
        setShowPreviewDialog(true);
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

    // Fetch folders from server path
    const fetchAvailableFolders = useCallback(async () => {
        setBrowserLoading(true);
        try {
            // Use a Node.js child process to list directories
            const response = await fetch('/api/list-folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: '/opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/' 
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                setAvailableFolders(data.folders || []);
            } else {
                // Fallback: try to simulate with mock data for development
                console.warn('Could not fetch server folders, using fallback');
                setAvailableFolders(['template1', 'template2', 'template3', 'custom_template']);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
            // Fallback: provide some example folders
            setAvailableFolders(['template1', 'template2', 'template3', 'custom_template']);
        } finally {
            setBrowserLoading(false);
        }
    }, []);

    // Fetch files from selected folder
    const fetchFilesInFolder = useCallback(async (folderName: string) => {
        setBrowserLoading(true);
        try {
            const response = await fetch('/api/list-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: `/opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/${folderName}` 
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                setAvailableFiles(data.files || []);
            } else {
                // Fallback: simulate with mock files
                setAvailableFiles(['template.yaml', 'config.yml']);
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            setAvailableFiles(['template.yaml', 'config.yml']);
        } finally {
            setBrowserLoading(false);
        }
    }, []);

    // Open custom file browser dialog
    const openFileBrowser = useCallback(() => {
        setShowFileBrowserDialog(true);
        setSelectedFolder('');
        setAvailableFiles([]);
        fetchAvailableFolders();
    }, [fetchAvailableFolders]);

    // Open save dialog
    const openSaveDialog = useCallback(async () => {
        setShowSaveDialog(true);
        setSaveSelectedFolder('');
        setSaveFilename(templateFilename.replace(/\.ya?ml$/i, '') || 'template');
        
        // Fetch available folders for saving
        try {
            const response = await fetch('/api/list-folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: '/opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/' 
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                setSaveFolders(data.folders || []);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        }
    }, [templateFilename]);

    // Save template to server
    const saveTemplateToServer = useCallback(async () => {
        if (!saveSelectedFolder || !saveFilename) {
            alert('Please select a folder and enter a filename');
            return;
        }

        setSaveLoading(true);
        
        try {
            // Generate YAML content (reuse exportToYAML logic but get the content)
            const yamlContent = await generateYAMLContent();
            
            // Ensure filename ends with .yml
            const filename = saveFilename.endsWith('.yml') || saveFilename.endsWith('.yaml') 
                ? saveFilename 
                : `${saveFilename}.yml`;
            
            const folderPath = `/opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/${saveSelectedFolder}`;
            
            const response = await fetch('/api/save-template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folderPath,
                    filename,
                    content: yamlContent
                }),
            });
            
            if (response.ok) {
                alert(`Template saved successfully to ${saveSelectedFolder}/${filename}`);
                setShowSaveDialog(false);
                setTemplateFilename(filename);
                setLastSavedFilename(filename);
            } else {
                const data = await response.json();
                const errorMsg = data.details 
                    ? `${data.error}\n\n${data.details}` 
                    : (data.error || 'Unknown error');
                alert(`Failed to save template:\n${errorMsg}`);
            }
        } catch (error) {
            console.error('Error saving template:', error);
            alert(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setSaveLoading(false);
        }
    }, [saveSelectedFolder, saveFilename]);

    // Open image browser dialog
    const openImageBrowser = useCallback(async () => {
        setShowImageBrowserDialog(true);
        setSelectedImage('');
        setImageBrowserLoading(true);
        
        try {
            const response = await fetch('/api/list-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: '/opt/esl/tag_image_gen/images' 
                }),
            });
            
            if (response.ok) {
                const data = await response.json();
                setAvailableImages(data.files || []);
            } else {
                console.error('Failed to load images');
                setAvailableImages([]);
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            setAvailableImages([]);
        } finally {
            setImageBrowserLoading(false);
        }
    }, []);

    // Add selected image to canvas
    const addImageFromBrowser = useCallback(() => {
        console.log('addImageFromBrowser called, selectedImage:', selectedImage);
        
        if (!selectedImage) {
            alert('Please select an image');
            return;
        }

        setCanvasItems(prevItems => {
            const newId = prevItems.length > 0 ? Math.max(...prevItems.map(item => item.id)) + 1 : 1;
            const newZIndex = prevItems.length > 0 ? Math.max(...prevItems.map(item => item.zIndex || 0)) + 1 : 0;
            
            const newItem: ImageItem = {
                id: newId,
                type: 'image',
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                color: '#000000',
                zIndex: newZIndex,
                filename: selectedImage
            };
            
            console.log('Adding new image item:', newItem);
            return [...prevItems, newItem];
        });
        
        setShowImageBrowserDialog(false);
        setSelectedImage('');
    }, [selectedImage]);

    // Import YAML template function
    const importTemplate = useCallback(() => {
        // Try to use File System Access API first (for Chrome/Edge)
        if ('showOpenFilePicker' in window) {
            (async () => {
                try {
                    const [fileHandle] = await (window as any).showOpenFilePicker({
                        types: [{
                            description: 'YAML Files',
                            accept: { 'text/yaml': ['.yaml', '.yml'] }
                        }],
                        startIn: 'documents', // Start in documents folder
                        multiple: false
                    });
                    
                    const file = await fileHandle.getFile();
                    await processTemplateFile(file);
                } catch (error) {
                    // User cancelled or error occurred
                    if ((error as any).name !== 'AbortError') {
                        console.error('Error opening file:', error);
                    }
                }
            })();
        } else {
            // Fallback to traditional file input for other browsers
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.yaml,.yml';
            
            input.onchange = async (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file) {
                    await processTemplateFile(file);
                }
            };
            
            input.click();
        }
    }, []);

    // Separate function to process the template file
    const processTemplateFile = async (file: File) => {
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
            
            // Handle element-specific fields
            if (element.type === 'image') {
                // Image elements use filename, size_x, size_y, x_pos, y_pos
                if (element.filename) {
                    yaml += `    filename: ${element.filename}\n`;
                }
                if (element.size_x !== undefined) {
                    yaml += `    size_x: ${element.size_x}\n`;
                }
                if (element.size_y !== undefined) {
                    yaml += `    size_y: ${element.size_y}\n`;
                }
                if (element.x_pos !== undefined) {
                    yaml += `    x_pos: ${element.x_pos}\n`;
                }
                if (element.y_pos !== undefined) {
                    yaml += `    y_pos: ${element.y_pos}\n`;
                }
            } else if (element.type === 'rect') {
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
            if (element.scale !== undefined) {
                yaml += `    scale: ${element.scale}\n`;
            }
            yaml += '\n';
        });
        
        return yaml;
    };

    // Import YAML from string content (for server-loaded templates)
    const importYAMLFromContent = useCallback((content: string) => {
        try {
            console.log('YAML content:', content); // Debug log
            
            const parsedData = parseYAMLString(content);
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
                        const fontInfo = parsedData.fonts?.[fontIndex] || { type: 'LiberationSans-Regular', size: 12 };
                        const webFont = getWebFontFromEslFont(fontInfo.type);
                        
                        const textItem: TextItem = {
                            id: nextId++,
                            type: 'text',
                            x: Number(element.x) || 0,
                            y: Number(element.y) || 0,
                            color: fillToColor(element.fill),
                            text: element.content || (element.type === 'var' ? `{${element.var || 'variable'}}` : 'Sample Text'),
                            fontSize: fontInfo.size,
                            fontFamily: webFont,
                            anchor: element.anchor || 'lt'
                        };
                        
                        newItems.push(textItem);
                    } else if (element.type === 'rect') {
                        // Rectangles use x1,y1,x2,y2 format (two corner points)
                        const x1 = Number(element.x1) || Number(element.x) || 0;
                        const y1 = Number(element.y1) || Number(element.y) || 0;
                        const x2 = Number(element.x2) || (x1 + 50);
                        const y2 = Number(element.y2) || (y1 + 30);
                        
                        const rectItem: RectItem = {
                            id: nextId++,
                            type: 'rect',
                            x: Math.min(x1, x2),
                            y: Math.min(y1, y2),
                            color: fillToColor(element.fill),
                            width: Math.abs(x2 - x1),
                            height: Math.abs(y2 - y1)
                        };
                        
                        newItems.push(rectItem);
                    } else if (element.type === 'line') {
                        // Handle line elements with x1,y1,x2,y2 format
                        const lineItem: LineItem = {
                            id: nextId++,
                            type: 'line',
                            x: Number(element.x1) || 0,
                            y: Number(element.y1) || 0,
                            color: fillToColor(element.fill),
                            x2: Number(element.x2) || 50,
                            y2: Number(element.y2) || 0,
                            strokeWidth: 1
                        };
                        
                        newItems.push(lineItem);
                    } else if (element.type === 'circle') {
                        const circleItem: CircleItem = {
                            id: nextId++,
                            type: 'circle',
                            x: Number(element.x) || 0,
                            y: Number(element.y) || 0,
                            color: fillToColor(element.fill),
                            radius: 15
                        };
                        
                        newItems.push(circleItem);
                    } else if (element.type === 'image') {
                        // Handle image elements
                        const imageItem: ImageItem = {
                            id: nextId++,
                            type: 'image',
                            x: Number(element.x_pos) || Number(element.x) || 0,
                            y: Number(element.y_pos) || Number(element.y) || 0,
                            color: fillToColor(element.fill),
                            width: Number(element.size_x) || Number(element.width) || 100,
                            height: Number(element.size_y) || Number(element.height) || 100,
                            filename: element.filename || 'unknown.png'
                        };
                        
                        newItems.push(imageItem);
                    }
                } catch (elementError) {
                    console.error('Error processing element:', elementError, element);
                }
            });
            
            // Update canvas with imported items
            setCanvasItems(newItems);
            setSelectedIds([]);
            
            // Update ESL configuration if available
            if (parsedData.x_res !== undefined) setCanvasWidth(parsedData.x_res);
            if (parsedData.y_res !== undefined) setCanvasHeight(parsedData.y_res);
            
            console.log('Successfully imported', newItems.length, 'items from YAML content');
            
        } catch (error) {
            console.error('Error importing YAML content:', error);
            alert('Failed to import template. Please check the file format.');
        }
    }, []);

    // Menu handlers
    const handleMenuClick = (menuName: string) => {
        setOpenMenu(openMenu === menuName ? null : menuName);
    };

    const handleMenuItemClick = (action: string) => {
        setOpenMenu(null);
        
        switch (action) {
            case 'load':
                openFileBrowser();
                break;
            case 'save':
                // Show options: save to server or export locally
                openSaveDialog();
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
            const deltaX = e.clientX - zoomDragStart.x; // Normal direction for left: position
            const deltaY = zoomDragStart.y - e.clientY; // Inverted because bottom: position
            
            setZoomControlsPosition(prev => {
                // Calculate new position
                const newX = prev.x + deltaX;
                const newY = prev.y + deltaY;
                
                // Get viewport dimensions
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Zoom control panel approximate dimensions
                const controlWidth = 120;
                const controlHeight = 200;
                
                // Constrain to viewport bounds
                // For left position: min is 10, max is (viewportWidth - controlWidth - 10)
                // For bottom position: min is 10, max is (viewportHeight - controlHeight - 10)
                const constrainedX = Math.max(10, Math.min(viewportWidth - controlWidth - 10, newX));
                const constrainedY = Math.max(10, Math.min(viewportHeight - controlHeight - 10, newY));
                
                return {
                    x: constrainedX,
                    y: constrainedY
                };
            });
            
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

            {/* File Browser Dialog */}
            {showFileBrowserDialog && (
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
                }} onClick={() => setShowFileBrowserDialog(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        width: '600px',
                        maxHeight: '70vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: '0', fontSize: '18px', color: '#333' }}>Select Template</h2>
                            <button 
                                onClick={() => setShowFileBrowserDialog(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '20px',
                                    cursor: 'pointer',
                                    color: '#999'
                                }}
                            >
                                ×
                            </button>
                        </div>
                        
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                            Location: /opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/
                        </div>

                        {browserLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                                Loading folders...
                            </div>
                        ) : (
                            <div style={{ flex: 1, overflow: 'auto' }}>
                                {!selectedFolder ? (
                                    /* Folder selection view */
                                    <div>
                                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>Select Folder:</h3>
                                        <div style={{ 
                                            border: '1px solid #ddd', 
                                            borderRadius: '4px', 
                                            maxHeight: '300px', 
                                            overflow: 'auto',
                                            backgroundColor: '#f9f9f9'
                                        }}>
                                            {availableFolders.length > 0 ? (
                                                availableFolders.map((folder, index) => (
                                                    <div 
                                                        key={index}
                                                        onClick={() => {
                                                            setSelectedFolder(folder);
                                                            fetchFilesInFolder(folder);
                                                        }}
                                                        style={{
                                                            padding: '12px',
                                                            borderBottom: index < availableFolders.length - 1 ? '1px solid #eee' : 'none',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',

                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <span style={{ marginRight: '8px' }}>📁</span>
                                                        {folder}
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                                    No template folders found in:<br />
                                                    /opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/<br />
                                                    <small style={{ fontSize: '12px', marginTop: '10px', display: 'block' }}>
                                                        Create some template folders to get started
                                                    </small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* File selection view */
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                            <button 
                                                onClick={() => {
                                                    setSelectedFolder('');
                                                    setAvailableFiles([]);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#007bff',
                                                    fontSize: '14px',
                                                    marginRight: '10px'
                                                }}
                                            >
                                                ← Back
                                            </button>
                                            <h3 style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                                                Files in: {selectedFolder}
                                            </h3>
                                        </div>
                                        <div style={{ 
                                            border: '1px solid #ddd', 
                                            borderRadius: '4px', 
                                            maxHeight: '300px', 
                                            overflow: 'auto',
                                            backgroundColor: '#f9f9f9'
                                        }}>
                                            {availableFiles.length > 0 ? (
                                                availableFiles.map((file, index) => (
                                                    <div 
                                                        key={index}
                                                        onClick={async () => {
                                                            try {
                                                                const response = await fetch('/api/load-template', {
                                                                    method: 'POST',
                                                                    headers: {
                                                                        'Content-Type': 'application/json',
                                                                    },
                                                                    body: JSON.stringify({
                                                                        folderPath: `/opt/esl/tag_image_gen/tag_image_templates/label_templates/bwry/${selectedFolder}`,
                                                                        fileName: file
                                                                    }),
                                                                });
                                                                
                                                                if (response.ok) {
                                                                    const data = await response.json();
                                                                    importYAMLFromContent(data.content);
                                                                    setShowFileBrowserDialog(false);
                                                                } else {
                                                                    const error = await response.json();
                                                                    alert(`Error loading template: ${error.error}`);
                                                                }
                                                            } catch (error) {
                                                                console.error('Error loading template:', error);
                                                                alert('Failed to load template');
                                                            }
                                                        }}
                                                        style={{
                                                            padding: '12px',
                                                            borderBottom: index < availableFiles.length - 1 ? '1px solid #eee' : 'none',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <span style={{ marginRight: '8px' }}>📄</span>
                                                        {file}
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                                    No YAML template files found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button 
                                onClick={() => {
                                    setShowFileBrowserDialog(false);
                                    importTemplate(); // Use existing local file import function
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                📁 Load Local
                            </button>
                            <button 
                                onClick={() => setShowFileBrowserDialog(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Dialog */}
            {showSaveDialog && (
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
                }} onClick={() => setShowSaveDialog(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        width: '500px',
                        display: 'flex',
                        flexDirection: 'column'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: '0', fontSize: '18px', color: '#333' }}>Save Template</h2>
                            <button 
                                onClick={() => setShowSaveDialog(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#999',
                                    padding: '0',
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                                Filename:
                            </label>
                            <input
                                type="text"
                                value={saveFilename}
                                onChange={(e) => setSaveFilename(e.target.value)}
                                placeholder="Enter filename (without extension)"
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <small style={{ color: '#666', fontSize: '12px' }}>.yml will be added automatically</small>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                                Select Folder:
                            </label>
                            <select
                                value={saveSelectedFolder}
                                onChange={(e) => setSaveSelectedFolder(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '14px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="">-- Select a folder --</option>
                                {saveFolders.map(folder => (
                                    <option key={folder} value={folder}>{folder}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={saveTemplateToServer}
                                disabled={!saveSelectedFolder || !saveFilename || saveLoading}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: (!saveSelectedFolder || !saveFilename || saveLoading) ? '#ccc' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: (!saveSelectedFolder || !saveFilename || saveLoading) ? 'not-allowed' : 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                {saveLoading ? 'Saving...' : 'Save to Server'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowSaveDialog(false);
                                    exportToYAML();
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Export Local
                            </button>
                            <button 
                                onClick={() => setShowSaveDialog(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Browser Dialog */}
            {showImageBrowserDialog && (
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
                }} onClick={() => setShowImageBrowserDialog(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        width: '500px',
                        maxHeight: '70vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: '0', fontSize: '18px', color: '#333' }}>Select Image</h2>
                            <button 
                                onClick={() => setShowImageBrowserDialog(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#999',
                                    padding: '0',
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                            <strong>Location:</strong> /opt/esl/tag_image_gen/images
                        </div>

                        {imageBrowserLoading ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                Loading images...
                            </div>
                        ) : availableImages.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                No .bmp or .png images found
                            </div>
                        ) : (
                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '10px',
                                marginBottom: '15px'
                            }}>
                                {availableImages.map(image => (
                                    <div
                                        key={image}
                                        onClick={() => setSelectedImage(image)}
                                        style={{
                                            padding: '10px',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            marginBottom: '5px',
                                            backgroundColor: selectedImage === image ? '#e3f2fd' : 'transparent',
                                            border: selectedImage === image ? '2px solid #2196f3' : '2px solid transparent',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedImage !== image) {
                                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedImage !== image) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ marginRight: '10px', fontSize: '18px' }}>
                                                {image.endsWith('.bmp') ? '🖼️' : '🖼️'}
                                            </span>
                                            <span style={{ fontSize: '14px', color: '#333' }}>{image}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={addImageFromBrowser}
                                disabled={!selectedImage || imageBrowserLoading}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: (!selectedImage || imageBrowserLoading) ? '#ccc' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: (!selectedImage || imageBrowserLoading) ? 'not-allowed' : 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Add Image
                            </button>
                            <button 
                                onClick={() => setShowImageBrowserDialog(false)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Dialog */}
            {showPreviewDialog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: '5vh',
                    zIndex: 3000
                }} onClick={() => {
                    setShowPreviewDialog(false);
                    setPreviewImageUrl('');
                    setPreviewZoom(1);
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                        width: `${previewDialogSize.width}px`,
                        height: `${previewDialogSize.height}px`,
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden'
                    }} onClick={(e) => e.stopPropagation()}>
                        {/* Resize handle */}
                        <div
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsResizingPreview(true);
                                setResizeStartPos({ x: e.clientX, y: e.clientY });
                                setResizeStartSize({ width: previewDialogSize.width, height: previewDialogSize.height });
                            }}
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width: '20px',
                                height: '20px',
                                cursor: 'nwse-resize',
                                zIndex: 10,
                                background: 'linear-gradient(135deg, transparent 0%, transparent 50%, #999 50%, #999 100%)',
                                borderBottomRightRadius: '8px'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px', position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button
                                    onClick={() => setPreviewZoom(Math.max(getMinimumZoom(), previewZoom - 0.25))}
                                    style={{
                                        padding: '4px 12px',
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '18px',
                                        fontWeight: 'bold'
                                    }}
                                    title="Zoom Out"
                                >
                                    −
                                </button>
                                <span style={{ fontSize: '14px', color: '#666', minWidth: '60px', textAlign: 'center' }}>
                                    {Math.round(previewZoom * 100)}%
                                </span>
                                <button
                                    onClick={() => setPreviewZoom(Math.min(4, previewZoom + 0.25))}
                                    style={{
                                        padding: '4px 12px',
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '18px',
                                        fontWeight: 'bold'
                                    }}
                                    title="Zoom In"
                                >
                                    +
                                </button>
                                <button
                                    onClick={() => setPreviewZoom(1)}
                                    style={{
                                        padding: '4px 12px',
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                    title="Reset Zoom"
                                >
                                    Reset
                                </button>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowPreviewDialog(false);
                                    setPreviewImageUrl('');
                                    setPreviewZoom(1);
                                }}
                                style={{
                                    position: 'absolute',
                                    right: '0',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#999',
                                    padding: '0',
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Case Color Selector */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: '10px',
                            marginBottom: '15px',
                            fontSize: '14px'
                        }}>
                            <span style={{ color: '#666', fontWeight: '500' }}>Case Colour:</span>
                            <button
                                onClick={() => setPreviewCaseColor('white')}
                                style={{
                                    padding: '6px 16px',
                                    backgroundColor: previewCaseColor === 'white' ? '#007bff' : '#f0f0f0',
                                    color: previewCaseColor === 'white' ? 'white' : '#333',
                                    border: '1px solid ' + (previewCaseColor === 'white' ? '#007bff' : '#ccc'),
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                White
                            </button>
                            <button
                                onClick={() => setPreviewCaseColor('black')}
                                style={{
                                    padding: '6px 16px',
                                    backgroundColor: previewCaseColor === 'black' ? '#007bff' : '#f0f0f0',
                                    color: previewCaseColor === 'black' ? 'white' : '#333',
                                    border: '1px solid ' + (previewCaseColor === 'black' ? '#007bff' : '#ccc'),
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Black
                            </button>
                        </div>

                        <div 
                            style={{
                                overflow: 'auto',
                                width: '100%',
                                flex: 1,
                                border: '1px solid #ddd',
                                backgroundColor: '#f8f9fa'
                            }}
                            onWheel={(e) => {
                                e.preventDefault();
                                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                                setPreviewZoom(Math.max(getMinimumZoom(), Math.min(4, previewZoom + delta)));
                            }}
                        >
                            <div style={{
                                display: 'table',
                                minWidth: '100%',
                                minHeight: '100%'
                            }}>
                                <div style={{
                                    display: 'table-cell',
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    padding: '20px'
                                }}>
                                    {/* ESL Housing - rounded outer border */}
                                    <div style={{
                                        padding: `${20 * previewZoom}px`,
                                        backgroundColor: previewCaseColor === 'white' ? '#ffffff' : '#1a1a1a',
                                        borderRadius: `${12 * previewZoom}px`,
                                        border: `${4 * previewZoom}px solid #000`,
                                        boxShadow: previewCaseColor === 'white' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.6)',
                                        display: 'inline-block'
                                    }}>
                                        {/* Image with bold rectangular border */}
                                        <img
                                            src={previewImageUrl}
                                            alt="Template Preview"
                                            style={{
                                                width: `${canvasWidth * previewZoom}px`,
                                                height: `${canvasHeight * previewZoom}px`,
                                                imageRendering: 'pixelated',
                                                border: `${3 * previewZoom}px solid #000`,
                                                display: 'block',
                                                borderRadius: '0'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    // Download the preview image
                                    const link = document.createElement('a');
                                    link.href = previewImageUrl;
                                    link.download = 'esl-template.jpg';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Download
                            </button>
                            <button 
                                onClick={() => {
                                    setShowPreviewDialog(false);
                                    setPreviewImageUrl('');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Close
                            </button>
                        </div>
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
                                            
                                            // Calculate anchor-based positioning for both edit and display modes
                                            const estimatedTextWidth = estimateTextWidth(text, item.fontSize, (item as TextItem).fontFamily);
                                            const estimatedTextHeight = lines.length * lineHeight;
                                            const textAnchoredPosition = calculateAnchoredPosition(item as TextItem, estimatedTextWidth, estimatedTextHeight);
                                            
                                            // If this text is being edited, show input instead
                                            if (editingTextId === item.id) {
                                                return (
                                                    <foreignObject
                                                        key={item.id}
                                                        x={textAnchoredPosition.x}
                                                        y={textAnchoredPosition.y}
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
                                                    ref={(el) => {
                                                        if (el) {
                                                            textElementRefs.current.set(item.id, el);
                                                        } else {
                                                            textElementRefs.current.delete(item.id);
                                                        }
                                                    }}
                                                    x={textAnchoredPosition.x}
                                                    y={textAnchoredPosition.y}
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
                                                            x={textAnchoredPosition.x}
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
                                        if (item.type === "image") {
                                            return (
                                                <g key={item.id}>
                                                    {item.filename ? (
                                                        <image
                                                            x={item.x}
                                                            y={item.y}
                                                            width={item.width}
                                                            height={item.height}
                                                            href={`/api/get-image?filename=${encodeURIComponent(item.filename)}`}
                                                            preserveAspectRatio="none"
                                                            stroke={selectedIds.includes(item.id) ? "#007bff" : "none"}
                                                            strokeWidth={selectedIds.includes(item.id) ? 2 : 0}
                                                            style={{ cursor: "grab" }}
                                                            onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                        />
                                                    ) : (
                                                        <rect
                                                            x={item.x}
                                                            y={item.y}
                                                            width={item.width}
                                                            height={item.height}
                                                            fill="#f0f0f0"
                                                            stroke="#ccc"
                                                            strokeWidth={1}
                                                            strokeDasharray="5,5"
                                                            style={{ cursor: "grab" }}
                                                            onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                        />
                                                    )}
                                                    {!item.filename && (
                                                        <text
                                                            x={item.x + item.width / 2}
                                                            y={item.y + item.height / 2}
                                                            fill="#999"
                                                            fontSize="12"
                                                            textAnchor="middle"
                                                            dominantBaseline="central"
                                                            style={{ pointerEvents: "none" }}
                                                        >
                                                            No Image
                                                        </text>
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
                                            } else if (selectedItem?.type === 'image') {
                                                return renderResizeHandles(selectedItem as ImageItem);
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
                        
                        {/* Floating Zoom Controls - Bottom Right of canvas area */}
                        <div 
                            onMouseDown={handleZoomControlMouseDown}
                            style={{
                                position: 'fixed',
                                bottom: `${zoomControlsPosition.y}px`,
                                left: `${zoomControlsPosition.x}px`,
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
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
                                }}>
                                    <div style={{
                                        fontSize: '10px',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        fontWeight: 'bold',
                                        letterSpacing: '1px'
                                    }}>
                                        ZOOM
                                    </div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: 'rgba(255, 255, 255, 0.9)',
                                        fontWeight: 'normal',
                                        marginTop: '4px'
                                    }}>
                                        {Math.round(zoomLevel * 100)}%
                                    </div>
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

export default IntegratedTemplateEditor;



