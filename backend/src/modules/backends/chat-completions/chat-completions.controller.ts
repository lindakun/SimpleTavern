import { Request, Response, NextFunction } from 'express';
import * as chatService from './chat-completions.service.js';
import { getActiveLlm } from '../llm-config.js';
import { logger } from '../../../common/logger.js';

/**
 * POST /api/chat/stream
 * 流式聊天接口 — SSE 逐 token 推送 AI 回复
 */
export async function chatStream(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
        const { message, history, characterName, characterDescription, provider } = req.body;

        if (!message) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Message is required' });
            return;
        }

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
        res.flushHeaders();

        const llmStream = await chatService.processChatStream({
            message,
            history: history || [],
            characterName: characterName || 'AI',
            characterDescription: characterDescription || '',
            personality: req.body.personality,
            scenario: req.body.scenario,
            first_mes: req.body.first_mes,
            mes_example: req.body.mes_example,
            system_prompt: req.body.system_prompt,
            post_history_instructions: req.body.post_history_instructions,
            alternate_greetings: req.body.alternate_greetings,
            worldBook: req.body.worldBook,
            provider,
        });

        logger.info('SSE 流已建立，开始读取...');
        let chunkCount = 0;

        const reader = llmStream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // 客户端断开连接时取消上游流，避免资源泄漏
        req.on('close', () => {
            reader.cancel().catch(() => {});
        });

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') {
                            res.write('data: [DONE]\n\n');
                            continue;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                chunkCount++;
                                // 只转发实际内容，跳过 reasoning/thinking 字段
                                res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
                            }
                        } catch {
                            // 跳过无法解析的行
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        res.write('data: [DONE]\n\n');
        logger.info(`SSE 流结束, 共发送 ${chunkCount} 个 token`);
        res.end();
    } catch (err: any) {
        logger.error('Chat Stream API 错误:', err);
        // 如果还没开始发送 SSE，返回 JSON 错误
        if (!res.headersSent) {
            res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message || '流式聊天接口调用失败' });
        } else {
            // 已经发送 SSE，用 SSE 格式发送错误
            res.write(`data: ${JSON.stringify({ error: err.message || '流式聊天失败' })}\n\n`);
            res.end();
        }
    }
}

/**
 * POST /api/chat
 * 通用聊天接口 — 接收用户消息 + 角色信息，返回 AI 回复
 */
export async function chat(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
        const { message, history, characterName, characterDescription, provider } = req.body;

        if (!message) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Message is required' });
            return;
        }

        const result = await chatService.processChat({
            message,
            history: history || [],
            characterName: characterName || 'AI',
            characterDescription: characterDescription || '',
            // V3 角色卡字段
            personality: req.body.personality,
            scenario: req.body.scenario,
            first_mes: req.body.first_mes,
            mes_example: req.body.mes_example,
            system_prompt: req.body.system_prompt,
            post_history_instructions: req.body.post_history_instructions,
            alternate_greetings: req.body.alternate_greetings,
            // 兼容旧字段
            worldBook: req.body.worldBook,
            provider,
        });

        res.json({ text: result.text, provider: result.provider, model: result.model });
    } catch (err: any) {
        logger.error('Chat API 错误:', err);
        res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message || '聊天接口调用失败' });
    }
}

/**
 * GET /api/chat/providers
 * 获取可用 LLM 列表
 */
export async function getProviders(_req: Request, res: Response): Promise<void> {
    const providers = chatService.getProviders();
    const active = getActiveLlm();
    res.json({ providers, active: active?.id || null });
}
