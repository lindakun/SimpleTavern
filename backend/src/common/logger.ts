import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const VALID_LOG_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error'];

/**
 * 验证日志级别，无效时回退到 'info'
 */
function validateLogLevel(level: string | undefined): LogLevel {
    if (level && VALID_LOG_LEVELS.includes(level)) {
        return level as LogLevel;
    }
    if (level) {
        console.warn(chalk.yellow(`[Logger] 无效的日志级别 "${level}"，回退到 "info"`));
    }
    return 'info';
}

const currentLevel: LogLevel = validateLogLevel(process.env.LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function timestamp(): string {
    return new Date().toISOString();
}

function formatMessage(level: LogLevel, ...args: unknown[]): string {
    const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
    return `${prefix} ${args.map(arg => {
        if (arg instanceof Error) {
            return `${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
        }
        return String(arg);
    }).join(' ')}`;
}

export const logger = {
    debug: (...args: unknown[]) => {
        if (!shouldLog('debug')) return;
        console.debug(chalk.gray(formatMessage('debug', ...args)));
    },

    info: (...args: unknown[]) => {
        if (!shouldLog('info')) return;
        console.info(chalk.cyan(formatMessage('info', ...args)));
    },

    warn: (...args: unknown[]) => {
        if (!shouldLog('warn')) return;
        console.warn(chalk.yellow(formatMessage('warn', ...args)));
    },

    error: (...args: unknown[]) => {
        if (!shouldLog('error')) return;
        console.error(chalk.red(formatMessage('error', ...args)));
    },

    /**
     * 获取当前日志级别
     */
    getLevel: (): LogLevel => currentLevel,

    /**
     * 检查指定级别是否启用
     */
    isEnabled: (level: LogLevel): boolean => shouldLog(level),
};
