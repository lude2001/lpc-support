/**
 * 防抖工具类
 */
export class Debouncer {
    private timers = new Map<string, NodeJS.Timeout>();

    /**
     * 防抖执行函数
     * @param key 唯一标识符
     * @param fn 要执行的函数
     * @param delay 延迟时间（毫秒）
     */
    debounce<T extends (...args: any[]) => any>(
        key: string,
        fn: T,
        delay: number = 300
    ): (...args: Parameters<T>) => void {
        return (...args: Parameters<T>) => {
            // 清除之前的定时器
            const existingTimer = this.timers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // 设置新的定时器
            const timer = setTimeout(() => {
                this.timers.delete(key);
                fn(...args);
            }, delay);

            this.timers.set(key, timer);
        };
    }

    /**
     * 立即执行并清除对应的防抖
     * @param key 唯一标识符
     */
    flush(key: string): void {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }

    /**
     * 清除所有防抖定时器
     */
    clear(): void {
        // 使用 forEach 代替 for...of 来避免迭代器问题
        this.timers.forEach((timer) => {
            clearTimeout(timer);
        });
        this.timers.clear();
    }
}

/**
 * 节流工具函数
 */
export class Throttler {
    private lastExecution = new Map<string, number>();

    /**
     * 节流执行函数
     * @param key 唯一标识符
     * @param fn 要执行的函数
     * @param interval 节流间隔（毫秒）
     */
    throttle<T extends (...args: any[]) => any>(
        key: string,
        fn: T,
        interval: number = 100
    ): (...args: Parameters<T>) => void {
        return (...args: Parameters<T>) => {
            const now = Date.now();
            const lastTime = this.lastExecution.get(key) || 0;

            if (now - lastTime >= interval) {
                this.lastExecution.set(key, now);
                fn(...args);
            }
        };
    }
}
