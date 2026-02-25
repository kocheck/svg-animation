# SVG Animation Editor — Roadmap

> Transforming the SVG Animation Viewer into an interactive animated SVG editing workbench.

---

## 1. Executive Summary

We're evolving our lean SVG animation viewer into a dual-mode editing workbench where users can **manually tweak** any visual or animation property through direct-manipulation controls, **or use any AI client** (Claude Desktop, Raycast, Cursor, etc.) to drive edits via an MCP server that exposes the editor's capabilities as structured tools. The AI never lives inside the app — it connects from outside through MCP, keeping the editor focused on what it does best: visual SVG manipulation. Both manual controls and MCP tool calls share a single structured SVG model, keeping output as portable, valid SVG at all times. The build-out is phased so that each milestone ships standalone value — starting with foundational infrastructure, then layering in visual controls, MCP-powered AI integration, advanced timeline tools, and finally export/polish.

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

## 5. Phase 3 — AI-Assisted Editing via MCP Server

**Goal:** Expose the editor's capabilities as structured MCP tools so any AI client — Claude Desktop, Raycast, Cursor, Ollama-based tools, or anything that speaks MCP — can read, analyze, and mutate SVGs through the editor. The app stays focused as a visual editor; AI lives outside it.

### Architecture Overview

```
┌──────────────────┐     MCP Protocol       ┌──────────────┐
│  Claude Desktop  │    (stdio or SSE)       │              │
│  Raycast AI      │◄──────────────────────►│  MCP Server  │
│  Cursor          │                         │  (Node.js)   │
│  Any MCP Client  │                         │              │
└──────────────────┘                         └──────┬───────┘
                                                    │
                                               WebSocket
                                              (localhost)
                                                    │
                                             ┌──────▼───────┐
                                             │ Browser App  │
                                             │ (React SPA)  │
                                             └──────────────┘

AI says: "call tool modify_element({ id: 'circle1', attrs: { fill: '#ff0000' } })"
  → MCP Server relays to browser via WebSocket
  → Browser applies to SvgDoc → pushes to undo history → re-renders
  → Returns confirmation + updated element state to AI
```

### P3-1: WebSocket Bridge (Browser ↔ MCP Server)

The glue layer. The browser app opens a persistent WebSocket connection to a local server. The server relays MCP tool calls to the browser and returns results.

*Technical approach:*
- **Browser side:** A `useWebSocket` hook in the React app connects to `ws://localhost:<port>`. On receiving a message, it dispatches the requested action to `EditorContext` (same mutation pipeline as manual edits) and sends back the result. If the WebSocket isn't connected, the app works normally — MCP is purely additive.
- **Server side:** A lightweight Node.js process (shipped as a separate `mcp-server/` package in the repo) that:
  1. Registers as an MCP server (using `@modelcontextprotocol/sdk`).
  2. Opens a WebSocket server on a configurable port (default 9500).
  3. When the MCP client invokes a tool, forwards the call to the browser over WebSocket and relays the response back.
- **Connection indicator:** A small status dot in the app toolbar — green when an MCP client is connected, gray when standalone.

*Priority:* Must-have

### P3-2: MCP Tool — `get_svg_source`

Returns the full serialized SVG markup for the currently active animation.

*Technical approach:*
- Tool input: `{ index?: number }` (defaults to the active/focused SVG).
- Tool output: `{ name: string, source: string, sizeBytes: number }`.
- Browser handler: reads `SvgDoc.serialize()` from the active document in `EditorContext`.

*Priority:* Must-have

### P3-3: MCP Tool — `get_element_tree`

Returns the SVG's DOM structure as a JSON tree — tag names, IDs, classes, key attributes — so the AI can understand what it's working with without parsing raw XML.

