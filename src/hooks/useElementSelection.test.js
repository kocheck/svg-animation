import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElementSelection } from './useElementSelection.js';

describe('useElementSelection', () => {
  let container;

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
  });

  function createContainer() {
    container = document.createElement('div');

    // Build DOM structure programmatically (safe DOM construction)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-svgdoc-id', 'group-1');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('data-svgdoc-id', 'circle-2');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', '25');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = 'no id here';

    g.appendChild(circle);
    g.appendChild(text);
    svg.appendChild(g);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('data-svgdoc-id', 'rect-3');
    rect.setAttribute('x', '10');
    rect.setAttribute('y', '10');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '50');
    svg.appendChild(rect);

    container.appendChild(svg);
    document.body.appendChild(container);
    return container;
  }

  it('calls onSelect with element ID when clicking element with data-svgdoc-id', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    const circle = c.querySelector('[data-svgdoc-id="circle-2"]');
    circle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith('circle-2');
  });

  it('calls onSelect with null when clicking empty space (container itself)', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    // Click on the container div itself (empty space)
    c.dispatchEvent(new MouseEvent('click', { bubbles: false }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with null when clicking the root svg element', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    const svg = c.querySelector('svg');
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('walks up to nearest parent with data-svgdoc-id when clicking nested element without it', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    // The <text> element has no data-svgdoc-id, but its parent <g> has "group-1"
    const textEl = c.querySelector('text');
    textEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith('group-1');
  });

  it('calls onHover with element ID on mousemove over element with data-svgdoc-id', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    const rect = c.querySelector('[data-svgdoc-id="rect-3"]');
    rect.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

    expect(onHover).toHaveBeenCalledWith('rect-3');
  });

  it('calls onHover with null on mousemove over empty space', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    const svg = c.querySelector('svg');
    svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('does nothing when containerRef.current is null', () => {
    const ref = { current: null };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    // Should not throw
    expect(() => {
      renderHook(() => useElementSelection(ref, { onSelect, onHover }));
    }).not.toThrow();
  });

  it('cleans up event listeners on unmount', () => {
    const c = createContainer();
    const ref = { current: c };
    const onSelect = vi.fn();
    const onHover = vi.fn();

    const { unmount } = renderHook(() => useElementSelection(ref, { onSelect, onHover }));

    unmount();

    // After unmount, clicks should not trigger callbacks
    const circle = c.querySelector('[data-svgdoc-id="circle-2"]');
    circle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    circle.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onHover).not.toHaveBeenCalled();
  });
});
