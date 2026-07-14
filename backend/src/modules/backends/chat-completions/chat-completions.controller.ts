import { Request, Response, NextFunction } from 'express';
import * as chatService from './chat-completions.service.js';
import { getActiveLlm } from '../llm-config.js';
import { logger } from '../../../common/logger.js';
import type { ChatRequest } from '../types.js';

function extractChatRequest(body: any): ChatRequest {
    return {
        message: body.message,
        history: body.history || [],
        characterName: body.characterName || 'AI',
        characterDescription: body.characterDescription || '',
        personality: body.personality,
        scenario: body.scenario,
        first_mes: body.first_mes,
        mes_example: body.mes_example,
        system_prompt: body.system_prompt,
        post_history_instructions: body.post_history_instructions,
        alternate_greetings: body.alternate_greetings,
        worldBook: body.worldBook,
        character_book: body.character_book,
        loreEntries: body.loreEntries,
        provider: body.provider,
        userName: body.userName,
        includeFirstMes: body.includeFirstMes,
        temperature: body.temperature,
        frequency_penalty: body.frequency_penalty,
        presence_penalty: body.presence_penalty,
        responseLength: body.responseLength,
        max_tokens: body.max_tokens,
        debug: body.debug === true,
    };
}

/**
 * POST /api/chat/stream
 */
export async function chatStream(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
        const chatReq = extractChatRequest(req.body);

        if (!chatReq.message) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Message is required' });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const { stream: llmStream, debug, provider, model } = await chatService.processChatStream(chatReq);

        // 首包附带 meta，便于前端/调试（不破坏只读 text 的旧客户端：忽略未知字段即可）
        res.write(`data: ${JSON.stringify({
            meta: {
                provider,
                model,
                prompt: {
                    thinCard: debug.thinCard,
                    roleSequence: debug.roleSequence,
                    totalMessages: debug.totalMessages,
                    historyIn: debug.historyIn,
                    historyOut: debug.historyOut,
                    summarized: debug.summarized,
                    loreCount: debug.loreCount,
                    firstMesInjected: debug.firstMesInjected,
                    systemChars: debug.systemChars,
                },
            },
        })}\n\n`);

        logger.info('SSE 流已建立，开始读取...');
        let chunkCount = 0;
        const streamStart = Date.now();

        const reader = llmStream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let firstTokenAt: number | null = null;

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
                                if (firstTokenAt === null) {
                                    firstTokenAt = Date.now();
                                    logger.info(`首 token 耗时: ${firstTokenAt - streamStart}ms`);
                                }
                                chunkCount++;
                                res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
                            }
                        } catch {
                            // skip
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        res.write('data: [DONE]\n\n');
        logger.info(
            `SSE 流结束, 共发送 ${chunkCount} 个 token, 总耗时 ${Date.now() - streamStart}ms` +
            (firstTokenAt ? `, 首 token ${firstTokenAt - streamStart}ms` : '') +
            `, prompt_seq=${debug.roleSequence}`,
        );
        res.end();
    } catch (err: any) {
        logger.error('Chat Stream API 错误:', err);
        if (!res.headersSent) {
            res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message || '流式聊天接口调用失败' });
        } else {
            res.write(`data: ${JSON.stringify({ error: err.message || '流式聊天失败' })}\n\n`);
            res.end();
        }
    }
}

/**
 * POST /api/chat
 */
export async function chat(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
        const chatReq = extractChatRequest(req.body);

        if (!chatReq.message) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Message is required' });
            return;
        }

        const result = await chatService.processChat(chatReq);
        res.json({
            text: result.text,
            provider: result.provider,
            model: result.model,
            ...(result.debug ? { debug: result.debug } : {}),
        });
    } catch (err: any) {
        logger.error('Chat API 错误:', err);
        res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message || '聊天接口调用失败' });
    }
}

/**
 * POST /api/chat/debug-prompt
 * 仅构建 prompt，不调用 LLM（便于审阅上下文质量）
 */
export async function debugPrompt(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
        const chatReq = extractChatRequest(req.body);
        if (!chatReq.message && !(chatReq.history?.length)) {
            // 允许只审卡片
            chatReq.message = chatReq.message || '（预览）';
        }
        const { messages, debug } = chatService.debugBuildPrompt(chatReq);
        res.json({ messages, debug });
    } catch (err: any) {
        logger.error('debug-prompt 错误:', err);
        res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message || 'debug 失败' });
    }
}

/**
 * GET /api/chat/providers
 */
export async function getProviders(_req: Request, res: Response): Promise<void> {
    const providers = chatService.getProviders();
    const active = getActiveLlm();
    res.json({ providers, active: active?.id || null });
}
