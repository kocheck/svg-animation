import { describe, it, expect, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../context/testUtils.jsx';
import Card from './Card.jsx';
import { SvgHistory } from '../model/SvgHistory.js';
import { SvgDoc } from '../model/SvgDoc.js';

const SVG_SRC = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>';

const mockDoc = {
  id: 'test-1',
  name: 'test-anim',
  history: new SvgHistory(SVG_SRC),
  doc: SvgDoc.parse(SVG_SRC),
};

describe('Card', () => {
  it('renders the document name', () => {
    renderWithProviders(<Card document={mockDoc} />, {
      initialDocState: { documents: [mockDoc], activeDocumentId: null },
    });
    expect(screen.getByText('test-anim')).toBeDefined();
  });

  it('renders copy button (QW-2)', () => {
    renderWithProviders(<Card document={mockDoc} />, {
      initialDocState: { documents: [mockDoc], activeDocumentId: null },
    });
    expect(screen.getByText('Copy')).toBeDefined();
  });

  it('copies SVG source to clipboard on copy click (QW-2)', async () => {
    renderWithProviders(<Card document={mockDoc} />, {
      initialDocState: { documents: [mockDoc], activeDocumentId: null },
    });
    await act(() => screen.getByText('Copy').click());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SVG_SRC);
  });

  it('shows Copied! flash after copy', async () => {
    renderWithProviders(<Card document={mockDoc} />, {
      initialDocState: { documents: [mockDoc], activeDocumentId: null },
    });
    await act(() => screen.getByText('Copy').click());
    expect(screen.getByText('Copied!')).toBeDefined();
  });

  it('applies preview background class (QW-3)', () => {
    renderWithProviders(<Card document={mockDoc} />, {
      initialDocState: { documents: [mockDoc], activeDocumentId: null },
    });
    const wrap = screen.getByTestId('svg-wrap-test-1');
    expect(wrap.className).toContain('preview-bg-dark');
  });

  it('renders edit and remove buttons', () => {
    renderWithProviders(<Card document={mockDoc} />, {
      initialDocState: { documents: [mockDoc], activeDocumentId: null },
    });
    expect(screen.getByText('Edit')).toBeDefined();
    expect(screen.getByText('Remove')).toBeDefined();
  });
});
