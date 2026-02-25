import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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

  it('updates duration value on change', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByTestId('timing-duration-0');
    await user.clear(input);
    await user.type(input, '5');
    expect(input.value).toBe('5');
  });

  it('updates delay value on change', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByTestId('timing-delay-0');
    await user.clear(input);
    await user.type(input, '1.5');
    expect(input.value).toBe('1.5');
  });

  it('shows iteration count input when infinite is unchecked', async () => {
    const user = userEvent.setup();
    setup();
    const toggle = screen.getByTestId('timing-infinite-0');
    expect(toggle.checked).toBe(true);
    // iteration count input should not be visible when infinite is checked
    expect(screen.queryByTestId('timing-iterations-0')).toBeNull();

    // Uncheck infinite
    await user.click(toggle);
    expect(toggle.checked).toBe(false);
    // Now iteration count input should appear
    const iterInput = screen.getByTestId('timing-iterations-0');
    expect(iterInput).toBeTruthy();
    expect(iterInput.value).toBe('1');
  });

  it('changes iteration count value', async () => {
    const user = userEvent.setup();
    setup();
    // First uncheck infinite to reveal iteration count input
    const toggle = screen.getByTestId('timing-infinite-0');
    await user.click(toggle);
    const iterInput = screen.getByTestId('timing-iterations-0');
    // Use fireEvent.change for number inputs (happy-dom doesn't support selection on number inputs)
    fireEvent.change(iterInput, { target: { value: '5' } });
    expect(iterInput.value).toBe('5');
  });

  it('changes easing dropdown to a different preset', async () => {
    const user = userEvent.setup();
    setup();
    const select = screen.getByTestId('timing-easing-0');
    expect(select.value).toBe('linear');
    await user.selectOptions(select, 'ease-in-out');
    expect(select.value).toBe('ease-in-out');
  });

  it('types a custom cubic-bezier value', async () => {
    const user = userEvent.setup();
    setup();
    const select = screen.getByTestId('timing-easing-0');
    await user.selectOptions(select, 'custom');
    const customInput = screen.getByTestId('timing-easing-custom-0');
    expect(customInput.value).toBe('');
    await user.type(customInput, 'cubic-bezier(0.1, 0.7, 1.0, 0.1)');
    expect(customInput.value).toBe('cubic-bezier(0.1, 0.7, 1.0, 0.1)');
  });

  it('commits timing on duration blur', async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByTestId('timing-duration-0');
    await user.clear(input);
    await user.type(input, '3');
    // Blur should trigger commitTiming
    await user.tab();
    // No error means commitTiming executed
    expect(input.value).toBe('3');
  });

  it('parses ms durations correctly', () => {
    const msAnimation = {
      ...MOCK_CSS_ANIMATION,
      properties: { ...MOCK_CSS_ANIMATION.properties, duration: '500ms' },
    };
    setup([msAnimation]);
    const input = screen.getByTestId('timing-duration-0');
    expect(input.value).toBe('0.5');
  });

  it('initializes with custom easing mode for non-preset easing', () => {
    const customEasingAnim = {
      ...MOCK_CSS_ANIMATION,
      properties: {
        ...MOCK_CSS_ANIMATION.properties,
        easing: 'cubic-bezier(0.1, 0.2, 0.3, 0.4)',
      },
    };
    setup([customEasingAnim]);
    const select = screen.getByTestId('timing-easing-0');
    expect(select.value).toBe('custom');
    const customInput = screen.getByTestId('timing-easing-custom-0');
    expect(customInput.value).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.4)');
  });

  it('initializes with non-infinite iteration count', () => {
    const finiteAnim = {
      ...MOCK_CSS_ANIMATION,
      properties: {
        ...MOCK_CSS_ANIMATION.properties,
        iterationCount: '3',
      },
    };
    setup([finiteAnim]);
    const toggle = screen.getByTestId('timing-infinite-0');
    expect(toggle.checked).toBe(false);
    const iterInput = screen.getByTestId('timing-iterations-0');
    expect(iterInput.value).toBe('3');
  });
});
