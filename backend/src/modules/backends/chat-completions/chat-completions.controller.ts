import { Request, Response, NextFunction } from 'express';
import * as chatService from './chat-completions.service.js';
import { logger } from '../../../common/logger.js';

/**
 * POST /api/chat
 * 通用聊天接口 — 接收用户消息 + 角色信息，返回 AI 回复
 */
export async function chat(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
        const { message, history, characterName, characterDescription, provider } = req.body;

        if (!message) {
            res.status(400).json({ error: 'Message is required' });
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
        res.status(500).json({ error: err.message || '聊天接口调用失败' });
    }
}

/**
 * GET /api/chat/providers
 * 获取可用 LLM 列表
 */
export async function getProviders(_req: Request, res: Response): Promise<void> {
    const providers = chatService.getProviders();
    res.json({ providers, active: providers[0]?.id || null });
}
