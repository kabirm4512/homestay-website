import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env: {
      // Unit tests never touch a database; this only signs test tokens.
      SESSION_SECRET: 'unit-test-session-secret-0123456789abcdef',
    },
    testTimeout: 60_000,
  },
});
