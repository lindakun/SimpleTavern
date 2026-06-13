import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
    let consoleDebugSpy: vi.SpyInstance;
    let consoleInfoSpy: vi.SpyInstance;
    let consoleWarnSpy: vi.SpyInstance;
    let consoleErrorSpy: vi.SpyInstance;

    beforeEach(async () => {
        // 模拟 console 方法
        consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // 重置模块缓存
        vi.resetModules();
    });

    afterEach(() => {
        // 恢复原始 console 方法
        consoleDebugSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();

        // 清理环境变量
        delete process.env.LOG_LEVEL;
    });

    describe('日志级别输出', () => {
        it('应该输出 debug 级别日志', async () => {
            process.env.LOG_LEVEL = 'debug';
            const { logger } = await import('../common/logger');

            logger.debug('test debug message');

            expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
            expect(consoleDebugSpy.mock.calls[0][0]).toContain('[DEBUG]');
            expect(consoleDebugSpy.mock.calls[0][0]).toContain('test debug message');
        });

        it('应该输出 info 级别日志', async () => {
            process.env.LOG_LEVEL = 'info';
            const { logger } = await import('../common/logger');

            logger.info('test info message');

            expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
            expect(consoleInfoSpy.mock.calls[0][0]).toContain('[INFO]');
            expect(consoleInfoSpy.mock.calls[0][0]).toContain('test info message');
        });

        it('应该输出 warn 级别日志', async () => {
            process.env.LOG_LEVEL = 'warn';
            const { logger } = await import('../common/logger');

            logger.warn('test warn message');

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('test warn message');
        });

        it('应该输出 error 级别日志', async () => {
            process.env.LOG_LEVEL = 'error';
            const { logger } = await import('../common/logger');

            logger.error('test error message');

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('test error message');
        });
    });

    describe('日志级别过滤', () => {
        it('info 级别时应该过滤 debug 日志', async () => {
            process.env.LOG_LEVEL = 'info';
            const { logger } = await import('../common/logger');

            logger.debug('should be filtered');
            logger.info('should show');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
        });

        it('warn 级别时应该过滤 debug 和 info 日志', async () => {
            process.env.LOG_LEVEL = 'warn';
            const { logger } = await import('../common/logger');

            logger.debug('should be filtered');
            logger.info('should be filtered');
            logger.warn('should show');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        });

        it('error 级别时只输出 error 日志', async () => {
            process.env.LOG_LEVEL = 'error';
            const { logger } = await import('../common/logger');

            logger.debug('should be filtered');
            logger.info('should be filtered');
            logger.warn('should be filtered');
            logger.error('should show');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });

        it('debug 级别时输出所有日志', async () => {
            process.env.LOG_LEVEL = 'debug';
            const { logger } = await import('../common/logger');

            logger.debug('debug message');
            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');

            expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
            expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('无效日志级别回退', () => {
        it('无效的日志级别应该回退到 info 并输出警告', async () => {
            process.env.LOG_LEVEL = 'invalid';
            const { logger } = await import('../common/logger');

            // 应该输出警告信息（在模块加载时）
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('无效的日志级别 "invalid"，回退到 "info"')
            );

            // 回退到 info，debug 应该被过滤
            logger.debug('should be filtered');
            logger.info('should show');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
            // info 应该被调用 1 次（"should show"）
            expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
        });

        it('未设置 LOG_LEVEL 时应该默认使用 info', async () => {
            delete process.env.LOG_LEVEL;
            const { logger } = await import('../common/logger');

            expect(logger.getLevel()).toBe('info');
        });

        it('空字符串 LOG_LEVEL 应该回退到 info', async () => {
            process.env.LOG_LEVEL = '';
            const { logger } = await import('../common/logger');

            expect(logger.getLevel()).toBe('info');
        });
    });

    describe('日志格式', () => {
        it('应该包含时间戳', async () => {
            process.env.LOG_LEVEL = 'debug';
            const { logger } = await import('../common/logger');

            logger.info('test message');

            const output = consoleInfoSpy.mock.calls[0][0];
            // ISO 8601 格式: YYYY-MM-DDTHH:mm:ss.sssZ
            expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
        });

        it('应该包含日志级别', async () => {
            process.env.LOG_LEVEL = 'debug';
            const { logger } = await import('../common/logger');

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(consoleDebugSpy.mock.calls[0][0]).toContain('[DEBUG]');
            expect(consoleInfoSpy.mock.calls[0][0]).toContain('[INFO]');
            expect(consoleWarnSpy.mock.calls[0][0]).toContain('[WARN]');
            expect(consoleErrorSpy.mock.calls[0][0]).toContain('[ERROR]');
        });

        it('应该支持多个参数', async () => {
            process.env.LOG_LEVEL = 'info';
            const { logger } = await import('../common/logger');

            logger.info('message', 'with', 'multiple', 'args');

            expect(consoleInfoSpy.mock.calls[0][0]).toContain('message with multiple args');
        });

        it('应该正确处理 Error 对象', async () => {
            process.env.LOG_LEVEL = 'error';
            const { logger } = await import('../common/logger');

            const error = new Error('test error');
            logger.error(error);

            expect(consoleErrorSpy.mock.calls[0][0]).toContain('test error');
        });
    });

    describe('工具方法', () => {
        it('getLevel 应该返回当前日志级别', async () => {
            process.env.LOG_LEVEL = 'warn';
            const { logger } = await import('../common/logger');

            expect(logger.getLevel()).toBe('warn');
        });

        it('isEnabled 应该正确判断级别是否启用', async () => {
            process.env.LOG_LEVEL = 'warn';
            const { logger } = await import('../common/logger');

            expect(logger.isEnabled('debug')).toBe(false);
            expect(logger.isEnabled('info')).toBe(false);
            expect(logger.isEnabled('warn')).toBe(true);
            expect(logger.isEnabled('error')).toBe(true);
        });
    });
});
