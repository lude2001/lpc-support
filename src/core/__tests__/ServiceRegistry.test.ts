import * as vscode from 'vscode';
import { ServiceKey, ServiceRegistry } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
    test('register and get returns the registered instance', () => {
        const registry = new ServiceRegistry();
        const key = new ServiceKey<string>('example');

        registry.register(key, 'value');

        expect(registry.get(key)).toBe('value');
    });

    test('register throws when key already exists', () => {
        const registry = new ServiceRegistry();
        const key = new ServiceKey<number>('duplicate');

        registry.register(key, 1);

        expect(() => registry.register(key, 2)).toThrow('Service "duplicate" is already registered');
    });

    test('get throws when key is not registered', () => {
        const registry = new ServiceRegistry();
        const key = new ServiceKey<number>('missing');

        expect(() => registry.get(key)).toThrow('Service "missing" is not registered');
    });

    test('track stores disposable and dispose runs in reverse registration order', () => {
        const registry = new ServiceRegistry();
        const first = { dispose: jest.fn() } as vscode.Disposable;
        const second = { dispose: jest.fn() } as vscode.Disposable;
        const callOrder: string[] = [];

        first.dispose = jest.fn(() => {
            callOrder.push('first');
        });
        second.dispose = jest.fn(() => {
            callOrder.push('second');
        });

        registry.track(first);
        registry.track(second);

        const key = new ServiceKey<boolean>('teardown');
        registry.register(key, true);
        registry.dispose();

        expect(callOrder).toEqual(['second', 'first']);
        expect(() => registry.get(key)).toThrow('Service "teardown" is not registered');
    });
});
