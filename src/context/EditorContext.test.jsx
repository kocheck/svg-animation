import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  DocumentProvider,
  useDocumentContext,
  SelectionProvider,
  useSelectionContext,
  UIProvider,
  useUIContext,
  EditorProvider,
} from './EditorContext.jsx';

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
const SVG_B = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>';
const SVG_C = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>';

// ---------------------------------------------------------------------------
// DocumentContext
// ---------------------------------------------------------------------------

describe('DocumentContext', () => {
  function DocConsumer() {
    const { state, dispatch } = useDocumentContext();
    const active = state.documents.find((d) => d.id === state.activeDocumentId);
    return (
      <div>
        <span data-testid="count">{state.documents.length}</span>
        <span data-testid="active-id">{state.activeDocumentId ?? 'none'}</span>
        <span data-testid="active-src">
          {active ? active.history.current : 'none'}
        </span>
        <span data-testid="can-undo">
          {active ? String(active.history.canUndo) : 'none'}
        </span>
        <span data-testid="can-redo">
          {active ? String(active.history.canRedo) : 'none'}
        </span>
        <button
          data-testid="add"
          onClick={() =>
            dispatch({ type: 'ADD_DOCUMENT', name: 'test.svg', src: SVG_A })
          }
        />
        <button
          data-testid="add-b"
          onClick={() =>
            dispatch({ type: 'ADD_DOCUMENT', name: 'b.svg', src: SVG_B })
          }
        />
        <button
          data-testid="remove"
          onClick={() =>
            dispatch({ type: 'REMOVE_DOCUMENT', id: state.activeDocumentId })
          }
        />
        <button
          data-testid="update"
          onClick={() =>
            dispatch({
              type: 'UPDATE_DOCUMENT',
              id: state.activeDocumentId,
              src: SVG_B,
            })
          }
        />
        <button
          data-testid="replace"
          onClick={() =>
            dispatch({
              type: 'REPLACE_DOCUMENT',
              id: state.activeDocumentId,
              src: SVG_B,
            })
          }
        />
        <button
          data-testid="undo"
          onClick={() =>
            dispatch({ type: 'UNDO', id: state.activeDocumentId })
          }
        />
        <button
          data-testid="redo"
          onClick={() =>
            dispatch({ type: 'REDO', id: state.activeDocumentId })
          }
        />
        <button
          data-testid="set-active"
          onClick={() => dispatch({ type: 'SET_ACTIVE', id: 'some-id' })}
        />
        <button
          data-testid="batch-start"
          onClick={() =>
            dispatch({ type: 'BATCH_START', id: state.activeDocumentId })
          }
        />
        <button
          data-testid="batch-update"
          onClick={() =>
            dispatch({
              type: 'BATCH_UPDATE',
              id: state.activeDocumentId,
              src: SVG_B,
            })
          }
        />
        <button
          data-testid="batch-update-2"
          onClick={() =>
            dispatch({
              type: 'BATCH_UPDATE',
              id: state.activeDocumentId,
              src: SVG_C,
            })
          }
        />
        <button
          data-testid="batch-commit"
          onClick={() =>
            dispatch({ type: 'BATCH_COMMIT', id: state.activeDocumentId })
          }
        />
      </div>
    );
  }

  it('starts with empty documents', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('active-id').textContent).toBe('none');
  });

  it('ADD_DOCUMENT creates a document and sets it active', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('active-id').textContent).not.toBe('none');
    expect(screen.getByTestId('active-src').textContent).not.toBe('none');
  });

  it('ADD_DOCUMENT multiple times increments count', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    act(() => screen.getByTestId('add-b').click());
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('REMOVE_DOCUMENT removes and clears active if removed was active', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    expect(screen.getByTestId('count').textContent).toBe('1');

    act(() => screen.getByTestId('remove').click());
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('active-id').textContent).toBe('none');
  });

  it('UPDATE_DOCUMENT pushes to history so undo is available', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    expect(screen.getByTestId('can-undo').textContent).toBe('false');

    act(() => screen.getByTestId('update').click());
    expect(screen.getByTestId('can-undo').textContent).toBe('true');
    expect(screen.getByTestId('active-src').textContent).toContain('r="2"');
  });

  it('REPLACE_DOCUMENT works the same as UPDATE_DOCUMENT', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    act(() => screen.getByTestId('replace').click());
    expect(screen.getByTestId('can-undo').textContent).toBe('true');
    expect(screen.getByTestId('active-src').textContent).toContain('r="2"');
  });

  it('UNDO reverts to previous source', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    act(() => screen.getByTestId('update').click());
    expect(screen.getByTestId('active-src').textContent).toContain('r="2"');

    act(() => screen.getByTestId('undo').click());
    expect(screen.getByTestId('active-src').textContent).toContain('r="1"');
    expect(screen.getByTestId('can-redo').textContent).toBe('true');
  });

  it('REDO reapplies undone change', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    act(() => screen.getByTestId('update').click());
    act(() => screen.getByTestId('undo').click());
    act(() => screen.getByTestId('redo').click());
    expect(screen.getByTestId('active-src').textContent).toContain('r="2"');
    expect(screen.getByTestId('can-redo').textContent).toBe('false');
  });

  it('UNDO is a no-op when nothing to undo', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    const srcBefore = screen.getByTestId('active-src').textContent;
    act(() => screen.getByTestId('undo').click());
    expect(screen.getByTestId('active-src').textContent).toBe(srcBefore);
  });

  it('REDO is a no-op when nothing to redo', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('add').click());
    const srcBefore = screen.getByTestId('active-src').textContent;
    act(() => screen.getByTestId('redo').click());
    expect(screen.getByTestId('active-src').textContent).toBe(srcBefore);
  });

  it('SET_ACTIVE sets the activeDocumentId', () => {
    render(
      <DocumentProvider>
        <DocConsumer />
      </DocumentProvider>,
    );
    act(() => screen.getByTestId('set-active').click());
    expect(screen.getByTestId('active-id').textContent).toBe('some-id');
  });

  it('accepts initialState prop for testing', () => {
    const initialState = {
      documents: [],
      activeDocumentId: 'preset-id',
    };
    render(
      <DocumentProvider initialState={initialState}>
        <DocConsumer />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('active-id').textContent).toBe('preset-id');
  });

  it('BATCH_START + BATCH_UPDATE + BATCH_COMMIT creates single undo entry', () => {
    const { getByTestId } = render(
      <DocumentProvider><DocConsumer /></DocumentProvider>,
    );
    act(() => getByTestId('add').click());

    // Start batch
    act(() => getByTestId('batch-start').click());
    // Batch update twice
    act(() => getByTestId('batch-update').click());
    act(() => getByTestId('batch-update-2').click());
    // Commit batch
    act(() => getByTestId('batch-commit').click());

    // Should have only 1 undo entry (not 2)
    expect(getByTestId('can-undo').textContent).toBe('true');
    act(() => getByTestId('undo').click());
    expect(getByTestId('can-undo').textContent).toBe('false');
    // After undo, should be back to original SVG_A
    expect(getByTestId('active-src').textContent).toBe(SVG_A);
  });

  it('BATCH_UPDATE without BATCH_START only updates doc, not history', () => {
    const { getByTestId } = render(
      <DocumentProvider><DocConsumer /></DocumentProvider>,
    );
    act(() => getByTestId('add').click());
    act(() => getByTestId('batch-update').click());
    // BATCH_UPDATE only sets the doc field (live preview) without pushing
    // to history, so canUndo remains false.
    expect(getByTestId('can-undo').textContent).toBe('false');
  });

  it('throws when useDocumentContext is used outside provider', () => {
    expect(() => render(<DocConsumer />)).toThrow(
      'useDocumentContext must be used within a DocumentProvider',
    );
  });
});

