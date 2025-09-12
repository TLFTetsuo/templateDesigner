import React, { useRef, useState } from "react";

// Type definitions
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

type CanvasItem = RectItem | CircleItem | TextItem;

const initialItems: CanvasItem[] = [
  { id: 1, type: "rect", x: 50, y: 50, width: 120, height: 70, color: "#FF6347" },
  { id: 2, type: "circle", x: 240, y: 130, radius: 50, color: "#4682B4" },
  { id: 3, type: "text", x: 140, y: 220, text: "Edit me!", color: "#222", fontSize: 32 }
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

export default function AdvancedCanvasEditor() {
  const [items, setItems] = useState<CanvasItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dragging, setDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [editingText, setEditingText] = useState<number | null>(null);

  function handleMouseDown(e: React.MouseEvent, id: number) {
    setSelectedId(id);
    setDragging(true);
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const bounds = getItemBounds(item);
    setDragOffset({
      x: e.clientX - (bounds.x || 0),
      y: e.clientY - (bounds.y || 0)
    });
  }

  function handleMouseUp() {
    setDragging(false);
  }

  function handleMouseMove(e: MouseEvent) {
    if (dragging && selectedId) {
      setItems(items =>
        items.map(item =>
          item.id === selectedId
            ? {
                ...item,
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
              }
            : item
        )
      );
    }
  }

  function handleColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (selectedId) {
      setItems(items =>
        items.map(item =>
          item.id === selectedId ? { ...item, color: e.target.value } : item
        )
      );
    }
  }

  function handleTextEdit(id: number) {
    setEditingText(id);
  }

  function handleTextInputChange(e: React.ChangeEvent<HTMLInputElement>, id: number) {
    setItems(items =>
      items.map(item =>
        item.id === id ? { ...item, text: e.target.value } : item
      )
    );
  }

  function handleTextInputBlur() {
    setEditingText(null);
  }

  function handleFontSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (selectedId) {
      setItems(items =>
        items.map(item =>
          item.id === selectedId && item.type === "text"
            ? { ...item, fontSize: parseInt(e.target.value, 10) }
            : item
        )
      );
    }
  }

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  const selectedItem = items.find(item => item.id === selectedId);

  return (
    <div>
      <svg width="500" height="350" style={{ border: "1px solid #ccc", userSelect: "none" }}>
        {items.map(item => {
          switch (item.type) {
            case "rect":
              return (
                <rect
                  key={item.id}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                  fill={item.color}
                  onMouseDown={e => handleMouseDown(e, item.id)}
                  style={{ cursor: "move", stroke: selectedId === item.id ? "#111" : "none", strokeWidth: 2 }}
                />
              );
            case "circle":
              return (
                <circle
                  key={item.id}
                  cx={item.x}
                  cy={item.y}
                  r={item.radius}
                  fill={item.color}
                  onMouseDown={e => handleMouseDown(e, item.id)}
                  style={{ cursor: "move", stroke: selectedId === item.id ? "#111" : "none", strokeWidth: 2 }}
                />
              );
            case "text":
              return editingText === item.id ? (
                <foreignObject
                  key={item.id}
                  x={item.x}
                  y={item.y - item.fontSize}
                  width={200}
                  height={item.fontSize + 8}
                >
                  <input
                    type="text"
                    value={item.text}
                    style={{ fontSize: item.fontSize, width: "100%" }}
                    onChange={e => handleTextInputChange(e, item.id)}
                    onBlur={handleTextInputBlur}
                    autoFocus
                  />
                </foreignObject>
              ) : (
                <text
                  key={item.id}
                  x={item.x}
                  y={item.y}
                  fill={item.color}
                  fontSize={item.fontSize}
                  onMouseDown={e => handleMouseDown(e, item.id)}
                  onDoubleClick={() => handleTextEdit(item.id)}
                  style={{ cursor: "move", stroke: selectedId === item.id ? "#111" : "none", strokeWidth: 2 }}
                >
                  {item.text}
                </text>
              );
            default:
              return null;
          }
        })}
      </svg>
      <br />
      {selectedItem && (
        <>
          <input
            type="color"
            value={selectedItem.color}
            onChange={handleColorChange}
            style={{ marginRight: 12 }}
          />
          {selectedItem.type === "text" && (
            <>
              <label>
                Font Size:
                <input
                  type="number"
                  min="10"
                  max="80"
                  value={selectedItem.fontSize}
                  onChange={handleFontSizeChange}
                  style={{ marginLeft: 4, width: 60 }}
                />
              </label>
            </>
          )}
        </>
      )}
      <span style={{ marginLeft: 16 }}>Select, drag, or double-click a text to edit.</span>
    </div>
  );
}