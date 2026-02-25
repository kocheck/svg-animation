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
