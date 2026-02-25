import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SvgDoc } from './SvgDoc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  readFileSync(resolve(__dirname, '../test/fixtures', name), 'utf-8');

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------
describe('SvgDoc.parse', () => {
  it('returns an SvgDoc instance for valid SVG', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    expect(doc).toBeInstanceOf(SvgDoc);
  });

  it('parses every fixture without throwing', () => {
    for (const name of ['simple.svg', 'animated-css.svg', 'animated-smil.svg', 'complex.svg']) {
      expect(() => SvgDoc.parse(fixture(name))).not.toThrow();
    }
  });

  it('throws with /parse/i for malformed SVG', () => {
    expect(() => SvgDoc.parse(fixture('malformed.svg'))).toThrow(/parse/i);
  });

  it('throws for empty string', () => {
    expect(() => SvgDoc.parse('')).toThrow();
  });

  it('throws for whitespace-only string', () => {
    expect(() => SvgDoc.parse('   \n\t  ')).toThrow();
  });

  it('throws for non-SVG XML (root is not <svg>)', () => {
    expect(() => SvgDoc.parse('<html><body>hi</body></html>')).toThrow(/svg/i);
  });

  it('throws for plain text input', () => {
    expect(() => SvgDoc.parse('hello world')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------
describe('SvgDoc query methods', () => {
  it('getRoot returns the <svg> element', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    // happy-dom may return tagName or localName as 'svg'
    expect(root.tagName === 'svg' || root.localName === 'svg').toBe(true);
  });

  it('getElementById finds an element by its id attribute', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    expect(circle).not.toBeNull();
    expect(circle.tagName === 'circle' || circle.localName === 'circle').toBe(true);
  });

  it('getElementById returns null for a missing id', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    expect(doc.getElementById('nonexistent')).toBeNull();
  });

  it('querySelector finds the first match', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const el = doc.querySelector('rect');
    expect(el).not.toBeNull();
    expect(el.getAttribute('id')).toBe('r1');
  });

  it('querySelectorAll returns all matches as an Array', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const circles = doc.querySelectorAll('circle');
    expect(Array.isArray(circles)).toBe(true);
    expect(circles).toHaveLength(2);
    const ids = circles.map((c) => c.getAttribute('id'));
    expect(ids).toContain('grad-circle');
    expect(ids).toContain('smil-circle');
  });

  it('querySelectorAll returns empty array when nothing matches', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const polygons = doc.querySelectorAll('polygon');
    expect(polygons).toEqual([]);
  });

  it('getAttributes returns a plain object excluding data-svgdoc-id', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const el = doc.getElementById('c1');
    const attrs = doc.getAttributes(el);
    expect(attrs).toBeTypeOf('object');
    expect(attrs).not.toHaveProperty('data-svgdoc-id');
    expect(attrs).toHaveProperty('id', 'c1');
    expect(attrs).toHaveProperty('cx', '200');
    expect(attrs).toHaveProperty('cy', '200');
    expect(attrs).toHaveProperty('r', '80');
    expect(attrs).toHaveProperty('fill', '#ff0000');
    expect(attrs).toHaveProperty('stroke', '#000000');
    expect(attrs).toHaveProperty('stroke-width', '2');
  });
});

