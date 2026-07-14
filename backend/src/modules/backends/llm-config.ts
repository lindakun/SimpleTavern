import { LlmConfig } from './types.js';
import { logger } from '../../common/logger.js';

/**
 * 从环境变量加载 LLM 配置
 *
 * 支持多 LLM：按前缀 SIMPLE_TAVERN_LLM_{ID}_XXX 定义
 * 也可用单组 SIMPLE_TAVERN_BASE_URL / MODEL / API_KEY
 */
/**
 * host 网络模式下 host.docker.internal 不可用，重写为 127.0.0.1
 */
function normalizeBaseUrl(baseUrl: string): string {
    if (process.env.SIMPLE_TAVERN_REWRITE_HOST_DOCKER_INTERNAL === '1') {
        return baseUrl.replace(/host\.docker\.internal/gi, '127.0.0.1');
    }
    return baseUrl;
}

function loadLlmConfigs(): LlmConfig[] {
    const configs: LlmConfig[] = [];

    // 扫描多 LLM 环境变量
    let index = 0;
    while (true) {
        const prefix = `SIMPLE_TAVERN_LLM_${index}`;
        const baseUrl = process.env[`${prefix}_BASE_URL`];
        if (!baseUrl) break;

        configs.push({
            id: `llm_${index}`,
            name: process.env[`${prefix}_NAME`] || `LLM #${index + 1}`,
            baseUrl: normalizeBaseUrl(baseUrl),
            model: process.env[`${prefix}_MODEL`] || 'gpt-4',
            apiKey: process.env[`${prefix}_API_KEY`] || '',
        });
        index++;
    }

    // 有通过单组配置定义时追加
    if (configs.length === 0) {
        const singleBaseUrl = process.env.SIMPLE_TAVERN_BASE_URL;
        if (singleBaseUrl) {
            configs.push({
                id: 'default',
                name: 'Default LLM',
                baseUrl: normalizeBaseUrl(singleBaseUrl),
                model: process.env.SIMPLE_TAVERN_MODEL || 'gpt-4',
                apiKey: process.env.SIMPLE_TAVERN_API_KEY || '',
            });
        }
    }

    return configs;
}

let llmConfigs: LlmConfig[] | null = null;

export function getLlmConfigs(): LlmConfig[] {
    if (!llmConfigs) {
        llmConfigs = loadLlmConfigs();
        if (llmConfigs.length === 0) {
            logger.warn('未配置任何 LLM。请设置环境变量或在 backend/.env 中配置');
        } else {
            logger.info(`已加载 ${llmConfigs.length} 个 LLM 配置`);
            llmConfigs.forEach(c => logger.info(`  [${c.id}] ${c.name} → ${c.model} (${c.baseUrl})`));
        }
    }
    return llmConfigs;
}

function isLocalBaseUrl(baseUrl: string): boolean {
    return /localhost|127\.0\.0\.1|host\.docker\.internal|:11434|:8081|:8080/.test(baseUrl);
}

/**
 * 获取当前活跃 LLM
 * - 优先 SIMPLE_TAVERN_ACTIVE_LLM
 * - 未指定时优先选择非本地（云端）模型，避免默认落到慢速本地推理
 */
export function getActiveLlm(): LlmConfig | undefined {
    const configs = getLlmConfigs();
    if (configs.length === 0) return undefined;

    const activeId = process.env.SIMPLE_TAVERN_ACTIVE_LLM;
    if (activeId) {
        const found = configs.find(c => c.id === activeId);
        if (found) return found;
    }

    const cloud = configs.find(c => !isLocalBaseUrl(c.baseUrl));
    return cloud || configs[0];
}
