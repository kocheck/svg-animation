# SVG Animation Editor — Roadmap

> Transforming the SVG Animation Viewer into an interactive animated SVG editing workbench.

---

## 1. Executive Summary

We're evolving our lean SVG animation viewer into a dual-mode editing workbench where users can **manually tweak** any visual or animation property through direct-manipulation controls, **or describe changes in natural language** and let an AI apply them. The editing surface shares a single structured SVG model that both modes read and write, keeping output as portable, valid SVG at all times. The build-out is phased so that each milestone ships standalone value — starting with foundational infrastructure, then layering in visual controls, AI assistance, advanced timeline tools, and finally export/polish.

---

## 2. Quick Wins

Low-effort, high-impact features we can ship in a day or less each. These build momentum and improve the existing viewer immediately.

### QW-1: In-place Edit (replace "Add to Gallery" duplication)

Currently, editing an SVG via `CodeEditor` always appends a *new* gallery entry. Instead, when the editor was opened via an "Edit" action, the "Add to Gallery" button should become **"Save Changes"** and update the existing entry in-place.

*Technical approach:* Pass the source index through `editTarget`. In `handleAdd`, check whether we're editing (index present) or creating (index absent) and call `setSvgs` with a splice-update or an append accordingly.
*Priority:* Must-have

### QW-2: Copy SVG Source to Clipboard

One-click button on each Card and in FocusOverlay to copy the raw SVG markup.

*Technical approach:* `navigator.clipboard.writeText(svg.src)` with a brief "Copied!" flash state, same pattern as the existing `addedFlash`.
*Priority:* Must-have

### QW-3: Dark/Light Background Toggle for Preview

Animated SVGs with white strokes are invisible on the current dark background (and vice versa). Add a toggle to flip the preview pane background between dark, light, and checkerboard.

*Technical approach:* Cycle a CSS class (`bg-dark`, `bg-light`, `bg-checker`) on `.preview-pane` and `.focus-svg`. Checkerboard via a repeating CSS gradient.
*Priority:* Must-have
*Android note:* Purely a viewer concern — no impact on SVG output.

### QW-4: SVG Metadata Display

Show dimensions, element count, animation count, and file size estimate below the preview.

*Technical approach:* Parse the SVG string with `DOMParser`, read the root `<svg>` attributes (`viewBox`, `width`, `height`), count child elements, count `<animate*>` and elements with `animation` styles. Display as a compact info bar.
*Priority:* Nice-to-have

### QW-5: Keyboard Shortcut Hints

Overlay small hints for existing keyboard shortcuts (arrows, Escape) in FocusOverlay, and add `Ctrl+Enter` to submit from CodeEditor.

*Technical approach:* Add a `<kbd>` hint strip to FocusOverlay. Wire `Ctrl+Enter` in `handleKeyDown` to trigger `handleAdd`.
*Priority:* Nice-to-have

---

## 3. Phase 1 — Foundation (Editing Infrastructure)

**Goal:** Replace the raw-string SVG model with a structured, editable representation and build the mutation primitives that all future editing features depend on.

### P1-1: SVG Document Model (AST)

The current data model is `{ name: string, src: string }` — a flat string with no structure. Every editing feature will need to locate elements, read attributes, and write changes. We need a lightweight in-memory model.

*Technical approach:*
- Parse SVG strings into a DOM tree using the browser's native `DOMParser` (`new DOMParser().parseFromString(src, 'image/svg+xml')`).
- Wrap the resulting `Document` in a thin facade class (`SvgDoc`) that provides helpers: `getElementById`, `querySelectorAll`, `setAttribute`, `removeAttribute`, `serialize` (back to string via `XMLSerializer`).
- The `SvgDoc` instance becomes the single source of truth. Both AI and manual editing tools call methods on `SvgDoc`. After any mutation, call `serialize()` to update the raw `src` string for rendering.
- Store in a new `useSvgDocument(src)` hook that returns `{ doc, update, serialized }`.

*Priority:* Must-have
*Android note:* Using `DOMParser` + `XMLSerializer` ensures we always output well-formed XML, which is critical because Android's SVG renderers are strict about XML validity (unlike browsers which tolerate HTML-ish SVG).

### P1-2: Undo/Redo History Stack