// ---------------------------------------------------------------------------
// SelectionContext
// ---------------------------------------------------------------------------

describe('SelectionContext', () => {
  function SelConsumer() {
    const { state, dispatch } = useSelectionContext();
    return (
      <div>
        <span data-testid="selected">{state.elementId ?? 'none'}</span>
        <span data-testid="hovered">{state.hoveredElementId ?? 'none'}</span>
        <button
          data-testid="select"
          onClick={() =>
            dispatch({ type: 'SELECT_ELEMENT', elementId: 'el-42' })
          }
        />
        <button
          data-testid="hover"
          onClick={() =>
            dispatch({ type: 'HOVER_ELEMENT', elementId: 'el-99' })
          }
        />
        <button
          data-testid="clear"
          onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
        />
      </div>
    );
  }

  it('starts with no selection', () => {
    render(
      <SelectionProvider>
        <SelConsumer />
      </SelectionProvider>,
    );
    expect(screen.getByTestId('selected').textContent).toBe('none');
    expect(screen.getByTestId('hovered').textContent).toBe('none');
  });

  it('SELECT_ELEMENT sets elementId and clears hovered', () => {
    render(
      <SelectionProvider>
        <SelConsumer />
      </SelectionProvider>,
    );
    // First hover something
    act(() => screen.getByTestId('hover').click());
    expect(screen.getByTestId('hovered').textContent).toBe('el-99');

    // Then select — hovered should be cleared
    act(() => screen.getByTestId('select').click());
    expect(screen.getByTestId('selected').textContent).toBe('el-42');
    expect(screen.getByTestId('hovered').textContent).toBe('none');
  });

  it('HOVER_ELEMENT sets hoveredElementId', () => {
    render(
      <SelectionProvider>
        <SelConsumer />
      </SelectionProvider>,
    );
    act(() => screen.getByTestId('hover').click());
    expect(screen.getByTestId('hovered').textContent).toBe('el-99');
  });

  it('CLEAR_SELECTION resets both to null', () => {
    render(
      <SelectionProvider>
        <SelConsumer />
      </SelectionProvider>,
    );
    act(() => screen.getByTestId('select').click());
    act(() => screen.getByTestId('hover').click());
    act(() => screen.getByTestId('clear').click());
    expect(screen.getByTestId('selected').textContent).toBe('none');
    expect(screen.getByTestId('hovered').textContent).toBe('none');
  });

  it('throws when useSelectionContext is used outside provider', () => {
    expect(() => render(<SelConsumer />)).toThrow(
      'useSelectionContext must be used within a SelectionProvider',
    );
  });
});

