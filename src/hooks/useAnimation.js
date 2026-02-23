/**
 * SVG animation helpers — speed, stroke, and pause manipulation.
 * These operate directly on SVG DOM elements via refs.
 */

const ANIMATED_SELECTOR =
  '[class*="anim-"], [class*="spin"], [class*="gyro"], [class*="orbit"], [class*="ping"], [class*="os-"]';

/**
 * Apply animation speed to an SVG element by scaling animation-duration.
 * Stores original durations in data-orig-dur so they can be recalculated.
 */
export function setSpeedOnSvg(svgEl, speed, paused) {
  const animated = svgEl.querySelectorAll(ANIMATED_SELECTOR);
  animated.forEach((el) => {
    el.style.animationPlayState = paused ? 'paused' : 'running';
    const cs = getComputedStyle(el);
    const durations = cs.animationDuration.split(',').map((d) => parseFloat(d));
    if (!el.dataset.origDur) {
      el.dataset.origDur = durations.join(',');
    }
    const originals = el.dataset.origDur.split(',').map(Number);
    const newDurs = originals.map((d) => d / speed + 's');
    el.style.animationDuration = newDurs.join(',');
  });
}

/**
 * Set stroke-width on all stroked elements inside an SVG.
 */
export function setStrokeOnSvg(svgEl, width) {
  svgEl.querySelectorAll('[stroke]').forEach((el) => {
    if (el.getAttribute('stroke') !== 'none') {
      el.setAttribute('stroke-width', width);
    }
  });
  svgEl.querySelectorAll('g[stroke-width]').forEach((el) => {
    el.setAttribute('stroke-width', width);
  });
}

/**
 * Toggle pause/play on all animated elements inside an SVG.
 * Returns the new paused state.
 */
export function togglePauseOnSvg(svgEl) {
  const animated = svgEl.querySelectorAll(ANIMATED_SELECTOR);
  const isPaused = animated[0]?.style.animationPlayState === 'paused';
  animated.forEach((el) => {
    el.style.animationPlayState = isPaused ? 'running' : 'paused';
  });
  return !isPaused;
}
