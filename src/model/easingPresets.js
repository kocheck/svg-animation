// src/model/easingPresets.js
export const EASING_PRESETS = {
  'linear': 'linear',
  'ease': 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'elastic': 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'sharp': 'cubic-bezier(0.4, 0, 0.6, 1)',
  'decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
  'accelerate': 'cubic-bezier(0.4, 0, 1, 1)',
};

export const EASING_NAMES = Object.keys(EASING_PRESETS);

export function getPresetName(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  for (const [name, css] of Object.entries(EASING_PRESETS)) {
    if (css === v) return name;
  }
  return null;
}
