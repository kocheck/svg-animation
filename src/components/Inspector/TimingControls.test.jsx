import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../context/testUtils.jsx';
import TimingControls from './TimingControls.jsx';
import { SvgDoc } from '../../model/SvgDoc.js';
import { SvgHistory } from '../../model/SvgHistory.js';

const MOCK_CSS_ANIMATION = {
  type: 'css',
  name: 'spin',
  elementId: '1',
  properties: {
    duration: '2s',
    delay: '0s',
    easing: 'linear',
    iterationCount: 'infinite',
    direction: 'normal',
    fillMode: 'none',
    state: 'running',
  },
  androidCompatible: true,
  warnings: [],
};

const MOCK_SMIL_ANIMATION = {
  type: 'smil',
  name: 'animate',
  elementId: '2',
  properties: {
    duration: '1s',
    delay: null,
    easing: null,
    iterationCount: 'indefinite',
    direction: null,
    fillMode: null,
    state: 'running',
  },
  androidCompatible: false,
  warnings: ['SMIL not supported on Android'],
};

const SIMPLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="c1" r="10"/></svg>';

function setup(animations = [MOCK_CSS_ANIMATION]) {
  const doc = SvgDoc.parse(SIMPLE_SVG);
  const history = new SvgHistory(SIMPLE_SVG);
  const el = doc.getElementById('c1');
  const svgdocId = el.getAttribute('data-svgdoc-id');

  return renderWithProviders(
    <TimingControls element={el} animations={animations} />,
    {
      initialDocState: {
        documents: [{ id: 'doc-1', name: 'test.svg', history, doc }],
        activeDocumentId: 'doc-1',
      },
      initialSelectionState: { elementId: svgdocId, hoveredElementId: null },
    }
  );
}

describe('TimingControls', () => {
  it('renders timing section with animation name', () => {
    setup();
    expect(screen.getByText('spin')).toBeTruthy();
  });

  it('renders duration input with current value', () => {
    setup();
    const input = screen.getByTestId('timing-duration-0');
    expect(input.value).toBe('2');
  });

  it('renders delay input with current value', () => {
    setup();
    const input = screen.getByTestId('timing-delay-0');
    expect(input.value).toBe('0');
  });

  it('renders iteration count input', () => {
    setup();
    const toggle = screen.getByTestId('timing-infinite-0');
    expect(toggle.checked).toBe(true);
  });

  it('renders easing dropdown with current preset selected', () => {
    setup();
    const select = screen.getByTestId('timing-easing-0');
    expect(select.value).toBe('linear');
  });

  it('shows custom input when Custom is selected', async () => {
    const user = userEvent.setup();
    setup();
    const select = screen.getByTestId('timing-easing-0');
    await user.selectOptions(select, 'custom');
    const input = screen.getByTestId('timing-easing-custom-0');
    expect(input).toBeTruthy();
  });

  it('shows SMIL read-only notice for SMIL animations', () => {
    setup([MOCK_SMIL_ANIMATION]);
    expect(screen.getByText(/attribute editor/i)).toBeTruthy();
  });

  it('renders easing preview area', () => {
    setup();
    expect(screen.getByTestId('easing-preview-0')).toBeTruthy();
  });

  it('renders nothing when no animations', () => {
    const { container } = setup([]);
    expect(container.querySelector('.timing-controls')).toBeNull();
  });
});
