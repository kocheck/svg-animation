export class SvgHistory {
  #past;
  #present;
  #future;
  #maxDepth;
  #batchAnchor;

  constructor(initialSrc, { maxDepth = 50, _past, _future, _batchAnchor } = {}) {
    this.#past = _past || [];
    this.#present = initialSrc;
    this.#future = _future || [];
    this.#maxDepth = maxDepth;
    this.#batchAnchor = _batchAnchor ?? null;
  }

  get current() { return this.#present; }
  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }
  get depth() { return { past: this.#past.length, future: this.#future.length }; }

  push(newSrc) {
    if (newSrc === this.#present) return this;
    let newPast = [...this.#past, this.#present];
    if (newPast.length > this.#maxDepth) {
      newPast = newPast.slice(newPast.length - this.#maxDepth);
    }
    return new SvgHistory(newSrc, { maxDepth: this.#maxDepth, _past: newPast, _future: [], _batchAnchor: null });
  }

  undo() {
    if (!this.canUndo) return this;
    const newPast = this.#past.slice(0, -1);
    const prev = this.#past[this.#past.length - 1];
    return new SvgHistory(prev, { maxDepth: this.#maxDepth, _past: newPast, _future: [this.#present, ...this.#future], _batchAnchor: null });
  }

  redo() {
    if (!this.canRedo) return this;
    const next = this.#future[0];
    return new SvgHistory(next, { maxDepth: this.#maxDepth, _past: [...this.#past, this.#present], _future: this.#future.slice(1), _batchAnchor: null });
  }

  beginBatch() {
    return new SvgHistory(this.#present, { maxDepth: this.#maxDepth, _past: this.#past, _future: this.#future, _batchAnchor: this.#present });
  }

  commitBatch(finalSrc) {
    const anchor = this.#batchAnchor ?? this.#present;
    if (finalSrc === anchor) {
      return new SvgHistory(anchor, { maxDepth: this.#maxDepth, _past: this.#past, _future: this.#future, _batchAnchor: null });
    }
    let newPast = [...this.#past, anchor];
    if (newPast.length > this.#maxDepth) {
      newPast = newPast.slice(newPast.length - this.#maxDepth);
    }
    return new SvgHistory(finalSrc, { maxDepth: this.#maxDepth, _past: newPast, _future: [], _batchAnchor: null });
  }
}
