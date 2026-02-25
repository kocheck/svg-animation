import { useState, useCallback, useEffect } from 'react';
import { useDocumentMutation } from '../../hooks/useDocumentMutation.js';
import { parseTransform, buildTransform } from '../../model/transformUtils.js';
import { getAndroidWarning } from '../../model/androidCompat.js';
import AndroidWarning from './AndroidWarning.jsx';

export default function TransformInputs({ element }) {
  const { mutate } = useDocumentMutation();
  const elementId = element.getAttribute('data-svgdoc-id');
  const rawTransform = element.getAttribute('transform') || '';
  const parsed = parseTransform(rawTransform);

  const [values, setValues] = useState(parsed);
  const [savedValues, setSavedValues] = useState(parsed);

  useEffect(() => {
    const p = parseTransform(element.getAttribute('transform') || '');
    setValues(p);
    setSavedValues(p);
  }, [element]);

  const handleChange = useCallback((field, val) => {
    setValues((prev) => ({ ...prev, [field]: val }));
  }, []);

  const commit = useCallback(() => {
    const numValues = {
      x: Number(values.x) || 0,
      y: Number(values.y) || 0,
      rotation: Number(values.rotation) || 0,
      scale: Number(values.scale) || 1,
    };
    setValues(numValues);
    setSavedValues(numValues);
    const transformStr = buildTransform(numValues);
    mutate((doc) => {
      const el = doc.querySelector(`[data-svgdoc-id="${elementId}"]`);
      if (!el) return;
      if (transformStr) {
        doc.setAttribute(el, 'transform', transformStr);
      } else {
        doc.removeAttribute(el, 'transform');
      }
    });
  }, [values, elementId, mutate]);

  const revert = useCallback(() => {
    setValues(savedValues);
  }, [savedValues]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') commit();
    else if (e.key === 'Escape') revert();
  }, [commit, revert]);

  const warning = getAndroidWarning('transform', rawTransform);

  const fields = [
    { key: 'x', label: 'X', step: 1 },
    { key: 'y', label: 'Y', step: 1 },
    { key: 'rotation', label: 'Rotation', step: 1 },
    { key: 'scale', label: 'Scale', step: 0.1 },
  ];

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">
        Transform
        <AndroidWarning message={warning} />
      </div>
      <div className="transform-inputs" data-testid="transform-inputs">
        {fields.map(({ key, label, step }) => (
          <div key={key} className="transform-field">
            <label className="transform-label">{label}</label>
            <input
              data-testid={`transform-${key}`}
              type="number"
              step={step}
              value={values[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commit}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
