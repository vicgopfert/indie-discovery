/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // O cliente gerado pelo Prisma importa './arquivo.js' apontando para os .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
