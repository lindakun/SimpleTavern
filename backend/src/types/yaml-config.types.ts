/**
 * YAML 配置类型定义
 *
 * 用于替代 config/index.ts 中的 `as any` 断言
 */

export interface YamlConfig {
    port?: number;
    host?: string;
    enableUserAccounts?: boolean;
    enableDiscreetLogin?: boolean;
    sessionTimeout?: number;
    rateLimiting?: {
        accountsLoginMaxAttempts?: number;
        accountsRecoverMaxAttempts?: number;
        basicAuthMaxAttempts?: number;
    };
    sso?: {
        autheliaAuth?: boolean;
        authentikAuth?: boolean;
        trustedProxies?: string[];
    };
    perUserBasicAuth?: boolean;
    whitelistMode?: boolean;
    disableCsrf?: boolean;
}