// ---------------------------------------------------------------------------
// UIContext
// ---------------------------------------------------------------------------

describe('UIContext', () => {
  function UIConsumer() {
    const { state, dispatch } = useUIContext();
    return (
      <div>
        <span data-testid="cols">{state.gridCols}</span>
        <span data-testid="speed">{state.globalSpeed}</span>
        <span data-testid="paused">{String(state.paused)}</span>
        <span data-testid="focus">{state.focusDocumentId ?? 'none'}</span>
        <span data-testid="editor">{String(state.editorOpen)}</span>
        <span data-testid="bg">{state.previewBackground}</span>
        <button
          data-testid="set-cols"
          onClick={() => dispatch({ type: 'SET_GRID_COLS', cols: 4 })}
        />
        <button
          data-testid="set-speed"
          onClick={() => dispatch({ type: 'SET_SPEED', speed: 2.5 })}
        />
        <button
          data-testid="toggle-pause"
          onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
        />
        <button
          data-testid="reset-speed"
          onClick={() => dispatch({ type: 'RESET_SPEED' })}
        />
        <button
          data-testid="set-focus"
          onClick={() =>
            dispatch({ type: 'SET_FOCUS', documentId: 'doc-1' })
          }
        />
        <button
          data-testid="clear-focus"
          onClick={() => dispatch({ type: 'CLEAR_FOCUS' })}
        />
        <button
          data-testid="toggle-editor"
          onClick={() => dispatch({ type: 'TOGGLE_EDITOR' })}
        />
        <button
          data-testid="set-bg"
          onClick={() => dispatch({ type: 'SET_PREVIEW_BG', mode: 'light' })}
        />
      </div>
    );
  }

  it('starts with correct defaults', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    expect(screen.getByTestId('cols').textContent).toBe('2');
    expect(screen.getByTestId('speed').textContent).toBe('1');
    expect(screen.getByTestId('paused').textContent).toBe('false');
    expect(screen.getByTestId('focus').textContent).toBe('none');
    expect(screen.getByTestId('editor').textContent).toBe('false');
    expect(screen.getByTestId('bg').textContent).toBe('dark');
  });

  it('SET_GRID_COLS updates gridCols', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('set-cols').click());
    expect(screen.getByTestId('cols').textContent).toBe('4');
  });

  it('SET_SPEED updates globalSpeed', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('set-speed').click());
    expect(screen.getByTestId('speed').textContent).toBe('2.5');
  });

  it('TOGGLE_PAUSE toggles paused state', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('toggle-pause').click());
    expect(screen.getByTestId('paused').textContent).toBe('true');
    act(() => screen.getByTestId('toggle-pause').click());
    expect(screen.getByTestId('paused').textContent).toBe('false');
  });

  it('RESET_SPEED resets globalSpeed to 1', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('set-speed').click());
    expect(screen.getByTestId('speed').textContent).toBe('2.5');
    act(() => screen.getByTestId('reset-speed').click());
    expect(screen.getByTestId('speed').textContent).toBe('1');
  });

  it('SET_FOCUS sets focusDocumentId', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('set-focus').click());
    expect(screen.getByTestId('focus').textContent).toBe('doc-1');
  });

  it('CLEAR_FOCUS clears focusDocumentId', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('set-focus').click());
    act(() => screen.getByTestId('clear-focus').click());
    expect(screen.getByTestId('focus').textContent).toBe('none');
  });

  it('TOGGLE_EDITOR toggles editorOpen', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('toggle-editor').click());
    expect(screen.getByTestId('editor').textContent).toBe('true');
    act(() => screen.getByTestId('toggle-editor').click());
    expect(screen.getByTestId('editor').textContent).toBe('false');
  });

  it('SET_PREVIEW_BG updates previewBackground', () => {
    render(
      <UIProvider>
        <UIConsumer />
      </UIProvider>,
    );
    act(() => screen.getByTestId('set-bg').click());
    expect(screen.getByTestId('bg').textContent).toBe('light');
  });

  it('throws when useUIContext is used outside provider', () => {
    expect(() => render(<UIConsumer />)).toThrow(
      'useUIContext must be used within a UIProvider',
    );
  });
});

// ---------------------------------------------------------------------------
// EditorProvider (combined)
// ---------------------------------------------------------------------------

describe('EditorProvider', () => {
  function CombinedConsumer() {
    const { state: docState } = useDocumentContext();
    const { state: selState } = useSelectionContext();
    const { state: uiState } = useUIContext();
    return (
      <div>
        <span data-testid="doc-count">{docState.documents.length}</span>
        <span data-testid="sel">{selState.elementId ?? 'none'}</span>
        <span data-testid="ui-cols">{uiState.gridCols}</span>
      </div>
    );
  }

  it('provides all three contexts', () => {
    render(
      <EditorProvider>
        <CombinedConsumer />
      </EditorProvider>,
    );
    expect(screen.getByTestId('doc-count').textContent).toBe('0');
    expect(screen.getByTestId('sel').textContent).toBe('none');
    expect(screen.getByTestId('ui-cols').textContent).toBe('2');
  });
});
