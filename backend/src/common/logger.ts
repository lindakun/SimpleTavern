import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function timestamp(): string {
    return new Date().toISOString();
}

export const logger = {
    debug: (...args: unknown[]) => {
        if (!shouldLog('debug')) return;
        console.debug(chalk.gray(`[${timestamp()}] [DEBUG]`), ...args);
    },

    info: (...args: unknown[]) => {
        if (!shouldLog('info')) return;
        console.info(chalk.cyan(`[${timestamp()}] [INFO]`), ...args);
    },

    warn: (...args: unknown[]) => {
        if (!shouldLog('warn')) return;
        console.warn(chalk.yellow(`[${timestamp()}] [WARN]`), ...args);
    },

    error: (...args: unknown[]) => {
        if (!shouldLog('error')) return;
        console.error(chalk.red(`[${timestamp()}] [ERROR]`), ...args);
    },
};
