# Phase 1 Foundation + Quick Wins — Design Document

> Build the editing infrastructure that all future features depend on, bundled with low-effort Quick Wins.

**Approach:** Bottom-up (Model → State → UI). Each layer is fully tested before the next builds on it.

**Testing:** Full coverage — unit tests for model, reducer tests for state, component tests for UI. Vitest + happy-dom + React Testing Library. 90% coverage threshold enforced.

**State management:** `useReducer` + React Context (three focused contexts). No external libraries. Re-render isolation via context splitting; straightforward migration path to Zustand if needed later.

**SVG model:** Browser-only. `DOMParser` + `XMLSerializer` wrapped in a thin `SvgDoc` facade. The local MCP server (Tier 2) relays commands to the browser — it never parses SVGs itself.

---

## 1. SvgDoc Model

A thin facade over the browser's native `DOMParser`/`XMLSerializer`. Single source of truth for SVG structure.

### API

```js
class SvgDoc {
  // Construction
  static parse(svgString)                    → SvgDoc (throws on invalid XML)

  // Query
  getElementById(id)                         → Element | null
  querySelector(selector)                    → Element | null
  querySelectorAll(selector)                 → Element[]
  getRoot()                                  → SVGSVGElement
  getAttributes(element)                     → Record<string, string>
  getBBox(element)                           → { x, y, width, height }

  // Mutation (return this for chaining)
  setAttribute(element, name, value)         → this
  removeAttribute(element, name)             → this
  setStyle(element, property, value)         → this
  addChild(parent, tagName, attrs)           → Element
  removeElement(element)                     → this
  insertBefore(newNode, refNode)             → this

  // Serialization
  serialize()                                → string
  clone()                                    → SvgDoc

  // Metadata
  getStats()                                 → { elementCount, animationCount, dimensions, sizeBytes }
}
```

### Decisions

- **Element identity:** Inject `data-svgdoc-id` attributes (auto-incrementing integers) on parse. Stable IDs for mapping between live rendered SVG and the model, even for elements without `id`. Stripped on `serialize()` for clean output.
- **Immutability boundary:** `SvgDoc` itself is mutable (wraps a live DOM `Document`). Immutability lives at the history layer — `SvgHistory` stores serialized string snapshots, not `SvgDoc` references.
- **Validation:** `parse()` checks for `<parsererror>` elements inserted by `DOMParser` on malformed XML. Throws a descriptive error.
- **No direct DOM exposure:** Consumers use facade methods, not the underlying `Document`.

### Tests

- Parse valid SVG → verify element queries, attribute reads, stats
- Parse malformed SVG → verify error thrown with message
- Mutations → verify `serialize()` reflects changes
- `data-svgdoc-id` injection → verify present after parse, stripped on serialize
- Round-trip fidelity → `parse(doc.serialize())` produces identical output
- Edge cases: empty SVG, namespaces (`xlink:href`), embedded `<style>`, `<script>`, CDATA sections

---

## 2. SvgHistory (Undo/Redo Stack)

Manages immutable snapshots of serialized SVG strings. Decoupled from `SvgDoc`.

### API

```js
class SvgHistory {
  constructor(initialSrc, { maxDepth = 50 } = {})

  get current()                → string
  get canUndo()                → boolean
  get canRedo()                → boolean
  get depth()                  → { past: number, future: number }

  push(newSrc)                 → SvgHistory
  undo()                       → SvgHistory
  redo()                       → SvgHistory

  beginBatch()                 → SvgHistory
  commitBatch(finalSrc)        → SvgHistory
}
```

### Decisions

- **Immutable instances:** Each operation returns a new `SvgHistory`. Plays cleanly with React — reducer replaces the reference.
- **String snapshots, not diffs:** SVGs under ~100KB (covers virtually all animated SVGs). 50-entry stack of 100KB strings is ~5MB — within browser memory.
- **Max depth cap:** Oldest entries silently dropped when stack exceeds `maxDepth`.
- **Batch operations:** `beginBatch()`/`commitBatch()` collapses drag interactions (color picker, transforms) into a single undo entry. Built now for Phase 2.
- **No-op dedup:** `push()` with a string identical to `current` is a no-op.

### Tests

- Push states → verify `current` updates, `canUndo` true, `canRedo` false
- Undo → verify rollback, `canRedo` becomes true
- Redo → verify forward navigation
- Undo then push → verify redo stack cleared (fork behavior)
- Max depth → push 60 with depth 50, verify oldest dropped, undo stops at 50
- No-op push → same string twice, depth unchanged
- Batch → begin, commit, single undo entry
- Edge cases: undo when `canUndo` false (no-op), redo when `canRedo` false (no-op)

