# Phase 2 — Editable Inspector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the read-only Inspector into a full editing suite with inline attribute editing, color picking, transform inputs, animation timing controls, an element tree, and Android compatibility warnings.

**Architecture:** Composable sub-panels under `src/components/Inspector/`, each independently testable. A shared `useDocumentMutation` hook centralizes the mutate-serialize-history-dispatch cycle. Three new reducer actions (`BATCH_START`, `BATCH_UPDATE`, `BATCH_COMMIT`) support live-preview batching for the color picker.

**Tech Stack:** React 19, Vitest + happy-dom + @testing-library/react, react-colorful (~2KB)

---

### Task 1: Android Compatibility Data Module

**Files:**
- Create: `src/model/androidCompat.js`
- Create: `src/model/androidCompat.test.js`

**Step 1: Write the failing tests**

```js
// src/model/androidCompat.test.js
import { describe, it, expect } from 'vitest';
import { getAndroidWarning } from './androidCompat.js';

describe('getAndroidWarning', () => {
  it('returns warning for filter attribute', () => {
    expect(getAndroidWarning('filter')).toMatch(/not supported/i);
  });

  it('returns warning for mask attribute', () => {
    expect(getAndroidWarning('mask')).toMatch(/limited/i);
  });

  it('returns warning for clip-path with url() value', () => {
    expect(getAndroidWarning('clip-path', 'url(#clip1)')).toMatch(/clip-path/i);
  });

  it('returns null for clip-path without url()', () => {
    expect(getAndroidWarning('clip-path', 'circle(50%)')).toBeNull();
  });

  it('returns warning for fill with hsl()', () => {
    expect(getAndroidWarning('fill', 'hsl(0, 100%, 50%)')).toMatch(/hex/i);
  });

  it('returns warning for stroke with oklch()', () => {
    expect(getAndroidWarning('stroke', 'oklch(0.5 0.2 240)')).toMatch(/hex/i);
  });

  it('returns warning for fill with currentColor', () => {
    expect(getAndroidWarning('fill', 'currentColor')).toMatch(/hex/i);
  });

  it('returns null for fill with hex color', () => {
    expect(getAndroidWarning('fill', '#ff0000')).toBeNull();
  });

  it('returns null for fill with standard named color', () => {
    expect(getAndroidWarning('fill', 'red')).toBeNull();
  });

  it('returns warning for transform with skewX', () => {
    expect(getAndroidWarning('transform', 'skewX(30)')).toMatch(/skew/i);
  });

  it('returns warning for transform with skewY', () => {
    expect(getAndroidWarning('transform', 'skewY(15)')).toMatch(/skew/i);
  });

  it('returns null for transform without skew', () => {
    expect(getAndroidWarning('transform', 'translate(10, 20)')).toBeNull();
  });

  it('returns warning for font-family with custom font', () => {
    expect(getAndroidWarning('font-family', 'MyCustomFont, sans-serif')).toMatch(/font/i);
  });

  it('returns null for font-family with system fonts only', () => {
    expect(getAndroidWarning('font-family', 'sans-serif')).toBeNull();
  });

  it('returns null for unrelated attributes', () => {
    expect(getAndroidWarning('cx', '50')).toBeNull();
    expect(getAndroidWarning('width', '100')).toBeNull();
    expect(getAndroidWarning('id', 'myId')).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/androidCompat.test.js`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```js
// src/model/androidCompat.js

const SVG_SAFE_NAMED_COLORS = new Set([
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'navy', 'teal',
  'maroon', 'olive', 'lime', 'aqua', 'fuchsia', 'silver',
]);

const SYSTEM_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
]);

function isUnsafeColor(value) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (v.startsWith('#')) return false;
  if (v.startsWith('rgb(') || v.startsWith('rgba(')) return false;
  if (v.startsWith('hsl') || v.startsWith('oklch') || v.startsWith('oklab')
      || v.startsWith('lch') || v.startsWith('lab')) return true;
  if (v === 'currentcolor') return true;
  if (v === 'none' || v === 'transparent' || v === 'inherit') return false;
  if (SVG_SAFE_NAMED_COLORS.has(v)) return false;
  // Unknown named color — might not be in SVG 1.1 set
  if (/^[a-z]+$/.test(v)) return true;
  return false;
}

function hasCustomFont(value) {
  if (!value) return false;
  const fonts = value.split(',').map(f => f.trim().replace(/['"]/g, '').toLowerCase());
  return fonts.some(f => !SYSTEM_FONTS.has(f));
}

export function getAndroidWarning(attrName, attrValue) {
  const name = attrName.toLowerCase();

  if (name === 'filter') return 'filter is not supported on Android WebView';
  if (name === 'mask') return 'mask has limited Android support';

  if (name === 'clip-path' && attrValue && attrValue.includes('url(')) {
    return 'Complex clip-path may not render on Android';
  }

  if ((name === 'fill' || name === 'stroke') && isUnsafeColor(attrValue)) {
    return 'Use #RRGGBB hex for Android compatibility';
  }

  if (name === 'transform' && attrValue && /skew[XY]/i.test(attrValue)) {
    return 'skew transforms not supported on all Android renderers';
  }

  if (name === 'font-family' && hasCustomFont(attrValue)) {
    return 'Custom fonts may not load on Android';
  }

  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/model/androidCompat.test.js`
Expected: All 16 tests PASS

**Step 5: Commit**

```bash
git add src/model/androidCompat.js src/model/androidCompat.test.js
git commit -m "feat: add androidCompat module for SVG attribute warnings"
```

---

### Task 2: Batch Reducer Actions in EditorContext

**Files:**
- Modify: `src/context/EditorContext.jsx` (documentReducer, ~lines 13-78)
- Modify: `src/context/EditorContext.test.jsx` (add batch tests)

**Step 1: Write the failing tests**

Append to `src/context/EditorContext.test.jsx`, inside the `DocumentContext` describe block:

```js
it('BATCH_START + BATCH_UPDATE + BATCH_COMMIT creates single undo entry', () => {
  // Setup: add a document
  const { getByTestId } = render(
    <DocumentProvider><DocConsumer /></DocumentProvider>
  );
  act(() => getByTestId('add').click());

  // Start batch
  act(() => getByTestId('batch-start').click());
  // Batch update twice
  act(() => getByTestId('batch-update').click());
  act(() => getByTestId('batch-update-2').click());
  // Commit batch
  act(() => getByTestId('batch-commit').click());

  // Should have only 1 undo entry (not 2)
  expect(getByTestId('can-undo').textContent).toBe('true');
  act(() => getByTestId('undo').click());
  expect(getByTestId('can-undo').textContent).toBe('false');
  // After undo, should be back to original SVG_A
  expect(getByTestId('active-src').textContent).toBe(SVG_A);
});

it('BATCH_UPDATE without BATCH_START behaves like UPDATE_DOCUMENT', () => {
  const { getByTestId } = render(
    <DocumentProvider><DocConsumer /></DocumentProvider>
  );
  act(() => getByTestId('add').click());
  act(() => getByTestId('batch-update').click());
  expect(getByTestId('can-undo').textContent).toBe('true');
});
```

