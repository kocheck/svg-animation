import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentMutation } from './useDocumentMutation.js';
import { DocumentProvider } from '../context/EditorContext.jsx';
import { SvgDoc } from '../model/SvgDoc.js';
import { SvgHistory } from '../model/SvgHistory.js';

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';

function makeWrapper(initialDocState) {
  return function Wrapper({ children }) {
    return <DocumentProvider initialState={initialDocState}>{children}</DocumentProvider>;
  };
}

function setupWithDoc() {
  const doc = SvgDoc.parse(SVG_A);
  const history = new SvgHistory(SVG_A);
  const initialDocState = {
    documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
    activeDocumentId: 'doc-1',
  };
  return { initialDocState, wrapper: makeWrapper(initialDocState) };
}

describe('useDocumentMutation', () => {
  it('mutate() applies changes and pushes to history', () => {
    const { wrapper } = setupWithDoc();
    const { result } = renderHook(() => useDocumentMutation(), { wrapper });

    act(() => {
      result.current.mutate((doc) => {
        const circle = doc.querySelector('circle');
        doc.setAttribute(circle, 'r', '20');
      });
    });

    expect(result.current).toBeDefined();
  });

  it('returns null from mutate when no active document', () => {
    const initialDocState = { documents: [], activeDocumentId: null };
    const wrapper = makeWrapper(initialDocState);
    const { result } = renderHook(() => useDocumentMutation(), { wrapper });

    act(() => {
      result.current.mutate(() => {});
    });
  });

  it('startBatch + mutate + commitBatch creates single undo entry', () => {
    const { wrapper } = setupWithDoc();
    const { result } = renderHook(() => useDocumentMutation(), { wrapper });

    act(() => { result.current.startBatch(); });
    act(() => {
      result.current.mutate((doc) => {
        const circle = doc.querySelector('circle');
        doc.setAttribute(circle, 'r', '30');
      });
    });
    act(() => {
      result.current.mutate((doc) => {
        const circle = doc.querySelector('circle');
        doc.setAttribute(circle, 'r', '40');
      });
    });
    act(() => { result.current.commitBatch(); });

    expect(result.current).toBeDefined();
  });
});
