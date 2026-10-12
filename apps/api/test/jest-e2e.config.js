module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  globalSetup: '<rootDir>/global-setup.js',
  globalTeardown: '<rootDir>/global-teardown.js',
  setupFiles: ['<rootDir>/setup-env.js'],
  testTimeout: 60000,
};
