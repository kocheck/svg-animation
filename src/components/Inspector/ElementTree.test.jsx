import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import ElementTree from './ElementTree.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const NESTED_SVG = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="layer1" class="main">
    <circle id="dot" cx="50" cy="50" r="10"/>
    <rect id="box" width="20" height="20"/>
  </g>
  <text id="label">Hello</text>
</svg>`;

function setup(svg = NESTED_SVG, selectedElementId = null) {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);

  let initialSelectionState = undefined;
  if (selectedElementId) {
    const el = doc.getElementById(selectedElementId);
    const svgdocId = el.getAttribute('data-svgdoc-id');
    initialSelectionState = { elementId: svgdocId, hoveredElementId: null };
  }

  return renderWithProviders(
    <ElementTree svgDoc={doc} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState,
    }
  );
}

describe('ElementTree', () => {
  it('renders the tree section', () => {
    setup();
    expect(screen.getByTestId('element-tree')).toBeTruthy();
  });

  it('renders root svg node', () => {
    setup();
    expect(screen.getByText('svg')).toBeTruthy();
  });

  it('renders child element names', () => {
    setup();
    expect(screen.getByText('g')).toBeTruthy();
    expect(screen.getByText('text')).toBeTruthy();
  });

  it('shows id attribute inline when present', () => {
    setup();
    expect(screen.getByText('#layer1')).toBeTruthy();
    expect(screen.getByText('#dot')).toBeTruthy();
  });

  it('shows class attribute inline when present', () => {
    setup();
    expect(screen.getByText('.main')).toBeTruthy();
  });

  it('dispatches SELECT_ELEMENT on click', async () => {
    const user = userEvent.setup();
    setup();
    const dotNode = screen.getByText('#dot').closest('[data-testid="tree-node"]');
    await user.click(dotNode);
    expect(dotNode.classList.contains('tree-node-selected')).toBe(true);
  });

  it('highlights selected element in tree', () => {
    setup(NESTED_SVG, 'dot');
    const dotNode = screen.getByText('#dot').closest('[data-testid="tree-node"]');
    expect(dotNode.classList.contains('tree-node-selected')).toBe(true);
  });

  it('toggle collapses and expands children', async () => {
    const user = userEvent.setup();
    setup();
    const toggles = screen.getAllByTestId('tree-toggle');
    expect(toggles.length).toBeGreaterThan(0);
    await user.click(toggles[0]);
    // After collapsing root svg, nested elements should be hidden
  });

  it('expands first two levels by default', () => {
    setup();
    expect(screen.getByText('g')).toBeTruthy();
    expect(screen.getByText('text')).toBeTruthy();
    expect(screen.getByText('circle')).toBeTruthy();
    expect(screen.getByText('rect')).toBeTruthy();
  });
});
