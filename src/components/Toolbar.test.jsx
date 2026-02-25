import { describe, it, expect } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../context/testUtils.jsx';
import Toolbar from './Toolbar.jsx';

describe('Toolbar', () => {
  it('renders grid buttons', () => {
    renderWithProviders(<Toolbar />);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('renders speed display', () => {
    renderWithProviders(<Toolbar />);
    expect(screen.getByText('1.0x')).toBeDefined();
  });

  it('renders pause button', () => {
    renderWithProviders(<Toolbar />);
    expect(screen.getByText('Pause All')).toBeDefined();
  });

  it('toggles pause on click', async () => {
    renderWithProviders(<Toolbar />);
    await act(() => screen.getByText('Pause All').click());
    expect(screen.getByText('Play All')).toBeDefined();
  });

  it('renders background toggle (QW-3)', () => {
    renderWithProviders(<Toolbar />);
    expect(screen.getByTestId('bg-toggle')).toBeDefined();
  });

  it('cycles background on click (QW-3)', async () => {
    renderWithProviders(<Toolbar />);
    const btn = screen.getByTestId('bg-toggle');
    expect(btn.textContent).toContain('Dark');
    await act(() => btn.click());
    expect(btn.textContent).toContain('Light');
    await act(() => btn.click());
    expect(btn.textContent).toContain('Checker');
    await act(() => btn.click());
    expect(btn.textContent).toContain('Dark');
  });
});
