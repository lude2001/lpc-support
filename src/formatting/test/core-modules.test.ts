/**
 * 核心模块基础测试
 * 验证重构后的核心模块是否正常工作
 */

import { CommonTokenStream } from 'antlr4ts';
import { ErrorCollector, IndentManager, TokenUtils, LineBreakManager, FormattingCore, FormattingContext } from '../core';
import { DEFAULT_FORMATTING_OPTIONS } from '../types';

// Mock CommonTokenStream for testing
class MockTokenStream extends CommonTokenStream {
    constructor() {
        super(null as any);
    }
    
    get size(): number { return 0; }
    get(index: number): any { return null; }
}

describe('Core Modules', () => {
    let mockTokenStream: MockTokenStream;
    let options = DEFAULT_FORMATTING_OPTIONS;

    beforeEach(() => {
        mockTokenStream = new MockTokenStream();
    });

    describe('ErrorCollector', () => {
        test('should collect and retrieve errors', () => {
            const errorCollector = new ErrorCollector();
            
            expect(errorCollector.getErrorCount()).toBe(0);
            expect(errorCollector.hasErrors()).toBe(false);
            
            errorCollector.addError('Test error', 'test context');
            
            expect(errorCollector.getErrorCount()).toBe(1);
            expect(errorCollector.hasErrors()).toBe(true);
            
            const errors = errorCollector.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Test error');
            expect(errors[0]).toContain('test context');
        });

        test('should respect maximum error limit', () => {
            const errorCollector = new ErrorCollector(3);
            
            errorCollector.addError('Error 1');
            errorCollector.addError('Error 2');
            errorCollector.addError('Error 3');
            errorCollector.addError('Error 4'); // Should be ignored
            
            expect(errorCollector.getErrorCount()).toBe(3);
            expect(errorCollector.isAtErrorLimit()).toBe(true);
        });
    });

    describe('IndentManager', () => {
        test('should manage indent levels correctly', () => {
            const indentManager = new IndentManager(options);
            
            expect(indentManager.getIndentLevel()).toBe(0);
            expect(indentManager.getIndent()).toBe('');
            
            indentManager.increaseIndent();
            expect(indentManager.getIndentLevel()).toBe(1);
            expect(indentManager.getIndent()).toBe('    '); // 4 spaces
            
            indentManager.increaseIndent(2);
            expect(indentManager.getIndentLevel()).toBe(3);
            
            indentManager.decreaseIndent();
            expect(indentManager.getIndentLevel()).toBe(2);
            
            indentManager.setIndentLevel(0);
            expect(indentManager.getIndentLevel()).toBe(0);
        });

        test('should calculate context-specific indent levels', () => {
            const indentManager = new IndentManager({
                ...options,
                switchCaseAlignment: 'indent'
            });
            
            indentManager.setIndentLevel(1);
            
            expect(indentManager.calculateIndentLevel()).toBe(1);
            expect(indentManager.calculateIndentLevel('case')).toBe(2);
            expect(indentManager.calculateIndentLevel('normal')).toBe(1);
        });

        test('should handle withIndent operations', () => {
            const indentManager = new IndentManager(options);
            
            const result = indentManager.withIndent(2, () => {
                expect(indentManager.getIndentLevel()).toBe(2);
                return 'test result';
            });
            
            expect(result).toBe('test result');
            expect(indentManager.getIndentLevel()).toBe(0); // Should be restored
        });
    });

    describe('TokenUtils', () => {
        test('should handle token operations safely', () => {
            const tokenUtils = new TokenUtils(mockTokenStream);
            
            expect(tokenUtils.getTokenBetween(null, null)).toBeUndefined();
            expect(tokenUtils.getTokenText(undefined)).toBe('');
            expect(tokenUtils.isTokenType(undefined, 1)).toBe(false);
            expect(tokenUtils.getTokenStreamSize()).toBe(0);
        });

        test('should validate token indices', () => {
            const tokenUtils = new TokenUtils(mockTokenStream);
            
            expect(tokenUtils.isValidTokenIndex(-1)).toBe(false);
            expect(tokenUtils.isValidTokenIndex(0)).toBe(false); // Empty stream
            expect(tokenUtils.safeGetToken(-1)).toBeUndefined();
        });
    });

    describe('LineBreakManager', () => {
        test('should make wrap line decisions', () => {
            const lineBreakManager = new LineBreakManager(options);
            
            expect(lineBreakManager.shouldWrapLine([])).toBe(false);
            expect(lineBreakManager.shouldWrapLine(['a'])).toBe(false);
            expect(lineBreakManager.shouldWrapLine(['a', 'b', 'c'])).toBe(false);
            
            // Many elements should wrap
            const manyElements = Array(10).fill('element');
            expect(lineBreakManager.shouldWrapLine(manyElements)).toBe(true);
        });

        test('should estimate line lengths', () => {
            const lineBreakManager = new LineBreakManager(options);
            lineBreakManager.setCurrentIndentSize(4);
            
            expect(lineBreakManager.estimateLineLength('test', true)).toBeGreaterThan(4);
            expect(lineBreakManager.estimateLineLength('test', false)).toBe(4); // No operators, so just text length
        });
    });

    describe('FormattingCore', () => {
        test('should format operators correctly', () => {
            const core = new FormattingCore(mockTokenStream, options);
            
            expect(core.formatOperator('+')).toBe(' + ');
            expect(core.formatOperator('=', true)).toBe(' = ');
            
            const noSpaceOptions = { ...options, spaceAroundBinaryOperators: false };
            const coreNoSpace = new FormattingCore(mockTokenStream, noSpaceOptions);
            expect(coreNoSpace.formatOperator('+')).toBe('+');
        });

        test('should track node limits', () => {
            const core = new FormattingCore(mockTokenStream, options);
            
            expect(core.checkNodeLimit()).toBe(true);
            expect(core.getNodeCount()).toBe(1);
            
            core.resetNodeCount();
            expect(core.getNodeCount()).toBe(0);
        });

        test('should format modifiers', () => {
            const core = new FormattingCore(mockTokenStream, options);
            
            const modifiers = ['static', 'public', 'virtual'];
            const formatted = core.formatModifiers(modifiers);
            
            // Should be ordered according to functionModifierOrder
            expect(formatted).toBe('public static virtual');
        });
    });

    describe('FormattingContext', () => {
        test('should create and initialize all components', () => {
            const context = new FormattingContext(mockTokenStream, options);
            
            expect(context.errorCollector).toBeDefined();
            expect(context.indentManager).toBeDefined();
            expect(context.tokenUtils).toBeDefined();
            expect(context.lineBreakManager).toBeDefined();
            expect(context.core).toBeDefined();
        });

        test('should execute operations safely', () => {
            const context = new FormattingContext(mockTokenStream, options);
            
            const result = context.safeExecute(
                () => 'success',
                'test operation'
            );
            
            expect(result).toBe('success');
            expect(context.errorCollector.hasErrors()).toBe(false);
            
            // Test error handling
            const errorResult = context.safeExecute(
                () => { throw new Error('test error'); },
                'test operation with error'
            );
            
            expect(errorResult).toBeUndefined();
            expect(context.errorCollector.hasErrors()).toBe(true);
        });

        test('should manage indent operations', () => {
            const context = new FormattingContext(mockTokenStream, options);
            
            const result = context.withIndent(2, () => {
                expect(context.indentManager.getIndentLevel()).toBe(2);
                return 'indented result';
            });
            
            expect(result).toBe('indented result');
            expect(context.indentManager.getIndentLevel()).toBe(0);
        });

        test('should provide health status', () => {
            const context = new FormattingContext(mockTokenStream, options);
            
            const health = context.isHealthy();
            expect(health.healthy).toBe(true);
            expect(health.issues).toHaveLength(0);
            
            // Add many errors to make it unhealthy
            for (let i = 0; i < 15; i++) {
                context.errorCollector.addError(`Error ${i}`);
            }
            
            const unhealthyStatus = context.isHealthy();
            expect(unhealthyStatus.healthy).toBe(false);
            expect(unhealthyStatus.issues.length).toBeGreaterThan(0);
        });

        test('should generate formatting reports', () => {
            const context = new FormattingContext(mockTokenStream, options);
            
            context.errorCollector.addError('Test error');
            context.indentManager.increaseIndent();
            context.core.checkNodeLimit();
            
            const report = context.getFormattingReport();
            
            expect(report.errors).toHaveLength(1);
            expect(report.statistics.errorCount).toBe(1);
            expect(report.statistics.indentLevel).toBe(1);
            expect(report.statistics.nodeCount).toBe(1);
            expect(report.hasErrors).toBe(true);
        });
    });
});