---

## 3. AnimationDetector

Replaces the hardcoded `ANIMATED_SELECTOR` with comprehensive discovery of CSS animations, SMIL elements, and CSS transitions.

### API

```js
function detectAnimations(svgElement) → AnimationInfo[]

AnimationInfo = {
  element,              // DOM Element reference
  elementId,            // data-svgdoc-id
  type,                 // 'css' | 'smil' | 'transition'
  name,                 // animation-name or SMIL tag
  properties: {
    duration, delay, easing, iterationCount,
    direction, fillMode, state,
  },
  target,               // for SMIL: the element being animated
  smilAttributes,       // for SMIL only: { attributeName, from, to, values, repeatCount, ... }
  androidCompatible,    // boolean
  warnings,             // string[]
}
```

### Detection Strategy

1. **CSS Animations:** Walk descendants, check `getComputedStyle(el).animationName !== "none"`. Read duration, delay, timing function, iteration count, direction, play state.
2. **SMIL Elements:** `querySelectorAll('animate, animateTransform, animateMotion, animateColor, set')`. Resolve target via parent or `href`/`xlink:href`. Read SMIL attributes.
3. **CSS Transitions:** Check `transitionProperty`. Flag as `state: 'idle'` (latent).

### Decisions

- **Pure function, not a class.** No state. Takes SVG element, returns data.
- **Requires live DOM.** `getComputedStyle()` only works on rendered elements. Detection runs against the preview pane, not `SvgDoc` directly. `elementId` bridges back via `data-svgdoc-id`.
- **Android compatibility flags.** Each animation gets a boolean and warnings. Feeds inspector and future MCP tools.
- **Replaces `useAnimation.js`.** Existing `setSpeedOnSvg`/`togglePauseOnSvg` refactored to use `detectAnimations()` output.

### Tests

- SVG with CSS `@keyframes` → verify detection with correct properties
- SVG with inline `style="animation: ..."` → verify detection
- SVG with SMIL `<animate>` → verify detection, correct target resolution
- SVG with `<animateTransform>` using `xlink:href` → verify target is referenced element
- SVG with CSS transitions → detected as `type: 'transition'`
- Mixed CSS + SMIL → all found, no duplicates
- No animations → empty array
- Android warnings → SMIL gets `androidCompatible: false`
- Note: CSS detection tests need happy-dom for computed style support

---

## 4. EditorContext (State Management)

Replaces seven `useState` calls in `App.jsx`. Three focused contexts to isolate re-render boundaries.

### State Shape

```js
EditorState = {
  documents: [{
    id,                  // crypto.randomUUID()
    name,
    history,             // SvgHistory instance
    doc,                 // SvgDoc instance (derived from history.current)
  }],
  activeDocumentId,      // null if none

  selection: {
    elementId,           // data-svgdoc-id (null if none)
    hoveredElementId,    // null if none
  },

  ui: {
    gridCols,            // 1 | 2 | 3
    globalSpeed,         // number
    paused,              // boolean
    focusDocumentId,     // null if closed
    editorOpen,          // boolean
    previewBackground,   // 'dark' | 'light' | 'checker'
  },
}
```

### Context Split

```
DocumentContext   — documents[], activeDocumentId, document mutations
SelectionContext  — selection state, selection actions
UIContext         — ui preferences, layout, playback controls
```

### Action Types

```js
// Document
ADD_DOCUMENT       { name, src }
REMOVE_DOCUMENT    { id }
UPDATE_DOCUMENT    { id, src }
REPLACE_DOCUMENT   { id, src }
SET_ACTIVE         { id }
UNDO               { id }
REDO               { id }

// Selection
SELECT_ELEMENT     { elementId }
HOVER_ELEMENT      { elementId }
CLEAR_SELECTION    {}

// UI
SET_GRID_COLS      { cols }
SET_SPEED          { speed }
TOGGLE_PAUSE       {}
RESET_SPEED        {}
SET_FOCUS          { documentId }
CLEAR_FOCUS        {}
TOGGLE_EDITOR      {}
SET_PREVIEW_BG     { mode }
```

### Decisions

