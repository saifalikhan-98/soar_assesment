export default {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setup.js'],
    moduleFileExtensions: ['js', 'json'],
    testMatch: [
        '<rootDir>/tests/**/*.test.js'
    ],
    collectCoverage: true,
    collectCoverageFrom: [
        'connect/**/*.js',
        'managers/**/*.js',
        'loaders/**/*.js',
        'libs/**/*.js',
        'mws/**/*.js',
        'cache/**/*.js',
        'index.js',
        // Exclude patterns
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**',
        '!config/**',
        '!**/*.config.js',
        '!**/*.config.mjs'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'clover'],
    verbose: true,
    testTimeout: 10000,
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    // Add moduleNameMapper for better import handling
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    },
    // For ES Modules support
    extensionsToTreatAsEsm: ['.js'],
    // Clear mocks between tests
    clearMocks: true,
    // Add roots to ensure Jest finds all files
    roots: [
        '<rootDir>'
    ]
}