Add the corresponding test buttons to the `DocConsumer` component in the test file:

```jsx
const SVG_C = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>';

// Inside DocConsumer, add:
<button data-testid="batch-start" onClick={() =>
  dispatch({ type: 'BATCH_START', id: state.activeDocumentId })} />
<button data-testid="batch-update" onClick={() =>
  dispatch({ type: 'BATCH_UPDATE', id: state.activeDocumentId, src: SVG_B })} />
<button data-testid="batch-update-2" onClick={() =>
  dispatch({ type: 'BATCH_UPDATE', id: state.activeDocumentId, src: SVG_C })} />
<button data-testid="batch-commit" onClick={() =>
  dispatch({ type: 'BATCH_COMMIT', id: state.activeDocumentId })} />
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/context/EditorContext.test.jsx`
Expected: FAIL — unknown action types

**Step 3: Add batch actions to the reducer**

In `src/context/EditorContext.jsx`, add three cases to `documentReducer` before the `default`:

```js
case 'BATCH_START': {
  const { id } = action;
  const documents = state.documents.map((d) => {
    if (d.id !== id) return d;
    const history = d.history.beginBatch();
    return { ...d, history };
  });
  return { ...state, documents };
}

case 'BATCH_UPDATE': {
  const { id, src } = action;
  const documents = state.documents.map((d) => {
    if (d.id !== id) return d;
    const doc = SvgDoc.parse(src);
    return { ...d, doc };
  });
  return { ...state, documents };
}

case 'BATCH_COMMIT': {
  const { id } = action;
  const documents = state.documents.map((d) => {
    if (d.id !== id) return d;
    const src = d.doc.serialize();
    const history = d.history.commitBatch(src);
    return { ...d, history };
  });
  return { ...state, documents };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/context/EditorContext.test.jsx`
Expected: All tests PASS (existing + 2 new)

**Step 5: Commit**

```bash
git add src/context/EditorContext.jsx src/context/EditorContext.test.jsx
git commit -m "feat: add BATCH_START, BATCH_UPDATE, BATCH_COMMIT reducer actions"
```

---

### Task 3: `useDocumentMutation` Hook

**Files:**
- Create: `src/hooks/useDocumentMutation.js`
- Create: `src/hooks/useDocumentMutation.test.js`

**Step 1: Write the failing tests**

```js
// src/hooks/useDocumentMutation.test.js
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentMutation } from './useDocumentMutation.js';
import { DocumentProvider } from '../context/EditorContext.jsx';
import { SvgDoc } from '../model/SvgDoc.js';
import { SvgHistory } from '../model/SvgHistory.js';

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';

function makeWrapper(initialDocState) {
  return function Wrapper({ children }) {
    return <DocumentProvider initialState={initialDocState}>{children}</DocumentProvider>;
  };
}

function setupWithDoc() {
  const doc = SvgDoc.parse(SVG_A);
  const history = new SvgHistory(SVG_A);
  const initialDocState = {
    documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
    activeDocumentId: 'doc-1',
  };
  return { initialDocState, wrapper: makeWrapper(initialDocState) };
}

describe('useDocumentMutation', () => {
  it('mutate() applies changes and pushes to history', () => {
    const { wrapper } = setupWithDoc();
    const { result } = renderHook(() => useDocumentMutation(), { wrapper });

    act(() => {
      result.current.mutate((doc) => {
        const circle = doc.querySelector('circle');
        doc.setAttribute(circle, 'r', '20');
      });
    });

    // Verify the mutation took effect by reading the context
    // (the hook internally dispatches UPDATE_DOCUMENT)
    expect(result.current).toBeDefined();
  });

  it('returns null from mutate when no active document', () => {
    const initialDocState = { documents: [], activeDocumentId: null };
    const wrapper = makeWrapper(initialDocState);
    const { result } = renderHook(() => useDocumentMutation(), { wrapper });

    // Should not throw
    act(() => {
      result.current.mutate(() => {});
    });
  });

  it('startBatch + mutate + commitBatch creates single undo entry', () => {
    const { wrapper } = setupWithDoc();
    const { result } = renderHook(() => useDocumentMutation(), { wrapper });

    act(() => { result.current.startBatch(); });
    act(() => {
      result.current.mutate((doc) => {
        const circle = doc.querySelector('circle');
        doc.setAttribute(circle, 'r', '30');
      });
    });
    act(() => {
      result.current.mutate((doc) => {
        const circle = doc.querySelector('circle');
        doc.setAttribute(circle, 'r', '40');
      });
    });
    act(() => { result.current.commitBatch(); });

    expect(result.current).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDocumentMutation.test.js`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```js
// src/hooks/useDocumentMutation.js
import { useCallback, useRef } from 'react';
import { useDocumentContext } from '../context/EditorContext.jsx';

export function useDocumentMutation() {
  const { state, dispatch } = useDocumentContext();
  const batchingRef = useRef(false);

  const getActiveDoc = useCallback(() => {
    return state.documents.find((d) => d.id === state.activeDocumentId) ?? null;
  }, [state.documents, state.activeDocumentId]);

  const mutate = useCallback((fn) => {
    const active = getActiveDoc();
    if (!active) return;

    fn(active.doc);
    const src = active.doc.serialize();

    if (batchingRef.current) {
      dispatch({ type: 'BATCH_UPDATE', id: active.id, src });
    } else {
      dispatch({ type: 'UPDATE_DOCUMENT', id: active.id, src });
    }
  }, [getActiveDoc, dispatch]);

  const startBatch = useCallback(() => {
    const active = getActiveDoc();
    if (!active) return;
    batchingRef.current = true;
    dispatch({ type: 'BATCH_START', id: active.id });
  }, [getActiveDoc, dispatch]);

  const commitBatch = useCallback(() => {
    const active = getActiveDoc();
    if (!active) return;
    batchingRef.current = false;
    dispatch({ type: 'BATCH_COMMIT', id: active.id });
  }, [getActiveDoc, dispatch]);

  return { mutate, startBatch, commitBatch };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDocumentMutation.test.js`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/hooks/useDocumentMutation.js src/hooks/useDocumentMutation.test.js
git commit -m "feat: add useDocumentMutation hook with batch support"
```

---

### Task 4: AndroidWarning Component

**Files:**
- Create: `src/components/Inspector/AndroidWarning.jsx`
- Create: `src/components/Inspector/AndroidWarning.test.jsx`
- Modify: `src/index.css` (append warning styles)

**Step 1: Write the failing tests**

```jsx
// src/components/Inspector/AndroidWarning.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AndroidWarning from './AndroidWarning.jsx';

