import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Satisfies config/env.ts validation. Tests never connect to MongoDB:
    // anything that would need the DB is mocked or stops before reaching it.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:1/never-connected',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      COOKIE_NAME: 'dt_token',
      CLIENT_ORIGIN: 'http://localhost:3001',
    },
  },
});