*Technical approach:*
- Tool input: `{ depth?: number }` (default unlimited, but capped at 10 to keep token count manageable).
- Tool output: recursive JSON: `{ tag: string, id?: string, class?: string, attrs: Record<string, string>, children: TreeNode[] }`.
- Browser handler: walks the `SvgDoc` DOM and serializes. Strip verbose attributes like `d` (path data) by default — include only on request via an `includePathData: boolean` flag.

*Priority:* Must-have

### P3-4: MCP Tool — `get_element_details`

Deep-read a specific element by ID or CSS selector — returns all attributes, computed styles, animation state, and bounding box.

*Technical approach:*
- Tool input: `{ selector: string }` (e.g., `"#circle1"`, `"path.outline"`, `"svg > g:nth-child(2)"`).
- Tool output: `{ tag, id, attrs: Record<string,string>, computedStyle: Record<string,string>, animations: AnimationInfo[], bbox: { x, y, width, height } }`.
- Browser handler: `SvgDoc.querySelector(selector)` → read attributes, call `getComputedStyle()`, call `getBBox()`.

*Priority:* Must-have

### P3-5: MCP Tool — `modify_element`

Set, change, or remove attributes on a specific element. This is the primary mutation tool.

*Technical approach:*
- Tool input: `{ selector: string, set?: Record<string,string>, remove?: string[] }`.
  - Example: `{ selector: "#circle1", set: { fill: "#ff0000", r: "80" }, remove: ["opacity"] }`.
