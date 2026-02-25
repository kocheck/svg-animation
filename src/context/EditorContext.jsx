import { createContext, useContext, useReducer } from 'react';
import { SvgDoc } from '../model/SvgDoc.js';
import { SvgHistory } from '../model/SvgHistory.js';

// ---------------------------------------------------------------------------
// DocumentContext
// ---------------------------------------------------------------------------

const DocumentContext = createContext(null);

const DOCUMENT_INITIAL_STATE = { documents: [], activeDocumentId: null };

function documentReducer(state, action) {
  switch (action.type) {
    case 'ADD_DOCUMENT': {
      const { name, src } = action;
      const history = new SvgHistory(src);
      const doc = SvgDoc.parse(src);
      const id = crypto.randomUUID();
      const newDoc = { id, name, history, doc };
      return {
        documents: [...state.documents, newDoc],
        activeDocumentId: id,
      };
    }

    case 'REMOVE_DOCUMENT': {
      const { id } = action;
      const documents = state.documents.filter((d) => d.id !== id);
      const activeDocumentId =
        state.activeDocumentId === id ? null : state.activeDocumentId;
      return { documents, activeDocumentId };
    }

    case 'UPDATE_DOCUMENT':
    case 'REPLACE_DOCUMENT': {
      const { id, src } = action;
      const documents = state.documents.map((d) => {
        if (d.id !== id) return d;
        const history = d.history.push(src);
        const doc = SvgDoc.parse(src);
        return { ...d, history, doc };
      });
      return { ...state, documents };
    }

    case 'SET_ACTIVE': {
      return { ...state, activeDocumentId: action.id };
    }

    case 'UNDO': {
      const { id } = action;
      const documents = state.documents.map((d) => {
        if (d.id !== id) return d;
        const history = d.history.undo();
        if (history === d.history) return d; // no-op
        const doc = SvgDoc.parse(history.current);
        return { ...d, history, doc };
      });
      return { ...state, documents };
    }

    case 'REDO': {
      const { id } = action;
      const documents = state.documents.map((d) => {
        if (d.id !== id) return d;
        const history = d.history.redo();
        if (history === d.history) return d; // no-op
        const doc = SvgDoc.parse(history.current);
        return { ...d, history, doc };
      });
      return { ...state, documents };
    }

    case 'BATCH_START': {
      const { id } = action;
      const documents = state.documents.map((d) => {
        if (d.id !== id) return d;
        const history = d.history.beginBatch();
        return { ...d, history };
      });
      return { ...state, documents };
    }

    case 'BATCH_UPDATE': {
      const { id, src } = action;
      const documents = state.documents.map((d) => {
        if (d.id !== id) return d;
        const doc = SvgDoc.parse(src);
        return { ...d, doc };
      });
      return { ...state, documents };
    }

    case 'BATCH_COMMIT': {
      const { id } = action;
      const documents = state.documents.map((d) => {
        if (d.id !== id) return d;
        const src = d.doc.serialize();
        const history = d.history.commitBatch(src);
        return { ...d, history };
      });
      return { ...state, documents };
    }

    default:
      return state;
  }
}

export function DocumentProvider({ children, initialState }) {
  const [state, dispatch] = useReducer(
    documentReducer,
    initialState ?? DOCUMENT_INITIAL_STATE,
  );
  return (
    <DocumentContext.Provider value={{ state, dispatch }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocumentContext() {
  const ctx = useContext(DocumentContext);
  if (!ctx) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// SelectionContext
// ---------------------------------------------------------------------------

const SelectionContext = createContext(null);

const SELECTION_INITIAL_STATE = { elementId: null, hoveredElementId: null };

function selectionReducer(state, action) {
  switch (action.type) {
    case 'SELECT_ELEMENT':
      return { elementId: action.elementId, hoveredElementId: null };

    case 'HOVER_ELEMENT':
      return { ...state, hoveredElementId: action.elementId };

    case 'CLEAR_SELECTION':
      return { elementId: null, hoveredElementId: null };

    default:
      return state;
  }
}

export function SelectionProvider({ children, initialState }) {
  const [state, dispatch] = useReducer(selectionReducer, initialState ?? SELECTION_INITIAL_STATE);
  return (
    <SelectionContext.Provider value={{ state, dispatch }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelectionContext() {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error(
      'useSelectionContext must be used within a SelectionProvider',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// UIContext
// ---------------------------------------------------------------------------

const UIContext = createContext(null);

const UI_INITIAL_STATE = {
  gridCols: 2,
  globalSpeed: 1,
  paused: false,
  focusDocumentId: null,
  editorOpen: false,
  previewBackground: 'dark',
};

function uiReducer(state, action) {
  switch (action.type) {
    case 'SET_GRID_COLS':
      return { ...state, gridCols: action.cols };

    case 'SET_SPEED':
      return { ...state, globalSpeed: action.speed };

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused };

    case 'RESET_SPEED':
      return { ...state, globalSpeed: 1 };

    case 'SET_FOCUS':
      return { ...state, focusDocumentId: action.documentId };

    case 'CLEAR_FOCUS':
      return { ...state, focusDocumentId: null };

    case 'TOGGLE_EDITOR':
      return { ...state, editorOpen: !state.editorOpen };

    case 'SET_PREVIEW_BG':
      return { ...state, previewBackground: action.mode };

    default:
      return state;
  }
}

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, UI_INITIAL_STATE);
  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUIContext() {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Combined EditorProvider
// ---------------------------------------------------------------------------

export function EditorProvider({ children }) {
  return (
    <DocumentProvider>
      <SelectionProvider>
        <UIProvider>{children}</UIProvider>
      </SelectionProvider>
    </DocumentProvider>
  );
}
