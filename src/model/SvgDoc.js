export class SvgDoc {
  #doc;
  #nextId;

  constructor(doc) {
    this.#doc = doc;
    this.#nextId = 1;
    this.#injectIds();
  }

  static parse(svgString) {
    if (!svgString || !svgString.trim()) {
      throw new Error('SvgDoc.parse: input string is empty');
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`SvgDoc.parse: invalid SVG — ${parseError.textContent.trim()}`);
    }
    const root = doc.documentElement;
    if (root.tagName !== 'svg' && root.localName !== 'svg') {
      throw new Error(`SvgDoc.parse: root element is <${root.tagName}>, expected <svg>`);
    }
    return new SvgDoc(doc);
  }

  #injectIds() {
    const all = this.#doc.querySelectorAll('*');
    for (const el of all) {
      el.setAttribute('data-svgdoc-id', String(this.#nextId++));
    }
  }

  getRoot() { return this.#doc.documentElement; }
  getElementById(id) { return this.#doc.getElementById(id); }
  querySelector(selector) { return this.#doc.documentElement.querySelector(selector); }
  querySelectorAll(selector) { return Array.from(this.#doc.documentElement.querySelectorAll(selector)); }

  getAttributes(element) {
    const attrs = {};
    for (const attr of element.attributes) {
      if (attr.name === 'data-svgdoc-id') continue;
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  setAttribute(element, name, value) { element.setAttribute(name, value); return this; }
  removeAttribute(element, name) { element.removeAttribute(name); return this; }
  setStyle(element, property, value) { element.style[property] = value; return this; }

  addChild(parent, tagName, attrs = {}) {
    const el = this.#doc.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const [key, val] of Object.entries(attrs)) { el.setAttribute(key, val); }
    el.setAttribute('data-svgdoc-id', String(this.#nextId++));
    parent.appendChild(el);
    return el;
  }

  removeElement(element) { element.parentNode?.removeChild(element); return this; }
  insertBefore(newNode, refNode) { refNode.parentNode?.insertBefore(newNode, refNode); return this; }

  serialize() {
    const clone = this.#doc.documentElement.cloneNode(true);
    clone.removeAttribute('data-svgdoc-id');
    for (const el of clone.querySelectorAll('[data-svgdoc-id]')) { el.removeAttribute('data-svgdoc-id'); }
    return new XMLSerializer().serializeToString(clone);
  }

  clone() { return SvgDoc.parse(this.serialize()); }

  getStats() {
    const root = this.#doc.documentElement;
    const allElements = root.querySelectorAll('*');
    const smilTags = root.querySelectorAll('animate, animateTransform, animateMotion, animateColor, set');
    let cssAnimCount = 0;
    for (const styleEl of root.querySelectorAll('style')) {
      const matches = (styleEl.textContent || '').match(/@keyframes\s/g);
      if (matches) cssAnimCount += matches.length;
    }
    const width = parseFloat(root.getAttribute('width')) || null;
    const height = parseFloat(root.getAttribute('height')) || null;
    const viewBox = root.getAttribute('viewBox') || null;
    const sizeBytes = new Blob([this.serialize()]).size;
    return {
      elementCount: allElements.length,
      animationCount: smilTags.length + cssAnimCount,
      dimensions: { width, height, viewBox },
      sizeBytes,
    };
  }
}
