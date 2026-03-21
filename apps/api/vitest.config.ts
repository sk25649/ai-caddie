import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Set env vars before any module loads — critical for JWT_SECRET
    env: {
      JWT_SECRET: 'test-jwt-secret-must-be-at-least-32-chars-long',
      DATABASE_URL: 'postgresql://test:test@localhost/test_ai_caddie',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
      OPENWEATHER_KEY: 'test-weather-key',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/scripts/**', 'src/db/**'],
      reporter: ['text', 'html'],
    },
  },
});
