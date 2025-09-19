/**
 * Jest 配置文件 - LPC格式化器测试套件
 * 配置全面的测试环境，支持单元测试、集成测试和性能测试
 */

module.exports = {
    // 测试环境
    preset: 'ts-jest',
    testEnvironment: 'node',

    // 源码和测试文件路径
    roots: ['<rootDir>/src', '<rootDir>/tests'],

    // 测试文件匹配模式
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/?(*.)+(spec|test).ts',
        '**/tests/**/*.test.ts'
    ],

    // 模块名称映射 - 正确的选项名是moduleNameMapping
    moduleNameMapping: {
        '^vscode$': '<rootDir>/tests/mocks/MockVSCode.ts'
    },

    // TypeScript 编译选项
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                module: 'commonjs',
                target: 'ES2020',
                lib: ['ES2020', 'DOM'],
                sourceMap: true,
                strict: false, // 放宽严格模式以支持mock
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                isolatedModules: true,
                types: ['jest', 'node']
            }
        }]
    },

    // 文件扩展名解析
    moduleFileExtensions: ['ts', 'js', 'json'],

    // 设置文件
    setupFiles: ['<rootDir>/tests/setup/jest.setup.ts'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup/global.setup.ts'],

    // 测试覆盖率配置
    collectCoverageFrom: [
        'src/formatting/**/*.ts',
        '!src/formatting/**/*.d.ts',
        '!src/formatting/test/**/*',
        '!src/formatting/**/index.ts',
        '!src/formatting/**/*.interface.ts'
    ],

    // 覆盖率报告格式
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageDirectory: 'coverage',

    // 测试超时设置
    testTimeout: 10000, // 默认10秒

    // 性能和内存设置
    maxWorkers: '50%',

    // 详细输出配置
    verbose: true,
    silent: false,

    // 错误处理
    bail: false, // 不在第一个测试失败时停止
    errorOnDeprecated: true,

    // 清理配置
    clearMocks: true,
    restoreMocks: true,
    resetMocks: false,

    // 监视模式配置
    watchPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/dist/',
        '<rootDir>/out/',
        '<rootDir>/coverage/'
    ],

    // 忽略模式
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/dist/',
        '<rootDir>/out/'
    ],

    // 模块路径忽略
    modulePathIgnorePatterns: [
        '<rootDir>/dist/',
        '<rootDir>/out/'
    ]
};