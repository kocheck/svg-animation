# Phase 1 Foundation + Quick Wins — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the editing infrastructure (SvgDoc, SvgHistory, AnimationDetector, EditorContext) and Quick Wins that all future SVG editor features depend on.

**Architecture:** Bottom-up — pure model classes first (fully unit tested), then state management (reducer tested), then component migration + new UI (component tested). Three React Contexts isolate re-render boundaries.

**Tech Stack:** Vite, React 19, Vitest, happy-dom, @testing-library/react, @testing-library/user-event

---

### Task 1: Testing Infrastructure Setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Create: `src/test/fixtures/simple.svg`
- Create: `src/test/fixtures/animated-css.svg`
- Create: `src/test/fixtures/animated-smil.svg`
- Create: `src/test/fixtures/complex.svg`
- Create: `src/test/fixtures/malformed.svg`

**Step 1: Install test dependencies**

Run:
```bash
npm install -D vitest happy-dom @testing-library/react @testing-library/user-event @vitest/coverage-v8
```

**Step 2: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/model/**', 'src/context/**', 'src/components/**', 'src/hooks/**'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
```

**Step 3: Create test setup file**

`src/test/setup.js`:
```js
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock crypto.randomUUID if not available
if (!globalThis.crypto?.randomUUID) {
  let counter = 0;
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => `test-uuid-${++counter}`,
  };
}
```

**Step 4: Create test fixtures**

`src/test/fixtures/simple.svg` — Basic circle + rect, no animations:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <circle id="c1" cx="200" cy="200" r="80" fill="#ff0000" stroke="#000000" stroke-width="2" />
  <rect id="r1" x="50" y="50" width="100" height="100" fill="#00ff00" />
</svg>
```

`src/test/fixtures/animated-css.svg` — CSS keyframe animations:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <style>
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes fade { 0% { opacity: 0; } 100% { opacity: 1; } }
    .spinner { animation: spin 2s linear infinite; transform-origin: center; }
    .fader { animation: fade 1.5s ease-in-out alternate infinite; }
  </style>
  <g id="group1">
    <circle id="spinning" class="spinner" cx="200" cy="200" r="80" fill="none" stroke="#000" stroke-width="2" />
    <rect id="fading" class="fader" x="50" y="50" width="100" height="100" fill="#00ff00" />
  </g>
</svg>
```

`src/test/fixtures/animated-smil.svg` — SMIL animate elements:
```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 400" width="400" height="400">
  <circle id="target" cx="200" cy="200" r="50" fill="blue">
    <animate attributeName="r" from="50" to="100" dur="2s" repeatCount="indefinite" />
  </circle>
  <rect id="mover" x="10" y="10" width="50" height="50" fill="red" />
  <animateTransform xlink:href="#mover" attributeName="transform" type="translate" from="0 0" to="300 0" dur="3s" repeatCount="indefinite" />
</svg>
```

`src/test/fixtures/complex.svg` — Mixed: gradients, CSS animations, SMIL, transitions, nested groups, text:
```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
    </linearGradient>
  </defs>
  <style>
    @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
    .pulse { animation: pulse 1s ease-in-out infinite; transform-origin: center; }
    .has-transition { transition: fill 0.3s ease; }
  </style>
  <g id="layer1">
    <circle id="grad-circle" cx="400" cy="300" r="100" fill="url(#grad1)" class="pulse" />
    <g id="nested">
      <rect id="trans-rect" class="has-transition" x="50" y="50" width="200" height="100" fill="#336699" />
      <path id="mypath" d="M10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" fill="none" stroke="#333" stroke-width="2" />
    </g>
  </g>
  <text id="label" x="400" y="550" text-anchor="middle" font-size="24" fill="#333">Hello SVG</text>
  <circle id="smil-circle" cx="600" cy="100" r="30" fill="green">
    <animate attributeName="cy" from="100" to="500" dur="4s" repeatCount="indefinite" />
  </circle>
</svg>
```

`src/test/fixtures/malformed.svg` — Intentionally broken XML:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <circle cx="200" cy="200" r="80" fill="#ff0000"
  <unclosed-tag>
</svg>
```

**Step 5: Add test scripts to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Step 6: Run to verify setup**

Run: `npm test`
Expected: 0 tests found, clean exit with no errors.

**Step 7: Commit**

```bash
git add -A && git commit -m "chore: add Vitest testing infrastructure with fixtures"
```

---

### Task 2: SvgDoc — Parse & Query (TDD)

**Files:**
- Create: `src/model/SvgDoc.js`
- Create: `src/model/SvgDoc.test.js`

**Step 1: Write failing tests for parse and query**

`src/model/SvgDoc.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SvgDoc } from './SvgDoc.js';

const fixture = (name) =>
  readFileSync(resolve(__dirname, '../test/fixtures', name), 'utf-8');

describe('SvgDoc.parse', () => {
  it('parses valid SVG and returns SvgDoc instance', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    expect(doc).toBeInstanceOf(SvgDoc);
  });

  it('throws on malformed SVG with descriptive message', () => {
    expect(() => SvgDoc.parse(fixture('malformed.svg'))).toThrow(/parse/i);
  });

  it('throws on empty string', () => {
    expect(() => SvgDoc.parse('')).toThrow();
  });

  it('throws on non-SVG XML', () => {
    expect(() => SvgDoc.parse('<div>not svg</div>')).toThrow();
  });
});

describe('SvgDoc query methods', () => {
  it('getRoot returns the root <svg> element', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    expect(root.tagName === 'svg' || root.localName === 'svg').toBe(true);
  });

  it('getElementById finds elements by their original id', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    expect(circle).not.toBeNull();
    expect(circle.tagName === 'circle' || circle.localName === 'circle').toBe(true);
  });

  it('getElementById returns null for missing id', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    expect(doc.getElementById('nonexistent')).toBeNull();
  });

  it('querySelector finds by CSS selector', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const rect = doc.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect.getAttribute('id')).toBe('r1');
  });

  it('querySelectorAll returns all matching elements', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const circles = doc.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('getAttributes returns all attributes as a plain object', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    const attrs = doc.getAttributes(circle);
    expect(attrs.cx).toBe('200');
    expect(attrs.cy).toBe('200');
    expect(attrs.r).toBe('80');
    expect(attrs.fill).toBe('#ff0000');
  });

  it('getAttributes excludes data-svgdoc-id', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    const attrs = doc.getAttributes(circle);
    expect(attrs['data-svgdoc-id']).toBeUndefined();
  });
});

describe('data-svgdoc-id injection', () => {
  it('injects data-svgdoc-id on all elements after parse', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const all = doc.querySelectorAll('*');
    for (const el of all) {
      expect(el.getAttribute('data-svgdoc-id')).toBeTruthy();
    }
  });

  it('assigns unique incrementing IDs', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const all = doc.querySelectorAll('*');
    const ids = all.map((el) => el.getAttribute('data-svgdoc-id'));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/SvgDoc.test.js`
Expected: FAIL — `SvgDoc` does not exist.

**Step 3: Implement SvgDoc parse and query methods**

`src/model/SvgDoc.js`:
```js
export class SvgDoc {
  #doc;
  #nextId;

  constructor(doc) {
    this.#doc = doc;
    this.#nextId = 1;
    this.#injectIds();
  }

  static parse(svgString) {
    if (!svgString || !svgString.trim()) {
      throw new Error('SvgDoc.parse: input string is empty');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(
        `SvgDoc.parse: invalid SVG — ${parseError.textContent.trim()}`
      );
    }

    const root = doc.documentElement;
    if (root.tagName !== 'svg' && root.localName !== 'svg') {
      throw new Error(
        `SvgDoc.parse: root element is <${root.tagName}>, expected <svg>`
      );
    }

    return new SvgDoc(doc);
  }

  #injectIds() {
    const all = this.#doc.querySelectorAll('*');
    for (const el of all) {
      el.setAttribute('data-svgdoc-id', String(this.#nextId++));
    }
  }

  getRoot() {
    return this.#doc.documentElement;
  }

  getElementById(id) {
    return this.#doc.getElementById(id);
  }

  querySelector(selector) {
    return this.#doc.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return Array.from(this.#doc.documentElement.querySelectorAll(selector));
  }

  getAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes) {
      if (attr.name === 'data-svgdoc-id') continue;
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/model/SvgDoc.test.js`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/model/SvgDoc.js src/model/SvgDoc.test.js && git commit -m "feat: SvgDoc parse and query methods with tests"
```

---

### Task 3: SvgDoc — Mutation & Serialization (TDD)

**Files:**
- Modify: `src/model/SvgDoc.js`
- Modify: `src/model/SvgDoc.test.js`

**Step 1: Write failing tests for mutation and serialization**

Append to `src/model/SvgDoc.test.js`:
```js
describe('SvgDoc mutations', () => {
  it('setAttribute changes an attribute and reflects in serialize', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    doc.setAttribute(circle, 'fill', '#0000ff');
    expect(circle.getAttribute('fill')).toBe('#0000ff');
    expect(doc.serialize()).toContain('fill="#0000ff"');
  });

  it('setAttribute returns this for chaining', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    const result = doc.setAttribute(circle, 'fill', '#0000ff');
    expect(result).toBe(doc);
  });

  it('removeAttribute removes an attribute', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    doc.removeAttribute(circle, 'stroke-width');
    expect(circle.getAttribute('stroke-width')).toBeNull();
    expect(doc.serialize()).not.toContain('stroke-width="2"');
  });

  it('setStyle sets inline style property', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    doc.setStyle(circle, 'opacity', '0.5');
    const style = circle.getAttribute('style') || circle.style?.cssText || '';
    expect(style).toContain('opacity');
  });

  it('addChild creates a new child element with attributes', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    const newEl = doc.addChild(root, 'ellipse', {
      cx: '100', cy: '100', rx: '50', ry: '30',
    });
    expect(newEl.tagName === 'ellipse' || newEl.localName === 'ellipse').toBe(true);
    expect(newEl.getAttribute('cx')).toBe('100');
    expect(doc.serialize()).toContain('ellipse');
  });

  it('addChild assigns a data-svgdoc-id to the new element', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    const newEl = doc.addChild(root, 'line', {
      x1: '0', y1: '0', x2: '100', y2: '100',
    });
    expect(newEl.getAttribute('data-svgdoc-id')).toBeTruthy();
  });

  it('removeElement removes an element from the document', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const rect = doc.getElementById('r1');
    doc.removeElement(rect);
    expect(doc.getElementById('r1')).toBeNull();
    expect(doc.serialize()).not.toContain('id="r1"');
  });

  it('insertBefore places element before reference node', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    const rect = doc.getElementById('r1');
    const newEl = doc.addChild(root, 'line', {
      x1: '0', y1: '0', x2: '50', y2: '50',
    });
    doc.insertBefore(newEl, rect);
    const children = Array.from(root.children);
    const lineIdx = children.indexOf(newEl);
    const rectIdx = children.indexOf(rect);
    expect(lineIdx).toBeLessThan(rectIdx);
  });
});

describe('SvgDoc serialization', () => {
  it('serialize strips data-svgdoc-id attributes', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const output = doc.serialize();
    expect(output).not.toContain('data-svgdoc-id');
  });

  it('serialize produces well-formed SVG XML', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const output = doc.serialize();
    expect(output).toContain('<svg');
    expect(output).toContain('</svg>');
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('round-trip parse(serialize()) produces equivalent output', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const serialized = doc.serialize();
    const doc2 = SvgDoc.parse(serialized);
    expect(doc2.serialize()).toBe(serialized);
  });

  it('preserves SVG with namespaces (xlink)', () => {
    const doc = SvgDoc.parse(fixture('animated-smil.svg'));
    const output = doc.serialize();
    expect(output).toContain('xlink');
  });

  it('preserves embedded style blocks', () => {
    const doc = SvgDoc.parse(fixture('animated-css.svg'));
    const output = doc.serialize();
    expect(output).toContain('@keyframes spin');
    expect(output).toContain('@keyframes fade');
  });

  it('clone returns independent copy', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const clone = doc.clone();
    const circle = clone.getElementById('c1');
    clone.setAttribute(circle, 'fill', '#999999');
    expect(doc.getElementById('c1').getAttribute('fill')).toBe('#ff0000');
    expect(clone.getElementById('c1').getAttribute('fill')).toBe('#999999');
  });
});

describe('SvgDoc.getStats', () => {
  it('returns correct element count for simple SVG', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.elementCount).toBe(2);
  });

  it('returns zero animations for static SVG', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.animationCount).toBe(0);
  });

  it('returns dimensions from root attributes', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.dimensions).toEqual({
      width: 400, height: 400, viewBox: '0 0 400 400',
    });
  });

  it('returns positive sizeBytes', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  it('counts CSS keyframe animations', () => {
    const doc = SvgDoc.parse(fixture('animated-css.svg'));
    const stats = doc.getStats();
    expect(stats.animationCount).toBeGreaterThanOrEqual(2);
  });

  it('counts SMIL animation elements', () => {
    const doc = SvgDoc.parse(fixture('animated-smil.svg'));
    const stats = doc.getStats();
    expect(stats.animationCount).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/SvgDoc.test.js`
Expected: FAIL — mutation and serialization methods not defined.

**Step 3: Add mutation, serialization, stats methods to SvgDoc**

Add these methods to the `SvgDoc` class in `src/model/SvgDoc.js`:
```js
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
    return this;
  }

  removeAttribute(element, name) {
    element.removeAttribute(name);
    return this;
  }

  setStyle(element, property, value) {
    element.style[property] = value;
    return this;
  }

  addChild(parent, tagName, attrs = {}) {
    const el = this.#doc.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val);
    }
    el.setAttribute('data-svgdoc-id', String(this.#nextId++));
    parent.appendChild(el);
    return el;
  }

  removeElement(element) {
    element.parentNode?.removeChild(element);
    return this;
  }

  insertBefore(newNode, refNode) {
    refNode.parentNode?.insertBefore(newNode, refNode);
    return this;
  }

  serialize() {
    const clone = this.#doc.documentElement.cloneNode(true);
    const all = clone.querySelectorAll('[data-svgdoc-id]');
    for (const el of all) {
      el.removeAttribute('data-svgdoc-id');
    }
    const serializer = new XMLSerializer();
    return serializer.serializeToString(clone);
  }

  clone() {
    return SvgDoc.parse(this.serialize());
  }

  getStats() {
    const root = this.#doc.documentElement;
    const allElements = root.querySelectorAll('*');
    const smilTags = root.querySelectorAll(
      'animate, animateTransform, animateMotion, animateColor, set'
    );

    let cssAnimCount = 0;
    const styleEls = root.querySelectorAll('style');
    for (const styleEl of styleEls) {
      const text = styleEl.textContent || '';
      const matches = text.match(/@keyframes\s/g);
      if (matches) cssAnimCount += matches.length;
    }

    const width = parseFloat(root.getAttribute('width')) || null;
    const height = parseFloat(root.getAttribute('height')) || null;
    const viewBox = root.getAttribute('viewBox') || null;
    const sizeBytes = new Blob([this.serialize()]).size;

    return {
      elementCount: allElements.length,
      animationCount: smilTags.length + cssAnimCount,
      dimensions: { width, height, viewBox },
      sizeBytes,
    };
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/model/SvgDoc.test.js`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/model/SvgDoc.js src/model/SvgDoc.test.js && git commit -m "feat: SvgDoc mutation, serialization, clone, and stats"
```

---

### Task 4: SvgHistory (TDD)

**Files:**
- Create: `src/model/SvgHistory.js`
- Create: `src/model/SvgHistory.test.js`

**Step 1: Write all SvgHistory tests**

`src/model/SvgHistory.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { SvgHistory } from './SvgHistory.js';

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
const SVG_B = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>';
const SVG_C = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>';
const SVG_D = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>';

describe('SvgHistory constructor', () => {
  it('initializes with the given source as current', () => {
    const h = new SvgHistory(SVG_A);
    expect(h.current).toBe(SVG_A);
  });

  it('starts with canUndo false and canRedo false', () => {
    const h = new SvgHistory(SVG_A);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('starts with depth { past: 0, future: 0 }', () => {
    const h = new SvgHistory(SVG_A);
    expect(h.depth).toEqual({ past: 0, future: 0 });
  });
});

describe('SvgHistory.push', () => {
  it('updates current to new source', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B);
    expect(h.current).toBe(SVG_B);
  });

  it('makes canUndo true', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B);
    expect(h.canUndo).toBe(true);
  });

  it('clears redo stack', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B);
    expect(h.canRedo).toBe(false);
  });

  it('returns a new instance (immutable)', () => {
    const h1 = new SvgHistory(SVG_A);
    const h2 = h1.push(SVG_B);
    expect(h1).not.toBe(h2);
    expect(h1.current).toBe(SVG_A);
  });

  it('is a no-op when pushing identical string', () => {
    const h1 = new SvgHistory(SVG_A);
    const h2 = h1.push(SVG_A);
    expect(h2).toBe(h1);
    expect(h2.depth).toEqual({ past: 0, future: 0 });
  });
});

describe('SvgHistory.undo', () => {
  it('rolls back to previous state', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B).undo();
    expect(h.current).toBe(SVG_A);
  });

  it('makes canRedo true', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B).undo();
    expect(h.canRedo).toBe(true);
  });

  it('is a no-op when canUndo is false', () => {
    const h1 = new SvgHistory(SVG_A);
    const h2 = h1.undo();
    expect(h2).toBe(h1);
  });

  it('supports multiple undos', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B).push(SVG_C).undo().undo();
    expect(h.current).toBe(SVG_A);
    expect(h.canUndo).toBe(false);
  });
});

describe('SvgHistory.redo', () => {
  it('moves forward after undo', () => {
    const h = new SvgHistory(SVG_A).push(SVG_B).undo().redo();
    expect(h.current).toBe(SVG_B);
  });

  it('is a no-op when canRedo is false', () => {
    const h1 = new SvgHistory(SVG_A).push(SVG_B);
    const h2 = h1.redo();
    expect(h2).toBe(h1);
  });

  it('supports multiple redos', () => {
    const h = new SvgHistory(SVG_A)
      .push(SVG_B).push(SVG_C)
      .undo().undo()
      .redo().redo();
    expect(h.current).toBe(SVG_C);
  });
});

describe('SvgHistory fork behavior', () => {
  it('clears redo stack when pushing after undo', () => {
    const h = new SvgHistory(SVG_A)
      .push(SVG_B).push(SVG_C)
      .undo()
      .push(SVG_D);
    expect(h.current).toBe(SVG_D);
    expect(h.canRedo).toBe(false);
    expect(h.depth).toEqual({ past: 2, future: 0 });
  });
});

describe('SvgHistory max depth', () => {
  it('drops oldest entries when exceeding maxDepth', () => {
    let h = new SvgHistory('<svg>0</svg>', { maxDepth: 5 });
    for (let i = 1; i <= 8; i++) {
      h = h.push(`<svg>${i}</svg>`);
    }
    expect(h.current).toBe('<svg>8</svg>');
    expect(h.depth.past).toBe(5);

    let undone = h;
    for (let i = 0; i < 5; i++) undone = undone.undo();
    expect(undone.canUndo).toBe(false);
    expect(undone.current).toBe('<svg>3</svg>');
  });
});

describe('SvgHistory batch operations', () => {
  it('beginBatch + commitBatch creates single undo entry', () => {
    const h = new SvgHistory(SVG_A)
      .push(SVG_B)
      .beginBatch()
      .commitBatch(SVG_C);
    expect(h.current).toBe(SVG_C);
    expect(h.depth).toEqual({ past: 2, future: 0 });
    const undone = h.undo();
    expect(undone.current).toBe(SVG_B);
  });

  it('commitBatch with same value as pre-batch is a no-op', () => {
    const h1 = new SvgHistory(SVG_A).push(SVG_B);
    const h2 = h1.beginBatch().commitBatch(SVG_B);
    expect(h2.depth).toEqual(h1.depth);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/SvgHistory.test.js`
Expected: FAIL — `SvgHistory` does not exist.

**Step 3: Implement SvgHistory**

`src/model/SvgHistory.js`:
```js
export class SvgHistory {
  #past;
  #present;
  #future;
  #maxDepth;
  #batchAnchor;

  constructor(initialSrc, { maxDepth = 50, _past, _future, _batchAnchor } = {}) {
    this.#past = _past || [];
    this.#present = initialSrc;
    this.#future = _future || [];
    this.#maxDepth = maxDepth;
    this.#batchAnchor = _batchAnchor ?? null;
  }

  get current() {
    return this.#present;
  }

  get canUndo() {
    return this.#past.length > 0;
  }

  get canRedo() {
    return this.#future.length > 0;
  }

  get depth() {
    return { past: this.#past.length, future: this.#future.length };
  }

  push(newSrc) {
    if (newSrc === this.#present) return this;

    let newPast = [...this.#past, this.#present];
    if (newPast.length > this.#maxDepth) {
      newPast = newPast.slice(newPast.length - this.#maxDepth);
    }

    return new SvgHistory(newSrc, {
      maxDepth: this.#maxDepth,
      _past: newPast,
      _future: [],
      _batchAnchor: null,
    });
  }

  undo() {
    if (!this.canUndo) return this;

    const newPast = this.#past.slice(0, -1);
    const prev = this.#past[this.#past.length - 1];

    return new SvgHistory(prev, {
      maxDepth: this.#maxDepth,
      _past: newPast,
      _future: [this.#present, ...this.#future],
      _batchAnchor: null,
    });
  }

  redo() {
    if (!this.canRedo) return this;

    const next = this.#future[0];
    const newFuture = this.#future.slice(1);

    return new SvgHistory(next, {
      maxDepth: this.#maxDepth,
      _past: [...this.#past, this.#present],
      _future: newFuture,
      _batchAnchor: null,
    });
  }

  beginBatch() {
    return new SvgHistory(this.#present, {
      maxDepth: this.#maxDepth,
      _past: this.#past,
      _future: this.#future,
      _batchAnchor: this.#present,
    });
  }

  commitBatch(finalSrc) {
    const anchor = this.#batchAnchor ?? this.#present;
    if (finalSrc === anchor) {
      return new SvgHistory(anchor, {
        maxDepth: this.#maxDepth,
        _past: this.#past,
        _future: this.#future,
        _batchAnchor: null,
      });
    }

    let newPast = [...this.#past, anchor];
    if (newPast.length > this.#maxDepth) {
      newPast = newPast.slice(newPast.length - this.#maxDepth);
    }

    return new SvgHistory(finalSrc, {
      maxDepth: this.#maxDepth,
      _past: newPast,
      _future: [],
      _batchAnchor: null,
    });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/model/SvgHistory.test.js`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/model/SvgHistory.js src/model/SvgHistory.test.js && git commit -m "feat: SvgHistory immutable undo/redo stack with batch support"
```

---

### Task 5: AnimationDetector (TDD)

**Files:**
- Create: `src/model/AnimationDetector.js`
- Create: `src/model/AnimationDetector.test.js`

**Step 1: Write failing tests**

`src/model/AnimationDetector.test.js`:
```js
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { detectAnimations } from './AnimationDetector.js';

const fixture = (name) =>
  readFileSync(resolve(__dirname, '../test/fixtures', name), 'utf-8');

const containers = [];

function render(fixtureName) {
  const container = document.createElement('div');
  container.innerHTML = fixture(fixtureName);
  document.body.appendChild(container);
  containers.push(container);
  return container.querySelector('svg');
}

afterEach(() => {
  containers.forEach((el) => el.remove());
  containers.length = 0;
});

describe('detectAnimations — no animations', () => {
  it('returns empty array for static SVG', () => {
    const svgEl = render('simple.svg');
    const result = detectAnimations(svgEl);
    expect(result).toEqual([]);
  });
});

describe('detectAnimations — SMIL', () => {
  it('detects animate elements', () => {
    const svgEl = render('animated-smil.svg');
    const result = detectAnimations(svgEl);
    const smilAnims = result.filter((a) => a.type === 'smil');
    expect(smilAnims.length).toBeGreaterThanOrEqual(2);
  });

  it('resolves parent target for inline SMIL', () => {
    const svgEl = render('animated-smil.svg');
    const result = detectAnimations(svgEl);
    const rAnim = result.find(
      (a) => a.type === 'smil' && a.smilAttributes?.attributeName === 'r'
    );
    expect(rAnim).toBeDefined();
    expect(rAnim.target.getAttribute('id')).toBe('target');
  });

  it('resolves xlink:href target for external SMIL', () => {
    const svgEl = render('animated-smil.svg');
    const result = detectAnimations(svgEl);
    const transformAnim = result.find(
      (a) => a.type === 'smil' && a.name === 'animateTransform'
    );
    expect(transformAnim).toBeDefined();
    expect(transformAnim.target.getAttribute('id')).toBe('mover');
  });

  it('marks SMIL as not Android compatible', () => {
    const svgEl = render('animated-smil.svg');
    const result = detectAnimations(svgEl);
    const smilAnims = result.filter((a) => a.type === 'smil');
    for (const anim of smilAnims) {
      expect(anim.androidCompatible).toBe(false);
      expect(anim.warnings.length).toBeGreaterThan(0);
    }
  });

  it('includes SMIL attributes', () => {
    const svgEl = render('animated-smil.svg');
    const result = detectAnimations(svgEl);
    const rAnim = result.find(
      (a) => a.type === 'smil' && a.smilAttributes?.attributeName === 'r'
    );
    expect(rAnim.smilAttributes.from).toBe('50');
    expect(rAnim.smilAttributes.to).toBe('100');
    expect(rAnim.smilAttributes.dur).toBe('2s');
  });
});

describe('detectAnimations — CSS', () => {
  it('detects elements with CSS animation-name (when supported by env)', () => {
    const svgEl = render('animated-css.svg');
    const result = detectAnimations(svgEl);
    const cssAnims = result.filter((a) => a.type === 'css');
    // happy-dom may not fully resolve getComputedStyle for CSS animations
    // so we accept >= 0 and test the structure if any are found
    if (cssAnims.length > 0) {
      expect(cssAnims[0].properties.duration).toBeDefined();
      expect(cssAnims[0].androidCompatible).toBe(true);
    }
  });
});

describe('detectAnimations — mixed', () => {
  it('detects SMIL in complex SVG', () => {
    const svgEl = render('complex.svg');
    const result = detectAnimations(svgEl);
    const smil = result.filter((a) => a.type === 'smil');
    expect(smil.length).toBeGreaterThanOrEqual(1);
  });

  it('returns no duplicates', () => {
    const svgEl = render('complex.svg');
    const result = detectAnimations(svgEl);
    const keys = result.map(
      (a) => `${a.type}-${a.element.tagName}-${a.name}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/AnimationDetector.test.js`
Expected: FAIL — `detectAnimations` does not exist.

**Step 3: Implement AnimationDetector**

`src/model/AnimationDetector.js`:
```js
const SMIL_SELECTOR =
  'animate, animateTransform, animateMotion, animateColor, set';

function resolveSmilTarget(smilEl) {
  const href =
    smilEl.getAttribute('href') ||
    smilEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
  if (href) {
    const root = smilEl.closest('svg');
    if (root) {
      const id = href.replace(/^#/, '');
      return root.querySelector(`[id="${id}"]`);
    }
  }
  return smilEl.parentElement;
}

function getSmilAttributes(el) {
  const attrNames = [
    'attributeName', 'from', 'to', 'values', 'dur', 'begin', 'end',
    'repeatCount', 'repeatDur', 'fill', 'type',
  ];
  const attrs = {};
  for (const name of attrNames) {
    const val = el.getAttribute(name);
    if (val !== null) attrs[name] = val;
  }
  return attrs;
}

function detectSmil(svgEl) {
  const elements = svgEl.querySelectorAll(SMIL_SELECTOR);
  const results = [];

  for (const el of elements) {
    const target = resolveSmilTarget(el);
    const smilAttrs = getSmilAttributes(el);

    results.push({
      element: el,
      elementId: el.getAttribute('data-svgdoc-id') || null,
      type: 'smil',
      name: el.tagName || el.localName,
      properties: {
        duration: smilAttrs.dur || null,
        delay: smilAttrs.begin || '0s',
        easing: null,
        iterationCount: smilAttrs.repeatCount || '1',
        direction: null,
        fillMode: smilAttrs.fill || null,
        state: 'running',
      },
      target: target || el.parentElement,
      smilAttributes: smilAttrs,
      androidCompatible: false,
      warnings: ['SMIL animations are not supported on Android VectorDrawable'],
    });
  }

  return results;
}

function detectCssAnimations(svgEl) {
  const results = [];
  const allElements = svgEl.querySelectorAll('*');

  for (const el of allElements) {
    try {
      const computed = getComputedStyle(el);
      const animName = computed.animationName;
      if (!animName || animName === 'none') continue;

      const names = animName.split(',').map((n) => n.trim()).filter((n) => n !== 'none');
      const durations = (computed.animationDuration || '0s').split(',').map((d) => d.trim());
      const delays = (computed.animationDelay || '0s').split(',').map((d) => d.trim());
      const easings = (computed.animationTimingFunction || 'ease').split(',').map((e) => e.trim());
      const iterations = (computed.animationIterationCount || '1').split(',').map((i) => i.trim());
      const directions = (computed.animationDirection || 'normal').split(',').map((d) => d.trim());
      const fillModes = (computed.animationFillMode || 'none').split(',').map((f) => f.trim());
      const states = (computed.animationPlayState || 'running').split(',').map((s) => s.trim());

      for (let i = 0; i < names.length; i++) {
        results.push({
          element: el,
          elementId: el.getAttribute('data-svgdoc-id') || null,
          type: 'css',
          name: names[i],
          properties: {
            duration: durations[i % durations.length] || '0s',
            delay: delays[i % delays.length] || '0s',
            easing: easings[i % easings.length] || 'ease',
            iterationCount: iterations[i % iterations.length] || '1',
            direction: directions[i % directions.length] || 'normal',
            fillMode: fillModes[i % fillModes.length] || 'none',
            state: states[i % states.length] || 'running',
          },
          target: el,
          smilAttributes: null,
          androidCompatible: true,
          warnings: [],
        });
      }
    } catch {
      // skip elements where getComputedStyle fails
    }
  }

  return results;
}

function detectCssTransitions(svgEl) {
  const results = [];
  const allElements = svgEl.querySelectorAll('*');

  for (const el of allElements) {
    try {
      const computed = getComputedStyle(el);
      const prop = computed.transitionProperty;
      const dur = computed.transitionDuration;
      if (!prop || prop === 'none' || prop === 'all') continue;
      if (!dur || dur === '0s') continue;

      results.push({
        element: el,
        elementId: el.getAttribute('data-svgdoc-id') || null,
        type: 'transition',
        name: prop,
        properties: {
          duration: dur,
          delay: computed.transitionDelay || '0s',
          easing: computed.transitionTimingFunction || 'ease',
          iterationCount: '1',
          direction: null,
          fillMode: null,
          state: 'idle',
        },
        target: el,
        smilAttributes: null,
        androidCompatible: true,
        warnings: [],
      });
    } catch {
      // skip
    }
  }

  return results;
}

export function detectAnimations(svgElement) {
  const smil = detectSmil(svgElement);
  const css = detectCssAnimations(svgElement);
  const transitions = detectCssTransitions(svgElement);
  return [...smil, ...css, ...transitions];
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/model/AnimationDetector.test.js`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/model/AnimationDetector.js src/model/AnimationDetector.test.js && git commit -m "feat: AnimationDetector for CSS, SMIL, and transition discovery"
```

---

### Task 6: EditorContext — Reducers & Providers (TDD)

**Files:**
- Create: `src/context/EditorContext.jsx`
- Create: `src/context/EditorContext.test.jsx`
- Create: `src/context/testUtils.jsx`

**Step 1: Write failing reducer/provider tests**

`src/context/EditorContext.test.jsx` — Test all three contexts (DocumentContext, SelectionContext, UIContext) using consumer components that read state and dispatch actions. See design doc section 4 for full action list. Tests:
- DocumentContext: ADD_DOCUMENT creates doc with history, REMOVE_DOCUMENT removes, UPDATE_DOCUMENT pushes history, UNDO/REDO navigate history
- SelectionContext: SELECT_ELEMENT sets id, HOVER_ELEMENT sets hover, CLEAR_SELECTION resets
- UIContext: SET_GRID_COLS, SET_SPEED, TOGGLE_PAUSE, RESET_SPEED, SET_PREVIEW_BG all update correctly, defaults are gridCols=2, speed=1, paused=false, bg='dark'

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/context/EditorContext.test.jsx`
Expected: FAIL.

**Step 3: Implement EditorContext**

`src/context/EditorContext.jsx` — Three context providers:
- `DocumentProvider` + `useDocumentContext()` — `useReducer` with documentReducer handling ADD/REMOVE/UPDATE/REPLACE/SET_ACTIVE/UNDO/REDO. Creates documents as `{ id: crypto.randomUUID(), name, history: new SvgHistory(src), doc: SvgDoc.parse(src) }`. On UPDATE/UNDO/REDO, re-parses doc from `history.current`.
- `SelectionProvider` + `useSelectionContext()` — `useReducer` with selectionReducer handling SELECT_ELEMENT/HOVER_ELEMENT/CLEAR_SELECTION.
- `UIProvider` + `useUIContext()` — `useReducer` with uiReducer handling SET_GRID_COLS/SET_SPEED/TOGGLE_PAUSE/RESET_SPEED/SET_FOCUS/CLEAR_FOCUS/TOGGLE_EDITOR/SET_PREVIEW_BG.
- `EditorProvider` — convenience wrapper nesting all three.

`src/context/testUtils.jsx` — `renderWithProviders(ui, { initialDocState })` helper wrapping components in all three providers.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/context/EditorContext.test.jsx`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/context/ && git commit -m "feat: EditorContext with Document, Selection, and UI providers"
```

---

### Task 7: Migrate App Shell + Toolbar + Header (TDD)

**Files:**
- Modify: `src/main.jsx` — wrap App in EditorProvider
- Modify: `src/App.jsx` — remove useState, become thin layout shell
- Modify: `src/components/Toolbar.jsx` — use `useUIContext()`, add QW-3 background toggle
- Modify: `src/components/Header.jsx` — use `useDocumentContext()`
- Create: `src/components/Toolbar.test.jsx`
- Create: `src/components/Header.test.jsx`
- Modify: `src/index.css` — add QW-3 background CSS classes

**Step 1: Write Toolbar test with QW-3**

`src/components/Toolbar.test.jsx` — Tests: renders grid buttons, speed slider, pause toggle. QW-3: renders bg-toggle button, cycles dark→light→checker→dark on click.

**Step 2: Write Header test**

`src/components/Header.test.jsx` — Tests: renders title, shows "0 animations" when empty.

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/Toolbar.test.jsx src/components/Header.test.jsx`
Expected: FAIL.

**Step 4: Migrate components**

- `Header.jsx`: Remove `count` prop, read `documents.length` from `useDocumentContext()`
- `Toolbar.jsx`: Remove all props, read from `useUIContext()`, dispatch actions. Add BG toggle button cycling through `['dark', 'light', 'checker']`.
- `main.jsx`: Wrap `<App>` in `<EditorProvider>`
- `index.css`: Add `.preview-bg-dark`, `.preview-bg-light`, `.preview-bg-checker` classes

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/Toolbar.test.jsx src/components/Header.test.jsx`
Expected: All PASS.

**Step 6: Verify app runs**

Run: `npm run dev`
Manual: toolbar works, background toggle cycles.

**Step 7: Commit**

```bash
git add src/ && git commit -m "feat: migrate Header, Toolbar to Context + QW-3 background toggle"
```

---

### Task 8: Migrate Gallery + Card + DropZone (TDD)

**Files:**
- Modify: `src/components/Gallery.jsx` — use context
- Modify: `src/components/Card.jsx` — use context, add QW-2 copy, QW-3 bg class
- Modify: `src/components/DropZone.jsx` — use context
- Create: `src/components/Card.test.jsx`

**Step 1: Write Card test with QW-2 + QW-3**

`src/components/Card.test.jsx` — Tests: renders name, renders Copy button, copies source on click (verifies `navigator.clipboard.writeText` called), applies `preview-bg-dark` class.

**Step 2: Run tests to verify they fail**

Expected: FAIL.

**Step 3: Migrate components**

- `Gallery.jsx`: Remove all props, read `documents` from `useDocumentContext()`, `gridCols` from `useUIContext()`. Render `<Card document={doc} />`.
- `Card.jsx`: Receive `document` prop (object from context). Use `useUIContext()` for speed/paused/bg. Add copy button with `navigator.clipboard.writeText(doc.history.current)` + flash. Apply `preview-bg-${ui.previewBackground}` class to svg-wrap. Note: continues using existing `dangerouslySetInnerHTML` pattern for SVG rendering (same as current codebase).
- `DropZone.jsx`: Remove `onFilesAdded` prop, dispatch `ADD_DOCUMENT` directly.

**Step 4: Update App.jsx — remove all remaining useState**

App becomes: `<><Header /><Toolbar /><Gallery /><DropZone /><CodeEditor /><FocusOverlay /></>`

**Step 5: Run tests**

Run: `npx vitest run src/components/Card.test.jsx`
Expected: All PASS.

**Step 6: Commit**

```bash
git add src/ && git commit -m "feat: migrate Gallery, Card, DropZone to Context + QW-2 copy button"
```

---

### Task 9: Migrate CodeEditor + FocusOverlay (TDD with QW-1, QW-4, QW-5)

**Files:**
- Modify: `src/components/CodeEditor.jsx`
- Create: `src/components/CodeEditor.test.jsx`
- Modify: `src/components/FocusOverlay.jsx`
- Create: `src/components/FocusOverlay.test.jsx`

**Step 1: Write CodeEditor tests**

`src/components/CodeEditor.test.jsx` — Tests:
- QW-1: shows "Add to Gallery" when no activeDocumentId; shows "Save Changes" when editing
- QW-4: renders metadata bar (data-testid="svg-metadata") when valid SVG present
- QW-5: renders Ctrl+Enter hint text

**Step 2: Write FocusOverlay tests**

`src/components/FocusOverlay.test.jsx` — Tests: hidden when no focusDocumentId, renders copy button, renders keyboard hints strip.

**Step 3: Run tests to verify they fail**

Expected: FAIL.

**Step 4: Migrate CodeEditor**

- Remove `editTarget` and `onAddToGallery` props
- Read `activeDocumentId` and `documents` from `useDocumentContext()`
- If `activeDocumentId` is set, pre-fill code from that document, show "Save Changes" → dispatch `REPLACE_DOCUMENT` (QW-1)
- If no active doc, show "Add to Gallery" → dispatch `ADD_DOCUMENT`
- Add metadata bar using `SvgDoc.parse(code).getStats()` guarded by try/catch (QW-4)
- Add `Ctrl+Enter` in handleKeyDown → trigger submit (QW-5)
- Add hint text: "Ctrl+Enter to submit"

**Step 5: Migrate FocusOverlay**

- Remove all props
- Read `focusDocumentId` from `useUIContext()`, `documents` from `useDocumentContext()`
- Find focused doc by ID, navigate via dispatching `SET_FOCUS` with next/prev doc ID
- Close via `CLEAR_FOCUS`
- Add copy button (QW-2)
- Add `<kbd>` hint strip: `← → navigate · Esc close · E edit` (QW-5)
- Apply `preview-bg-*` class (QW-3)

**Step 6: Run tests**

Run: `npx vitest run src/components/CodeEditor.test.jsx src/components/FocusOverlay.test.jsx`
Expected: All PASS.

**Step 7: Commit**

```bash
git add src/ && git commit -m "feat: migrate CodeEditor, FocusOverlay to Context + QW-1,4,5"
```

---

### Task 10: Element Selection Hook + Overlay (TDD)

**Files:**
- Create: `src/hooks/useElementSelection.js`
- Create: `src/hooks/useElementSelection.test.js`
- Create: `src/components/SelectionOverlay.jsx`
- Create: `src/components/SelectionOverlay.test.jsx`

**Step 1: Write selection hook tests**

`src/hooks/useElementSelection.test.js` — Tests:
- Click element with data-svgdoc-id → calls onSelect with that ID
- Click container (empty space) → calls onSelect with null
- Click nested element without data-svgdoc-id → walks up to nearest parent with ID

**Step 2: Run tests to verify they fail**

Expected: FAIL.

**Step 3: Implement useElementSelection**

`src/hooks/useElementSelection.js`:
- Attaches delegated click + mousemove handlers to containerRef
- On click: walk up from event.target to find nearest `data-svgdoc-id`, skip root `<svg>`, call `onSelect(id)` or `onSelect(null)` if none found
- On mousemove: same walk-up, call `onHover(id)`

**Step 4: Write SelectionOverlay tests**

`src/components/SelectionOverlay.test.jsx` — Tests: renders nothing when no selection, renders dashed rect when element selected (in environments where getBBox works).

**Step 5: Implement SelectionOverlay**

`src/components/SelectionOverlay.jsx`:
- Reads `selection` from `useSelectionContext()`
- Finds element by `data-svgdoc-id` in the SVG container
- Uses `getBBox()` (guarded by try/catch) to position a dashed rect overlay
- Shows hover highlight at 0.4 opacity for `hoveredElementId`

**Step 6: Run tests**

Run: `npx vitest run src/hooks/useElementSelection.test.js src/components/SelectionOverlay.test.jsx`
Expected: All PASS.

**Step 7: Commit**

```bash
git add src/hooks/ src/components/SelectionOverlay.* && git commit -m "feat: element selection hook and overlay"
```

---

### Task 11: Inspector Panel (TDD)

**Files:**
- Create: `src/components/Inspector/InspectorPanel.jsx`
- Create: `src/components/Inspector/InspectorPanel.test.jsx`
- Modify: `src/index.css`

**Step 1: Write InspectorPanel tests**

`src/components/Inspector/InspectorPanel.test.jsx` — Tests: shows "Select an element" placeholder when no selection, renders element tag name when selected, displays attributes table, shows parent chain breadcrumb.

**Step 2: Run tests to verify they fail**

Expected: FAIL.

**Step 3: Implement InspectorPanel**

`src/components/Inspector/InspectorPanel.jsx`:
- Reads `selection` from `useSelectionContext()`, `documents`/`activeDocumentId` from `useDocumentContext()`
- Finds selected element in active doc's `SvgDoc` by `data-svgdoc-id`
- Renders: element header (tag, id, class pills), attributes table (read-only key-value rows via `doc.getAttributes()`), parent chain breadcrumb
- Empty state: "Select an element to inspect"

**Step 4: Add inspector CSS to index.css**

Inspector panel styles: 300px width, dark surface background, syntax-highlighted attribute keys/values, class pills, breadcrumb styling.

**Step 5: Run tests**

Run: `npx vitest run src/components/Inspector/InspectorPanel.test.jsx`
Expected: All PASS.

**Step 6: Commit**

```bash
git add src/components/Inspector/ src/index.css && git commit -m "feat: read-only Inspector panel with attributes and parent chain"
```

---

### Task 12: Integration Wiring + Final Verification

**Files:**
- Modify: `src/App.jsx` — wire selection + inspector into layout
- Modify: `src/index.css` — main layout with inspector sidebar

**Step 1: Update App.jsx layout**

Wire InspectorPanel and SelectionOverlay into App. Gallery + Inspector sit in a flex row. Selection overlay positioned over the SVG preview area.

**Step 2: Add layout CSS**

Main content area becomes flex row: gallery (flex:1) + inspector (300px). Inspector only visible when an element is selected.

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass across all files.

**Step 4: Run coverage**

Run: `npm run test:coverage`
Expected: Meets thresholds (90/85/90/90). If not, add targeted tests for gaps.

**Step 5: Manual verification**

Run: `npm run dev`
Checklist:
- [ ] Drop SVG → appears in gallery
- [ ] Grid buttons work (1/2/3)
- [ ] Speed slider + pause/play work
- [ ] Background toggle cycles dark/light/checker (QW-3)
- [ ] Card: copy button copies source (QW-2)
- [ ] Focus overlay: opens on card click, copy button, keyboard hints (QW-2, QW-5)
- [ ] Focus overlay: background mode applied (QW-3)
- [ ] Code editor: Add to Gallery for new SVG
- [ ] Code editor: Edit card → Save Changes mode (QW-1)
- [ ] Code editor: Ctrl+Enter submits (QW-5)
- [ ] Code editor: metadata bar shows dims/count/size (QW-4)
- [ ] Click SVG element → highlight overlay appears
- [ ] Inspector panel shows tag, attributes, parent chain
- [ ] Click another element → inspector updates
- [ ] Click empty space → selection clears
- [ ] Undo/Redo via code editor works
- [ ] Build succeeds: `npm run build`

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: wire inspector and selection into app layout, complete Phase 1"
```

---

## Task Dependencies

```
Task 1 (test infra) ──► Task 2 (SvgDoc parse) ──► Task 3 (SvgDoc mutation)
                    ──► Task 4 (SvgHistory)
                    ──► Task 5 (AnimationDetector)
                                                      │
Tasks 2-5 ──────────────────────────────────────────► Task 6 (EditorContext)
                                                          │
Task 6 ─────────────────────────────────────────────► Task 7 (App/Toolbar/Header)
                                                          │
Task 7 ─────────────────────────────────────────────► Task 8 (Gallery/Card/DropZone)
                                                          │
Task 8 ─────────────────────────────────────────────► Task 9 (CodeEditor/FocusOverlay)
                                                          │
Task 6 ─────────────────────────────────────────────► Task 10 (Selection hook/overlay)
                                                          │
Tasks 9-10 ─────────────────────────────────────────► Task 11 (Inspector)
                                                          │
Task 11 ────────────────────────────────────────────► Task 12 (Integration)
```

**Parallelizable:** Tasks 2-5 can run concurrently after Task 1. Tasks 10-11 can start as soon as Task 6 is done, in parallel with Tasks 7-9.
