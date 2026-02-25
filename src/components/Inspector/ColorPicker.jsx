import { useState, useEffect, useCallback, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { getAndroidWarning } from '../../model/androidCompat.js';
import AndroidWarning from './AndroidWarning.jsx';

function normalizeToHex(color) {
  if (!color) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  // For rgb(), hsl(), named colors — use canvas to convert
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return ctx.fillStyle; // Returns #rrggbb
  } catch {
    return '#000000';
  }
}

export default function ColorPicker({
  color,
  onChange,
  onClose,
  onBatchStart,
  onBatchEnd,
}) {
  const [hex, setHex] = useState(() => normalizeToHex(color));
  const [inputValue, setInputValue] = useState(color || '#000000');
  const pickerRef = useRef(null);
  const originalColor = useRef(color);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePickerChange = useCallback((newColor) => {
    setHex(newColor);
    setInputValue(newColor);
    onChange(newColor);
  }, [onChange]);

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInputValue(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setHex(value);
      onChange(value);
    }
  }, [onChange]);

  const warning = getAndroidWarning('fill', originalColor.current);

  return (
    <div
      className="color-picker-popover"
      data-testid="color-picker"
      ref={pickerRef}
      onPointerDown={() => onBatchStart?.()}
      onPointerUp={() => onBatchEnd?.()}
    >
      <HexColorPicker color={hex} onChange={handlePickerChange} />
      <div className="color-picker-input-row">
        <input
          data-testid="color-hex-input"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="color-hex-input"
          spellCheck={false}
        />
        <AndroidWarning message={warning} />
      </div>
    </div>
  );
}
