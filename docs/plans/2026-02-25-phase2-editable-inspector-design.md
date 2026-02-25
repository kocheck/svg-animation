# Phase 2 — Editable Inspector Design

> Turn the read-only Inspector into a full editing suite with inline attribute editing, color picking, transform inputs, animation timing controls, an element tree, and Android compatibility warnings.

---

## Approach

**Composable Inspector with Shared Mutation Hook.** The inspector is split into focused sub-panels that each live in their own file under `src/components/Inspector/`. A single `useDocumentMutation` hook centralizes the mutate → serialize → push-to-history → dispatch cycle, shared by all editing components.

**Why this approach:**
- Each sub-panel is independently testable and focused
- Mutation logic centralized — no duplication across editors
- Clean re-render boundaries
- Matches Phase 1 architecture (focused components, focused contexts)

---

## Architecture & File Structure

### New Hook: `useDocumentMutation`

```js
function useDocumentMutation() → { mutate, startBatch, commitBatch }
```

- `mutate(fn)` — receives the active `SvgDoc`, applies changes, serializes, pushes to history, dispatches `UPDATE_DOCUMENT`
- `startBatch()` — begins a batch (for live dragging); preview updates without pushing to history
- `commitBatch()` — finalizes the batch as a single undo entry

### New Reducer Actions

| Action | Purpose |
|---|---|
| `BATCH_START` | Calls `history.beginBatch()`, stores batch anchor |
| `BATCH_UPDATE` | Updates doc preview without pushing to history stack |
| `BATCH_COMMIT` | Calls `history.commitBatch(src)`, single undo entry |

### New Files

```
src/
├── hooks/
│   ├── useDocumentMutation.js
│   └── useDocumentMutation.test.js
│
├── components/Inspector/
│   ├── InspectorPanel.jsx              # Refactored — layout shell for sub-panels
│   ├── AttributeEditor.jsx             # P2-1
│   ├── AttributeEditor.test.jsx
│   ├── ColorPicker.jsx                 # P2-2
│   ├── ColorPicker.test.jsx
│   ├── TransformInputs.jsx             # P2-3
│   ├── TransformInputs.test.jsx
│   ├── TimingControls.jsx              # P2-4 + P2-6
│   ├── TimingControls.test.jsx
│   ├── ElementTree.jsx                 # P2-5
│   ├── ElementTree.test.jsx
│   ├── AndroidWarning.jsx              # Inline warning icon
│   └── AndroidWarning.test.jsx
│
├── model/
│   ├── androidCompat.js                # Pure data: attribute → warning map
│   └── androidCompat.test.js
```

### Inspector Layout Order

`InspectorPanel` renders sub-panels in this order:
1. Header (tag, id, classes — unchanged)
2. `ElementTree` (collapsible DOM hierarchy)
3. `AttributeEditor` (editable attribute table)
4. `ColorPicker` (shown when element has fill/stroke)
5. `TransformInputs` (shown when element is a shape/group)
6. `TimingControls` (shown when element has animations)
7. Parent chain breadcrumb (unchanged)

---

## P2-1: Inline Attribute Editor

### Interaction

- Each attribute row shows `key: value` as today
- Double-click a value cell → swaps to `<input>` pre-filled with current value
- **Enter** or **blur** commits via `useDocumentMutation`
- **Escape** cancels, restores original value
- Only one attribute editable at a time

### Attribute Type Awareness

| Attribute type | Behavior |
|---|---|
| Numeric (`width`, `height`, `r`, `cx`, `opacity`, etc.) | Validate as number on commit |
| Color (`fill`, `stroke`) | Show color swatch; clicking opens ColorPicker |
| Enum (`stroke-linecap`, `stroke-linejoin`, `display`, `visibility`) | `<select>` dropdown with valid values |
| General (everything else) | Plain text input |

A lookup map (`attributeTypeMap`) classifies known SVG attributes into these categories.

### Android Warnings

Each row checks `androidCompat.getAndroidWarning(key, value)`. If a warning exists, an `<AndroidWarning>` icon appears inline next to the value.

---

## P2-2: Color Picker

### Trigger

When the selected element has `fill` or `stroke`, the `AttributeEditor` renders a small color swatch next to those values. Clicking the swatch opens a `ColorPicker` popover positioned below.

### Component

- Uses `react-colorful`'s `HexColorPicker` (~2KB gzipped)
- Hex text input below the picker for direct entry
- Both `fill` and `stroke` get separate swatches if both present
- Click outside or Escape closes the popover

### Live Preview with Batching

- `pointerdown` on picker container → `startBatch()`
- `onChange` (continuous drag) → `mutate()` updates preview, debounced at 16ms
- `pointerup` → `commitBatch()` creates single undo entry

`react-colorful` doesn't expose `onChangeStart`/`onChangeEnd` — we attach `pointerdown`/`pointerup` listeners on the picker container via a ref.

### Color Normalization

All output normalized to `#RRGGBB` hex. Input SVGs with `rgb()`, `hsl()`, or named colors are read via a canvas-based parser and output as hex. Android warning shown on the original value if non-hex.

---

## P2-3: Transform Inputs

