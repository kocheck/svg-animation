import { useSelectionContext, useDocumentContext } from '../../context/EditorContext.jsx';
import { detectAnimations } from '../../model/AnimationDetector.js';
import ElementTree from './ElementTree.jsx';
import AttributeEditor from './AttributeEditor.jsx';
import ColorPicker from './ColorPicker.jsx';
import TransformInputs from './TransformInputs.jsx';
import TimingControls from './TimingControls.jsx';
import { useDocumentMutation } from '../../hooks/useDocumentMutation.js';
import { useState, useCallback } from 'react';

const TRANSFORMABLE_TAGS = new Set([
  'g', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'path', 'text', 'image', 'use', 'svg',
]);

export default function InspectorPanel() {
  const { state: { elementId } } = useSelectionContext();
  const { state: { documents, activeDocumentId } } = useDocumentContext();
  const { mutate, startBatch, commitBatch } = useDocumentMutation();
  const [colorPickerAttr, setColorPickerAttr] = useState(null);

  const activeDoc = documents.find(d => d.id === activeDocumentId);

  let element = null;
  if (activeDoc && elementId) {
    const matches = activeDoc.doc.querySelectorAll(`[data-svgdoc-id="${elementId}"]`);
    element = matches[0] || null;
  }

  if (!element) {
    return (
      <div className="inspector-panel" data-testid="inspector-panel">
        <div className="inspector-empty">Select an element to inspect</div>
      </div>
    );
  }

  const tagName = element.tagName?.toLowerCase() || element.localName;
  const attrs = activeDoc.doc.getAttributes(element);
  const parentChain = buildParentChain(element);
  const isTransformable = TRANSFORMABLE_TAGS.has(tagName);

  // Detect animations targeting this element
  let animations = [];
  try {
    const allAnimations = detectAnimations(activeDoc.doc.getRoot());
    animations = allAnimations.filter(
      (a) => a.elementId === elementId || a.target?.getAttribute('data-svgdoc-id') === elementId
    );
  } catch {
    // AnimationDetector may fail in test environments without getComputedStyle
  }

  const hasColorAttrs = attrs.fill || attrs.stroke;

  const handleColorChange = useCallback((color) => {
    if (!colorPickerAttr) return;
    mutate((doc) => {
      const el = doc.querySelector(`[data-svgdoc-id="${elementId}"]`);
      if (el) doc.setAttribute(el, colorPickerAttr, color);
    });
  }, [colorPickerAttr, elementId, mutate]);

  return (
    <div className="inspector-panel" data-testid="inspector-panel">
      {/* Header */}
      <div className="inspector-header">
        <span className="inspector-tag" data-testid="inspector-tag">&lt;{tagName}&gt;</span>
        {attrs.id && <span className="inspector-id">#{attrs.id}</span>}
        {attrs.class && (
          <span className="inspector-classes">
            {attrs.class.split(/\s+/).map(cls => (
              <span key={cls} className="class-pill">.{cls}</span>
            ))}
          </span>
        )}
      </div>

      {/* Element Tree */}
      <ElementTree svgDoc={activeDoc.doc} />

      {/* Attribute Editor */}
      <AttributeEditor
        element={element}
        svgDoc={activeDoc.doc}
        onColorSwatchClick={(attrName) => setColorPickerAttr(attrName)}
      />

      {/* Color Picker (shown when a color swatch is clicked) */}
      {colorPickerAttr && hasColorAttrs && (
        <ColorPicker
          color={attrs[colorPickerAttr] || '#000000'}
          onChange={handleColorChange}
          onClose={() => setColorPickerAttr(null)}
          onBatchStart={startBatch}
          onBatchEnd={commitBatch}
        />
      )}

      {/* Transform Inputs */}
      {isTransformable && (
        <TransformInputs element={element} />
      )}

      {/* Timing Controls */}
      {animations.length > 0 && (
        <TimingControls element={element} animations={animations} />
      )}

      {/* Parent Chain Breadcrumb */}
      <div className="inspector-section">
        <div className="inspector-section-title">Parent Chain</div>
        <div className="inspector-breadcrumb" data-testid="inspector-breadcrumb">
          {parentChain.map((tag, i) => (
            <span key={i}>
              {i > 0 && <span className="breadcrumb-sep"> &rsaquo; </span>}
              <span className="breadcrumb-tag">{tag}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildParentChain(element) {
  const chain = [];
  let el = element;
  while (el && el.parentElement) {
    el = el.parentElement;
    const tag = el.tagName?.toLowerCase() || el.localName;
    if (tag && tag !== '#document') {
      chain.unshift(tag);
    }
  }
  return chain;
}
