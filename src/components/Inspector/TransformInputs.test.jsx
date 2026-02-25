import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import TransformInputs from './TransformInputs.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const SVG_WITH_TRANSFORM = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect id="r1" width="50" height="50" transform="translate(10, 20) rotate(45) scale(1.5)"/>
</svg>`;

const SVG_NO_TRANSFORM = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect id="r1" width="50" height="50"/>
</svg>`;

function setup(svg, elementId = 'r1') {
  const doc = SvgDoc.parse(svg);
  const history = new SvgHistory(svg);
  const el = doc.getElementById(elementId);
  const svgdocId = el.getAttribute('data-svgdoc-id');

  return renderWithProviders(
    <TransformInputs element={el} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState: { elementId: svgdocId, hoveredElementId: null },
    }
  );
}

describe('TransformInputs', () => {
  it('renders four numeric inputs', () => {
    setup(SVG_WITH_TRANSFORM);
    expect(screen.getByTestId('transform-x')).toBeTruthy();
    expect(screen.getByTestId('transform-y')).toBeTruthy();
    expect(screen.getByTestId('transform-rotation')).toBeTruthy();
    expect(screen.getByTestId('transform-scale')).toBeTruthy();
  });

  it('populates fields from existing transform attribute', () => {
    setup(SVG_WITH_TRANSFORM);
    expect(screen.getByTestId('transform-x').value).toBe('10');
    expect(screen.getByTestId('transform-y').value).toBe('20');
    expect(screen.getByTestId('transform-rotation').value).toBe('45');
    expect(screen.getByTestId('transform-scale').value).toBe('1.5');
  });

  it('shows defaults when no transform attribute exists', () => {
    setup(SVG_NO_TRANSFORM);
    expect(screen.getByTestId('transform-x').value).toBe('0');
    expect(screen.getByTestId('transform-y').value).toBe('0');
    expect(screen.getByTestId('transform-rotation').value).toBe('0');
    expect(screen.getByTestId('transform-scale').value).toBe('1');
  });

  it('commits on Enter', async () => {
    const user = userEvent.setup();
    setup(SVG_WITH_TRANSFORM);
    const xInput = screen.getByTestId('transform-x');
    await user.clear(xInput);
    await user.type(xInput, '99');
    await user.keyboard('{Enter}');
    expect(xInput.value).toBe('99');
  });

  it('reverts on Escape', async () => {
    const user = userEvent.setup();
    setup(SVG_WITH_TRANSFORM);
    const xInput = screen.getByTestId('transform-x');
    await user.clear(xInput);
    await user.type(xInput, '999');
    await user.keyboard('{Escape}');
    expect(xInput.value).toBe('10');
  });

  it('shows android warning when original transform has skew', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect id="r1" width="50" height="50" transform="skewX(30)"/>
    </svg>`;
    setup(svg);
    const warning = screen.getByTestId('android-warning');
    expect(warning).toBeTruthy();
  });
});
