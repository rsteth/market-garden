const nextJest = require('next/jest')({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '\\.(glsl|vert|frag)$': '<rootDir>/src/__mocks__/shaderMock.ts',
  },
};

module.exports = nextJest(customConfig);
