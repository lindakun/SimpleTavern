/**
 * 日期格式化工具测试
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeSendDate,
    formatDisplayDate,
    isToday,
    getRelativeTime,
} from '../shared/utils/date.js';

describe('normalizeSendDate', () => {
    it('应该处理 ISO 8601 格式', () => {
        const result = normalizeSendDate('2026-06-13T10:30:00.000Z');
        expect(result).toBe('2026-06-13T10:30:00.000Z');
    });

    it('应该处理 Unix timestamp', () => {
        const result = normalizeSendDate('1749812400000');
        expect(result).toContain('2025');
    });

    it('应该处理 SillyTavern 格式', () => {
        const result = normalizeSendDate('2026-06-13 @10h 30m 00s 000ms');
        expect(result).toContain('2026-06-13');
        expect(result).toContain('02:30:00'); // UTC 时间（服务器时区）
    });

    it('应该处理空字符串', () => {
        const result = normalizeSendDate('');
        expect(result).toBe('');
    });

    it('应该处理 undefined', () => {
        const result = normalizeSendDate(undefined);
        expect(result).toBe('');
    });
});

describe('formatDisplayDate', () => {
    it('应该格式化 ISO 日期为本地格式', () => {
        const result = formatDisplayDate('2026-06-13T10:30:00.000Z');
        expect(result).toContain('2026');
        expect(result).toContain('06');
        expect(result).toContain('13');
    });

    it('应该回退无效日期', () => {
        const result = formatDisplayDate('invalid');
        expect(result).toBe('invalid');
    });
});

describe('isToday', () => {
    it('应该识别今天的日期', () => {
        const now = new Date().toISOString();
        expect(isToday(now)).toBe(true);
    });

    it('应该识别不是今天的日期', () => {
        expect(isToday('2020-01-01T00:00:00.000Z')).toBe(false);
    });

    it('应该处理无效日期', () => {
        expect(isToday('invalid')).toBe(false);
    });
});

describe('getRelativeTime', () => {
    it('应该返回"刚刚"', () => {
        const now = new Date();
        expect(getRelativeTime(now.toISOString())).toBe('刚刚');
    });

    it('应该返回"X分钟前"', () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
        expect(getRelativeTime(fiveMinAgo.toISOString())).toBe('5分钟前');
    });

    it('应该返回"X小时前"', () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
        expect(getRelativeTime(threeHoursAgo.toISOString())).toBe('3小时前');
    });

    it('应该返回"昨天"', () => {
        const yesterday = new Date(Date.now() - 86_400_000);
        expect(getRelativeTime(yesterday.toISOString())).toBe('昨天');
    });

    it('应该返回"X天前"', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
        expect(getRelativeTime(threeDaysAgo.toISOString())).toBe('3天前');
    });

    it('应该处理无效日期', () => {
        expect(getRelativeTime('invalid')).toBe('invalid');
    });
});
