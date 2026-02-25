import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../context/testUtils.jsx';
import InspectorPanel from './InspectorPanel.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="group1">
    <circle id="c1" cx="50" cy="50" r="25" fill="red" stroke="black" class="shape primary"/>
  </g>
</svg>`;

function makeDocAndSelection(svg, elementSelector) {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);

  const initialDocState = {
    documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
    activeDocumentId: 'doc-1',
  };

  let initialSelectionState = undefined;
  if (elementSelector) {
    const el = typeof elementSelector === 'function'
      ? elementSelector(doc)
      : doc.getElementById(elementSelector);
    const svgdocId = el.getAttribute('data-svgdoc-id');
    initialSelectionState = { elementId: svgdocId, hoveredElementId: null };
  }

  return { initialDocState, initialSelectionState };
}

describe('InspectorPanel', () => {
  it('shows placeholder when no element is selected', () => {
    const doc = SvgDoc.parse(SIMPLE_SVG);
    const history = new SvgHistory(SIMPLE_SVG);
    renderWithProviders(<InspectorPanel />, {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
    });
    expect(screen.getByText('Select an element to inspect')).toBeTruthy();
  });

  it('shows placeholder when no active document', () => {
    renderWithProviders(<InspectorPanel />);
    expect(screen.getByText('Select an element to inspect')).toBeTruthy();
  });

  it('renders element tag name when selected', () => {
    const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
    renderWithProviders(<InspectorPanel />, opts);

    const tagEl = screen.getByTestId('inspector-tag');
    expect(tagEl.textContent).toBe('<circle>');
  });

  it('displays attributes table with correct key-value pairs', () => {
    const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
    renderWithProviders(<InspectorPanel />, opts);

    const table = screen.getByTestId('inspector-attrs');
    const rows = table.querySelectorAll('tr');

    // circle has: id, cx, cy, r, fill, stroke, class = 7 attributes
    expect(rows.length).toBe(7);

    // Check a few specific attribute key-value pairs
    const cells = table.querySelectorAll('td');
    const keyValues = {};
    for (let i = 0; i < cells.length; i += 2) {
      keyValues[cells[i].textContent] = cells[i + 1].textContent;
    }

    expect(keyValues['cx']).toBe('50');
    expect(keyValues['cy']).toBe('50');
    expect(keyValues['r']).toBe('25');
    expect(keyValues['fill']).toBe('red');
    expect(keyValues['stroke']).toBe('black');
  });

  it('shows parent chain breadcrumb (svg > g for a circle inside a group)', () => {
    const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
    renderWithProviders(<InspectorPanel />, opts);

    const breadcrumb = screen.getByTestId('inspector-breadcrumb');
    const tags = breadcrumb.querySelectorAll('.breadcrumb-tag');

    // Parent chain for circle: svg > g (not including circle itself)
    expect(tags.length).toBe(2);
    expect(tags[0].textContent).toBe('svg');
    expect(tags[1].textContent).toBe('g');
  });

  it('shows id badge when element has id attribute', () => {
    const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
    renderWithProviders(<InspectorPanel />, opts);

    const idBadge = screen.getByText('#c1');
    expect(idBadge).toBeTruthy();
    expect(idBadge.className).toBe('inspector-id');
  });

  it('shows class pills when element has class attribute', () => {
    const opts = makeDocAndSelection(SIMPLE_SVG, 'c1');
    renderWithProviders(<InspectorPanel />, opts);

    const pills = screen.getAllByText(/^\./);
    expect(pills.length).toBe(2);
    expect(pills[0].textContent).toBe('.shape');
    expect(pills[1].textContent).toBe('.primary');

    pills.forEach(pill => {
      expect(pill.className).toBe('class-pill');
    });
  });
});
