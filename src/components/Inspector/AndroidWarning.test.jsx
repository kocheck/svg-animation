import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AndroidWarning from './AndroidWarning.jsx';

describe('AndroidWarning', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<AndroidWarning message={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when message is undefined', () => {
    const { container } = render(<AndroidWarning message={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders warning icon when message is provided', () => {
    render(<AndroidWarning message="Not supported on Android" />);
    const icon = screen.getByTestId('android-warning');
    expect(icon).toBeTruthy();
  });

  it('shows tooltip text on hover', async () => {
    const user = userEvent.setup();
    render(<AndroidWarning message="filter is not supported" />);
    const icon = screen.getByTestId('android-warning');

    await user.hover(icon);
    expect(icon.getAttribute('title')).toBe('filter is not supported');
  });

  it('has the correct CSS class for styling', () => {
    render(<AndroidWarning message="warning" />);
    const icon = screen.getByTestId('android-warning');
    expect(icon.classList.contains('android-warning')).toBe(true);
  });
});
