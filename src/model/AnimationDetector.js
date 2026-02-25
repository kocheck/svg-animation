/**
 * AnimationDetector — pure function that discovers all animations in an SVG element.
 *
 * Detects three categories:
 *   1. SMIL animations  (<animate>, <animateTransform>, <animateMotion>, <animateColor>, <set>)
 *   2. CSS keyframe animations (via getComputedStyle animationName)
 *   3. CSS transitions       (via getComputedStyle transitionProperty / transitionDuration)
 *
 * Returns AnimationInfo[] — see JSDoc below for the shape.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SMIL_TAGS = ['animate', 'animateTransform', 'animateMotion', 'animateColor', 'set'];

const SMIL_ATTRIBUTE_NAMES = [
  'attributeName',
  'from',
  'to',
  'values',
  'dur',
  'begin',
  'end',
  'repeatCount',
  'repeatDur',
  'fill',
  'type',
];

const XLINK_NS = 'http://www.w3.org/1999/xlink';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the target element for a SMIL animation element.
 *
 * Resolution order:
 *   1. `href` attribute (SVG 2)
 *   2. `xlink:href` attribute (SVG 1.1)
 *   3. Parent element (inline SMIL)
 *
 * @param {Element} animEl - The SMIL animation element.
 * @param {Element} svgRoot - The root <svg> element (used for id lookups).
 * @returns {Element|null}
 */
function resolveSmilTarget(animEl, svgRoot) {
  // SVG 2 href
  const href = animEl.getAttribute('href');
  if (href && href.startsWith('#')) {
    const id = href.slice(1);
    const target = svgRoot.querySelector(`[id="${id}"]`);
    if (target) return target;
  }

  // SVG 1.1 xlink:href
  const xlinkHref = animEl.getAttributeNS(XLINK_NS, 'href');
  if (xlinkHref && xlinkHref.startsWith('#')) {
    const id = xlinkHref.slice(1);
    const target = svgRoot.querySelector(`[id="${id}"]`);
    if (target) return target;
  }

  // Inline — parent is the target
  const parent = animEl.parentElement;
  if (parent && parent !== svgRoot) {
    return parent;
  }

  return null;
}

/**
 * Collect raw SMIL attributes from an animation element.
 *
 * @param {Element} animEl
 * @returns {Record<string, string>}
 */
function collectSmilAttributes(animEl) {
  const attrs = {};
  for (const name of SMIL_ATTRIBUTE_NAMES) {
    const value = animEl.getAttribute(name);
    if (value !== null) {
      attrs[name] = value;
    }
  }
  return attrs;
}

/**
 * Read the element's tracking id (`data-svgdoc-id`) or return null.
 *
 * @param {Element} el
 * @returns {string|null}
 */
function elementId(el) {
  return el?.getAttribute('data-svgdoc-id') ?? null;
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/**
 * Detect SMIL animations inside the given SVG element.
 *
 * @param {SVGElement} svgElement
 * @returns {import('./AnimationDetector').AnimationInfo[]}
 */
function detectSmil(svgElement) {
  const results = [];
  const selector = SMIL_TAGS.join(', ');
  const animEls = svgElement.querySelectorAll(selector);

  for (const animEl of animEls) {
    const target = resolveSmilTarget(animEl, svgElement);
    const smilAttributes = collectSmilAttributes(animEl);
    const warnings = ['SMIL animations are not supported on Android WebView'];

    results.push({
      element: animEl,
      elementId: elementId(animEl),
      type: 'smil',
      name: animEl.tagName.toLowerCase(),
      properties: {
        duration: smilAttributes.dur ?? null,
        delay: smilAttributes.begin ?? null,
        easing: null, // SMIL uses calcMode, not captured here
        iterationCount: smilAttributes.repeatCount ?? null,
        direction: null,
        fillMode: smilAttributes.fill ?? null,
        state: 'running',
      },
      target: target,
      smilAttributes,
      androidCompatible: false,
      warnings,
    });
  }

  return results;
}

/**
 * Detect CSS keyframe animations on descendants of the SVG element.
 *
 * @param {SVGElement} svgElement
 * @returns {import('./AnimationDetector').AnimationInfo[]}
 */
function detectCssAnimations(svgElement) {
  const results = [];
  const descendants = svgElement.querySelectorAll('*');

  for (const el of descendants) {
    // Skip SMIL animation elements — they are handled by detectSmil
    if (SMIL_TAGS.includes(el.tagName.toLowerCase())) {
      continue;
    }

    let style;
    try {
      style = getComputedStyle(el);
    } catch {
      continue; // detached element or unsupported environment
    }

    const animationName = style.animationName;
    if (!animationName || animationName === 'none') {
      continue;
    }

    // There can be multiple comma-separated animation names
    const names = animationName.split(',').map((n) => n.trim());
    const durations = (style.animationDuration || '0s').split(',').map((v) => v.trim());
    const delays = (style.animationDelay || '0s').split(',').map((v) => v.trim());
    const timings = (style.animationTimingFunction || 'ease').split(',').map((v) => v.trim());
    const iterations = (style.animationIterationCount || '1').split(',').map((v) => v.trim());
    const directions = (style.animationDirection || 'normal').split(',').map((v) => v.trim());
    const fillModes = (style.animationFillMode || 'none').split(',').map((v) => v.trim());
    const playStates = (style.animationPlayState || 'running').split(',').map((v) => v.trim());

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (name === 'none') continue;

      results.push({
        element: el,
        elementId: elementId(el),
        type: 'css',
        name,
        properties: {
          duration: durations[i % durations.length] ?? durations[0],
          delay: delays[i % delays.length] ?? delays[0],
          easing: timings[i % timings.length] ?? timings[0],
          iterationCount: iterations[i % iterations.length] ?? iterations[0],
          direction: directions[i % directions.length] ?? directions[0],
          fillMode: fillModes[i % fillModes.length] ?? fillModes[0],
          state: playStates[i % playStates.length] ?? playStates[0],
        },
        target: el,
        smilAttributes: null,
        androidCompatible: true,
        warnings: [],
      });
    }
  }

  return results;
}

