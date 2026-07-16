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
        tagline: body.tagline,
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
        promptStrictness: body.promptStrictness,
        contextBudgetChars: body.contextBudgetChars,
        loreScanDepth: body.loreScanDepth,
        continueMode: body.continueMode === true,
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

        const { stream: llmStream, debug, provider, model, isLocal } =
            await chatService.processChatStream(chatReq);

        // 首包附带 meta，便于前端/调试（不破坏只读 text 的旧客户端：忽略未知字段即可）
        res.write(`data: ${JSON.stringify({
            meta: {
                provider,
                model,
                isLocal,
                prompt: {
                    thinCard: debug.thinCard,
                    compact: debug.compact,
                    strictness: debug.strictness,
                    roleSequence: debug.roleSequence,
                    totalMessages: debug.totalMessages,
                    totalChars: debug.totalChars,
                    budgetChars: debug.budgetChars,
                    budgetTrimmed: debug.budgetTrimmed,
                    historyIn: debug.historyIn,
                    historyOut: debug.historyOut,
                    summarized: debug.summarized,
                    loreCount: debug.loreCount,
                    loreBefore: debug.loreBefore,
                    loreAfter: debug.loreAfter,
                    firstMesInjected: debug.firstMesInjected,
                    firstMesSynthesized: debug.firstMesSynthesized,
                    systemChars: debug.systemChars,
                    continueMode: debug.continueMode,
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
        let finishReason: string | null = null;
        let clientClosed = false;

        // 仅在客户端真正断开时取消上游；避免误伤正常结束
        req.on('close', () => {
            if (!res.writableEnded) {
                clientClosed = true;
                reader.cancel().catch(() => {});
            }
        });

        const processSseLine = (line: string) => {
            if (!line.startsWith('data: ')) return;
            const data = line.slice(6).trim();
            if (!data) return;
            if (data === '[DONE]') {
                return;
            }
            try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                if (choice?.finish_reason) {
                    finishReason = String(choice.finish_reason);
                }
                // 兼容 content 为 string 或极少见的数组片段
                let delta = choice?.delta?.content ?? choice?.message?.content ?? '';
                if (Array.isArray(delta)) {
                    delta = delta.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('');
                }
                if (delta) {
                    if (firstTokenAt === null) {
                        firstTokenAt = Date.now();
                        logger.info(`首 token 耗时: ${firstTokenAt - streamStart}ms`);
                    }
                    chunkCount++;
                    res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
                }
            } catch {
                // skip malformed SSE lines
            }
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (clientClosed) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    processSseLine(line);
                }
            }
            // 刷尽 TextDecoder 与最后半行（上游结束时常见无尾部 \n）
            buffer += decoder.decode();
            if (buffer.trim()) {
                for (const line of buffer.split('\n')) {
                    processSseLine(line);
                }
                buffer = '';
            }
        } finally {
            reader.releaseLock();
        }

        if (!clientClosed) {
            // 结束元信息：前端可据此展示「续写」（finish_reason=length）
            res.write(`data: ${JSON.stringify({
                done: true,
                finishReason: finishReason || 'stop',
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            logger.info(
                `SSE 流结束, 共发送 ${chunkCount} 个 chunk, 总耗时 ${Date.now() - streamStart}ms` +
                (firstTokenAt ? `, 首 token ${firstTokenAt - streamStart}ms` : '') +
                (finishReason ? `, finish=${finishReason}` : '') +
                `, prompt_seq=${debug.roleSequence}`,
            );
            res.end();
        } else {
            logger.warn(`SSE 客户端提前断开, 已转发 ${chunkCount} chunk, prompt_seq=${debug.roleSequence}`);
        }
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
