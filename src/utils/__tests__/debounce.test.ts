/**
 * Debouncer和Throttler单元测试
 * 测试防抖和节流功能的正确性
 */

import { Debouncer, Throttler } from '../debounce';

describe('Debouncer', () => {
    let debouncer: Debouncer;

    beforeEach(() => {
        debouncer = new Debouncer();
        jest.useFakeTimers();
    });

    afterEach(() => {
        debouncer.clear();
        jest.useRealTimers();
    });

    describe('基本防抖功能', () => {
        test('应该延迟执行函数', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 300);

            debouncedFn('arg1', 'arg2');

            // 立即执行不应该调用函数
            expect(fn).not.toHaveBeenCalled();

            // 快进时间
            jest.advanceTimersByTime(300);

            // 现在应该被调用
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        test('应该在延迟时间内只执行一次', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 300);

            // 多次快速调用
            debouncedFn('call1');
            debouncedFn('call2');
            debouncedFn('call3');

            // 快进时间
            jest.advanceTimersByTime(300);

            // 只执行最后一次调用
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('call3');
        });

        test('应该重置计时器当新调用发生', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 300);

            debouncedFn('first');
            jest.advanceTimersByTime(200);

            debouncedFn('second');
            jest.advanceTimersByTime(200);

            // 第一次调用被取消，还没到300ms
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);

            // 现在应该执行第二次调用
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('second');
        });

        test('应该支持不同的key独立防抖', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();

            const debounced1 = debouncer.debounce('key1', fn1, 300);
            const debounced2 = debouncer.debounce('key2', fn2, 300);

            debounced1('arg1');
            debounced2('arg2');

            jest.advanceTimersByTime(300);

            expect(fn1).toHaveBeenCalledWith('arg1');
            expect(fn2).toHaveBeenCalledWith('arg2');
        });
    });

    describe('flush方法', () => {
        test('应该立即清除防抖定时器', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 300);

            debouncedFn('arg');
            debouncer.flush('test');

            // 快进时间
            jest.advanceTimersByTime(300);

            // 函数不应该被调用
            expect(fn).not.toHaveBeenCalled();
        });

        test('应该只清除指定key的防抖', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();

            const debounced1 = debouncer.debounce('key1', fn1, 300);
            const debounced2 = debouncer.debounce('key2', fn2, 300);

            debounced1('arg1');
            debounced2('arg2');

            debouncer.flush('key1');
            jest.advanceTimersByTime(300);

            // key1的函数不应该被调用
            expect(fn1).not.toHaveBeenCalled();
            // key2的函数应该被调用
            expect(fn2).toHaveBeenCalledWith('arg2');
        });
    });

    describe('clear方法', () => {
        test('应该清除所有防抖定时器', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();

            const debounced1 = debouncer.debounce('key1', fn1, 300);
            const debounced2 = debouncer.debounce('key2', fn2, 300);

            debounced1('arg1');
            debounced2('arg2');

            debouncer.clear();
            jest.advanceTimersByTime(300);

            // 所有函数都不应该被调用
            expect(fn1).not.toHaveBeenCalled();
            expect(fn2).not.toHaveBeenCalled();
        });
    });

    describe('自定义延迟时间', () => {
        test('应该支持自定义延迟时间', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 500);

            debouncedFn('arg');

            jest.advanceTimersByTime(300);
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(200);
            expect(fn).toHaveBeenCalledWith('arg');
        });

        test('应该使用默认延迟时间300ms', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn);

            debouncedFn('arg');

            jest.advanceTimersByTime(299);
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalledWith('arg');
        });
    });

    describe('边界条件', () => {
        test('应该处理空参数', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 300);

            debouncedFn();
            jest.advanceTimersByTime(300);

            expect(fn).toHaveBeenCalledWith();
        });

        test('应该处理多个参数', () => {
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 300);

            debouncedFn('arg1', 'arg2', 'arg3', 42, true);
            jest.advanceTimersByTime(300);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', 42, true);
        });

        test('应该处理不存在的key的flush', () => {
            expect(() => {
                debouncer.flush('nonexistent');
            }).not.toThrow();
        });
    });
});

