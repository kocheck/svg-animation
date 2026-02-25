import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
  configurable: true,
});

// Mock crypto.randomUUID if not available
if (!globalThis.crypto?.randomUUID) {
  let counter = 0;
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => `test-uuid-${++counter}`,
  };
}