// ---------------------------------------------------------------------------
// data-svgdoc-id injection
// ---------------------------------------------------------------------------
describe('data-svgdoc-id injection', () => {
  it('every element has a data-svgdoc-id attribute', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    // Check root itself
    expect(root.hasAttribute('data-svgdoc-id')).toBe(true);
    // Check all descendants
    const all = root.querySelectorAll('*');
    for (const el of all) {
      expect(el.hasAttribute('data-svgdoc-id')).toBe(true);
    }
  });

  it('all data-svgdoc-id values are unique', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const root = doc.getRoot();
    const ids = new Set();
    ids.add(root.getAttribute('data-svgdoc-id'));
    for (const el of root.querySelectorAll('*')) {
      const id = el.getAttribute('data-svgdoc-id');
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });

  it('data-svgdoc-id values are numeric strings', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    for (const el of root.querySelectorAll('*')) {
      const id = el.getAttribute('data-svgdoc-id');
      expect(Number.isFinite(Number(id))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
describe('SvgDoc mutations', () => {
  it('setAttribute changes an attribute and reflects in serialize', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    const result = doc.setAttribute(circle, 'fill', 'blue');
    expect(circle.getAttribute('fill')).toBe('blue');
    expect(doc.serialize()).toContain('fill="blue"');
    // returns this for chaining
    expect(result).toBe(doc);
  });

  it('removeAttribute removes an attribute', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    doc.removeAttribute(circle, 'stroke');
    expect(circle.hasAttribute('stroke')).toBe(false);
    expect(doc.serialize()).not.toContain('stroke="#000000"');
  });

  it('removeAttribute returns this for chaining', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    const result = doc.removeAttribute(circle, 'stroke');
    expect(result).toBe(doc);
  });

  it('setStyle sets an inline style property', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const circle = doc.getElementById('c1');
    const result = doc.setStyle(circle, 'fill', 'blue');
    expect(circle.getAttribute('style')).toContain('fill');
    expect(circle.getAttribute('style')).toContain('blue');
    // returns this for chaining
    expect(result).toBe(doc);
  });

  it('addChild creates an element with given attrs and assigns data-svgdoc-id', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    const el = doc.addChild(root, 'ellipse', { cx: '100', cy: '100', rx: '50', ry: '30' });
    expect(el.tagName === 'ellipse' || el.localName === 'ellipse').toBe(true);
    expect(el.getAttribute('cx')).toBe('100');
    expect(el.getAttribute('ry')).toBe('30');
    expect(el.hasAttribute('data-svgdoc-id')).toBe(true);
    // should appear in the DOM
    expect(root.contains(el)).toBe(true);
  });

  it('addChild data-svgdoc-id is unique from existing IDs', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    const existingIds = new Set();
    for (const el of root.querySelectorAll('*')) {
      existingIds.add(el.getAttribute('data-svgdoc-id'));
    }
    const newEl = doc.addChild(root, 'line', { x1: '0', y1: '0', x2: '100', y2: '100' });
    expect(existingIds.has(newEl.getAttribute('data-svgdoc-id'))).toBe(false);
  });

  it('removeElement removes an element from its parent', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const rect = doc.getElementById('r1');
    const result = doc.removeElement(rect);
    expect(doc.getElementById('r1')).toBeNull();
    expect(doc.serialize()).not.toContain('r1');
    // returns this for chaining
    expect(result).toBe(doc);
  });

  it('insertBefore reorders elements', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const root = doc.getRoot();
    const c1 = doc.getElementById('c1');
    const r1 = doc.getElementById('r1');
    // Original order: c1, r1. Move r1 before c1.
    doc.insertBefore(r1, c1);
    const children = Array.from(root.children);
    const ids = children.map((c) => c.getAttribute('id'));
    expect(ids.indexOf('r1')).toBeLessThan(ids.indexOf('c1'));
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
describe('SvgDoc serialization', () => {
  it('serialize strips all data-svgdoc-id attributes', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const output = doc.serialize();
    expect(output).not.toContain('data-svgdoc-id');
  });

  it('serialize produces well-formed SVG (starts with <svg)', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const output = doc.serialize();
    expect(output).toMatch(/^<svg[\s>]/);
  });

  it('round-trip fidelity: parse then serialize preserves structure', () => {
    const original = fixture('simple.svg');
    const doc = SvgDoc.parse(original);
    const output = doc.serialize();
    // re-parse to verify
    const doc2 = SvgDoc.parse(output);
    expect(doc2.getElementById('c1')).not.toBeNull();
    expect(doc2.getElementById('r1')).not.toBeNull();
    expect(doc2.getRoot().getAttribute('viewBox')).toBe('0 0 400 400');
  });

  it('preserves xlink namespaces through round-trip', () => {
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

  it('clone creates an independent copy', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const cloned = doc.clone();
    // Mutating the clone should not affect the original
    const clonedCircle = cloned.getElementById('c1');
    cloned.setAttribute(clonedCircle, 'fill', 'green');
    expect(clonedCircle.getAttribute('fill')).toBe('green');
    // Original should be untouched
    const originalCircle = doc.getElementById('c1');
    expect(originalCircle.getAttribute('fill')).toBe('#ff0000');
  });

  it('clone is itself a valid SvgDoc', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const cloned = doc.clone();
    expect(cloned).toBeInstanceOf(SvgDoc);
    expect(cloned.getRoot().tagName === 'svg' || cloned.getRoot().localName === 'svg').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------
describe('SvgDoc.getStats', () => {
  it('returns correct elementCount for simple.svg (all descendants)', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    // simple.svg has circle + rect = 2 descendant elements
    expect(stats.elementCount).toBe(2);
  });

  it('returns zero animationCount for static SVG', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.animationCount).toBe(0);
  });

  it('returns correct dimensions for simple.svg', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.dimensions.width).toBe(400);
    expect(stats.dimensions.height).toBe(400);
    expect(stats.dimensions.viewBox).toBe('0 0 400 400');
  });

  it('returns positive sizeBytes', () => {
    const doc = SvgDoc.parse(fixture('simple.svg'));
    const stats = doc.getStats();
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  it('counts CSS @keyframes animations', () => {
    const doc = SvgDoc.parse(fixture('animated-css.svg'));
    const stats = doc.getStats();
    // animated-css.svg has @keyframes spin and @keyframes fade
    expect(stats.animationCount).toBe(2);
  });

  it('counts SMIL animation elements', () => {
    const doc = SvgDoc.parse(fixture('animated-smil.svg'));
    const stats = doc.getStats();
    // animated-smil.svg has <animate> and <animateTransform>
    expect(stats.animationCount).toBe(2);
  });

  it('counts both CSS and SMIL animations in complex.svg', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const stats = doc.getStats();
    // complex.svg: 1 @keyframes pulse + 1 <animate> = 2
    expect(stats.animationCount).toBe(2);
  });

  it('returns correct elementCount for complex.svg', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const stats = doc.getStats();
    // complex.svg: defs, linearGradient, 2x stop, style, g(layer1), circle(grad-circle),
    // g(nested), rect, path, text, circle(smil-circle), animate = 13
    expect(stats.elementCount).toBe(13);
  });

  it('returns correct dimensions for complex.svg', () => {
    const doc = SvgDoc.parse(fixture('complex.svg'));
    const stats = doc.getStats();
    expect(stats.dimensions.width).toBe(800);
    expect(stats.dimensions.height).toBe(600);
    expect(stats.dimensions.viewBox).toBe('0 0 800 600');
  });

  it('returns null dimensions when width/height are absent', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="10" height="10"/></svg>';
    const doc = SvgDoc.parse(svg);
    const stats = doc.getStats();
    expect(stats.dimensions.width).toBeNull();
    expect(stats.dimensions.height).toBeNull();
    expect(stats.dimensions.viewBox).toBe('0 0 100 100');
  });
});
