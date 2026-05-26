import { LlmConfig } from './types.js';
import { logger } from '../../common/logger.js';

/**
 * 从环境变量加载 LLM 配置
 *
 * 支持多 LLM：按前缀 SIMPLE_TAVERN_LLM_{ID}_XXX 定义
 * 也可用单组 SIMPLE_TAVERN_BASE_URL / MODEL / API_KEY
 */
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
            baseUrl,
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
                baseUrl: singleBaseUrl,
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

export function getActiveLlm(): LlmConfig | undefined {
    const configs = getLlmConfigs();
    const activeId = process.env.SIMPLE_TAVERN_ACTIVE_LLM;
    if (activeId) {
        return configs.find(c => c.id === activeId);
    }
    return configs[0];
}
