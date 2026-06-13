/**
 * YAML 配置类型测试
 */

import { describe, it, expect } from 'vitest';
import type { YamlConfig } from '../types/yaml-config.types.js';

describe('YamlConfig 类型', () => {
    it('应该允许空配置', () => {
        const config: YamlConfig = {};
        expect(config.port).toBeUndefined();
        expect(config.host).toBeUndefined();
    });

    it('应该包含所有可选字段', () => {
        const config: YamlConfig = {
            port: 8000,
            host: 'localhost',
            enableUserAccounts: true,
            enableDiscreetLogin: false,
            sessionTimeout: 3600,
            rateLimiting: {
                accountsLoginMaxAttempts: 5,
                accountsRecoverMaxAttempts: 3,
                basicAuthMaxAttempts: 10,
            },
            sso: {
                autheliaAuth: true,
                authentikAuth: false,
                trustedProxies: ['127.0.0.1'],
            },
            perUserBasicAuth: true,
            whitelistMode: false,
            disableCsrf: false,
        };

        expect(config.port).toBe(8000);
        expect(config.host).toBe('localhost');
        expect(config.enableUserAccounts).toBe(true);
        expect(config.rateLimiting?.accountsLoginMaxAttempts).toBe(5);
        expect(config.sso?.autheliaAuth).toBe(true);
    });

    it('应该支持部分配置', () => {
        const config: YamlConfig = {
            port: 8080,
            enableUserAccounts: true,
        };

        expect(config.port).toBe(8080);
        expect(config.enableUserAccounts).toBe(true);
        expect(config.host).toBeUndefined();
        expect(config.rateLimiting).toBeUndefined();
    });
});
