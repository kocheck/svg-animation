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

  it('returns null for fill with SVG 1.1 named color cornflowerblue', () => {
    expect(getAndroidWarning('fill', 'cornflowerblue')).toBeNull();
  });

  it('returns warning for fill with CSS4-only color rebeccapurple', () => {
    expect(getAndroidWarning('fill', 'rebeccapurple')).toMatch(/hex/i);
  });

  it('returns null for unrelated attributes', () => {
    expect(getAndroidWarning('cx', '50')).toBeNull();
    expect(getAndroidWarning('width', '100')).toBeNull();
    expect(getAndroidWarning('id', 'myId')).toBeNull();
  });
});