Once we can mutate SVGs, users need to revert mistakes. This is foundational for both AI and manual editing — an AI-applied change that looks wrong should be one `Ctrl+Z` away from reversal.

*Technical approach:*
- Maintain a history stack of serialized SVG strings per document: `{ past: string[], present: string, future: string[] }`.
- On each mutation, push the previous `present` onto `past`, clear `future`.
- Undo: pop from `past` to `present`, push old `present` to `future`. Redo: inverse.
- Expose via `useSvgHistory(initialSrc)` hook returning `{ current, apply, undo, redo, canUndo, canRedo }`.
- Cap stack depth (e.g., 50 entries) to avoid memory bloat on large SVGs.

*Priority:* Must-have

### P1-3: Element Selection & Inspection Panel

Click an element in the preview → highlight it → show its attributes in a side panel. This is the bridge between "looking at an SVG" and "editing an SVG."

*Technical approach:*
- Attach a delegated `click` handler on the rendered SVG container. On click, identify the target element and map it back to the corresponding node in the `SvgDoc` AST (match by a temporarily-injected `data-editor-id` attribute added during rendering).
- Highlight the selected element with a dashed overlay (an absolutely-positioned `<rect>` matching the element's `getBBox()`).
- Render an **Inspector Panel** (slide-in sidebar or bottom drawer) showing the element's tag name, all attributes as key-value pairs, computed styles, and parent chain.
- Initially read-only; Phase 2 makes it editable.

*Priority:* Must-have

### P1-4: Generalized Animation Detection

The current `useAnimation.js` only finds elements matching hardcoded class-name patterns (`anim-`, `spin`, `gyro`, etc.). Real SVGs use diverse animation approaches.

*Technical approach:*
- Detect **CSS animations**: walk all elements, call `getComputedStyle(el).animationName` — anything other than `"none"` is animated.
- Detect **SMIL animations**: query `animate`, `animateTransform`, `animateMotion`, `set` elements and resolve their `xlink:href` or parent targets.
- Detect **CSS transitions**: check for `transition` properties (these fire on state changes).
- Return a unified list: `{ element, type: 'css'|'smil'|'transition', properties: {...} }`.
- Replace the `ANIMATED_SELECTOR` constant with this discovery function.

*Priority:* Must-have
*Android note:* Android's `AndroidSVG` and `VectorDrawable` renderers do **not** support SMIL. If the goal is Android playback, we should flag SMIL-animated elements with a warning badge and eventually offer a "convert SMIL to CSS" tool (Phase 4).

### P1-5: State Management Upgrade

The app currently uses seven independent `useState` calls in `App.jsx` with no shared state bus. As we add document model, history, selection, inspector, and AI state, this will become unwieldy.

*Technical approach:*
- Introduce a `useReducer` + React Context pattern: a single `EditorContext` providing `state` and `dispatch`.
- State shape: `{ svgs: SvgEntry[], activeIndex: number, selection: ElementId | null, history: HistoryState, ui: { panel, gridCols, speed, paused } }`.
- Keep it pure React — no external state library needed at this scale.
- Existing components consume context instead of prop-drilling. Migration is incremental: wrap `App` in the provider, move one `useState` at a time.

*Priority:* Must-have

---

## 4. Phase 2 — Manual Editing Suite

**Goal:** Give users direct visual controls to modify the most common SVG properties without touching code.

### P2-1: Inline Attribute Editor

Make the Inspector Panel (P1-3) editable. Click any attribute value → inline text input → edit → Enter to apply.

*Technical approach:*
- Render each attribute as a `<span>` that, on double-click, swaps to an `<input>` pre-filled with the current value.
- On commit (Enter or blur), call `SvgDoc.setAttribute(nodeId, attrName, newValue)` → push to history → re-serialize.
- Validate numeric attributes (parse as number), color attributes (validate hex/rgb), and enum attributes (dropdown for values like `stroke-linecap`).

*Priority:* Must-have
*Android note:* Show a warning icon next to attributes that Android renderers don't support (e.g., `filter`, `clip-path` with complex values, `mask`).

### P2-2: Color Picker Overlay

Click any filled/stroked element → a floating color picker appears → changes `fill` or `stroke` in real-time.

*Technical approach:*
- Use a lightweight color picker component (build a simple HSL wheel, or adopt a minimal dependency like `react-colorful` at ~2KB gzipped).
- On selection of a fill/stroke element, position the picker near the element. Bind the picker's `onChange` to `SvgDoc.setAttribute(id, 'fill'|'stroke', color)`.
- Debounce updates (16ms) for smooth live preview.
- Show both fill and stroke pickers when both are present.

*Priority:* Must-have
*Android note:* Stick to `#RRGGBB` and `#RRGGBBAA` hex format. Android SVG renderers may not support `hsl()`, `oklch()`, `currentColor`, or named colors beyond the SVG 1.1 keyword set. The picker should normalize output to hex.

### P2-3: Transform Controls (Visual Handles)

Drag handles on the selected element to translate, scale, and rotate it visually.

*Technical approach:*
- When an element is selected, render overlay handles (corner squares for scale, edge midpoints for translate, a rotation handle above).
- On drag, compute the delta and update the element's `transform` attribute. Decompose existing transforms using `SVGElement.getCTM()` for accurate stacking.
- Display numeric readouts (x, y, rotation°, scaleX, scaleY) in the inspector for precision input.

*Priority:* Must-have
*Android note:* Stick to `matrix()`, `translate()`, `rotate()`, `scale()` transform functions. Android does not support `skewX()`/`skewY()` in all renderers.

### P2-4: Animation Timing Controls

For any animated element, show controls to adjust `animation-duration`, `animation-delay`, `animation-iteration-count`, and `animation-timing-function`.

*Technical approach:*
- In the Inspector Panel, when the selected element has CSS animations, render dedicated controls:
  - Duration: numeric input with scrub slider (0.1s–30s).
  - Delay: numeric input (0s–10s).
  - Iteration count: numeric input + "infinite" toggle.
  - Timing function: dropdown of presets (`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`) plus a cubic-bezier curve editor for custom easing.
- Mutations target the element's inline `style` attribute or a `<style>` block. Prefer inline style when the animation is already inline; otherwise, locate and modify the `<style>` rule.
- Cubic-bezier editor: a small canvas with draggable control points, outputting `cubic-bezier(x1,y1,x2,y2)`.

*Priority:* Must-have

### P2-5: Element Tree Panel

A collapsible tree view showing the SVG's DOM hierarchy — like a mini DevTools "Elements" tab.

*Technical approach:*
- Recursively walk `SvgDoc` children. Render each node as an expandable tree row: `<tag id="..." class="...">`.
- Click a tree node → select that element in the preview (with highlight).
- Hover a tree node → show a subtle overlay highlight on the corresponding element.
- Support drag-to-reorder for reparenting elements (changes z-order).

*Priority:* Nice-to-have

### P2-6: Easing Presets Library

A panel of pre-built easing curves that users can click to apply to the selected animation.

*Technical approach:*
- Ship a JSON map of named easings: `{ "bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)", "elastic": "cubic-bezier(0.68, -0.55, 0.27, 1.55)", ... }`.
- On click, set `animation-timing-function` on the selected element.
- Show a small preview animation (a dot moving along a track) for each easing so users can compare visually.

*Priority:* Nice-to-have

---

## 5. Phase 3 — AI-Assisted Editing

**Goal:** Let users describe changes in natural language and have an LLM apply the corresponding SVG mutations.

### P3-1: AI Chat Panel (Prompt Interface)

A persistent side panel where users type natural-language instructions like "make the circle red" or "slow down the rotation by half."

*Technical approach:*
- Slide-in panel with a chat-style message list (user messages + AI responses).
- Input field at the bottom with `Enter` to submit, `Shift+Enter` for newline.
- Messages are stored in editor state: `{ role: 'user'|'assistant', content: string, diff?: SvgDiff }`.
- The panel is always visible alongside the preview — no mode switching required. Users can interleave AI commands with manual edits seamlessly.

*Priority:* Must-have

### P3-2: LLM Integration (SVG Mutation Pipeline)

The core engine: take a user prompt + current SVG → send to an LLM → receive modified SVG → apply the diff.

*Technical approach:*
- **Prompt construction:** Build a system prompt that includes:
  - The current serialized SVG (or a truncated/summarized version for large files).
  - The element tree structure (tag names, IDs, classes) for context.
  - Rules: "Output only the modified SVG. Maintain valid SVG XML. Do not add proprietary attributes."
  - Android compatibility guidelines as soft constraints.
- **API call:** POST to an LLM endpoint (configurable — could be OpenAI, Anthropic, or a local model). Abstract behind an `AiProvider` interface so the backend is swappable.
- **Response handling:** Parse the returned SVG string, validate it with `DOMParser` (check for `parsererror`). If valid, compute a diff against the current SVG and show a preview. If invalid, show the error and let the user retry.
- **Apply flow:** Show the AI's changes as a highlighted diff. User clicks "Accept" → changes are applied to `SvgDoc` and pushed to the undo history. User clicks "Reject" → changes are discarded.

*Priority:* Must-have

### P3-3: Contextual AI (Selection-Aware Prompts)

When an element is selected, scope the AI's context to that element so prompts like "make this bigger" or "change the color to blue" work without ambiguity.

*Technical approach:*
- If `selection` is non-null, inject the selected element's serialized subtree and its ID/path into the LLM prompt: "The user has selected `<circle id='c1' cx='200' cy='200' r='50' fill='red'/>`. Apply the following change to this element."
- The AI returns a replacement for that subtree. We validate it, swap it into the `SvgDoc`, and push to history.
- Show a visual indicator in the chat panel: "Editing: `<circle#c1>`".

*Priority:* Must-have

### P3-4: AI Suggestion Mode (Proactive Recommendations)

After analyzing the SVG, the AI suggests improvements — "This animation has no easing; want me to add ease-in-out?" or "These two paths could be merged."

*Technical approach:*
- On SVG load or on-demand ("Analyze" button), send the SVG to the LLM with a prompt asking for optimization/improvement suggestions.
- Display suggestions as dismissable cards in the AI panel, each with a one-click "Apply" button.
- Suggestions are non-destructive — they queue proposed diffs that the user must explicitly accept.

*Priority:* Nice-to-have

### P3-5: Prompt Templates / Quick Actions

Pre-built prompt shortcuts for common tasks: "Add a fade-in animation", "Center all elements", "Optimize path data", "Convert SMIL to CSS".

*Technical approach:*
- A searchable palette of template buttons. Each template has a display name and a prompt string with `{{selection}}` placeholders filled at execution time.
- Power users can create and save custom templates.
- Accessible via a dropdown above the chat input or via the command palette (Phase 5).

*Priority:* Nice-to-have

---

## 6. Phase 4 — Advanced Tools

**Goal:** Provide professional-grade animation editing with timeline, interaction, and sequencing capabilities.

### P4-1: Keyframe Timeline Editor

A horizontal timeline strip (like After Effects or Figma's animation panel) showing animation keyframes visually.

*Technical approach:*
- Parse `@keyframes` blocks from `<style>` elements and CSS animation properties from inline styles.
- Render a horizontal track per animated element. Each keyframe stop (0%, 50%, 100%) is a draggable diamond marker.
- Drag a marker left/right to change its percentage. Click a marker to edit its property values in a popover.
- Adding/removing keyframe stops via right-click context menu.
- Changes write back to the `@keyframes` rule in the `SvgDoc`'s `<style>` block.

*Priority:* Must-have

### P4-2: Animation Sequencer

Visually arrange multiple animations on a shared timeline to control start times, durations, and overlap.

*Technical approach:*
- Display all animated elements on stacked horizontal tracks (like a video editor timeline).
- Each animation is a resizable bar. Drag to change start offset (`animation-delay`), resize to change duration.
- Snap-to-grid and snap-to-other-animation for alignment.
- Playback scrubber: drag to scrub through the combined animation, showing the SVG at that point in time (set `animation-delay` to negative values for scrubbing).

*Priority:* Must-have

### P4-3: Path Editor

Click-to-select path points, drag to reshape curves. For `<path d="...">` elements.

*Technical approach:*
- Parse the `d` attribute into a command array (M, L, C, Q, A, Z with coordinates).
- Render overlay dots on each anchor point and control-point handles on curves.
- Drag an anchor → update coordinates in the command array → re-serialize `d`.
- Support adding/deleting points (right-click menu).
- Show control-point handles for cubic/quadratic bezier segments.

*Priority:* Nice-to-have (complex, but high value for illustration work)
*Android note:* Android supports the full SVG path `d` syntax, so no compatibility issues here.

### P4-4: Interaction / Trigger Builder

Define hover, click, and scroll-triggered animations — common for interactive SVGs on the web.

*Technical approach:*
- UI: select an element → choose a trigger (hover, click, scroll-into-view) → choose an action (play animation, toggle class, change attribute).
- Output: generate inline `onmouseover`/`onclick` attributes or a `<script>` block with event listeners.
- Keep the event handling in a namespaced, self-contained `<script>` so the SVG remains portable.

*Priority:* Nice-to-have
*Android note:* Interactive SVG events (onclick, onmouseover) are **not supported** in Android's native SVG renderers or VectorDrawable. Flag these as "web-only" in the UI and strip them from Android exports.

### P4-5: Animation Presets / Templates

A library of ready-made animations (fade in, slide up, pulse, spin, bounce, draw stroke) that users can apply to any element with one click.

*Technical approach:*
- Each preset is a function that takes an element ID and returns the CSS `@keyframes` rule + the `animation` property to inject.
- Apply by inserting the `@keyframes` block into the document's `<style>` and setting the `animation` shorthand on the target element.
- Presets have configurable parameters (duration, delay, easing) shown in a mini form before applying.

*Priority:* Nice-to-have

---

## 7. Phase 5 — Export & Polish

**Goal:** Production-ready output, optimized workflows, and UX refinements.

### P5-1: SVG Optimizer (SVGO Integration)

Clean and minify the SVG output — remove editor metadata, redundant attributes, empty groups, and unnecessary precision.

*Technical approach:*
- Integrate [SVGO](https://github.com/svg/svgo) as a browser-side dependency (it supports browser builds).
- Run on export with a sensible default plugin set. Offer an "Advanced" toggle to configure individual SVGO plugins.
- Show before/after file size comparison.

*Priority:* Must-have

### P5-2: Android Vector Drawable Export

Export the SVG as an Android `VectorDrawable` XML and/or `AnimatedVectorDrawable` XML.

*Technical approach:*
- Build a converter that maps SVG elements to VectorDrawable equivalents: `<path>` → `<path>`, `<group>` → `<group>`, `fill`/`stroke` → `android:fillColor`/`android:strokeColor`, `d` → `android:pathData`.
- For animations, generate `<objectAnimator>` blocks targeting path properties.
- Flag unsupported features (filters, masks, gradients with >2 stops in older API levels, SMIL) with warnings before export.
- Output as downloadable `.xml` file.

*Priority:* Must-have (given the Android SVG context of this app)
*Android note:* This is the core Android deliverable. VectorDrawable supports a subset of SVG — we need a compatibility matrix and clear warnings for unsupported features.

### P5-3: Animated GIF / APNG / WebM Preview Export

Generate an animated image preview of the SVG animation for sharing in contexts that don't support SVG.

*Technical approach:*
- Use the `html2canvas` or `CanvasRenderingContext2D` approach: render the SVG to a canvas at each animation frame, capture frames, encode as GIF (via `gif.js`) or WebM (via `MediaRecorder` API).
- Let the user set duration, FPS, and canvas size.
- Show a progress bar during encoding.

*Priority:* Nice-to-have

### P5-4: Command Palette

A Raycast/VS Code-style `Ctrl+K` command palette for power users to quickly access any action.

*Technical approach:*
- Overlay with a search input. Fuzzy-match against a registry of all available commands (edit actions, view toggles, AI prompts, export options, navigation).
- Each command has a name, optional keyboard shortcut, and an action callback.
- Build as a generic `CommandPalette` component that consumes a `commands[]` array from the editor context.

*Priority:* Nice-to-have

### P5-5: Persistent Storage (LocalStorage / IndexedDB)

Save the gallery and editor state so users don't lose their work on refresh.

*Technical approach:*
- Serialize the `svgs[]` array (names + source strings) to `localStorage` on every change (debounced 500ms).
- On app load, hydrate from `localStorage`.
- For large SVG collections, switch to `IndexedDB` (use the `idb` wrapper library — ~1KB).
- Add "Export All" / "Import All" buttons (JSON file) for backup/sharing.

*Priority:* Must-have

### P5-6: Responsive Layout & Mobile Improvements

Ensure the editor works on tablets and narrow viewports.

*Technical approach:*
- Inspector and AI panels become bottom drawers on narrow screens.
- Gallery switches to single-column automatically.
- Touch-friendly hit targets (minimum 44px) for all controls.

*Priority:* Nice-to-have

---

## 8. Architecture Notes

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    EditorContext                         │
│  ┌─────────┐   ┌───────────┐   ┌────────────────────┐  │
│  │ Gallery  │   │ Selection │   │   UI Preferences   │  │
│  │ svgs[]   │   │ elementId │   │ grid, speed, panel │  │
│  └────┬─────┘   └─────┬─────┘   └────────────────────┘  │
│       │               │                                  │
│  ┌────▼─────────────────▼──────┐                         │
│  │       Active SvgDoc         │◄─── Single source of    │
│  │  (parsed DOM + serialize)   │     truth for the SVG   │
│  └────┬────────────┬───────────┘                         │
│       │            │                                     │
│  ┌────▼────┐  ┌────▼─────┐                               │
│  │ History │  │ Renderer │                               │
│  │ undo[]  │  │ (HTML)   │                               │
│  │ redo[]  │  └──────────┘                               │
│  └─────────┘                                             │
└─────────────────────────────────────────────────────────┘

Mutation flow (both AI and manual):

  User action ──► Mutation function ──► SvgDoc.update() ──► History.push()
       │                                      │
  AI prompt ────► LLM ──► validate ──► SvgDoc.replace() ──► History.push()
                                              │
                                              ▼
                                     serialize() ──► re-render preview
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Browser `DOMParser` for SVG model** | Zero dependencies, handles all SVG including embedded `<style>` and `<script>`. More reliable than regex or third-party AST parsers. |
| **`useReducer` + Context over Redux/Zustand** | App complexity is moderate. React's built-in primitives are sufficient and keep the zero-dependency philosophy. Revisit if state shape grows beyond ~10 top-level keys. |
| **String-diff history over structural diff** | Serialized SVG strings are easy to compare, store, and restore. Structural diffing is complex and error-prone with SVG's namespace quirks. String snapshots with a 50-entry cap are memory-safe for typical SVGs (<100KB). |
| **AI operates on full SVG strings, not AST commands** | LLMs are better at producing valid SVG markup than at generating programmatic AST mutation instructions. Validate LLM output with `DOMParser` before applying. |
| **No TypeScript migration (yet)** | The codebase is JSX. Adding TS would be valuable long-term but is not a blocker for any phase. Consider migrating incrementally starting Phase 3 when the AI integration adds type complexity. |
| **Inline styles over `<style>` blocks for per-element edits** | Inline styles are more predictable when elements are moved, copied, or exported. Reserve `<style>` block editing for `@keyframes` and global rules only. |

### Module Structure (Target)

```
src/
├── main.jsx
├── App.jsx
├── index.css
├── context/
│   └── EditorContext.jsx          # useReducer + Context provider
├── model/
│   ├── SvgDoc.js                  # SVG document model (parse, query, mutate, serialize)
│   ├── SvgHistory.js              # Undo/redo stack
│   └── AnimationDetector.js       # Generalized animation discovery
├── components/
│   ├── Header.jsx
│   ├── Toolbar.jsx
│   ├── Gallery.jsx
│   ├── Card.jsx
│   ├── CodeEditor.jsx
│   ├── DropZone.jsx
│   ├── FocusOverlay.jsx
│   ├── Inspector/
│   │   ├── InspectorPanel.jsx     # Attribute viewer/editor
│   │   ├── ColorPicker.jsx
│   │   ├── TransformHandles.jsx
│   │   └── TimingControls.jsx
│   ├── Timeline/
│   │   ├── KeyframeEditor.jsx
│   │   └── Sequencer.jsx
│   ├── AI/
│   │   ├── ChatPanel.jsx
│   │   ├── PromptTemplates.jsx
│   │   └── DiffPreview.jsx
│   └── shared/
│       ├── CommandPalette.jsx
│       └── ElementTree.jsx
├── ai/
│   ├── AiProvider.js              # LLM API abstraction
│   ├── promptBuilder.js           # System prompt construction
│   └── responseValidator.js       # SVG output validation
├── export/
│   ├── svgOptimizer.js            # SVGO wrapper
│   ├── vectorDrawable.js          # Android VD export
│   └── animatedPreview.js         # GIF/WebM export
└── hooks/
    ├── useAnimation.js            # (existing, to be refactored)
    ├── useSvgDocument.js
    ├── useSvgHistory.js
    └── useElementSelection.js
```

---

## 9. Risk & Compatibility Callouts

### Android SVG Rendering Pitfalls

| Feature | Browser Support | Android Support | Mitigation |
|---------|----------------|-----------------|------------|
| **CSS animations** | Full | Partial (WebView only, not VectorDrawable) | Flag as "WebView-only" if targeting native rendering. Offer conversion to `<objectAnimator>` for VectorDrawable export. |
| **SMIL (`<animate>`, `<animateTransform>`)** | Full (except Chrome deprecation reversed) | Not supported in VectorDrawable; partial in WebView | Show warning badge. Offer "Convert SMIL → CSS" tool. |
| **Filters (`<filter>`, `feGaussianBlur`, etc.)** | Full | Not supported in VectorDrawable; partial in WebView | Show "web-only" tag. Strip on VD export. |
| **Masks and clip-paths** | Full | Basic support in VectorDrawable (path-based clips only) | Warn on complex clip-paths. Flatten on export if possible. |
| **Gradients** | Full | Linear and radial supported in VD; no mesh gradients | Warn on `<meshgradient>`. Limit gradient stops guidance. |
| **CSS `hsl()`, `oklch()` color functions** | Full | Not supported in Android SVG renderers | Normalize all colors to `#RRGGBB` / `#RRGGBBAA` hex in the color picker and on export. |
| **`transform-origin`** | Full | Inconsistent across Android versions | Bake `transform-origin` into the transform matrix on export. |
| **`<text>` and fonts** | Full | Limited font support in VD (system fonts only) | Warn about custom fonts. Offer "Convert text to paths" tool. |
| **JavaScript / `<script>`** | Full | Not supported in VD; limited in WebView | Flag interactive features as "web-only". Strip on VD export. |
| **`viewBox` handling** | Consistent | Occasional aspect ratio bugs on older Android | Always include explicit `viewBox` and `width`/`height`. |

### General Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **LLM produces invalid SVG** | Broken rendering, data loss | Always validate with `DOMParser` before applying. Show parse errors to user. Never auto-apply without preview. |
| **Large SVGs overwhelm the editor** | Slow rendering, high memory | Lazy-render the element tree. Virtualize long lists. Cap history stack. Show file size warnings above 500KB. |
| **Undo history memory usage** | Browser tab crash on very large SVGs | Store diffs instead of full snapshots for SVGs over 100KB. Or compress snapshots with a lightweight algorithm. |
| **CSS specificity conflicts between editor UI and SVG content** | SVG styles leak into editor, or vice versa | Render SVGs in a Shadow DOM container or `<iframe>` sandbox. At minimum, scope all editor CSS under a `.editor-*` namespace. |
| **DOMParser namespace issues** | SVG elements not recognized correctly | Always parse with `'image/svg+xml'` MIME type. Handle the `parsererror` element that `DOMParser` inserts on failure. |

---

## 10. Phasing Summary

| Phase | Duration Estimate | Key Deliverables | Dependencies |
|-------|-------------------|------------------|--------------|
| **Quick Wins** | — | In-place edit, copy, background toggle, metadata, shortcuts | None |
| **Phase 1: Foundation** | — | SVG document model, undo/redo, element selection, animation detection, state management | None |
| **Phase 2: Manual Editing** | — | Attribute editor, color picker, transform handles, timing controls, element tree, easing presets | Phase 1 |
| **Phase 3: AI Editing** | — | Chat panel, LLM integration, selection-aware prompts, suggestions, prompt templates | Phase 1 |
| **Phase 4: Advanced Tools** | — | Keyframe timeline, sequencer, path editor, interaction builder, animation presets | Phase 2 |
| **Phase 5: Export & Polish** | — | SVG optimizer, VectorDrawable export, animated preview export, command palette, persistence, responsive layout | Phase 1+ |

> **Phases 2 and 3 can be developed in parallel** — they both depend on Phase 1 but are independent of each other. Phase 4 depends on Phase 2. Phase 5 items can be sprinkled in alongside any phase (especially persistence, which is valuable early).