- Tool output: `{ success: boolean, element: { tag, id, attrs } }` (the element's state after mutation).
- Browser handler: locate element via `SvgDoc.querySelector`, apply `setAttribute`/`removeAttribute`, push to history stack, re-render.
- **Validation:** Reject obviously dangerous attributes (`onload`, `onclick` with `javascript:` URIs). Normalize color values to hex.

*Priority:* Must-have
*Android note:* The tool response should include an `androidWarnings: string[]` field listing any attributes the AI just set that are known to be unsupported on Android (e.g., `filter`, `clip-path`, `hsl()` colors). This lets the AI proactively warn the user.

### P3-6: MCP Tool — `add_animation`

Add a CSS animation to an element — injects a `@keyframes` block and sets the `animation` shorthand.

*Technical approach:*
- Tool input: `{ selector: string, keyframes: Record<string, Record<string, string>>, duration?: string, easing?: string, delay?: string, iterationCount?: string, name?: string }`.
  - Example: `{ selector: "#circle1", keyframes: { "0%": { opacity: "0" }, "100%": { opacity: "1" } }, duration: "1s", easing: "ease-in" }`.
- Tool output: `{ success: boolean, animationName: string }`.
- Browser handler: auto-generate a unique `@keyframes` name (or use the provided one), inject the `@keyframes` block into the document's `<style>` element (create one if absent), set the `animation` shorthand on the target element.

*Priority:* Must-have

### P3-7: MCP Tool — `replace_svg`

Replace the entire SVG source. The nuclear option for when the AI wants to make sweeping changes. Always validated before applying.

*Technical approach:*
- Tool input: `{ source: string, validateOnly?: boolean }`.
- Tool output: `{ success: boolean, valid: boolean, parseErrors?: string[], elementCount: number, animationCount: number }`.
- Browser handler: parse with `DOMParser`, check for `parsererror`. If `validateOnly` is true, return validation result without applying. Otherwise, replace the `SvgDoc`, push old state to undo history.
- **Safety:** The tool always returns a diff summary (elements added/removed/changed) so the AI can confirm the change was what it intended.

*Priority:* Must-have

### P3-8: MCP Tool — `undo` / `redo`

Navigate the history stack. Essential for AI error recovery — if a change looks wrong, the AI (or user) can immediately revert.

*Technical approach:*
- Tool input: `{ action: "undo" | "redo" }`.
- Tool output: `{ success: boolean, historyDepth: number, canUndo: boolean, canRedo: boolean }`.
- Browser handler: delegates directly to the `SvgHistory` module from Phase 1.

*Priority:* Must-have

### P3-9: MCP Tool — `list_animations`

List all detected animations in the SVG with their properties — so the AI can reason about timing, sequencing, and conflicts.

*Technical approach:*
- Tool input: `{}` (no parameters).
- Tool output: `{ animations: [{ element: string, type: "css"|"smil", name: string, duration: string, delay: string, easing: string, iterationCount: string, state: "running"|"paused" }] }`.
- Browser handler: uses the generalized `AnimationDetector` from P1-4.

*Priority:* Nice-to-have

### P3-10: MCP Server Package & Setup

Ship the MCP server as a self-contained package within the repo, with a simple setup flow.

*Technical approach:*
- Directory: `mcp-server/` at repo root, with its own `package.json`.
- Dependencies: `@modelcontextprotocol/sdk`, `ws` (WebSocket library). Minimal footprint.
- Entry point: `mcp-server/index.js` — runnable via `node mcp-server/index.js` or `npx svg-editor-mcp`.
- **MCP client configuration:** Ship a sample `claude_desktop_config.json` snippet and a Raycast MCP config example in the README so users can connect in under a minute.
- **Transport:** Support both `stdio` (for Claude Desktop, which launches the process directly) and `SSE` over HTTP (for network-based MCP clients). The WebSocket to the browser is always localhost.
- **Zero-config default:** `npm run mcp` script in the root `package.json` starts the server. The browser app auto-connects when it detects the WebSocket is available.

*Priority:* Must-have

### MCP Configuration Examples

**Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "svg-editor": {
      "command": "node",
      "args": ["/path/to/svg-animation/mcp-server/index.js"]
    }
  }
}
```

**Raycast MCP Extension:**
```json
{
  "name": "svg-editor",
  "transport": "stdio",
  "command": "node",
  "args": ["/path/to/svg-animation/mcp-server/index.js"]
}
```

**What users can say to their AI client after connecting:**
- "Show me the element tree of my SVG"
- "Make the circle red and slow down its animation to 3 seconds"
- "Add a fade-in animation to every path element"
- "What elements have animations? List them with their durations"
- "Undo that last change"
- "Replace the entire SVG with an optimized version"

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
┌──────────────────────────────────────────────────────────────────────┐
│                         EditorContext                                 │
│  ┌─────────┐   ┌───────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │ Gallery  │   │ Selection │   │ UI Prefs     │   │ WebSocket   │  │
│  │ svgs[]   │   │ elementId │   │ grid, speed  │   │ connection  │  │
│  └────┬─────┘   └─────┬─────┘   └──────────────┘   └──────┬──────┘  │
│       │               │                                    │         │
│  ┌────▼─────────────────▼──────┐            ┌──────────────▼───────┐ │
│  │       Active SvgDoc         │◄──────────►│   MCP Tool Handler  │ │
│  │  (parsed DOM + serialize)   │  mutations  │   (dispatch actions)│ │
│  └────┬────────────┬───────────┘            └──────────────────────┘ │
│       │            │                                                 │
│  ┌────▼────┐  ┌────▼─────┐                                          │
│  │ History │  │ Renderer │                                          │
│  │ undo[]  │  │ (HTML)   │                                          │
│  │ redo[]  │  └──────────┘                                          │
│  └─────────┘                                                         │
└──────────────────────────────────────────────────────────────────────┘

Mutation flow (both MCP and manual share the same pipeline):

  Manual: User click ──► Mutation function ──► SvgDoc.update() ──► History.push()
                                                     │
  MCP:   AI tool call ──► WebSocket ──► dispatch ──► SvgDoc.update() ──► History.push()
                                                     │
                                                     ▼
                                            serialize() ──► re-render preview
                                                     │
                                            WebSocket ──► MCP Server ──► AI client
                                            (return updated state)
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Browser `DOMParser` for SVG model** | Zero dependencies, handles all SVG including embedded `<style>` and `<script>`. More reliable than regex or third-party AST parsers. |
| **`useReducer` + Context over Redux/Zustand** | App complexity is moderate. React's built-in primitives are sufficient and keep the zero-dependency philosophy. Revisit if state shape grows beyond ~10 top-level keys. |
| **String-diff history over structural diff** | Serialized SVG strings are easy to compare, store, and restore. Structural diffing is complex and error-prone with SVG's namespace quirks. String snapshots with a 50-entry cap are memory-safe for typical SVGs (<100KB). |
| **MCP server (external AI) over built-in chat panel** | Keeps the app focused as a visual editor. Users bring their own AI client (Claude Desktop, Raycast, Cursor). No API keys in the browser, no LLM vendor lock-in, no chat UI to maintain. MCP's structured tool calls are more reliable than asking an LLM to produce raw SVG strings. |
| **WebSocket bridge for MCP ↔ browser** | MCP servers run as Node.js processes (stdio/SSE), but the editor state lives in the browser. WebSocket is the simplest reliable bridge — persistent, bidirectional, low-latency. Falls back gracefully (app works without it). |
| **Structured MCP tools over raw SVG replacement** | Tools like `modify_element` and `add_animation` constrain what the AI can do, making mutations predictable and validatable. The `replace_svg` tool is the escape hatch for sweeping changes, but it always validates first. |
| **No TypeScript migration (yet)** | The codebase is JSX. Adding TS would be valuable long-term but is not a blocker for any phase. Consider migrating incrementally starting Phase 3 when the MCP server adds type complexity (the MCP SDK has good TS support). |
| **Inline styles over `<style>` blocks for per-element edits** | Inline styles are more predictable when elements are moved, copied, or exported. Reserve `<style>` block editing for `@keyframes` and global rules only. |

### Module Structure (Target)

```
svg-animation/
├── src/                               # React app (browser)
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── context/
│   │   └── EditorContext.jsx          # useReducer + Context provider
│   ├── model/
│   │   ├── SvgDoc.js                  # SVG document model (parse, query, mutate, serialize)
│   │   ├── SvgHistory.js              # Undo/redo stack
│   │   └── AnimationDetector.js       # Generalized animation discovery
│   ├── mcp/
│   │   ├── useWebSocket.js            # WebSocket connection hook
│   │   ├── toolDispatcher.js          # Routes MCP tool calls → EditorContext actions
│   │   └── connectionStatus.js        # Connection state (connected/disconnected)
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Toolbar.jsx                # + MCP connection indicator
│   │   ├── Gallery.jsx
│   │   ├── Card.jsx
│   │   ├── CodeEditor.jsx
│   │   ├── DropZone.jsx
│   │   ├── FocusOverlay.jsx
│   │   ├── Inspector/
│   │   │   ├── InspectorPanel.jsx     # Attribute viewer/editor
│   │   │   ├── ColorPicker.jsx
│   │   │   ├── TransformHandles.jsx
│   │   │   └── TimingControls.jsx
│   │   ├── Timeline/
│   │   │   ├── KeyframeEditor.jsx
│   │   │   └── Sequencer.jsx
│   │   └── shared/
│   │       ├── CommandPalette.jsx
│   │       └── ElementTree.jsx
│   ├── export/
│   │   ├── svgOptimizer.js            # SVGO wrapper
│   │   ├── vectorDrawable.js          # Android VD export
│   │   └── animatedPreview.js         # GIF/WebM export
│   └── hooks/
│       ├── useAnimation.js            # (existing, to be refactored)
│       ├── useSvgDocument.js
│       ├── useSvgHistory.js
│       └── useElementSelection.js
│
└── mcp-server/                        # MCP server (Node.js, separate process)
    ├── package.json                   # deps: @modelcontextprotocol/sdk, ws
    ├── index.js                       # Entry point, stdio + SSE transport
    ├── tools/
    │   ├── getSvgSource.js            # get_svg_source tool definition
    │   ├── getElementTree.js          # get_element_tree tool definition
    │   ├── getElementDetails.js       # get_element_details tool definition
    │   ├── modifyElement.js           # modify_element tool definition
    │   ├── addAnimation.js            # add_animation tool definition
    │   ├── replaceSvg.js              # replace_svg tool definition
    │   ├── listAnimations.js          # list_animations tool definition
    │   └── undoRedo.js                # undo/redo tool definition
    ├── bridge.js                      # WebSocket client → browser app
    └── README.md                      # Setup instructions + config examples
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
| **AI calls `replace_svg` with invalid SVG** | Broken rendering, data loss | `replace_svg` always validates with `DOMParser` before applying. Returns parse errors to the AI so it can self-correct. Structured tools like `modify_element` avoid this risk entirely by operating on individual attributes. |
| **Large SVGs overwhelm the editor** | Slow rendering, high memory | Lazy-render the element tree. Virtualize long lists. Cap history stack. Show file size warnings above 500KB. |
| **Undo history memory usage** | Browser tab crash on very large SVGs | Store diffs instead of full snapshots for SVGs over 100KB. Or compress snapshots with a lightweight algorithm. |
| **CSS specificity conflicts between editor UI and SVG content** | SVG styles leak into editor, or vice versa | Render SVGs in a Shadow DOM container or `<iframe>` sandbox. At minimum, scope all editor CSS under a `.editor-*` namespace. |
| **DOMParser namespace issues** | SVG elements not recognized correctly | Always parse with `'image/svg+xml'` MIME type. Handle the `parsererror` element that `DOMParser` inserts on failure. |
| **WebSocket disconnects between MCP server and browser** | AI tool calls fail silently | Implement reconnection with exponential backoff. MCP server queues tool calls during brief disconnects (up to 5s). Return clear error to AI client if browser is unreachable. |
| **MCP server port conflicts** | Server fails to start | Use a configurable port (default 9500) with automatic fallback to next available port. Write the active port to a `.mcp-port` file for the browser to discover. |
| **Multiple browser tabs open** | MCP server doesn't know which tab to target | Only one tab maintains the WebSocket connection at a time. Subsequent tabs see a "controlled by another tab" indicator. Or: MCP server uses `activeTab` parameter on tool calls to target a specific gallery entry. |

