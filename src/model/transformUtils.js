// src/model/transformUtils.js
const DEFAULTS = { x: 0, y: 0, rotation: 0, scale: 1 };

export function parseTransform(str) {
  if (!str) return { ...DEFAULTS };

  const result = { ...DEFAULTS };

  const translateMatch = str.match(/translate\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/);
  if (translateMatch) {
    result.x = parseFloat(translateMatch[1]) || 0;
    result.y = parseFloat(translateMatch[2]) || 0;
  }

  const rotateMatch = str.match(/rotate\(\s*([^,)]+)/);
  if (rotateMatch) {
    result.rotation = parseFloat(rotateMatch[1]) || 0;
  }

  const scaleMatch = str.match(/scale\(\s*([^,)]+)/);
  if (scaleMatch) {
    result.scale = parseFloat(scaleMatch[1]) || 1;
  }

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
