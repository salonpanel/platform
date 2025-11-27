/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  moduleNameMapper: {
    // Align Jest path aliases with tsconfig ("@/*" -> "./src/*")
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Ignore heavy integration suites that require external services
  // or a live Supabase/Stripe/Upstash environment. They can be run
  // manually when that infrastructure is available.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/rls.test.ts',
    '/tests/rls-integration.test.ts',
    '/tests/rls-complete.test.ts',
    '/tests/webhook-idempotency.test.ts',
    '/tests/rate-limit.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
};

module.exports = config;