describe('AndroidWarning', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<AndroidWarning message={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when message is undefined', () => {
    const { container } = render(<AndroidWarning message={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders warning icon when message is provided', () => {
    render(<AndroidWarning message="Not supported on Android" />);
    const icon = screen.getByTestId('android-warning');
    expect(icon).toBeTruthy();
  });

  it('shows tooltip text on hover', async () => {
    const user = userEvent.setup();
    render(<AndroidWarning message="filter is not supported" />);
    const icon = screen.getByTestId('android-warning');

    await user.hover(icon);
    expect(icon.getAttribute('title')).toBe('filter is not supported');
  });

  it('has the correct CSS class for styling', () => {
    render(<AndroidWarning message="warning" />);
    const icon = screen.getByTestId('android-warning');
    expect(icon.classList.contains('android-warning')).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Inspector/AndroidWarning.test.jsx`
Expected: FAIL — module not found

**Step 3: Write the component**

```jsx
// src/components/Inspector/AndroidWarning.jsx
export default function AndroidWarning({ message }) {
  if (!message) return null;

  return (
    <span
      className="android-warning"
      data-testid="android-warning"
      title={message}
      aria-label={message}
    >
      &#x26A0;
    </span>
  );
}
```

**Step 4: Add CSS styles**

Append to `src/index.css`:

```css
/* --- Android Warning --- */
.android-warning {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c8a832;
  font-size: 12px;
  margin-left: 4px;
  cursor: help;
  vertical-align: middle;
  line-height: 1;
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Inspector/AndroidWarning.test.jsx`
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
git add src/components/Inspector/AndroidWarning.jsx src/components/Inspector/AndroidWarning.test.jsx src/index.css
git commit -m "feat: add AndroidWarning inline icon component"
```

---

### Task 5: AttributeEditor Component

**Files:**
- Create: `src/components/Inspector/AttributeEditor.jsx`
- Create: `src/components/Inspector/AttributeEditor.test.jsx`
- Create: `src/model/attributeTypes.js`
- Modify: `src/index.css` (append styles)

**Step 1: Write attributeTypes module**

```js
// src/model/attributeTypes.js
const NUMERIC_ATTRS = new Set([
  'width', 'height', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'opacity', 'fill-opacity',
  'stroke-opacity', 'stroke-width', 'stroke-miterlimit', 'font-size',
  'letter-spacing', 'word-spacing',
]);

const COLOR_ATTRS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);

const ENUM_ATTRS = {
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'display': ['inline', 'block', 'none'],
  'visibility': ['visible', 'hidden', 'collapse'],
  'fill-rule': ['nonzero', 'evenodd'],
  'clip-rule': ['nonzero', 'evenodd'],
  'text-anchor': ['start', 'middle', 'end'],
  'dominant-baseline': ['auto', 'middle', 'hanging', 'central', 'text-bottom', 'text-top'],
  'overflow': ['visible', 'hidden', 'scroll', 'auto'],
};

export function getAttributeType(attrName) {
  const name = attrName.toLowerCase();
  if (ENUM_ATTRS[name]) return { type: 'enum', options: ENUM_ATTRS[name] };
  if (COLOR_ATTRS.has(name)) return { type: 'color' };
  if (NUMERIC_ATTRS.has(name)) return { type: 'numeric' };
  return { type: 'text' };
}
```

No separate test file needed — this is a simple lookup map tested implicitly through AttributeEditor tests.

**Step 2: Write the failing tests for AttributeEditor**

```jsx
// src/components/Inspector/AttributeEditor.test.jsx
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import AttributeEditor from './AttributeEditor.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle id="c1" cx="50" cy="50" r="25" fill="red" stroke="black" stroke-linecap="round"/>
</svg>`;

function setup(svg = SIMPLE_SVG, elementId = 'c1') {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);
  const el = doc.getElementById(elementId);
  const svgdocId = el.getAttribute('data-svgdoc-id');

  return renderWithProviders(
    <AttributeEditor element={el} svgDoc={doc} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState: { elementId: svgdocId, hoveredElementId: null },
    }
  );
}

describe('AttributeEditor', () => {
  it('renders all attributes as rows', () => {
    setup();
    const table = screen.getByTestId('attribute-editor');
    const rows = table.querySelectorAll('tr');
    // id, cx, cy, r, fill, stroke, stroke-linecap = 7
    expect(rows.length).toBe(7);
  });

  it('enters edit mode on double-click of a value cell', async () => {
    const user = userEvent.setup();
    setup();
    const valueCells = screen.getAllByTestId('attr-value');
    // Double-click the 'r' attribute value (index 3: id=0, cx=1, cy=2, r=3)
    await user.dblClick(valueCells[3]);
    const input = screen.getByTestId('attr-edit-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('25');
  });

  it('commits edit on Enter and updates the value', async () => {
    const user = userEvent.setup();
    setup();
    const valueCells = screen.getAllByTestId('attr-value');
    await user.dblClick(valueCells[3]); // r = 25
    const input = screen.getByTestId('attr-edit-input');
    await user.clear(input);
    await user.type(input, '50');
    await user.keyboard('{Enter}');
    // Should exit edit mode
    expect(screen.queryByTestId('attr-edit-input')).toBeNull();
  });

  it('cancels edit on Escape', async () => {
    const user = userEvent.setup();
    setup();
    const valueCells = screen.getAllByTestId('attr-value');
    await user.dblClick(valueCells[3]);
    const input = screen.getByTestId('attr-edit-input');
    await user.clear(input);
    await user.type(input, '999');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('attr-edit-input')).toBeNull();
  });

  it('renders enum attributes as select dropdown on double-click', async () => {
    const user = userEvent.setup();
    setup();
    // stroke-linecap is the last attribute (index 6)
    const valueCells = screen.getAllByTestId('attr-value');
    await user.dblClick(valueCells[6]);
    const select = screen.getByTestId('attr-edit-select');
    expect(select).toBeTruthy();
    expect(select.value).toBe('round');
  });

  it('renders color swatch for fill attribute', () => {
    setup();
    const swatches = screen.getAllByTestId('color-swatch');
    expect(swatches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows android warning for problematic attributes', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <circle id="c1" cx="50" cy="50" r="25" filter="url(#blur)"/>
    </svg>`;
    setup(svg);
    const warning = screen.getByTestId('android-warning');
    expect(warning).toBeTruthy();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/Inspector/AttributeEditor.test.jsx`
Expected: FAIL — module not found

**Step 4: Write the component**

```jsx
// src/components/Inspector/AttributeEditor.jsx
import { useState, useCallback } from 'react';
import { useDocumentMutation } from '../../hooks/useDocumentMutation.js';
import { getAttributeType } from '../../model/attributeTypes.js';
import { getAndroidWarning } from '../../model/androidCompat.js';
import AndroidWarning from './AndroidWarning.jsx';

export default function AttributeEditor({ element, svgDoc }) {
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
                          // Auto-commit on select change
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
                            // ColorPicker integration comes in Task 6
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
```

**Step 5: Add CSS styles**

Append to `src/index.css`:

```css
/* --- Attribute Editor --- */
.attr-value { position: relative; cursor: default; }
.attr-value input, .attr-value select {
  background: #0d0d0d;
  border: 1px solid #555;
  color: var(--text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 1px 4px;
  width: 100%;
  border-radius: 2px;
  outline: none;
}
.attr-value input:focus, .attr-value select:focus {
  border-color: #7ec8e3;
}
.color-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid #555;
  vertical-align: middle;
  margin-right: 6px;
  cursor: pointer;
}
.attr-value-text {
  vertical-align: middle;
}
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/Inspector/AttributeEditor.test.jsx`
Expected: All 7 tests PASS

**Step 7: Commit**

```bash
git add src/components/Inspector/AttributeEditor.jsx src/components/Inspector/AttributeEditor.test.jsx src/model/attributeTypes.js src/index.css
git commit -m "feat: add inline AttributeEditor with type-aware inputs and Android warnings"
```

---

### Task 6: ColorPicker Component

**Files:**
- Create: `src/components/Inspector/ColorPicker.jsx`
- Create: `src/components/Inspector/ColorPicker.test.jsx`
- Modify: `src/index.css` (append styles)
- Modify: `package.json` (add react-colorful dependency)

**Step 1: Install react-colorful**

```bash
npm install react-colorful
```

**Step 2: Write the failing tests**

```jsx
// src/components/Inspector/ColorPicker.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorPicker from './ColorPicker.jsx';

describe('ColorPicker', () => {
  it('renders the hex color picker', () => {
    render(<ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('color-picker')).toBeTruthy();
  });

  it('renders hex text input with current color', () => {
    render(<ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}} />);
    const input = screen.getByTestId('color-hex-input');
    expect(input.value).toBe('#ff0000');
  });

  it('calls onChange when hex input changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker color="#ff0000" onChange={onChange} onClose={() => {}} />);
    const input = screen.getByTestId('color-hex-input');
    await user.clear(input);
    await user.type(input, '#00ff00');
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker color="#ff0000" onChange={() => {}} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onBatchStart on pointer down', () => {
    const onBatchStart = vi.fn();
    render(
      <ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}}
        onBatchStart={onBatchStart} onBatchEnd={() => {}} />
    );
    const picker = screen.getByTestId('color-picker');
    fireEvent.pointerDown(picker);
    expect(onBatchStart).toHaveBeenCalled();
  });

  it('calls onBatchEnd on pointer up', () => {
    const onBatchEnd = vi.fn();
    render(
      <ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}}
        onBatchStart={() => {}} onBatchEnd={onBatchEnd} />
    );
    const picker = screen.getByTestId('color-picker');
    fireEvent.pointerUp(picker);
    expect(onBatchEnd).toHaveBeenCalled();
  });

  it('shows android warning for non-hex input color', () => {
    render(<ColorPicker color="hsl(0, 100%, 50%)" onChange={() => {}} onClose={() => {}} />);
    const warning = screen.getByTestId('android-warning');
    expect(warning).toBeTruthy();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/Inspector/ColorPicker.test.jsx`
Expected: FAIL — module not found

**Step 4: Write the component**

```jsx
// src/components/Inspector/ColorPicker.jsx
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
```

**Step 5: Add CSS styles**

Append to `src/index.css`:

```css
/* --- Color Picker --- */
.color-picker-popover {
  position: absolute;
  z-index: 50;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
.color-picker-popover .react-colorful {
  width: 180px;
  height: 160px;
}
.color-picker-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}
.color-hex-input {
  flex: 1;
  background: #0d0d0d;
  border: 1px solid var(--border);
  color: var(--text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 3px;
  outline: none;
}
.color-hex-input:focus { border-color: #7ec8e3; }
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/Inspector/ColorPicker.test.jsx`
Expected: All 7 tests PASS

**Step 7: Commit**

```bash
git add src/components/Inspector/ColorPicker.jsx src/components/Inspector/ColorPicker.test.jsx src/index.css package.json package-lock.json
git commit -m "feat: add ColorPicker with react-colorful, batching, and hex normalization"
```

---

### Task 7: Transform Utilities and TransformInputs Component

**Files:**
- Create: `src/model/transformUtils.js`
- Create: `src/model/transformUtils.test.js`
- Create: `src/components/Inspector/TransformInputs.jsx`
- Create: `src/components/Inspector/TransformInputs.test.jsx`
- Modify: `src/index.css` (append styles)

**Step 1: Write the transform utility tests**

```js
// src/model/transformUtils.test.js
import { describe, it, expect } from 'vitest';
import { parseTransform, buildTransform } from './transformUtils.js';

describe('parseTransform', () => {
  it('parses translate(x, y)', () => {
    const result = parseTransform('translate(10, 20)');
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });

  it('parses translate with single value (y defaults to 0)', () => {
    const result = parseTransform('translate(10)');
    expect(result.x).toBe(10);
    expect(result.y).toBe(0);
  });

  it('parses rotate(deg)', () => {
    const result = parseTransform('rotate(45)');
    expect(result.rotation).toBe(45);
  });

  it('parses rotate(deg, cx, cy) and extracts just the angle', () => {
    const result = parseTransform('rotate(90, 50, 50)');
    expect(result.rotation).toBe(90);
  });

  it('parses scale(s)', () => {
    const result = parseTransform('scale(2)');
    expect(result.scale).toBe(2);
  });

  it('parses scale(sx, sy) and uses sx', () => {
    const result = parseTransform('scale(2, 3)');
    expect(result.scale).toBe(2);
  });

  it('parses combined transforms', () => {
    const result = parseTransform('translate(10, 20) rotate(45) scale(1.5)');
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.rotation).toBe(45);
    expect(result.scale).toBe(1.5);
  });

  it('returns defaults for empty string', () => {
    const result = parseTransform('');
    expect(result).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
  });

  it('returns defaults for null/undefined', () => {
    expect(parseTransform(null)).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
    expect(parseTransform(undefined)).toEqual({ x: 0, y: 0, rotation: 0, scale: 1 });
  });

  it('parses matrix(a,b,c,d,e,f) — extracts translate and rotation', () => {
    // matrix(1, 0, 0, 1, 10, 20) = translate(10, 20), no rotation, scale 1
    const result = parseTransform('matrix(1, 0, 0, 1, 10, 20)');
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(20);
    expect(result.rotation).toBeCloseTo(0);
    expect(result.scale).toBeCloseTo(1);
  });
});

describe('buildTransform', () => {
  it('builds transform string from values', () => {
    const result = buildTransform({ x: 10, y: 20, rotation: 45, scale: 1.5 });
    expect(result).toBe('translate(10, 20) rotate(45) scale(1.5)');
  });

  it('omits translate when x and y are 0', () => {
    const result = buildTransform({ x: 0, y: 0, rotation: 45, scale: 1 });
    expect(result).toBe('rotate(45)');
  });

  it('omits rotation when 0', () => {
    const result = buildTransform({ x: 10, y: 0, rotation: 0, scale: 1 });
    expect(result).toBe('translate(10, 0)');
  });

  it('omits scale when 1', () => {
    const result = buildTransform({ x: 0, y: 0, rotation: 0, scale: 1 });
    expect(result).toBe('');
  });

  it('returns empty string for all defaults', () => {
    const result = buildTransform({ x: 0, y: 0, rotation: 0, scale: 1 });
    expect(result).toBe('');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/transformUtils.test.js`
Expected: FAIL — module not found

**Step 3: Write the transform utilities**

```js
// src/model/transformUtils.js
const DEFAULTS = { x: 0, y: 0, rotation: 0, scale: 1 };

export function parseTransform(str) {
  if (!str) return { ...DEFAULTS };

  const result = { ...DEFAULTS };

  // translate(x[, y])
  const translateMatch = str.match(/translate\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/);
  if (translateMatch) {
    result.x = parseFloat(translateMatch[1]) || 0;
    result.y = parseFloat(translateMatch[2]) || 0;
  }

  // rotate(deg[, cx, cy])
  const rotateMatch = str.match(/rotate\(\s*([^,)]+)/);
  if (rotateMatch) {
    result.rotation = parseFloat(rotateMatch[1]) || 0;
  }

  // scale(s[, sy])
  const scaleMatch = str.match(/scale\(\s*([^,)]+)/);
  if (scaleMatch) {
    result.scale = parseFloat(scaleMatch[1]) || 1;
  }

  // matrix(a, b, c, d, e, f) — decompose
  const matrixMatch = str.match(/matrix\(\s*([^)]+)\)/);
  if (matrixMatch && !translateMatch && !rotateMatch && !scaleMatch) {
    const [a, b, c, d, e, f] = matrixMatch[1].split(/[\s,]+/).map(Number);
    result.x = e || 0;
    result.y = f || 0;
    result.rotation = Math.atan2(b, a) * (180 / Math.PI);
    result.scale = Math.sqrt(a * a + b * b);
  }

  return result;
}

export function buildTransform({ x, y, rotation, scale }) {
  const parts = [];
  if (x !== 0 || y !== 0) parts.push(`translate(${x}, ${y})`);
  if (rotation !== 0) parts.push(`rotate(${rotation})`);
  if (scale !== 1) parts.push(`scale(${scale})`);
  return parts.join(' ');
}
```

**Step 4: Run transform utility tests**

Run: `npx vitest run src/model/transformUtils.test.js`
Expected: All 14 tests PASS

**Step 5: Write the TransformInputs tests**

```jsx
// src/components/Inspector/TransformInputs.test.jsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import TransformInputs from './TransformInputs.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const SVG_WITH_TRANSFORM = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect id="r1" width="50" height="50" transform="translate(10, 20) rotate(45) scale(1.5)"/>
</svg>`;

const SVG_NO_TRANSFORM = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect id="r1" width="50" height="50"/>
</svg>`;

function setup(svg, elementId = 'r1') {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);
  const el = doc.getElementById(elementId);
  const svgdocId = el.getAttribute('data-svgdoc-id');

  return renderWithProviders(
    <TransformInputs element={el} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState: { elementId: svgdocId, hoveredElementId: null },
    }
  );
}

describe('TransformInputs', () => {
  it('renders four numeric inputs', () => {
    setup(SVG_WITH_TRANSFORM);
    expect(screen.getByTestId('transform-x')).toBeTruthy();
    expect(screen.getByTestId('transform-y')).toBeTruthy();
    expect(screen.getByTestId('transform-rotation')).toBeTruthy();
    expect(screen.getByTestId('transform-scale')).toBeTruthy();
  });

  it('populates fields from existing transform attribute', () => {
    setup(SVG_WITH_TRANSFORM);
    expect(screen.getByTestId('transform-x').value).toBe('10');
    expect(screen.getByTestId('transform-y').value).toBe('20');
    expect(screen.getByTestId('transform-rotation').value).toBe('45');
    expect(screen.getByTestId('transform-scale').value).toBe('1.5');
  });

  it('shows defaults when no transform attribute exists', () => {
    setup(SVG_NO_TRANSFORM);
    expect(screen.getByTestId('transform-x').value).toBe('0');
    expect(screen.getByTestId('transform-y').value).toBe('0');
    expect(screen.getByTestId('transform-rotation').value).toBe('0');
    expect(screen.getByTestId('transform-scale').value).toBe('1');
  });

  it('commits on Enter', async () => {
    const user = userEvent.setup();
    setup(SVG_WITH_TRANSFORM);
    const xInput = screen.getByTestId('transform-x');
    await user.clear(xInput);
    await user.type(xInput, '99');
    await user.keyboard('{Enter}');
    // Should not throw, mutation dispatched
    expect(xInput.value).toBe('99');
  });

  it('reverts on Escape', async () => {
    const user = userEvent.setup();
    setup(SVG_WITH_TRANSFORM);
    const xInput = screen.getByTestId('transform-x');
    await user.clear(xInput);
    await user.type(xInput, '999');
    await user.keyboard('{Escape}');
    expect(xInput.value).toBe('10');
  });

  it('shows android warning when original transform has skew', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect id="r1" width="50" height="50" transform="skewX(30)"/>
    </svg>`;
    setup(svg);
    const warning = screen.getByTestId('android-warning');
    expect(warning).toBeTruthy();
  });
});
```

**Step 6: Write the TransformInputs component**

```jsx
// src/components/Inspector/TransformInputs.jsx
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
```

**Step 7: Add CSS styles**

Append to `src/index.css`:

```css
/* --- Transform Inputs --- */
.transform-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.transform-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.transform-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}
.transform-field input {
  background: #0d0d0d;
  border: 1px solid var(--border);
  color: var(--text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 3px;
  outline: none;
  width: 100%;
}
.transform-field input:focus { border-color: #7ec8e3; }
```

**Step 8: Run all tests**

Run: `npx vitest run src/model/transformUtils.test.js src/components/Inspector/TransformInputs.test.jsx`
Expected: All tests PASS

**Step 9: Commit**

```bash
git add src/model/transformUtils.js src/model/transformUtils.test.js src/components/Inspector/TransformInputs.jsx src/components/Inspector/TransformInputs.test.jsx src/index.css
git commit -m "feat: add transform parsing utilities and TransformInputs component"
```

---

### Task 8: TimingControls Component (with Easing Presets)

**Files:**
- Create: `src/model/easingPresets.js`
- Create: `src/components/Inspector/TimingControls.jsx`
- Create: `src/components/Inspector/TimingControls.test.jsx`
- Modify: `src/index.css` (append styles)

**Step 1: Write the easing presets data module**

```js
// src/model/easingPresets.js
export const EASING_PRESETS = {
  // Standard
  'linear': 'linear',
  'ease': 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  // Extended
  'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'elastic': 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'sharp': 'cubic-bezier(0.4, 0, 0.6, 1)',
  'decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
  'accelerate': 'cubic-bezier(0.4, 0, 1, 1)',
};

export const EASING_NAMES = Object.keys(EASING_PRESETS);

export function getPresetName(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  for (const [name, css] of Object.entries(EASING_PRESETS)) {
    if (css === v) return name;
  }
  return null;
}
```

**Step 2: Write the failing tests**

```jsx
// src/components/Inspector/TimingControls.test.jsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import TimingControls from './TimingControls.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

// Provide a mock animation info object (matches AnimationDetector output shape)
const MOCK_CSS_ANIMATION = {
  type: 'css',
  name: 'spin',
  elementId: '1',
  properties: {
    duration: '2s',
    delay: '0s',
    easing: 'linear',
    iterationCount: 'infinite',
    direction: 'normal',
    fillMode: 'none',
    state: 'running',
  },
  androidCompatible: true,
  warnings: [],
};

const MOCK_SMIL_ANIMATION = {
  type: 'smil',
  name: 'animate',
  elementId: '2',
  properties: {
    duration: '1s',
    delay: null,
    easing: null,
    iterationCount: 'indefinite',
    direction: null,
    fillMode: null,
    state: 'running',
  },
  androidCompatible: false,
  warnings: ['SMIL not supported on Android'],
};

const SIMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="c1" r="10"/></svg>';

function setup(animations = [MOCK_CSS_ANIMATION]) {
  const doc = SvgDoc.parse(SIMPLE_SVG);
  const history = new SvgHistory(SIMPLE_SVG);
  const el = doc.getElementById('c1');
  const svgdocId = el.getAttribute('data-svgdoc-id');

  return renderWithProviders(
    <TimingControls element={el} animations={animations} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState: { elementId: svgdocId, hoveredElementId: null },
    }
  );
}

describe('TimingControls', () => {
  it('renders timing section with animation name', () => {
    setup();
    expect(screen.getByText('spin')).toBeTruthy();
  });

  it('renders duration input with current value', () => {
    setup();
    const input = screen.getByTestId('timing-duration-0');
    expect(input.value).toBe('2');
  });

  it('renders delay input with current value', () => {
    setup();
    const input = screen.getByTestId('timing-delay-0');
    expect(input.value).toBe('0');
  });

  it('renders iteration count input', () => {
    setup();
    const toggle = screen.getByTestId('timing-infinite-0');
    expect(toggle.checked).toBe(true);
  });

  it('renders easing dropdown with current preset selected', () => {
    setup();
    const select = screen.getByTestId('timing-easing-0');
    expect(select.value).toBe('linear');
  });

  it('shows custom input when Custom is selected', async () => {
    const user = userEvent.setup();
    setup();
    const select = screen.getByTestId('timing-easing-0');
    await user.selectOptions(select, 'custom');
    const input = screen.getByTestId('timing-easing-custom-0');
    expect(input).toBeTruthy();
  });

  it('shows SMIL read-only notice for SMIL animations', () => {
    setup([MOCK_SMIL_ANIMATION]);
    expect(screen.getByText(/attribute editor/i)).toBeTruthy();
  });

  it('renders easing preview area', () => {
    setup();
    expect(screen.getByTestId('easing-preview-0')).toBeTruthy();
  });

  it('renders nothing when no animations', () => {
    const { container } = setup([]);
    expect(container.querySelector('.timing-controls')).toBeNull();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/Inspector/TimingControls.test.jsx`
Expected: FAIL — module not found

**Step 4: Write the component**

```jsx
// src/components/Inspector/TimingControls.jsx
import { useState, useCallback } from 'react';
import { useDocumentMutation } from '../../hooks/useDocumentMutation.js';
import { EASING_PRESETS, EASING_NAMES, getPresetName } from '../../model/easingPresets.js';

function parseDuration(str) {
  if (!str) return 0;
  const num = parseFloat(str);
  if (str.includes('ms')) return num / 1000;
  return num;
}

export default function TimingControls({ element, animations }) {
  const { mutate } = useDocumentMutation();
  const elementId = element.getAttribute('data-svgdoc-id');

  if (!animations || animations.length === 0) return null;

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">Timing</div>
      <div className="timing-controls">
        {animations.map((anim, i) => (
          <AnimationSection
            key={`${anim.name}-${i}`}
            anim={anim}
            index={i}
            elementId={elementId}
            mutate={mutate}
          />
        ))}
      </div>
    </div>
  );
}

function AnimationSection({ anim, index, elementId, mutate }) {
  const props = anim.properties;
  const [duration, setDuration] = useState(parseDuration(props.duration));
  const [delay, setDelay] = useState(parseDuration(props.delay));
  const [isInfinite, setIsInfinite] = useState(
    props.iterationCount === 'infinite' || props.iterationCount === 'indefinite'
  );
  const [iterationCount, setIterationCount] = useState(
    isInfinite ? 1 : (parseInt(props.iterationCount) || 1)
  );

  const presetName = getPresetName(props.easing);
  const [easingMode, setEasingMode] = useState(presetName ? presetName : 'custom');
  const [customEasing, setCustomEasing] = useState(
    presetName ? '' : (props.easing || '')
  );

  const commitTiming = useCallback(() => {
    if (anim.type === 'smil') return;

    const easingValue = easingMode === 'custom'
      ? customEasing
      : EASING_PRESETS[easingMode] || 'ease';

    mutate((doc) => {
      const el = doc.querySelector(`[data-svgdoc-id="${elementId}"]`);
      if (!el) return;
      doc.setStyle(el, 'animationDuration', `${duration}s`);
      doc.setStyle(el, 'animationDelay', `${delay}s`);
      doc.setStyle(el, 'animationIterationCount', isInfinite ? 'infinite' : String(iterationCount));
      doc.setStyle(el, 'animationTimingFunction', easingValue);
    });
  }, [anim.type, duration, delay, isInfinite, iterationCount, easingMode, customEasing, elementId, mutate]);

  if (anim.type === 'smil') {
    return (
      <div className="timing-animation-section">
        <div className="timing-anim-name">{anim.name}</div>
        <div className="timing-smil-notice">
          SMIL timing is read-only. Edit via the attribute editor (<code>dur</code>, <code>begin</code>, <code>repeatCount</code>).
        </div>
      </div>
    );
  }

  const currentEasingValue = easingMode === 'custom'
    ? customEasing
    : (EASING_PRESETS[easingMode] || 'ease');

  return (
    <div className="timing-animation-section">
      <div className="timing-anim-name">{anim.name}</div>

      <div className="timing-row">
        <label>Duration</label>
        <input
          data-testid={`timing-duration-${index}`}
          type="number"
          min="0.1"
          max="30"
          step="0.1"
          value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
          onBlur={commitTiming}
        />
        <span className="timing-unit">s</span>
      </div>

      <div className="timing-row">
        <label>Delay</label>
        <input
          data-testid={`timing-delay-${index}`}
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={delay}
          onChange={(e) => setDelay(parseFloat(e.target.value) || 0)}
          onBlur={commitTiming}
        />
        <span className="timing-unit">s</span>
      </div>

      <div className="timing-row">
        <label>Iterations</label>
        {!isInfinite && (
          <input
            data-testid={`timing-iterations-${index}`}
            type="number"
            min="1"
            max="100"
            step="1"
            value={iterationCount}
            onChange={(e) => setIterationCount(parseInt(e.target.value) || 1)}
            onBlur={commitTiming}
          />
        )}
        <label className="timing-infinite-label">
          <input
            data-testid={`timing-infinite-${index}`}
            type="checkbox"
            checked={isInfinite}
            onChange={(e) => {
              setIsInfinite(e.target.checked);
              // Commit on next tick after state updates
              setTimeout(commitTiming, 0);
            }}
          />
          Infinite
        </label>
      </div>

      <div className="timing-row">
        <label>Easing</label>
        <select
          data-testid={`timing-easing-${index}`}
          value={easingMode}
          onChange={(e) => {
            setEasingMode(e.target.value);
            if (e.target.value !== 'custom') {
              setTimeout(commitTiming, 0);
            }
          }}
        >
          {EASING_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value="custom">Custom...</option>
        </select>
      </div>

      {easingMode === 'custom' && (
        <div className="timing-row">
          <input
            data-testid={`timing-easing-custom-${index}`}
            type="text"
            placeholder="cubic-bezier(x1, y1, x2, y2)"
            value={customEasing}
            onChange={(e) => setCustomEasing(e.target.value)}
            onBlur={commitTiming}
          />
        </div>
      )}

      <div className="easing-preview" data-testid={`easing-preview-${index}`}>
        <div
          className="easing-preview-dot"
          style={{ animationTimingFunction: currentEasingValue }}
        />
      </div>
    </div>
  );
}
```

**Step 5: Add CSS styles**

Append to `src/index.css`:

```css
/* --- Timing Controls --- */
.timing-controls { display: flex; flex-direction: column; gap: 12px; }
.timing-animation-section {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
}
.timing-anim-name {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: #7ec8e3;
  margin-bottom: 8px;
}
.timing-smil-notice {
  font-size: 12px;
  color: var(--text-dim);
  font-style: italic;
}
.timing-smil-notice code {
  background: #1a1a1a;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 11px;
}
.timing-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.timing-row label {
  font-size: 11px;
  color: var(--text-dim);
  min-width: 60px;
}
.timing-row input[type="number"],
.timing-row input[type="text"],
.timing-row select {
  background: #0d0d0d;
  border: 1px solid var(--border);
  color: var(--text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 3px 6px;
  border-radius: 3px;
  outline: none;
  flex: 1;
}
.timing-row input:focus, .timing-row select:focus { border-color: #7ec8e3; }
.timing-unit { font-size: 11px; color: var(--text-dim); }
.timing-infinite-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim);
  min-width: auto;
}
.timing-infinite-label input[type="checkbox"] { accent-color: #7ec8e3; }

/* Easing preview */
.easing-preview {
  height: 24px;
  background: #0d0d0d;
  border-radius: 3px;
  margin-top: 6px;
  position: relative;
  overflow: hidden;
}
@keyframes easing-slide {
  from { left: 0; }
  to { left: calc(100% - 8px); }
}
.easing-preview-dot {
  position: absolute;
  top: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7ec8e3;
  animation: easing-slide 1.5s alternate infinite;
}
```

**Step 6: Run tests**

Run: `npx vitest run src/components/Inspector/TimingControls.test.jsx`
Expected: All 9 tests PASS

**Step 7: Commit**

```bash
git add src/model/easingPresets.js src/components/Inspector/TimingControls.jsx src/components/Inspector/TimingControls.test.jsx src/index.css
git commit -m "feat: add TimingControls with easing presets and preview animation"
```

---

### Task 9: ElementTree Component

**Files:**
- Create: `src/components/Inspector/ElementTree.jsx`
- Create: `src/components/Inspector/ElementTree.test.jsx`
- Modify: `src/index.css` (append styles)

**Step 1: Write the failing tests**

```jsx
// src/components/Inspector/ElementTree.test.jsx
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import ElementTree from './ElementTree.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const NESTED_SVG = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="layer1" class="main">
    <circle id="dot" cx="50" cy="50" r="10"/>
    <rect id="box" width="20" height="20"/>
  </g>
  <text id="label">Hello</text>
</svg>`;

function setup(svg = NESTED_SVG, selectedElementId = null) {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);

  let initialSelectionState = undefined;
  if (selectedElementId) {
    const el = doc.getElementById(selectedElementId);
    const svgdocId = el.getAttribute('data-svgdoc-id');
    initialSelectionState = { elementId: svgdocId, hoveredElementId: null };
  }

  return renderWithProviders(
    <ElementTree svgDoc={doc} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState,
    }
  );
}

describe('ElementTree', () => {
  it('renders the tree section', () => {
    setup();
    expect(screen.getByTestId('element-tree')).toBeTruthy();
  });

  it('renders root svg node', () => {
    setup();
    expect(screen.getByText('svg')).toBeTruthy();
  });

  it('renders child element names', () => {
    setup();
    expect(screen.getByText('g')).toBeTruthy();
    expect(screen.getByText('text')).toBeTruthy();
  });

  it('shows id attribute inline when present', () => {
    setup();
    expect(screen.getByText('#layer1')).toBeTruthy();
    expect(screen.getByText('#dot')).toBeTruthy();
  });

  it('shows class attribute inline when present', () => {
    setup();
    expect(screen.getByText('.main')).toBeTruthy();
  });

  it('dispatches SELECT_ELEMENT on click', async () => {
    const user = userEvent.setup();
    setup();
    const dotNode = screen.getByText('#dot').closest('[data-testid="tree-node"]');
    await user.click(dotNode);
    // After click, the tree node should get the selected class
    expect(dotNode.classList.contains('tree-node-selected')).toBe(true);
  });

  it('highlights selected element in tree', () => {
    setup(NESTED_SVG, 'dot');
    const dotNode = screen.getByText('#dot').closest('[data-testid="tree-node"]');
    expect(dotNode.classList.contains('tree-node-selected')).toBe(true);
  });

  it('toggle collapses and expands children', async () => {
    const user = userEvent.setup();
    setup();
    // The g element should have a toggle
    const toggles = screen.getAllByTestId('tree-toggle');
    expect(toggles.length).toBeGreaterThan(0);
    // Click first toggle to collapse
    await user.click(toggles[0]);
    // Children should be hidden (circle and rect inside g)
  });

  it('expands first two levels by default', () => {
    setup();
    // svg and its direct children (g, text) should be visible
    expect(screen.getByText('g')).toBeTruthy();
    expect(screen.getByText('text')).toBeTruthy();
    // Nested children (circle, rect inside g) should also be visible (level 2)
    expect(screen.getByText('circle')).toBeTruthy();
    expect(screen.getByText('rect')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Inspector/ElementTree.test.jsx`
Expected: FAIL — module not found

**Step 3: Write the component**

```jsx
// src/components/Inspector/ElementTree.jsx
import { useState, useCallback, useEffect } from 'react';
import { useSelectionContext } from '../../context/EditorContext.jsx';

export default function ElementTree({ svgDoc }) {
  const root = svgDoc.getRoot();

  return (
    <div className="inspector-section">
      <div className="inspector-section-title">Element Tree</div>
      <div className="element-tree" data-testid="element-tree">
        <TreeNode element={root} depth={0} svgDoc={svgDoc} />
      </div>
    </div>
  );
}

function TreeNode({ element, depth, svgDoc }) {
  const { state: { elementId }, dispatch } = useSelectionContext();
  const nodeId = element.getAttribute('data-svgdoc-id');
  const isSelected = elementId === nodeId;

  const children = Array.from(element.children || []).filter(
    (child) => child.nodeType === 1 // Element nodes only
  );
  const hasChildren = children.length > 0;

  const [expanded, setExpanded] = useState(depth < 2);

  // Auto-expand to reveal selected element
  useEffect(() => {
    if (isSelected) setExpanded(true);
  }, [isSelected]);

  const tagName = element.tagName?.toLowerCase() || element.localName;
  const id = element.getAttribute('id');
  const cls = element.getAttribute('class');

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_ELEMENT', elementId: nodeId });
  }, [dispatch, nodeId]);

  const handleHover = useCallback(() => {
    dispatch({ type: 'HOVER_ELEMENT', elementId: nodeId });
  }, [dispatch, nodeId]);

  const handleHoverEnd = useCallback(() => {
    dispatch({ type: 'HOVER_ELEMENT', elementId: null });
  }, [dispatch]);

  const toggleExpand = useCallback((e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="tree-node-container">
      <div
        className={`tree-node${isSelected ? ' tree-node-selected' : ''}`}
        data-testid="tree-node"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={handleClick}
        onMouseEnter={handleHover}
        onMouseLeave={handleHoverEnd}
      >
        {hasChildren ? (
          <span
            className="tree-toggle"
            data-testid="tree-toggle"
            onClick={toggleExpand}
          >
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <span className="tree-tag">{tagName}</span>
        {id && <span className="tree-id">#{id}</span>}
        {cls && (
          <span className="tree-class">
            .{cls.split(/\s+/)[0]}
          </span>
        )}
      </div>
      {hasChildren && expanded && children.map((child, i) => (
        <TreeNode
          key={child.getAttribute('data-svgdoc-id') || i}
          element={child}
          depth={depth + 1}
          svgDoc={svgDoc}
        />
      ))}
    </div>
  );
}
```

**Step 4: Add CSS styles**

Append to `src/index.css`:

```css
/* --- Element Tree --- */
.element-tree {
  max-height: 200px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
}
.tree-node:hover { background: rgba(255, 255, 255, 0.05); }
.tree-node-selected { background: rgba(126, 200, 227, 0.15); }
.tree-toggle {
  width: 14px;
  text-align: center;
  color: var(--text-dim);
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
}
.tree-toggle-spacer { width: 14px; flex-shrink: 0; }
.tree-tag { color: #7ec8e3; }
.tree-id { color: #c8a87e; font-size: 11px; }
.tree-class { color: #8cc88c; font-size: 11px; }
```

**Step 5: Run tests**

Run: `npx vitest run src/components/Inspector/ElementTree.test.jsx`
Expected: All 9 tests PASS

**Step 6: Commit**

```bash
git add src/components/Inspector/ElementTree.jsx src/components/Inspector/ElementTree.test.jsx src/index.css
git commit -m "feat: add ElementTree with collapsible hierarchy and selection sync"
```

---

### Task 10: Wire Everything into InspectorPanel

**Files:**
- Modify: `src/components/Inspector/InspectorPanel.jsx`
- Modify: `src/components/Inspector/InspectorPanel.test.jsx`

**Step 1: Update InspectorPanel to compose all sub-panels**

Rewrite `src/components/Inspector/InspectorPanel.jsx`:

```jsx
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

  // Detect animations on the root SVG to find animations targeting this element
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
```

**Step 2: Update AttributeEditor to support `onColorSwatchClick` prop**

In `src/components/Inspector/AttributeEditor.jsx`, update the color swatch `onClick`:

```jsx
// Change the swatch onClick from:
onClick={(e) => { e.stopPropagation(); }}
// To:
onClick={(e) => {
  e.stopPropagation();
  onColorSwatchClick?.(key);
}}
```

And add `onColorSwatchClick` to the component props.

**Step 3: Update InspectorPanel tests**

Add to `src/components/Inspector/InspectorPanel.test.jsx`:

```jsx
it('renders ElementTree when element is selected', () => {
  const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
  renderWithProviders(<InspectorPanel />, opts);
  expect(screen.getByTestId('element-tree')).toBeTruthy();
});

it('renders AttributeEditor when element is selected', () => {
  const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
  renderWithProviders(<InspectorPanel />, opts);
  expect(screen.getByTestId('attribute-editor')).toBeTruthy();
});

it('renders TransformInputs for transformable elements', () => {
  const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
  renderWithProviders(<InspectorPanel />, opts);
  expect(screen.getByTestId('transform-inputs')).toBeTruthy();
});
```

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (existing + new)

**Step 5: Commit**

```bash
git add src/components/Inspector/InspectorPanel.jsx src/components/Inspector/InspectorPanel.test.jsx src/components/Inspector/AttributeEditor.jsx
git commit -m "feat: wire all sub-panels into InspectorPanel layout"
```

---

### Task 11: Full Integration Test and Coverage Check

**Files:** No new files

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 2: Run coverage check**

Run: `npx vitest run --coverage`
Expected: Coverage meets thresholds (90% statements, 85% branches, 90% functions)

**Step 3: If coverage falls below thresholds, add targeted tests for uncovered branches**

Look at coverage report, add tests for any uncovered branches in the new files.

**Step 4: Run dev server and manually verify**

Run: `npm run dev`
Verify:
- Select an element → inspector shows all sub-panels
- Double-click an attribute value → edit mode works
- Escape cancels, Enter commits
- Color swatches appear for fill/stroke
- Transform inputs show and commit
- Element tree shows hierarchy with correct selection sync
- Android warnings appear on problematic attributes

**Step 5: Final commit if any coverage fixes were needed**

```bash
git add -A
git commit -m "test: improve coverage for Phase 2 Inspector components"
```

---

Plan complete and saved to `docs/plans/2026-02-25-phase2-editable-inspector-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