---

## 10. Phasing Summary

| Phase | Duration Estimate | Key Deliverables | Dependencies |
|-------|-------------------|------------------|--------------|
| **Quick Wins** | — | In-place edit, copy, background toggle, metadata, shortcuts | None |
| **Phase 1: Foundation** | — | SVG document model, undo/redo, element selection, animation detection, state management | None |
| **Phase 2: Manual Editing** | — | Attribute editor, color picker, transform handles, timing controls, element tree, easing presets | Phase 1 |
| **Phase 3: AI via MCP** | — | MCP server, WebSocket bridge, 8 structured tools (get/modify/animate/undo), connection indicator | Phase 1 |
| **Phase 4: Advanced Tools** | — | Keyframe timeline, sequencer, path editor, interaction builder, animation presets | Phase 2 |
| **Phase 5: Export & Polish** | — | SVG optimizer, VectorDrawable export, animated preview export, command palette, persistence, responsive layout | Phase 1+ |

> **Phases 2 and 3 can be developed in parallel** — they both depend on Phase 1 but are independent of each other. The MCP server (Phase 3) is a separate Node.js package with no dependency on the React component work in Phase 2. Phase 4 depends on Phase 2. Phase 5 items can be sprinkled in alongside any phase (especially persistence, which is valuable early).
>
> **MCP tools grow with the editor.** As Phase 2 adds capabilities (color picker, transform handles, timing controls), those same capabilities naturally become available through MCP — the tools call the same underlying mutation functions. No separate AI-specific work needed for each new editor feature.
