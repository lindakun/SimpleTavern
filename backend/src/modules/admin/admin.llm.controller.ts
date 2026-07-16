import { Request, Response, NextFunction } from 'express';
import { getActiveLlm, getLlmConfigs } from '../backends/llm-config.js';
import { BadRequestError } from '../../common/errors.js';

function maskApiKey(apiKey: string): { configured: boolean; last4: string | null } {
    if (!apiKey) return { configured: false, last4: null };
    const last4 = apiKey.length >= 4 ? apiKey.slice(-4) : '****';
    return { configured: true, last4 };
}

/**
 * GET /api/admin/llm
 * 返回 LLM 配置列表（apiKey 脱敏）
 */
export async function listLlms(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const active = getActiveLlm();
        const providers = getLlmConfigs().map((c) => {
            const mask = maskApiKey(c.apiKey || '');
            return {
                id: c.id,
                name: c.name,
                model: c.model,
                baseUrl: c.baseUrl,
                active: active?.id === c.id,
                isLocal: /localhost|127\.0\.0\.1|host\.docker\.internal|:11434|:8081|:8080/.test(c.baseUrl),
                configured: mask.configured,
                apiKeyLast4: mask.last4,
            };
        });
        res.json({ providers, activeId: active?.id ?? null });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/admin/llm/test
 * body: { id: string }
 */
export async function testLlm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = req.body?.id as string | undefined;
        if (!id) {
            throw new BadRequestError('Missing required field: id');
        }

        const configs = getLlmConfigs();
        const config = configs.find((c) => c.id === id);
        if (!config) {
            throw new BadRequestError(`LLM provider not found: ${id}`);
        }

        const baseUrl = config.baseUrl.replace(/\/+$/, '');
        const modelsUrl = `${baseUrl}/models`;
        const started = Date.now();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        try {
            const headers: Record<string, string> = {
                Accept: 'application/json',
            };
            if (config.apiKey) {
                headers.Authorization = `Bearer ${config.apiKey}`;
            }

            const response = await fetch(modelsUrl, {
                method: 'GET',
                headers,
                signal: controller.signal,
            });

            const latencyMs = Date.now() - started;
            clearTimeout(timeout);

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                res.json({
                    ok: false,
                    latencyMs,
                    status: response.status,
                    error: text.slice(0, 200) || `HTTP ${response.status}`,
                });
                return;
            }

            res.json({
                ok: true,
                latencyMs,
                status: response.status,
            });
        } catch (err) {
            clearTimeout(timeout);
            const latencyMs = Date.now() - started;
            const message = err instanceof Error
                ? (err.name === 'AbortError' ? '请求超时（12s）' : err.message)
                : '连接失败';
            res.json({
                ok: false,
                latencyMs,
                error: message,
            });
        }
    } catch (err) {
        next(err);
    }
}
