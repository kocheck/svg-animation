import { useRef, useState, useEffect, useCallback } from 'react';
import { useDocumentContext, useUIContext } from '../context/EditorContext.jsx';
import {
  setSpeedOnSvg,
  setStrokeOnSvg,
  togglePauseOnSvg,
} from '../hooks/useAnimation';

/** FocusOverlay — expanded single-animation view with speed/stroke/pause controls, powered by Context */
export default function FocusOverlay() {
  const { state: docState, dispatch } = useDocumentContext();
  const { state: ui, dispatch: uiDispatch } = useUIContext();

  const { documents } = docState;
  const { focusDocumentId, previewBackground, globalSpeed, paused: globalPaused } = ui;

  const svgContainerRef = useRef(null);
  const [speed, setSpeed] = useState(globalSpeed);
  const [stroke, setStroke] = useState(2);
  const [localPaused, setLocalPaused] = useState(globalPaused);
  const [prevFocusId, setPrevFocusId] = useState(focusDocumentId);

  const isOpen = focusDocumentId !== null;
  const focusDoc = isOpen
    ? documents.find((d) => d.id === focusDocumentId)
    : null;

  // Reset controls when focus changes (adjust state during render)
  if (focusDocumentId !== prevFocusId) {
    setPrevFocusId(focusDocumentId);
    if (isOpen) {
      setSpeed(globalSpeed);
      setStroke(2);
      setLocalPaused(globalPaused);
    }
  }

  // Apply speed to focus SVG after render
  useEffect(() => {
    if (isOpen && focusDoc) {
      const svgEl = svgContainerRef.current?.querySelector('svg');
      if (svgEl) {
        setSpeedOnSvg(svgEl, speed, localPaused);
      }
    }
  }, [isOpen, speed, localPaused, focusDoc]);

  // Navigate helpers
  const currentIndex = focusDoc
    ? documents.indexOf(focusDoc)
    : -1;

  const navigateNext = useCallback(() => {
    if (documents.length === 0) return;
    const nextIdx = (currentIndex + 1) % documents.length;
    uiDispatch({ type: 'SET_FOCUS', documentId: documents[nextIdx].id });
  }, [currentIndex, documents, uiDispatch]);

  const navigatePrev = useCallback(() => {
    if (documents.length === 0) return;
    const prevIdx = (currentIndex - 1 + documents.length) % documents.length;
    uiDispatch({ type: 'SET_FOCUS', documentId: documents[prevIdx].id });
  }, [currentIndex, documents, uiDispatch]);

  const handleClose = useCallback(() => {
    uiDispatch({ type: 'CLEAR_FOCUS' });
  }, [uiDispatch]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateNext();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigatePrev();
      }
    },
    [isOpen, handleClose, navigateNext, navigatePrev],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSpeedChange = (val) => {
    setSpeed(val);
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (svgEl) setSpeedOnSvg(svgEl, val, localPaused);
  };

  const handleStrokeChange = (val) => {
    setStroke(val);
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (svgEl) setStrokeOnSvg(svgEl, val);
  };

  const handlePauseToggle = () => {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (svgEl) {
      const nowPaused = togglePauseOnSvg(svgEl);
      setLocalPaused(nowPaused);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('focus-overlay')) handleClose();
  };

  // "Edit Code" => set active + open editor + close overlay
  const handleEdit = () => {
    if (focusDoc) {
      dispatch({ type: 'SET_ACTIVE', id: focusDoc.id });
      uiDispatch({ type: 'TOGGLE_EDITOR' });
      uiDispatch({ type: 'CLEAR_FOCUS' });
    }
  };

  // QW-2: Copy SVG source
  const handleCopy = async () => {
    if (focusDoc) {
      await navigator.clipboard.writeText(focusDoc.history.current);
    }
  };

  const svgSrc = focusDoc ? focusDoc.history.current : '';

  return (
    <div
      className={`focus-overlay${isOpen ? ' open' : ''}`}
      onClick={handleOverlayClick}
    >
      <button className="close-btn" onClick={handleClose}>
        &times;
      </button>
      <div className="focus-name">{focusDoc?.name}</div>
      {/* QW-3: preview background class */}
      <div className={`focus-svg preview-bg-${previewBackground}`}>
        {focusDoc && (
          <div
            className="inline-svg"
            ref={svgContainerRef}
            dangerouslySetInnerHTML={{ __html: svgSrc }}
          />
        )}
      </div>
      <div className="focus-controls">
        <label>Speed</label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={speed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
        />
        <span className="val">{speed.toFixed(1)}x</span>
        <div
          className="sep"
          style={{ width: 1, height: 20, background: '#2a2a2a' }}
        />

        <label>Stroke</label>
        <input
          type="range"
          min="0.5"
          max="6"
          step="0.25"
          value={stroke}
          onChange={(e) => handleStrokeChange(parseFloat(e.target.value))}
        />
        <span className="val">{stroke.toFixed(1)}</span>
        <div
          className="sep"
          style={{ width: 1, height: 20, background: '#2a2a2a' }}
        />

        <button onClick={handlePauseToggle}>
          {localPaused ? 'Play' : 'Pause'}
        </button>
        <div
          className="sep"
          style={{ width: 1, height: 20, background: '#2a2a2a' }}
        />
        {/* QW-2: Copy button */}
        <button onClick={handleCopy}>Copy SVG</button>
        <div
          className="sep"
          style={{ width: 1, height: 20, background: '#2a2a2a' }}
        />
        <button onClick={handleEdit}>Edit Code</button>
      </div>
      {/* QW-5: Keyboard hints strip */}
      <div className="keyboard-hints">
        <span>&larr; &rarr; navigate &middot; Esc close &middot; E edit</span>
      </div>
    </div>
  );
}
