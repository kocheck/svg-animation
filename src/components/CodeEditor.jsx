import { useState, useRef, useEffect, useCallback } from 'react';
import { useDocumentContext, useUIContext } from '../context/EditorContext.jsx';
import { SvgDoc } from '../model/SvgDoc.js';

/** CodeEditor — collapsible SVG code editor with live preview, powered by Context */
export default function CodeEditor() {
  const { state: docState, dispatch } = useDocumentContext();
  const { state: ui, dispatch: uiDispatch } = useUIContext();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [flash, setFlash] = useState(null); // 'Added!' | 'Saved!' | null
  const [prevActiveId, setPrevActiveId] = useState(null);
  const textareaRef = useRef(null);
  const editorSectionRef = useRef(null);

  const { documents, activeDocumentId } = docState;
  const isEditing = activeDocumentId !== null;
  const activeDoc = isEditing
    ? documents.find((d) => d.id === activeDocumentId)
    : null;

  // Sync code/name when activeDocumentId changes
  if (activeDocumentId !== prevActiveId) {
    setPrevActiveId(activeDocumentId);
    if (activeDoc) {
      setCode(activeDoc.history.current);
      setName(activeDoc.name);
    }
  }

  // Scroll to editor when editing target changes
  useEffect(() => {
    if (activeDoc && ui.editorOpen) {
      editorSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeDocumentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValidSvg = code.trim().includes('<svg') && code.trim().includes('</svg>');

  // QW-4: SVG metadata
  const metadata = (() => {
    if (!isValidSvg) return null;
    try {
      const doc = SvgDoc.parse(code);
      return doc.getStats();
    } catch {
      return null;
    }
  })();

  const handleSubmit = useCallback(() => {
    if (!code.trim() || !code.includes('<svg')) return;

    if (isEditing && activeDocumentId) {
      // QW-1: Save changes to existing document
      dispatch({ type: 'REPLACE_DOCUMENT', id: activeDocumentId, src: code });
      setFlash('Saved!');
    } else {
      // QW-1: Add new document
      const svgName = name.trim() || 'custom-' + (Date.now() % 10000);
      dispatch({ type: 'ADD_DOCUMENT', name: svgName, src: code });
      setName('');
      setFlash('Added!');
    }
    setTimeout(() => setFlash(null), 1200);
  }, [code, isEditing, activeDocumentId, name, dispatch]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = textareaRef.current;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = code.substring(0, start) + '  ' + code.substring(end);
        setCode(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      // QW-5: Ctrl+Enter / Cmd+Enter to submit
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [code, handleSubmit],
  );

  const handleClear = () => {
    setCode('');
    setName('');
  };

  const handleToggle = () => {
    uiDispatch({ type: 'TOGGLE_EDITOR' });
  };

  const statusText = !code.trim()
    ? ''
    : isValidSvg
      ? 'Valid SVG'
      : 'Missing <svg> tags';
  const statusClass = !code.trim()
    ? 'status'
    : isValidSvg
      ? 'status valid'
      : 'status invalid';

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="editor-section" ref={editorSectionRef}>
      <button className="editor-toggle" onClick={handleToggle}>
        <span>Code Editor &mdash; paste or write SVG code with live preview</span>
        <span className={`chevron${ui.editorOpen ? ' open' : ''}`}>&#9654;</span>
      </button>
      <div className={`editor-body${ui.editorOpen ? ' open' : ''}`}>
        <div className="editor-layout">
          <div className="editor-pane">
            <div className="editor-pane-header">
              <span>SVG Code</span>
              <span className={statusClass}>{statusText}</span>
            </div>
            <textarea
              ref={textareaRef}
              className="code-input"
              placeholder={
                'Paste or type SVG code here...\n\nExample:\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">\n  <circle cx="200" cy="200" r="100" fill="none" stroke="black" />\n</svg>'
              }
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="editor-pane">
            <div className="editor-pane-header">
              <span>Live Preview</span>
            </div>
            <div className="preview-pane">
              {isValidSvg ? (
                <div
                  className="inline-svg"
                  dangerouslySetInnerHTML={{ __html: code }}
                />
              ) : (
                <span className="placeholder-msg">
                  {code.trim()
                    ? 'Waiting for valid SVG...'
                    : 'Preview appears here'}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* QW-4: Metadata bar */}
        {metadata && (
          <div className="svg-metadata" data-testid="svg-metadata">
            {metadata.dimensions.width && metadata.dimensions.height && (
              <span>{metadata.dimensions.width} x {metadata.dimensions.height}</span>
            )}
            {metadata.dimensions.viewBox && (
              <span>viewBox: {metadata.dimensions.viewBox}</span>
            )}
            <span>{metadata.elementCount} elements</span>
            <span>{metadata.animationCount} animations</span>
            <span>{formatBytes(metadata.sizeBytes)}</span>
          </div>
        )}
        <div className="editor-actions">
          <input
            type="text"
            className="name-input"
            placeholder="Animation name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="primary" onClick={handleSubmit}>
            {flash || (isEditing ? 'Save Changes' : 'Add to Gallery')}
          </button>
          <button onClick={handleClear}>Clear</button>
          <span className="spacer" />
          {/* QW-5: Ctrl+Enter hint */}
          <span className="hint">Ctrl+Enter to submit</span>
        </div>
      </div>
    </div>
  );
}
