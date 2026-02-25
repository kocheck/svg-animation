import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../context/testUtils.jsx';
import FocusOverlay from './FocusOverlay.jsx';
import { SvgHistory } from '../model/SvgHistory.js';
import { SvgDoc } from '../model/SvgDoc.js';

const SVG_SRC = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';

function makeDocState() {
  const doc = {
    id: 'doc-1',
    name: 'Test SVG',
    history: new SvgHistory(SVG_SRC),
    doc: SvgDoc.parse(SVG_SRC),
  };
  return {
    documents: [doc],
    activeDocumentId: null,
  };
}

describe('FocusOverlay', () => {
  it('hidden when focusDocumentId is null', () => {
    const { container } = renderWithProviders(<FocusOverlay />, {
      initialDocState: makeDocState(),
    });
    const overlay = container.querySelector('.focus-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('visible when focusDocumentId matches a document', () => {
    // We need a custom wrapper that sets focusDocumentId
    // Since UIProvider starts with focusDocumentId: null, we render and then
    // trigger via a companion component. Instead, we test the content approach:
    // Render with a helper that clicks to focus.
    // Alternative: test internal rendering by providing a pre-focused UI state.
    // Since testUtils doesn't support initialUIState, we'll use an integration approach.
    const { container } = renderWithProviders(
      <FocusOverlayWithFocus docId="doc-1" />,
      { initialDocState: makeDocState() },
    );
    const overlay = container.querySelector('.focus-overlay');
    expect(overlay.classList.contains('open')).toBe(true);
  });

  it('renders copy button', () => {
    renderWithProviders(
      <FocusOverlayWithFocus docId="doc-1" />,
      { initialDocState: makeDocState() },
    );
    expect(screen.getByText('Copy SVG')).toBeDefined();
  });

  it('renders keyboard hints strip', () => {
    renderWithProviders(
      <FocusOverlayWithFocus docId="doc-1" />,
      { initialDocState: makeDocState() },
    );
    expect(screen.getByText(/navigate/)).toBeDefined();
    expect(screen.getByText(/Esc close/)).toBeDefined();
  });

  it('close button dispatches CLEAR_FOCUS', () => {
    const { container } = renderWithProviders(
      <FocusOverlayWithFocus docId="doc-1" />,
      { initialDocState: makeDocState() },
    );
    // Overlay should be open
    expect(container.querySelector('.focus-overlay.open')).toBeDefined();
    // Click close
    fireEvent.click(screen.getByText('\u00d7'));
    // Should no longer be open
    expect(container.querySelector('.focus-overlay').classList.contains('open')).toBe(false);
  });

  it('applies preview background class', () => {
    const { container } = renderWithProviders(
      <FocusOverlayWithFocus docId="doc-1" />,
      { initialDocState: makeDocState() },
    );
    // Default previewBackground is 'dark'
    const svgWrap = container.querySelector('.focus-svg');
    expect(svgWrap.className).toContain('preview-bg-dark');
  });
});

// Helper component that sets focus via UIContext dispatch
import { useUIContext } from '../context/EditorContext.jsx';
import { useEffect } from 'react';

function FocusOverlayWithFocus({ docId }) {
  const { dispatch } = useUIContext();
  useEffect(() => {
    dispatch({ type: 'SET_FOCUS', documentId: docId });
  }, [dispatch, docId]);
  return <FocusOverlay />;
}
