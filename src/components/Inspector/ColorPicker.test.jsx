import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorPicker from './ColorPicker.jsx';

vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }) => (
    <div data-testid="hex-picker-mock" onClick={() => onChange?.('#00ff00')} />
  ),
}));

describe('ColorPicker', () => {
  it('renders the hex color picker', () => {
    render(<ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId('color-picker')).toBeTruthy();
  });

  it('renders hex text input with current color', () => {
    render(<ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}} />);
    const input = screen.getByTestId('color-hex-input');
    expect(input.value).toBe('#ff0000');
  });

  it('calls onChange when hex input changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker color="#ff0000" onChange={onChange} onClose={() => {}} />);
    const input = screen.getByTestId('color-hex-input');
    await user.clear(input);
    await user.type(input, '#00ff00');
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker color="#ff0000" onChange={() => {}} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onBatchStart on pointer down', () => {
    const onBatchStart = vi.fn();
    render(
      <ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}}
        onBatchStart={onBatchStart} onBatchEnd={() => {}} />
    );
    const picker = screen.getByTestId('color-picker');
    fireEvent.pointerDown(picker);
    expect(onBatchStart).toHaveBeenCalled();
  });

  it('calls onBatchEnd on pointer up', () => {
    const onBatchEnd = vi.fn();
    render(
      <ColorPicker color="#ff0000" onChange={() => {}} onClose={() => {}}
        onBatchStart={() => {}} onBatchEnd={onBatchEnd} />
    );
    const picker = screen.getByTestId('color-picker');
    fireEvent.pointerUp(picker);
    expect(onBatchEnd).toHaveBeenCalled();
  });

  it('shows android warning for non-hex input color', () => {
    render(<ColorPicker color="hsl(0, 100%, 50%)" onChange={() => {}} onClose={() => {}} />);
    const warning = screen.getByTestId('android-warning');
    expect(warning).toBeTruthy();
  });
});
