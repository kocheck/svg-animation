import { useState, useEffect } from 'react';
import { useSelectionContext } from '../context/EditorContext.jsx';

export default function SelectionOverlay({ containerRef }) {
  const { state: selection } = useSelectionContext();
  const [selectionRect, setSelectionRect] = useState(null);
  const [hoverRect, setHoverRect] = useState(null);

  useEffect(() => {
    if (!containerRef?.current || !selection.elementId) {
      setSelectionRect(null);
      return;
    }
    const el = containerRef.current.querySelector(
      `[data-svgdoc-id="${selection.elementId}"]`,
    );
    if (!el) {
      setSelectionRect(null);
      return;
    }
    try {
      const bbox = el.getBBox();
      setSelectionRect({
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    } catch {
      setSelectionRect(null);
    }
  }, [selection.elementId, containerRef]);

  useEffect(() => {
    if (!containerRef?.current || !selection.hoveredElementId) {
      setHoverRect(null);
      return;
    }
    const el = containerRef.current.querySelector(
      `[data-svgdoc-id="${selection.hoveredElementId}"]`,
    );
    if (!el) {
      setHoverRect(null);
      return;
    }
    try {
      const bbox = el.getBBox();
      setHoverRect({
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    } catch {
      setHoverRect(null);
    }
  }, [selection.hoveredElementId, containerRef]);

  if (!selectionRect && !hoverRect) return null;

  return (
    <svg
      data-testid="selection-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {hoverRect && (
        <rect
          x={hoverRect.x}
          y={hoverRect.y}
          width={hoverRect.width}
          height={hoverRect.height}
          fill="rgba(74, 158, 255, 0.1)"
          stroke="#4a9eff"
          strokeWidth="1"
          opacity="0.4"
          data-testid="hover-rect"
        />
      )}
      {selectionRect && (
        <rect
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="none"
          stroke="#4a9eff"
          strokeWidth="2"
          strokeDasharray="6 3"
          data-testid="selection-rect"
        />
      )}
    </svg>
  );
}
