// src/model/androidCompat.js

const SVG_SAFE_NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
  'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen',
  'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange',
  'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet',
  'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
  'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
  'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green',
  'greenyellow', 'grey',
  'honeydew', 'hotpink',
  'indianred', 'indigo', 'ivory',
  'khaki',
  'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue',
  'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
  'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
  'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid',
  'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
  'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin',
  'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue',
  'purple',
  'red', 'rosybrown', 'royalblue',
  'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
  'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
  'springgreen', 'steelblue',
  'tan', 'teal', 'thistle', 'tomato', 'turquoise',
  'violet',
  'wheat', 'white', 'whitesmoke',
  'yellow', 'yellowgreen',
]);

const SYSTEM_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
]);

function isUnsafeColor(value) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (v.startsWith('#')) return false;
  if (v.startsWith('rgb(') || v.startsWith('rgba(')) return false;
  if (v.startsWith('hsl') || v.startsWith('oklch') || v.startsWith('oklab')
      || v.startsWith('lch') || v.startsWith('lab')) return true;
  if (v === 'currentcolor') return true;
  if (v === 'none' || v === 'transparent' || v === 'inherit') return false;
  if (SVG_SAFE_NAMED_COLORS.has(v)) return false;
  if (/^[a-z]+$/.test(v)) return true;
  return false;
}

function hasCustomFont(value) {
  if (!value) return false;
  const fonts = value.split(',').map(f => f.trim().replace(/['"]/g, '').toLowerCase());
  return fonts.some(f => !SYSTEM_FONTS.has(f));
}

export function getAndroidWarning(attrName, attrValue) {
  if (!attrName) return null;
  const name = attrName.toLowerCase();

  if (name === 'filter') return 'filter is not supported on Android WebView';
  if (name === 'mask') return 'mask has limited Android support';

  if (name === 'clip-path' && attrValue && attrValue.includes('url(')) {
    return 'Complex clip-path may not render on Android';
  }

  if ((name === 'fill' || name === 'stroke') && isUnsafeColor(attrValue)) {
    return 'Use #RRGGBB hex for Android compatibility';
  }

  if (name === 'transform' && attrValue && /skew[XY]/i.test(attrValue)) {
    return 'skew transforms not supported on all Android renderers';
  }

  if (name === 'font-family' && hasCustomFont(attrValue)) {
    return 'Custom fonts may not load on Android';
  }

  return null;
}