- **Stable document IDs:** `crypto.randomUUID()` replaces array index identification. Fixes breakage on remove/reorder and enables QW-1 naturally.
- **`SvgDoc` derived from history:** On every `UPDATE_DOCUMENT` or undo/redo, the reducer calls `SvgDoc.parse(history.current)` to rebuild. Keeps doc and history in guaranteed sync.
- **Three contexts:** Color picker dragging at 60fps only triggers `DocumentContext` subscribers — toolbar and gallery are untouched.
- **Incremental migration:** Old prop-drilling and new context coexist during migration.

### Tests

**Reducer unit tests:**
- `ADD_DOCUMENT` → document created, history initialized
- `REMOVE_DOCUMENT` → document removed, active cleared if was active
- `UPDATE_DOCUMENT` → history pushed, doc re-parsed
- `UNDO` / `REDO` → history navigated, doc re-parsed
- `SELECT_ELEMENT` → selection set
- All UI actions → state toggles correctly

**Component integration tests:**
- Providers with initial state → children read state via hooks
- Dispatch actions → subscribed components re-render
- Context isolation — UI action does not re-render Document-subscribed component

---

## 5. Element Selection & Inspector Panel

Click an element → highlight it → show attributes in a side panel.

### Selection Hook

```js
function useElementSelection(containerRef, { onSelect, onHover }) {
  // Delegated click + mousemove on containerRef
  // Maps event.target → data-svgdoc-id → dispatches SELECT_ELEMENT
  // Mousemove → HOVER_ELEMENT (debounced 16ms)
  // Click empty space → CLEAR_SELECTION
}
```

**Element mapping:** On click, walk up from `event.target` to find nearest `data-svgdoc-id`. Skip root `<svg>`. Map back to `SvgDoc` via the ID.

### Selection Highlight Overlay

Transparent SVG layer over the preview. Draws dashed rect via `getBBox()`:
- Selected: `stroke="dodgerblue"`, `stroke-dasharray="4 3"`
- Hovered: same but `stroke-opacity="0.4"`
- Recalculates on resize and document mutation

### Inspector Panel

Slide-in sidebar (right, ~300px). Sections:

1. **Element header** — tag name, ID, classes as pills
2. **Attributes table** — all attributes as key-value rows (read-only in Phase 1)
3. **Animations** — detected via `AnimationDetector`, type/name/duration/easing, Android badge
4. **Parent chain** — breadcrumb path, clickable to select ancestors
5. **Metadata** — `getBBox()` dimensions, computed fill/stroke

### Decisions

- **Read-only in Phase 1.** Editing comes in Phase 2.
- **Overlay approach over CSS outline.** `outline`/`box-shadow` unreliable on SVG elements. Separate overlay gives full control.
- **Inspector outside the SVG.** React component beside preview, not injected into SVG.
- **No inspector in focus overlay yet.** Selection/inspection only in main gallery/editor view.

### Tests

**useElementSelection:**
- Click SVG element → `SELECT_ELEMENT` with correct ID
- Click empty space → `CLEAR_SELECTION`
- Click nested element → nearest `data-svgdoc-id` ancestor selected
- Mousemove → `HOVER_ELEMENT`

**Inspector:**
- Selected element → tag, ID, attributes displayed
- Animated element → animation info shown
- No selection → placeholder state
- Click parent breadcrumb → `SELECT_ELEMENT` for ancestor
- Android warnings render for incompatible attributes

**Highlight overlay:**
- Selected → rect matches `getBBox()`
- Cleared → overlay removed
- Mutated → overlay repositions

---

## 6. Quick Wins

Woven into the Context migration since we're touching every component.

### QW-1: In-Place Edit

Code editor reads `activeDocumentId` from `DocumentContext`. If set: button says "Save Changes", dispatches `REPLACE_DOCUMENT`. If null: "Add to Gallery", dispatches `ADD_DOCUMENT`.

### QW-2: Copy SVG Source

`navigator.clipboard.writeText(doc.history.current)` with "Copied!" flash. On Card and FocusOverlay.

### QW-3: Dark/Light/Checker Background Toggle

Three-state cycle in Toolbar. `ui.previewBackground` in `UIContext`. Applied to `.svg-wrap`, `.focus-svg`, `.preview-pane`.

```css
.preview-bg-dark    { background: #0a0a0a; }
.preview-bg-light   { background: #ffffff; }
.preview-bg-checker {
  background: repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
}
```

### QW-4: SVG Metadata Display

Compact info bar: `1200x800 · 47 elements · 3 animations · ~12.4 KB`. Data from `SvgDoc.getStats()`.

### QW-5: Keyboard Shortcut Hints

`Ctrl+Enter` submits in CodeEditor. `<kbd>` hints in FocusOverlay: `← → navigate · Esc close · E edit`.

