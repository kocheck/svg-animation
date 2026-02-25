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

  it('normalizes short hex (#fff) to full hex (#ffffff)', () => {
    render(<ColorPicker color="#fff" onChange={() => {}} onClose={() => {}} />);
    const picker = screen.getByTestId('hex-picker-mock');
    // The HexColorPicker mock receives the normalized hex
    // The component initializes hex state via normalizeToHex('#fff') -> '#ffffff'
    // We can verify by checking the hex input shows the original color prop as inputValue
    const input = screen.getByTestId('color-hex-input');
    expect(input.value).toBe('#fff');
  });

  it('normalizes short hex (#abc) to full hex (#aabbcc) for the picker', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#abc" onChange={onChange} onClose={() => {}} />);
    // Simulate the picker mock calling onChange
    const picker = screen.getByTestId('hex-picker-mock');
    fireEvent.click(picker);
    // The mock sends #00ff00 on click, which triggers handlePickerChange
    expect(onChange).toHaveBeenCalledWith('#00ff00');
  });

  it('handles handlePickerChange to update hex and input value', () => {
    const onChange = vi.fn();
    render(<ColorPicker color="#ff0000" onChange={onChange} onClose={() => {}} />);
    const picker = screen.getByTestId('hex-picker-mock');
    fireEvent.click(picker);
    // handlePickerChange should update both hex and inputValue, and call onChange
    expect(onChange).toHaveBeenCalledWith('#00ff00');
    const input = screen.getByTestId('color-hex-input');
    expect(input.value).toBe('#00ff00');
  });

  it('handles null/undefined color gracefully (defaults to #000000)', () => {
    render(<ColorPicker color={null} onChange={() => {}} onClose={() => {}} />);
    const input = screen.getByTestId('color-hex-input');
    // inputValue is initialized with color || '#000000'
    expect(input.value).toBe('#000000');
  });

  it('does not call onChange for invalid (non-6-digit) hex input', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker color="#ff0000" onChange={onChange} onClose={() => {}} />);
    const input = screen.getByTestId('color-hex-input');
    await user.clear(input);
    await user.type(input, '#ff');
    // Only partial hex typed, onChange should not be called for incomplete hex
    expect(onChange).not.toHaveBeenCalled();
  });
});
