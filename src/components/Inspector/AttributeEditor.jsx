// src/components/Inspector/AttributeEditor.jsx
import { useState, useCallback } from 'react';
import { useDocumentMutation } from '../../hooks/useDocumentMutation.js';
import { getAttributeType } from '../../model/attributeTypes.js';
import { getAndroidWarning } from '../../model/androidCompat.js';
import AndroidWarning from './AndroidWarning.jsx';

export default function AttributeEditor({ element, svgDoc, onColorSwatchClick }) {
  const { mutate } = useDocumentMutation();
  const [editingAttr, setEditingAttr] = useState(null);
  const [editValue, setEditValue] = useState('');

  const attrs = svgDoc.getAttributes(element);
  const elementId = element.getAttribute('data-svgdoc-id');

  const startEdit = useCallback((key, value) => {
    setEditingAttr(key);
    setEditValue(value);
  }, []);

  const commitEdit = useCallback((key) => {
    const attrType = getAttributeType(key);
    if (attrType.type === 'numeric' && editValue !== '' && isNaN(Number(editValue))) {
      cancelEdit();
      return;
    }

    mutate((doc) => {
      const el = doc.querySelector(`[data-svgdoc-id="${elementId}"]`);
      if (el) doc.setAttribute(el, key, editValue);
    });
    setEditingAttr(null);
  }, [editValue, elementId, mutate]);

  const cancelEdit = useCallback(() => {
    setEditingAttr(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e, key) => {
    if (e.key === 'Enter') commitEdit(key);
    else if (e.key === 'Escape') cancelEdit();
  }, [commitEdit, cancelEdit]);

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">Attributes</div>
      <table className="inspector-attrs" data-testid="attribute-editor">
        <tbody>
          {Object.entries(attrs).map(([key, value]) => {
            const attrType = getAttributeType(key);
            const warning = getAndroidWarning(key, value);
            const isEditing = editingAttr === key;

            return (
              <tr key={key}>
                <td className="attr-key">{key}</td>
                <td
                  className="attr-value"
                  data-testid="attr-value"
                  onDoubleClick={() => !isEditing && startEdit(key, value)}
                >
                  {isEditing ? (
                    attrType.type === 'enum' ? (
                      <select
                        data-testid="attr-edit-select"
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          mutate((doc) => {
                            const el = doc.querySelector(`[data-svgdoc-id="${elementId}"]`);
                            if (el) doc.setAttribute(el, key, e.target.value);
                          });
                          setEditingAttr(null);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        onBlur={() => commitEdit(key)}
                        autoFocus
                      >
                        {attrType.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        data-testid="attr-edit-input"
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        onBlur={() => commitEdit(key)}
                        autoFocus
                      />
                    )
                  ) : (
                    <>
                      {attrType.type === 'color' && (
                        <span
                          className="color-swatch"
                          data-testid="color-swatch"
                          style={{ backgroundColor: value }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onColorSwatchClick?.(key);
                          }}
                        />
                      )}
                      <span className="attr-value-text">{value}</span>
                    </>
                  )}
                  <AndroidWarning message={warning} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
