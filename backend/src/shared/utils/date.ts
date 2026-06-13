/**
 * 日期格式化工具函数
 * 兼容 ISO 8601、Unix timestamp 和 SillyTavern 格式
 */

/**
 * 标准化 send_date 为 ISO 8601 字符串
 * 兼容多种日期格式：
 * - ISO 8601: "2026-06-13T10:30:00.000Z"
 * - Unix timestamp: "1749812400000"
 * - SillyTavern: "2026-06-13 @10h 30m 00s 000ms"
 * - 纯时间: "10:30"（需要 filePath 参数获取文件 mtime）
 *
 * @param sendDate 原始日期字符串
 * @param filePath 可选，用于获取文件 mtime 作为回退
 * @returns ISO 8601 格式日期字符串，解析失败返回空字符串
 */
export function normalizeSendDate(sendDate: string | undefined, filePath?: string): string {
    if (!sendDate) return '';

    // 已经是有效日期（ISO 8601 / Unix timestamp）
    const direct = new Date(sendDate);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // 纯数字 Unix timestamp（毫秒）
    if (/^\d+$/.test(sendDate)) {
        const ts = new Date(parseInt(sendDate, 10));
        if (!isNaN(ts.getTime())) return ts.toISOString();
    }

    // SillyTavern 格式: "YYYY-MM-DD @HHh MMm SSs MSms"
    const stMatch = sendDate.match(/^(\d{4}-\d{2}-\d{2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s/);
    if (stMatch) {
        const [, date, hours, mins, secs] = stMatch;
        const isoStr = `${date}T${hours.padStart(2, '0')}:${mins.padStart(2, '0')}:${secs.padStart(2, '0')}`;
        const stParsed = new Date(isoStr);
        if (!isNaN(stParsed.getTime())) return stParsed.toISOString();
    }

    // 纯时间格式 "HH:MM" — 使用文件 mtime
    const timeMatch = sendDate.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch && filePath) {
        try {
            const fs = require('node:fs');
            const stats = fs.statSync(filePath);
            return new Date(stats.mtimeMs).toISOString();
        } catch {
            // 忽略文件读取失败
        }
    }

    return '';
}

/**
 * 格式化日期为本地显示格式
 * 用于前端展示
 *
 * @param isoDate ISO 8601 格式日期
 * @returns 格式化后的日期字符串
 */
export function formatDisplayDate(isoDate: string): string {
    try {
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) return isoDate;
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return isoDate;
    }
}

/**
 * 检查日期是否为今天
 *
 * @param isoDate ISO 8601 格式日期
 * @returns 是否为今天
 */
export function isToday(isoDate: string): boolean {
    try {
        const date = new Date(isoDate);
        const now = new Date();
        return (
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate()
        );
    } catch {
        return false;
    }
}

/**
 * 获取相对时间描述
 * 例如："刚刚"、"5分钟前"、"昨天"、"3天前"
 *
 * @param isoDate ISO 8601 格式日期
 * @returns 相对时间描述
 */
export function getRelativeTime(isoDate: string): string {
    try {
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) return isoDate;
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60_000);
        const diffHours = Math.floor(diffMs / 3_600_000);
        const diffDays = Math.floor(diffMs / 86_400_000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays}天前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
        return `${Math.floor(diffDays / 365)}年前`;
    } catch {
        return isoDate;
    }
}