### Display

A "Transform" section shown when the selected element has a `transform` attribute or is a transformable element (shapes, groups, `<g>`, `<use>`).

| Field | Maps to | Default |
|---|---|---|
| X | `translate(x, ...)` | 0 |
| Y | `translate(..., y)` | 0 |
| Rotation | `rotate(deg)` | 0 |
| Scale | `scale(s)` | 1 |

### Parsing

A utility function `parseTransform(transformString)` extracts values from the element's `transform` attribute. Handles `translate()`, `rotate()`, `scale()`, and `matrix()` (decomposed).

### Writing

On commit, rebuilds the `transform` string from the four fields: `translate(x, y) rotate(deg) scale(s)`. The original format is not preserved — deliberate simplification.

### Interaction

- Numeric `<input>` fields with step buttons
- **Enter** or **blur** commits via `useDocumentMutation`
- **Escape** reverts
- Android warning on `skewX`/`skewY` if original transform contained them

---

## P2-4 + P2-6: Animation Timing Controls with Easing Presets

### Display

A "Timing" section shown when the selected element has CSS animations (detected by `AnimationDetector`). Multiple animations get separate collapsible sub-sections labeled by name.

### Controls

| Control | Input type | Range |
|---|---|---|
| Duration | Numeric + range slider | 0.1s – 30s, step 0.1 |
| Delay | Numeric + range slider | 0s – 10s, step 0.1 |
| Iteration count | Numeric + "infinite" toggle | 1 – 100, or `infinite` |
| Timing function | Dropdown + text input | Presets or custom `cubic-bezier(...)` |

### Easing Presets (P2-6 Integrated)

The dropdown includes:

- **Standard:** `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`
- **Extended:** `bounce`, `elastic`, `smooth`, and more from a JSON presets map
- **Custom:** selecting "Custom..." switches to a text input for `cubic-bezier(x1,y1,x2,y2)`

Below the dropdown, a single **easing preview** — a dot animating along a horizontal track using the selected easing. Updates live on selection change.

### Mutation Strategy

CSS animation timing always writes to the element's **inline `style` attribute**, which overrides stylesheet rules. Avoids the complexity of parsing/rewriting `<style>` blocks.

### SMIL

SMIL timing shows as read-only with a note: "Edit SMIL timing via the attribute editor (`dur`, `begin`, `repeatCount`)."

---

## P2-5: Element Tree

### Display

Collapsible section at the top of the inspector. Shows the SVG's DOM hierarchy as an indented tree.

```
▸ <g id="layer1" class="main">
    ▸ <circle id="dot" fill="#ff0000">
    ▾ <rect width="100" height="50">
      <animate attributeName="x" ...>
```

- Tag name in monospace (`#7ec8e3`)
- `id` and `class` shown inline, truncated if long
- Collapse/expand toggle for elements with children

### Interactions

- **Click** → `SELECT_ELEMENT` dispatch (same as clicking in SVG preview)
- **Hover** → `HOVER_ELEMENT` dispatch (triggers `SelectionOverlay` highlight)
- **Selected node** gets background highlight
- **Auto-expand** to reveal selected element when selection changes externally

### Default State

Collapsed by default. First two levels (root `<svg>` and direct children) expanded on initial render.

### Data Source

Walks `SvgDoc.getRoot()` recursively. Filters out text nodes and `data-svgdoc-id` from display.

---

## Android Compatibility Warnings

### Data Model

`androidCompat.js` exports a pure function:

```js
getAndroidWarning(attrName: string, attrValue?: string): string | null
```

### Warning Rules

| Pattern | Warning |
|---|---|
| `filter` | "filter is not supported on Android WebView" |
| `mask` | "mask has limited Android support" |
| `clip-path` with `url()` | "Complex clip-path may not render on Android" |
| `fill`/`stroke` with `hsl()`, `oklch()`, `currentColor`, non-SVG 1.1 named colors | "Use #RRGGBB hex for Android compatibility" |
| `transform` with `skewX`/`skewY` | "skew transforms not supported on all Android renderers" |
| `font-family` with custom/web fonts | "Custom fonts may not load on Android" |

### `AndroidWarning` Component

Inline `⚠` icon (CSS-styled, not emoji) next to attribute values. Hover shows tooltip with warning text. Uses `#c8a832` (muted amber).

### Integration

- `AttributeEditor` calls `getAndroidWarning(key, value)` per row
- `ColorPicker` calls it when input color was non-hex
- `TransformInputs` calls it if original transform had skew

---

## Dependencies

- **New:** `react-colorful` (~2KB gzipped) for the color picker
- **No other new dependencies**

## Key Decisions

1. All mutations flow through `useDocumentMutation` — no direct SvgDoc manipulation in components
2. Batch API for color picker prevents undo spam during live dragging
3. Transform editing uses canonical form (`translate/rotate/scale`), does not preserve original format
4. CSS animation timing always writes to inline style, overriding stylesheet rules
5. Android warnings are inline per-attribute, not section-level
6. SMIL timing is read-only in TimingControls; editable via AttributeEditor as regular attributes
7. Element tree supports click/hover selection but no drag-to-reorder
