import { useCallback, useRef } from 'react';
import { useDocumentContext } from '../context/EditorContext.jsx';

export function useDocumentMutation() {
  const { state, dispatch } = useDocumentContext();
  const batchingRef = useRef(false);

  const getActiveDoc = useCallback(() => {
    return state.documents.find((d) => d.id === state.activeDocumentId) ?? null;
  }, [state.documents, state.activeDocumentId]);

  const mutate = useCallback((fn) => {
    const active = getActiveDoc();
    if (!active) return;

    fn(active.doc);
    const src = active.doc.serialize();

    if (batchingRef.current) {
      dispatch({ type: 'BATCH_UPDATE', id: active.id, src });
    } else {
      dispatch({ type: 'UPDATE_DOCUMENT', id: active.id, src });
    }
  }, [getActiveDoc, dispatch]);

  const startBatch = useCallback(() => {
    const active = getActiveDoc();
    if (!active) return;
    batchingRef.current = true;
    dispatch({ type: 'BATCH_START', id: active.id });
  }, [getActiveDoc, dispatch]);

  const commitBatch = useCallback(() => {
    const active = getActiveDoc();
    if (!active) return;
    batchingRef.current = false;
    dispatch({ type: 'BATCH_COMMIT', id: active.id });
  }, [getActiveDoc, dispatch]);

  return { mutate, startBatch, commitBatch };
}
