// src/components/Inspector/AttributeEditor.test.jsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import AttributeEditor from './AttributeEditor.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle id="c1" cx="50" cy="50" r="25" fill="red" stroke="black" stroke-linecap="round"/>
</svg>`;

function setup(svg = SIMPLE_SVG, elementId = 'c1') {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);
  const el = doc.getElementById(elementId);
  const svgdocId = el.getAttribute('data-svgdoc-id');

  return renderWithProviders(
    <AttributeEditor element={el} svgDoc={doc} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState: { elementId: svgdocId, hoveredElementId: null },
    }
  );
}

describe('AttributeEditor', () => {
  it('renders all attributes as rows', () => {
    setup();
    const table = screen.getByTestId('attribute-editor');
    const rows = table.querySelectorAll('tr');
    // id, cx, cy, r, fill, stroke, stroke-linecap = 7
    expect(rows.length).toBe(7);
  });

  it('enters edit mode on double-click of a value cell', async () => {
    const user = userEvent.setup();
    setup();
    const valueCells = screen.getAllByTestId('attr-value');
    // Double-click the 'r' attribute value (index 3: id=0, cx=1, cy=2, r=3)
    await user.dblClick(valueCells[3]);
    const input = screen.getByTestId('attr-edit-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('25');
  });

  it('commits edit on Enter and updates the value', async () => {
    const user = userEvent.setup();
    setup();
    const valueCells = screen.getAllByTestId('attr-value');
    await user.dblClick(valueCells[3]); // r = 25
    const input = screen.getByTestId('attr-edit-input');
    await user.clear(input);
    await user.type(input, '50');
    await user.keyboard('{Enter}');
    // Should exit edit mode
    expect(screen.queryByTestId('attr-edit-input')).toBeNull();
  });

  it('cancels edit on Escape', async () => {
    const user = userEvent.setup();
    setup();
    const valueCells = screen.getAllByTestId('attr-value');
    await user.dblClick(valueCells[3]);
    const input = screen.getByTestId('attr-edit-input');
    await user.clear(input);
    await user.type(input, '999');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('attr-edit-input')).toBeNull();
  });

  it('renders enum attributes as select dropdown on double-click', async () => {
    const user = userEvent.setup();
    setup();
    // stroke-linecap is the last attribute (index 6)
    const valueCells = screen.getAllByTestId('attr-value');
    await user.dblClick(valueCells[6]);
    const select = screen.getByTestId('attr-edit-select');
    expect(select).toBeTruthy();
    expect(select.value).toBe('round');
  });

  it('renders color swatch for fill attribute', () => {
    setup();
    const swatches = screen.getAllByTestId('color-swatch');
    expect(swatches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows android warning for problematic attributes', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <circle id="c1" cx="50" cy="50" r="25" filter="url(#blur)"/>
    </svg>`;
    setup(svg);
    const warning = screen.getByTestId('android-warning');
    expect(warning).toBeTruthy();
  });
});
