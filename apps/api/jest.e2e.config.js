const base = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
};
