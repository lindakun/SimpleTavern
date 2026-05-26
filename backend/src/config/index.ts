import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { logger } from '../common/logger.js';
import { ServerConfig, CommandLineArgs } from '../types/config.types.js';

const DEFAULT_CONFIG: ServerConfig = {
    port: 8001,
    host: '0.0.0.0',
    dataRoot: '',
    ssl: false,
    enableUserAccounts: false,
    enableDiscreetLogin: false,
    sessionTimeout: -1,
    basicAuthMode: false,
    perUserBasicAuth: false,
    corsEnabled: true,
    whitelistEnabled: false,
    disableCsrf: false,
    rateLimiting: {
        accountsLoginMaxAttempts: 5,
        accountsRecoverMaxAttempts: 5,
        basicAuthMaxAttempts: 5,
        attemptsLoginWindow: 60,
        attemptsRecoverWindow: 300,
        attemptsBasicAuthWindow: 60,
    },
    sso: {
        autheliaAuth: false,
        authentikAuth: false,
        trustedProxies: ['127.0.0.1', '::1'],
    },
    backups: {
        allowFullDataBackup: true,
    },
};

function resolveDataRoot(cliArgs: CommandLineArgs): string {
    // CLI 参数优先
    if (cliArgs.dataRoot) {
        return path.resolve(cliArgs.dataRoot);
    }
    // 环境变量
    if (process.env.SIMPLE_TAVERN_DATA_ROOT) {
        return path.resolve(process.env.SIMPLE_TAVERN_DATA_ROOT);
    }
    // 默认指向原项目的 data/ 目录
    const defaultSillyTavernPath = path.resolve('/Users/linda/code/SillyTavern');
    const potentialData = path.join(defaultSillyTavernPath, 'data');
    if (fs.existsSync(potentialData)) {
        return potentialData;
    }
    // 回退到本地 ./data
    return path.resolve(process.cwd(), 'data');
}

function loadYamlConfig(dataRoot: string): Partial<ServerConfig> {
    const configPath = path.join(dataRoot, '..', 'config.yaml');
    try {
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = YAML.parse(raw);
            if (parsed) {
                return mapYamlToConfig(parsed);
            }
        }
    } catch (err) {
        logger.warn('无法加载 config.yaml:', err);
    }
    return {};
}

function mapYamlToConfig(yaml: Record<string, unknown>): Partial<ServerConfig> {
    const result: Partial<ServerConfig> = {};

    // 映射端口——config.yaml 中的 port 是 8000，新项目需要用 8001
    if (yaml.port !== undefined) result.port = Number(yaml.port) + 1;
    if ((yaml as any).host !== undefined) result.host = (yaml as any).host as string;

    if ((yaml as any).enableUserAccounts !== undefined) {
        result.enableUserAccounts = Boolean((yaml as any).enableUserAccounts);
    }
    if ((yaml as any).enableDiscreetLogin !== undefined) {
        result.enableDiscreetLogin = Boolean((yaml as any).enableDiscreetLogin);
    }
    if ((yaml as any).sessionTimeout !== undefined) {
        result.sessionTimeout = Number((yaml as any).sessionTimeout);
    }

    const rl = (yaml as any).rateLimiting;
    if (rl) {
        result.rateLimiting = {
            accountsLoginMaxAttempts: rl.accountsLoginMaxAttempts !== undefined ? Number(rl.accountsLoginMaxAttempts) : DEFAULT_CONFIG.rateLimiting.accountsLoginMaxAttempts,
            accountsRecoverMaxAttempts: rl.accountsRecoverMaxAttempts !== undefined ? Number(rl.accountsRecoverMaxAttempts) : DEFAULT_CONFIG.rateLimiting.accountsRecoverMaxAttempts,
            basicAuthMaxAttempts: rl.basicAuthMaxAttempts !== undefined ? Number(rl.basicAuthMaxAttempts) : DEFAULT_CONFIG.rateLimiting.basicAuthMaxAttempts,
            attemptsLoginWindow: DEFAULT_CONFIG.rateLimiting.attemptsLoginWindow,
            attemptsRecoverWindow: DEFAULT_CONFIG.rateLimiting.attemptsRecoverWindow,
            attemptsBasicAuthWindow: DEFAULT_CONFIG.rateLimiting.attemptsBasicAuthWindow,
        };
    }

    const sso = (yaml as any).sso;
    if (sso) {
        result.sso = {
            autheliaAuth: sso.autheliaAuth !== undefined ? Boolean(sso.autheliaAuth) : DEFAULT_CONFIG.sso.autheliaAuth,
            authentikAuth: sso.authentikAuth !== undefined ? Boolean(sso.authentikAuth) : DEFAULT_CONFIG.sso.authentikAuth,
            trustedProxies: sso.trustedProxies !== undefined ? sso.trustedProxies as string[] : DEFAULT_CONFIG.sso.trustedProxies,
        };
    }

    if ((yaml as any).perUserBasicAuth !== undefined) result.perUserBasicAuth = Boolean((yaml as any).perUserBasicAuth);
    if ((yaml as any).whitelistMode !== undefined) result.whitelistEnabled = Boolean((yaml as any).whitelistMode);
    if ((yaml as any).disableCsrf !== undefined) result.disableCsrf = Boolean((yaml as any).disableCsrf);

    return result;
}

let config: ServerConfig | null = null;

export function loadConfig(cliArgs: CommandLineArgs): ServerConfig {
    if (config) return config;

    const dataRoot = resolveDataRoot(cliArgs);
    DEFAULT_CONFIG.dataRoot = dataRoot;

    const yamlOverrides = loadYamlConfig(dataRoot);

    config = {
        ...DEFAULT_CONFIG,
        ...yamlOverrides,
        // CLI 参数覆盖配置文件
        ...(cliArgs.port !== undefined ? { port: cliArgs.port } : {}),
        ...(cliArgs.host !== undefined ? { host: cliArgs.host } : {}),
        ...(cliArgs.ssl ? { ssl: true, sslKeyPath: cliArgs.sslKeyPath, sslCertPath: cliArgs.sslCertPath } : {}),
        ...(cliArgs.disableCsrf !== undefined ? { disableCsrf: cliArgs.disableCsrf } : {}),
        ...(cliArgs.basicAuthMode !== undefined ? { basicAuthMode: cliArgs.basicAuthMode } : {}),
        ...(cliArgs.corsEnabled !== undefined ? { corsEnabled: cliArgs.corsEnabled } : {}),
    };

    return config;
}

export function getConfig(): ServerConfig {
    if (!config) {
        throw new Error('Config not loaded. Call loadConfig() first.');
    }
    return config;
}