/**
 * Detect CSS transitions on descendants of the SVG element.
 *
 * @param {SVGElement} svgElement
 * @returns {import('./AnimationDetector').AnimationInfo[]}
 */
function detectCssTransitions(svgElement) {
  const results = [];
  const descendants = svgElement.querySelectorAll('*');

  for (const el of descendants) {
    // Skip SMIL animation elements
    if (SMIL_TAGS.includes(el.tagName.toLowerCase())) {
      continue;
    }

    let style;
    try {
      style = getComputedStyle(el);
    } catch {
      continue;
    }

    const transitionProperty = style.transitionProperty;
    const transitionDuration = style.transitionDuration;

    // Skip if no meaningful transition is declared
    if (!transitionProperty || transitionProperty === 'none' || transitionProperty === 'all') {
      continue;
    }
    if (!transitionDuration || transitionDuration === '0s') {
      continue;
    }

    const properties = transitionProperty.split(',').map((p) => p.trim());
    const durations = (transitionDuration || '0s').split(',').map((v) => v.trim());
    const delays = (style.transitionDelay || '0s').split(',').map((v) => v.trim());
    const timings = (style.transitionTimingFunction || 'ease').split(',').map((v) => v.trim());

    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      if (prop === 'none') continue;

      const dur = durations[i % durations.length] ?? durations[0];
      if (dur === '0s') continue;

      results.push({
        element: el,
        elementId: elementId(el),
        type: 'transition',
        name: `transition-${prop}`,
        properties: {
          duration: dur,
          delay: delays[i % delays.length] ?? delays[0],
          easing: timings[i % timings.length] ?? timings[0],
          iterationCount: '1',
          direction: 'normal',
          fillMode: 'none',
          state: 'idle',
        },
        target: el,
        smilAttributes: null,
        androidCompatible: true,
        warnings: [],
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AnimationProperties
 * @property {string|null} duration
 * @property {string|null} delay
 * @property {string|null} easing
 * @property {string|null} iterationCount
 * @property {string|null} direction
 * @property {string|null} fillMode
 * @property {string}      state
 */

/**
 * @typedef {Object} AnimationInfo
 * @property {Element}                    element           - The DOM element that carries the animation declaration.
 * @property {string|null}                elementId         - data-svgdoc-id or null.
 * @property {'smil'|'css'|'transition'}  type
 * @property {string}                     name              - animation-name, SMIL tag name, or transition-<prop>.
 * @property {AnimationProperties}        properties
 * @property {Element|null}               target            - The element being animated.
 * @property {Record<string,string>|null} smilAttributes    - Raw SMIL attributes (only for type 'smil').
 * @property {boolean}                    androidCompatible
 * @property {string[]}                   warnings
 */

/**
 * Detect all animations present in an SVG element.
 *
 * @param {SVGElement} svgElement - The root <svg> DOM element to inspect.
 * @returns {AnimationInfo[]}
 */
export function detectAnimations(svgElement) {
  if (!svgElement || svgElement.tagName?.toLowerCase() !== 'svg') {
    return [];
  }

  const smil = detectSmil(svgElement);
  const css = detectCssAnimations(svgElement);
  const transitions = detectCssTransitions(svgElement);

  return [...smil, ...css, ...transitions];
}