### Tests

- QW-1: Edit mode submit → `REPLACE_DOCUMENT`. New mode submit → `ADD_DOCUMENT`.
- QW-2: Click copy → `clipboard.writeText` called with correct source. Flash appears/disappears.
- QW-3: Toggle → CSS class cycles. All preview containers update.
- QW-4: Load SVG → metadata shows correct dimensions, counts, size.
- QW-5: `Ctrl+Enter` → submit fires. Hint text renders in FocusOverlay.

---

## 7. Testing Infrastructure

### Stack

- **Vitest** — Vite-native, ESM-first
- **happy-dom** — Vitest environment. Better SVG support than jsdom (`getComputedStyle`, `getBBox`, namespaces)
- **@testing-library/react** — component tests
- **@testing-library/user-event** — user interaction simulation

### Configuration

```js
// vitest.config.js
export default {
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      include: ['src/model/**', 'src/context/**', 'src/components/**', 'src/hooks/**'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
    }
  }
}
```

### File Structure

```
src/
├── model/
│   ├── SvgDoc.js
│   ├── SvgDoc.test.js
│   ├── SvgHistory.js
│   ├── SvgHistory.test.js
│   ├── AnimationDetector.js
│   └── AnimationDetector.test.js
├── context/
│   ├── EditorContext.jsx
│   ├── EditorContext.test.jsx
│   └── testUtils.jsx
├── hooks/
│   ├── useElementSelection.js
│   └── useElementSelection.test.js
├── components/
│   ├── Inspector/
│   │   ├── InspectorPanel.jsx
│   │   └── InspectorPanel.test.jsx
│   ├── SelectionOverlay.jsx
│   ├── SelectionOverlay.test.jsx
│   ├── Card.jsx
│   ├── Card.test.jsx
│   ├── CodeEditor.jsx
│   ├── CodeEditor.test.jsx
│   ├── FocusOverlay.jsx
│   ├── FocusOverlay.test.jsx
│   ├── Toolbar.jsx
│   └── Toolbar.test.jsx
└── test/
    ├── setup.js
    └── fixtures/
        ├── simple.svg
        ├── animated-css.svg
        ├── animated-smil.svg
        ├── complex.svg
        └── malformed.svg
```

### Decisions

- **happy-dom over jsdom:** Better SVG namespace handling, `getComputedStyle`, and `getBBox` support.
- **Test fixtures as real SVG files:** Avoids duplicating strings across tests. Each fixture covers a specific scenario.
- **Coverage thresholds enforced:** 90/85/90/90. Branch threshold slightly lower because some exotic error paths are hard to trigger.
- **`renderWithProviders` helper:** Wraps components in all three providers with configurable initial state.

---

## 8. Component Migration Order

Each step: swap props for Context hook, add test, verify behavior unchanged.

| Step | Component | Context | Quick Win |
|------|-----------|---------|-----------|
| 1 | App.jsx — wrap in providers, remove useState | All | — |
| 2 | Toolbar | UIContext | QW-3 background toggle |
| 3 | Gallery | DocumentContext + UIContext | — |
| 4 | Card | DocumentContext + UIContext | QW-2 copy, QW-3 background |
| 5 | CodeEditor | DocumentContext + UIContext | QW-1 in-place edit, QW-4 metadata, QW-5 Ctrl+Enter |
| 6 | FocusOverlay | DocumentContext + UIContext | QW-2 copy, QW-3 background, QW-5 hints |
| 7 | DropZone | DocumentContext | — |
| 8 | Header | DocumentContext | — |
| 9 | New: SelectionOverlay + useElementSelection | SelectionContext | — |
| 10 | New: InspectorPanel | SelectionContext + DocumentContext | — |

---

## 9. Build Sequence Summary

| Layer | What | Test Type |
|-------|------|-----------|
| 1. SvgDoc | Parse, query, mutate, serialize | Unit |
| 2. SvgHistory | Immutable undo/redo string stack | Unit |
| 3. AnimationDetector | CSS + SMIL + transition discovery | Unit (happy-dom) |
| 4. EditorContext | Three-context state replacing useState | Reducer unit + integration |
| 5. Component migration | Swap props for Context hooks (steps 1-8) | Component |
| 6. Element selection | Click-to-select with overlay highlight | Hook + component |
| 7. Inspector panel | Read-only attribute/animation sidebar | Component |
| 8. Quick Wins 1-5 | In-place edit, copy, background, metadata, shortcuts | Component |
