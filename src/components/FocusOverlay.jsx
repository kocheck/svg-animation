import { useRef, useState, useEffect, useCallback } from 'react';
import {
  setSpeedOnSvg,
  setStrokeOnSvg,
  togglePauseOnSvg,
} from '../hooks/useAnimation';

/** FocusOverlay — expanded single-animation view with speed/stroke/pause controls */
export default function FocusOverlay({
  svgs,
  focusIndex,
  globalSpeed,
  globalPaused,
  onClose,
  onEdit,
  onNavigate,
}) {
  const svgContainerRef = useRef(null);
  const [speed, setSpeed] = useState(globalSpeed);
  const [stroke, setStroke] = useState(2);
  const [localPaused, setLocalPaused] = useState(globalPaused);
  const [prevFocus, setPrevFocus] = useState(focusIndex);

  const isOpen = focusIndex >= 0 && focusIndex < svgs.length;
  const svg = isOpen ? svgs[focusIndex] : null;

  // Reset controls when focus changes (adjust state during render)
  if (focusIndex !== prevFocus) {
    setPrevFocus(focusIndex);
    if (isOpen) {
      setSpeed(globalSpeed);
      setStroke(2);
      setLocalPaused(globalPaused);
    }
  }

  // Apply speed to focus SVG after render
  useEffect(() => {
    if (isOpen) {
      const svgEl = svgContainerRef.current?.querySelector('svg');
      if (svgEl) {
        setSpeedOnSvg(svgEl, speed, localPaused);
      }
    }
  }, [isOpen, speed, localPaused, svg]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigate((focusIndex + 1) % svgs.length);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate((focusIndex - 1 + svgs.length) % svgs.length);
      }
    },
    [isOpen, focusIndex, svgs.length, onClose, onNavigate],
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
    if (e.target.classList.contains('focus-overlay')) onClose();
  };

  const handleEdit = () => {
    if (focusIndex >= 0) onEdit(focusIndex);
  };

  return (
    <div
      className={`focus-overlay${isOpen ? ' open' : ''}`}
      onClick={handleOverlayClick}
    >
      <button className="close-btn" onClick={onClose}>
        &times;
      </button>
      <div className="focus-name">{svg?.name}</div>
      <div className="focus-svg">
        {svg && (
          <div
            className="inline-svg"
            ref={svgContainerRef}
            dangerouslySetInnerHTML={{ __html: svg.src }}
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
        <button onClick={handleEdit}>Edit Code</button>
      </div>
    </div>
  );
}
