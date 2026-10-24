const base = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  globalSetup: '<rootDir>/test/support/e2e-global-setup.ts',
  setupFiles: ['<rootDir>/test/support/e2e-guard.ts'],
};
