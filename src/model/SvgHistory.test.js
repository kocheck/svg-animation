import { describe, it, expect } from 'vitest';
import { SvgHistory } from './SvgHistory.js';

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
const SVG_B = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>';
const SVG_C = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>';
const SVG_D = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>';
const SVG_E = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';

describe('SvgHistory', () => {
  describe('constructor', () => {
    it('initializes with the given source as current', () => {
      const h = new SvgHistory(SVG_A);
      expect(h.current).toBe(SVG_A);
    });

    it('starts with canUndo false', () => {
      const h = new SvgHistory(SVG_A);
      expect(h.canUndo).toBe(false);
    });

    it('starts with canRedo false', () => {
      const h = new SvgHistory(SVG_A);
      expect(h.canRedo).toBe(false);
    });

    it('starts with depth { past: 0, future: 0 }', () => {
      const h = new SvgHistory(SVG_A);
      expect(h.depth).toEqual({ past: 0, future: 0 });
    });
  });

  describe('push', () => {
    it('updates current to the new source', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B);
      expect(h.current).toBe(SVG_B);
    });

    it('makes canUndo true after push', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B);
      expect(h.canUndo).toBe(true);
    });

    it('makes canRedo false after push', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B);
      expect(h.canRedo).toBe(false);
    });

    it('returns a new instance (immutable)', () => {
      const h1 = new SvgHistory(SVG_A);
      const h2 = h1.push(SVG_B);
      expect(h2).not.toBe(h1);
      // Original is unchanged
      expect(h1.current).toBe(SVG_A);
      expect(h1.canUndo).toBe(false);
    });

    it('is a no-op when pushing identical string (returns same instance)', () => {
      const h = new SvgHistory(SVG_A);
      const same = h.push(SVG_A);
      expect(same).toBe(h);
    });
  });

  describe('undo', () => {
    it('rolls back to the previous state', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).undo();
      expect(h.current).toBe(SVG_A);
    });

    it('makes canRedo true after undo', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).undo();
      expect(h.canRedo).toBe(true);
    });

    it('is a no-op when canUndo is false (returns same instance)', () => {
      const h = new SvgHistory(SVG_A);
      const same = h.undo();
      expect(same).toBe(h);
    });

    it('supports multiple undos', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).push(SVG_C);
      const h1 = h.undo();
      expect(h1.current).toBe(SVG_B);
      expect(h1.canUndo).toBe(true);

      const h2 = h1.undo();
      expect(h2.current).toBe(SVG_A);
      expect(h2.canUndo).toBe(false);
    });
  });

  describe('redo', () => {
    it('moves forward to the next state', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).undo().redo();
      expect(h.current).toBe(SVG_B);
    });

    it('is a no-op when canRedo is false (returns same instance)', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B);
      const same = h.redo();
      expect(same).toBe(h);
    });

    it('supports multiple redos', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).push(SVG_C).undo().undo();
      expect(h.current).toBe(SVG_A);

      const h1 = h.redo();
      expect(h1.current).toBe(SVG_B);
      expect(h1.canRedo).toBe(true);

      const h2 = h1.redo();
      expect(h2.current).toBe(SVG_C);
      expect(h2.canRedo).toBe(false);
    });
  });

  describe('fork (undo then push clears redo stack)', () => {
    it('clears redo stack when pushing after undo', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).push(SVG_C).undo();
      expect(h.canRedo).toBe(true);

      const forked = h.push(SVG_D);
      expect(forked.current).toBe(SVG_D);
      expect(forked.canRedo).toBe(false);
      expect(forked.depth.future).toBe(0);
    });

    it('preserves correct undo history after fork', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).push(SVG_C).undo().push(SVG_D);
      // Should be able to undo back through A -> B -> D
      const h1 = h.undo();
      expect(h1.current).toBe(SVG_B);

      const h2 = h1.undo();
      expect(h2.current).toBe(SVG_A);
      expect(h2.canUndo).toBe(false);
    });
  });

  describe('max depth', () => {
    it('caps past stack at maxDepth, dropping oldest entries', () => {
      let h = new SvgHistory(SVG_A, { maxDepth: 5 });
      // Push 8 more entries (total 9 states including initial)
      const entries = [SVG_B, SVG_C, SVG_D, SVG_E,
        '<svg><rect width="1"/></svg>',
        '<svg><rect width="2"/></svg>',
        '<svg><rect width="3"/></svg>',
        '<svg><rect width="4"/></svg>',
      ];
      for (const src of entries) {
        h = h.push(src);
      }
      expect(h.depth.past).toBe(5);
      // The oldest entries should have been dropped.
      // After 5 undos we should reach the 4th pushed entry (SVG_D, index 3 from entries)
      // since entries[0..2] (SVG_A, SVG_B, SVG_C) were dropped.
      let undone = h;
      for (let i = 0; i < 5; i++) {
        undone = undone.undo();
      }
      expect(undone.canUndo).toBe(false);
      expect(undone.current).toBe(SVG_D);
    });
  });

  describe('batch', () => {
    it('beginBatch + commitBatch creates a single undo entry', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B);
      const batching = h.beginBatch();
      const committed = batching.commitBatch(SVG_E);

      expect(committed.current).toBe(SVG_E);
      expect(committed.canUndo).toBe(true);

      // A single undo should go back to the batch anchor (SVG_B)
      const undone = committed.undo();
      expect(undone.current).toBe(SVG_B);
    });

    it('commitBatch with same value as anchor is a no-op', () => {
      const h = new SvgHistory(SVG_A);
      const batching = h.beginBatch();
      const committed = batching.commitBatch(SVG_A);

      expect(committed.current).toBe(SVG_A);
      expect(committed.canUndo).toBe(false);
      expect(committed.depth).toEqual({ past: 0, future: 0 });
    });

    it('commitBatch clears the redo stack', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).undo();
      expect(h.canRedo).toBe(true);

      const batching = h.beginBatch();
      const committed = batching.commitBatch(SVG_C);
      expect(committed.canRedo).toBe(false);
    });

    it('batch preserves past history for undo', () => {
      const h = new SvgHistory(SVG_A).push(SVG_B).push(SVG_C);
      const batching = h.beginBatch();
      const committed = batching.commitBatch(SVG_E);

      // Undo the batch: should go back to SVG_C (the anchor)
      const h1 = committed.undo();
      expect(h1.current).toBe(SVG_C);

      // Undo further: should go back to SVG_B
      const h2 = h1.undo();
      expect(h2.current).toBe(SVG_B);

      // Undo further: should go back to SVG_A
      const h3 = h2.undo();
      expect(h3.current).toBe(SVG_A);
      expect(h3.canUndo).toBe(false);
    });
  });
});
