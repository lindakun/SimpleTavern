/**
 * Session 类型测试
 */

import { describe, it, expect } from 'vitest';
import type { AuthSession } from '../types/session.types.js';

describe('AuthSession 类型', () => {
    it('应该允许空 session', () => {
        const session: AuthSession = {};
        expect(session.handle).toBeUndefined();
        expect(session.csrfToken).toBeUndefined();
        expect(session.version).toBeUndefined();
        expect(session.admin).toBeUndefined();
    });

    it('应该包含正确的属性', () => {
        const session: AuthSession = {
            handle: 'test-user',
            csrfToken: 'abc123',
            version: 'v1',
            admin: true,
        };
        expect(session.handle).toBe('test-user');
        expect(session.csrfToken).toBe('abc123');
        expect(session.version).toBe('v1');
        expect(session.admin).toBe(true);
    });

    it('应该支持 null 值', () => {
        const session: AuthSession = {
            handle: null,
            csrfToken: null,
            version: null,
            admin: null,
        };
        expect(session.handle).toBeNull();
        expect(session.csrfToken).toBeNull();
        expect(session.version).toBeNull();
        expect(session.admin).toBeNull();
    });

    it('应该支持 touch 时间戳', () => {
        const session: AuthSession = {
            handle: 'test-user',
            touch: Date.now(),
        };
        expect(session.touch).toBeDefined();
        expect(typeof session.touch).toBe('number');
    });
});
