/**
 * 配置类型
 */

export interface ServerConfig {
    port: number;
    host: string;
    dataRoot: string;
    ssl: boolean;
    sslKeyPath?: string;
    sslCertPath?: string;
    enableUserAccounts: boolean;
    enableDiscreetLogin: boolean;
    sessionTimeout: number;
    basicAuthMode: boolean;
    perUserBasicAuth: boolean;
    corsEnabled: boolean;
    whitelistEnabled: boolean;
    disableCsrf: boolean;

    rateLimiting: {
        accountsLoginMaxAttempts: number;
        accountsRecoverMaxAttempts: number;
        basicAuthMaxAttempts: number;
        attemptsLoginWindow: number;
        attemptsRecoverWindow: number;
        attemptsBasicAuthWindow: number;
    };

    sso: {
        autheliaAuth: boolean;
        authentikAuth: boolean;
        trustedProxies: string[];
    };

    backups: {
        allowFullDataBackup: boolean;
    };
}

export interface CommandLineArgs {
    port?: number;
    host?: string;
    dataRoot?: string;
    ssl?: boolean;
    sslKeyPath?: string;
    sslCertPath?: string;
    disableCsrf?: boolean;
    basicAuthMode?: boolean;
    corsEnabled?: boolean;
    global?: boolean;
}
