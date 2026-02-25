import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../context/testUtils.jsx';
import Header from './Header.jsx';

describe('Header', () => {
  it('renders title', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('SVG Animation Viewer')).toBeDefined();
  });

  it('shows 0 animations when empty', () => {
    renderWithProviders(<Header />);
    expect(screen.getByText('0 animations')).toBeDefined();
  });
});
