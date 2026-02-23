import { useState, useRef, useEffect, useCallback } from 'react';

/** CodeEditor — collapsible SVG code editor with live preview */
export default function CodeEditor({ onAddToGallery, editTarget }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [addedFlash, setAddedFlash] = useState(false);
  const [lastEditTs, setLastEditTs] = useState(null);
  const textareaRef = useRef(null);
  const editorSectionRef = useRef(null);

  // Adjust state when editTarget prop changes (React recommended pattern)
  if (editTarget && editTarget._ts !== lastEditTs) {
    setLastEditTs(editTarget._ts);
    setCode(editTarget.src);
    setName(editTarget.name);
    setOpen(true);
  }

  // Scroll to editor when editTarget changes (side-effect)
  useEffect(() => {
    if (editTarget && open) {
      editorSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lastEditTs]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValidSvg = code.trim().includes('<svg') && code.trim().includes('</svg>');

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = textareaRef.current;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = code.substring(0, start) + '  ' + code.substring(end);
        setCode(newVal);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [code],
  );

  const handleAdd = () => {
    if (!code.trim() || !code.includes('<svg')) return;
    const svgName = name.trim() || 'custom-' + (Date.now() % 10000);
    onAddToGallery({ name: svgName, src: code });
    setName('');
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 1200);
  };

  const handleClear = () => {
    setCode('');
    setName('');
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

  return (
    <div className="editor-section" ref={editorSectionRef}>
      <button className="editor-toggle" onClick={() => setOpen(!open)}>
        <span>Code Editor &mdash; paste or write SVG code with live preview</span>
        <span className={`chevron${open ? ' open' : ''}`}>&#9654;</span>
      </button>
      <div className={`editor-body${open ? ' open' : ''}`}>
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
        <div className="editor-actions">
          <input
            type="text"
            className="name-input"
            placeholder="Animation name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="primary" onClick={handleAdd}>
            {addedFlash ? 'Added!' : 'Add to Gallery'}
          </button>
          <button onClick={handleClear}>Clear</button>
          <span className="spacer" />
          <span className="hint">Edits update the preview in real time</span>
        </div>
      </div>
    </div>
  );
}
