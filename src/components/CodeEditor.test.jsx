import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../context/testUtils.jsx';
import CodeEditor from './CodeEditor.jsx';
import { SvgHistory } from '../model/SvgHistory.js';
import { SvgDoc } from '../model/SvgDoc.js';

const SVG_SRC = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';

function makeDocState(overrides = {}) {
  const doc = {
    id: 'doc-1',
    name: 'Test SVG',
    history: new SvgHistory(SVG_SRC),
    doc: SvgDoc.parse(SVG_SRC),
  };
  return {
    documents: [doc],
    activeDocumentId: 'doc-1',
    ...overrides,
  };
}

describe('CodeEditor', () => {
  it('renders editor toggle button', () => {
    renderWithProviders(<CodeEditor />);
    expect(screen.getByText(/Code Editor/)).toBeDefined();
  });

  it('QW-1: shows "Add to Gallery" when no activeDocumentId', () => {
    renderWithProviders(<CodeEditor />, {
      initialDocState: { documents: [], activeDocumentId: null },
    });
    // Open the editor
    fireEvent.click(screen.getByText(/Code Editor/));
    expect(screen.getByText('Add to Gallery')).toBeDefined();
  });

  it('QW-1: shows "Save Changes" when activeDocumentId is set', () => {
    renderWithProviders(<CodeEditor />, {
      initialDocState: makeDocState(),
    });
    // Open the editor
    fireEvent.click(screen.getByText(/Code Editor/));
    expect(screen.getByText('Save Changes')).toBeDefined();
  });

  it('QW-4: renders metadata bar with data-testid="svg-metadata" when valid SVG typed', () => {
    renderWithProviders(<CodeEditor />, {
      initialDocState: { documents: [], activeDocumentId: null },
    });
    fireEvent.click(screen.getByText(/Code Editor/));
    const textarea = screen.getByPlaceholderText(/Paste or type SVG code/);
    fireEvent.change(textarea, { target: { value: SVG_SRC } });
    expect(screen.getByTestId('svg-metadata')).toBeDefined();
  });

  it('QW-5: renders Ctrl+Enter hint text', () => {
    renderWithProviders(<CodeEditor />);
    fireEvent.click(screen.getByText(/Code Editor/));
    expect(screen.getByText(/Ctrl\+Enter to submit/)).toBeDefined();
  });

  it('dispatches ADD_DOCUMENT when "Add to Gallery" clicked with valid SVG', () => {
    renderWithProviders(<CodeEditor />, {
      initialDocState: { documents: [], activeDocumentId: null },
    });
    fireEvent.click(screen.getByText(/Code Editor/));
    const textarea = screen.getByPlaceholderText(/Paste or type SVG code/);
    fireEvent.change(textarea, { target: { value: SVG_SRC } });
    const nameInput = screen.getByPlaceholderText(/Animation name/);
    fireEvent.change(nameInput, { target: { value: 'my-anim' } });
    fireEvent.click(screen.getByText('Add to Gallery'));
    // After add, flash should show
    expect(screen.getByText('Added!')).toBeDefined();
  });

  it('dispatches REPLACE_DOCUMENT when "Save Changes" clicked', () => {
    renderWithProviders(<CodeEditor />, {
      initialDocState: makeDocState(),
    });
    fireEvent.click(screen.getByText(/Code Editor/));
    // Modify the code
    const textarea = screen.getByPlaceholderText(/Paste or type SVG code/);
    const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    fireEvent.change(textarea, { target: { value: newSvg } });
    fireEvent.click(screen.getByText('Save Changes'));
    expect(screen.getByText('Saved!')).toBeDefined();
  });
});
