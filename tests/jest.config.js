/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        module: 'commonjs'
      }
    }]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    '../tyk-gateway/middleware/**/*.js',
    '../client-sdk/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  verbose: true,
  maxWorkers: 4,

  // Test suites configuration
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/unit/**/*.test.ts'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true,
            moduleResolution: 'node',
            module: 'commonjs'
          }
        }]
      }
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/integration/**/*.test.ts'],
      testEnvironment: 'node',
      testTimeout: 60000,
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true,
            moduleResolution: 'node',
            module: 'commonjs'
          }
        }]
      }
    },
    {
      displayName: 'blockchain',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/blockchain/**/*.test.ts'],
      testEnvironment: 'node',
      testTimeout: 60000,
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true,
            moduleResolution: 'node',
            module: 'commonjs'
          }
        }]
      }
    }
  ]
};
