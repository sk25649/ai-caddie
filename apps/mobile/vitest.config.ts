import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'test-utils/react-native-mock.ts'),
      'expo-modules-core': path.resolve(__dirname, 'test-utils/expo-modules-core-mock.ts'),
    },
  },
  test: {
    include: ['lib/__tests__/**/*.test.ts', 'stores/__tests__/**/*.test.ts', 'hooks/__tests__/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [
      ['hooks/__tests__/**/*.test.ts', 'jsdom'],
    ],
  },
});
