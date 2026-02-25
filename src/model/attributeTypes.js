// src/model/attributeTypes.js

const NUMERIC_ATTRS = new Set([
  'width', 'height', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'opacity', 'fill-opacity',
  'stroke-opacity', 'stroke-width', 'stroke-miterlimit', 'font-size',
  'letter-spacing', 'word-spacing',
]);

const COLOR_ATTRS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);

const ENUM_ATTRS = {
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'display': ['inline', 'block', 'none'],
  'visibility': ['visible', 'hidden', 'collapse'],
  'fill-rule': ['nonzero', 'evenodd'],
  'clip-rule': ['nonzero', 'evenodd'],
  'text-anchor': ['start', 'middle', 'end'],
  'dominant-baseline': ['auto', 'middle', 'hanging', 'central', 'text-bottom', 'text-top'],
  'overflow': ['visible', 'hidden', 'scroll', 'auto'],
};

export function getAttributeType(attrName) {
  const name = attrName.toLowerCase();
  if (ENUM_ATTRS[name]) return { type: 'enum', options: ENUM_ATTRS[name] };
  if (COLOR_ATTRS.has(name)) return { type: 'color' };
  if (NUMERIC_ATTRS.has(name)) return { type: 'numeric' };
  return { type: 'text' };
}
