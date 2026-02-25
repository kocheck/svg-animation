import { useEffect, useRef, useState } from 'react';
import { useDocumentContext, useUIContext } from '../context/EditorContext.jsx';
import { setSpeedOnSvg } from '../hooks/useAnimation';

export default function Card({ document: doc }) {
  const { dispatch } = useDocumentContext();
  const { state: ui, dispatch: uiDispatch } = useUIContext();
  const wrapRef = useRef(null);
  const [copiedFlash, setCopiedFlash] = useState(false);

  useEffect(() => {
    const svgEl = wrapRef.current?.querySelector('svg');
    if (svgEl) {
      svgEl.style.animationPlayState = ui.paused ? 'paused' : 'running';
      setSpeedOnSvg(svgEl, ui.globalSpeed, ui.paused);
    }
  }, [ui.globalSpeed, ui.paused, doc.history.current]);

  const handleCopy = async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(doc.history.current);
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 1200);
  };

  const handleClick = (e) => {
    if (e.target.closest('.remove-btn') || e.target.closest('.edit-btn') || e.target.closest('.copy-btn')) return;
    uiDispatch({ type: 'SET_FOCUS', documentId: doc.id });
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    dispatch({ type: 'SET_ACTIVE', id: doc.id });
    uiDispatch({ type: 'TOGGLE_EDITOR' });
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_DOCUMENT', id: doc.id });
  };

  return (
    <div className="card" onClick={handleClick}>
      <div className={`svg-wrap preview-bg-${ui.previewBackground}`} data-testid={`svg-wrap-${doc.id}`}>
        <div className="inline-svg" ref={wrapRef} dangerouslySetInnerHTML={{ __html: doc.history.current }} />
      </div>
      <div className="card-label">
        <span>{doc.name}</span>
        <span>
          <button className="copy-btn" onClick={handleCopy}>{copiedFlash ? 'Copied!' : 'Copy'}</button>
          <button className="edit-btn" onClick={handleEdit}>Edit</button>
          <button className="remove-btn" onClick={handleRemove}>Remove</button>
        </span>
      </div>
    </div>
  );
}