describe('Throttler', () => {
    let throttler: Throttler;

    beforeEach(() => {
        throttler = new Throttler();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('基本节流功能', () => {
        test('应该立即执行第一次调用', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 100);

            throttledFn('arg');

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('arg');
        });

        test('应该在间隔期内忽略后续调用', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 100);

            throttledFn('call1');
            throttledFn('call2');
            throttledFn('call3');

            // 只执行第一次
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('call1');
        });

        test('应该在间隔后允许新的调用', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 100);

            throttledFn('call1');
            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);

            throttledFn('call2');
            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenCalledWith('call2');
        });

        test('应该支持不同的key独立节流', () => {
            const fn1 = jest.fn();
            const fn2 = jest.fn();

            const throttled1 = throttler.throttle('key1', fn1, 100);
            const throttled2 = throttler.throttle('key2', fn2, 100);

            throttled1('arg1');
            throttled2('arg2');

            expect(fn1).toHaveBeenCalledWith('arg1');
            expect(fn2).toHaveBeenCalledWith('arg2');
        });
    });

    describe('自定义间隔时间', () => {
        test('应该支持自定义间隔时间', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 200);

            throttledFn('call1');
            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);
            throttledFn('call2');
            expect(fn).toHaveBeenCalledTimes(1); // 还没到200ms

            jest.advanceTimersByTime(100);
            throttledFn('call3');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        test('应该使用默认间隔时间100ms', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn);

            throttledFn('call1');
            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(99);
            throttledFn('call2');
            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(1);
            throttledFn('call3');
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe('连续调用场景', () => {
        test('应该正确处理多次间隔调用', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 100);

            // 第一次调用
            throttledFn('call1');
            expect(fn).toHaveBeenCalledTimes(1);

            // 50ms后调用 - 被忽略
            jest.advanceTimersByTime(50);
            throttledFn('call2');
            expect(fn).toHaveBeenCalledTimes(1);

            // 再50ms后调用 - 执行
            jest.advanceTimersByTime(50);
            throttledFn('call3');
            expect(fn).toHaveBeenCalledTimes(2);

            // 再100ms后调用 - 执行
            jest.advanceTimersByTime(100);
            throttledFn('call4');
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('边界条件', () => {
        test('应该处理空参数', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 100);

            throttledFn();

            expect(fn).toHaveBeenCalledWith();
        });

        test('应该处理多个参数', () => {
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 100);

            throttledFn('arg1', 'arg2', 'arg3', 42, true);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', 42, true);
        });
    });
});

describe('性能基准测试', () => {
    describe('Debouncer性能', () => {
        test('应该高效处理大量快速调用', () => {
            const debouncer = new Debouncer();
            const fn = jest.fn();
            const debouncedFn = debouncer.debounce('test', fn, 100);

            jest.useFakeTimers();
            const startTime = Date.now();

            // 模拟1000次快速调用
            for (let i = 0; i < 1000; i++) {
                debouncedFn(i);
            }

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // 执行应该很快（小于100ms）
            expect(executionTime).toBeLessThan(100);

            // 快进时间
            jest.advanceTimersByTime(100);

            // 只执行一次
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(999);

            jest.useRealTimers();
            debouncer.clear();
        });
    });

    describe('Throttler性能', () => {
        test('应该高效限制调用频率', () => {
            const throttler = new Throttler();
            const fn = jest.fn();
            const throttledFn = throttler.throttle('test', fn, 50);

            jest.useFakeTimers();

            // 模拟500ms内的大量调用
            for (let i = 0; i < 10; i++) {
                throttledFn(i);
                jest.advanceTimersByTime(50);
            }

            // 应该执行10次（每50ms一次）
            expect(fn).toHaveBeenCalledTimes(10);

            jest.useRealTimers();
        });
    });

    describe('内存使用', () => {
        test('Debouncer应该正确清理计时器', () => {
            const debouncer = new Debouncer();
            const fn = jest.fn();

            jest.useFakeTimers();

            // 创建多个防抖函数
            for (let i = 0; i < 100; i++) {
                const debouncedFn = debouncer.debounce(`key${i}`, fn, 100);
                debouncedFn(i);
            }

            // 清理所有
            debouncer.clear();

            // 快进时间
            jest.advanceTimersByTime(100);

            // 不应该执行任何函数
            expect(fn).not.toHaveBeenCalled();

            jest.useRealTimers();
        });
    });
});
