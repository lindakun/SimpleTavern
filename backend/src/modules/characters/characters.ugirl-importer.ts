import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createCharacter } from './characters.service.js';
import { logger } from '../../common/logger.js';

/**
 * ugirl 导入条目原始数据格式
 */
interface UgirlItem {
    id: string;
    name: string;
    avatar_url: string;
    avatar_local?: string;
    introduction: string;
    short_introduction: string;
    tags: string[];
    is_nsfw: boolean;
    card_type: string;
    popularity: number;
    favorite_count: number;
    like_count: number;
    rating_avg: number;
    rating_count: number;
    chat_count: number;
    comment_count: number;
    radar_tier: string;
    radar_scores: {
        depth: number;
        rating: number;
        repeat: number;
        breadth: number;
        consumed: number;
    };
    creator_nickname: string;
    creator_level: number;
    source: string;
    created_at: string;
    updated_at: string;
}

/**
 * 导入结果
 */
export interface UgirlImportResult {
    total: number;
    success: number;
    failed: number;
    results: Array<{
        name: string;
        status: 'success' | 'failed';
        fileName?: string;
        error?: string;
    }>;
}

/**
 * 从 avatar_local 路径中提取文件名
 * avatar_local 格式示例: output\test_avatars\fHWdkN.png
 */
function extractAvatarFileName(avatarLocal: string): string {
    // 兼容 Windows \ 和 Unix / 路径分隔符
    const normalized = avatarLocal.replace(/\\/g, '/');
    return path.basename(normalized);
}

/**
 * 加载本地头像文件
 * 使用 sharp 自动转换任意图片格式为 PNG
 */
async function loadLocalAvatar(avatarsDir: string | undefined, avatarLocal: string | undefined): Promise<Buffer | undefined> {
    if (!avatarsDir || !avatarLocal) return undefined;

    const fileName = extractAvatarFileName(avatarLocal);
    const fullPath = path.join(avatarsDir, fileName);

    if (!fs.existsSync(fullPath)) {
        logger.warn(`头像文件不存在: ${fullPath}`);
        return undefined;
    }

    const ext = path.extname(fullPath).toLowerCase();

    try {
        if (ext === '.png') {
            return fs.readFileSync(fullPath);
        }
        // 非 PNG 格式 — 使用 sharp 转换为 PNG
        logger.info(`转换头像格式: ${fullPath} (${ext}) → PNG`);
        return await sharp(fullPath).png().toBuffer();
    } catch (err: any) {
        logger.warn(`头像加载失败: ${fullPath} - ${err.message}`);
        return undefined;
    }
}

/**
 * 将 ugirl 条目转换为 V3 角色数据
 */
function buildV3CharacterData(item: UgirlItem): Record<string, unknown> {
    const tags = [...item.tags];
    if (item.is_nsfw && !tags.includes('NSFW')) {
        tags.push('NSFW');
    }

    // 将完整介绍作为 description（如果 short_introduction 太短则用 introduction）
    const description = (item.short_introduction || item.introduction || '').slice(0, 500);

    return {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        name: item.name,
        description,
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        creatorcomment: '',
        talkativeness: 0.5,
        fav: false,
        tags,
        create_date: new Date().toISOString(),
        data: {
            name: item.name,
            description,
            personality: '',
            scenario: '',
            first_mes: '',
            mes_example: '',
            creator_notes: item.introduction || '',
            system_prompt: '',
            post_history_instructions: '',
            tags,
            creator: item.creator_nickname || '',
            character_version: '1.0',
            alternate_greetings: [],
            extensions: {
                talkativeness: 0.5,
                fav: false,
                world: '',
                depth_prompt: {
                    prompt: '',
                    depth: 4,
                    role: 'system',
                },
                // 保留 ugirl 原始元数据
                ugirl_id: item.id,
                ugirl_popularity: item.popularity,
                ugirl_rating_avg: item.rating_avg,
                ugirl_radar_tier: item.radar_tier,
                ugirl_source: item.source,
                ugirl_url: item.avatar_url,
            },
        },
    };
}

/**
 * 批量导入 ugirl JSON 文件中的角色
 */
export async function importUgirlCharacters(
    jsonFilePath: string,
    charactersDir: string,
    avatarsDir?: string,
): Promise<UgirlImportResult> {
    const raw = fs.readFileSync(jsonFilePath, 'utf-8');
    const data = JSON.parse(raw);

    // 支持两种格式：直接数组 或 { metadata, items }
    const items: UgirlItem[] = Array.isArray(data)
        ? data
        : (data.items as UgirlItem[]) || [];

    if (!items.length) {
        throw new Error('JSON 文件中没有找到有效的角色数据（需要 items 数组）');
    }

    logger.info(`开始导入 ugirl 角色: 共 ${items.length} 个`);

    const result: UgirlImportResult = {
        total: items.length,
        success: 0,
        failed: 0,
        results: [],
    };

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
            const v3Data = buildV3CharacterData(item);
            const avatarBuffer = await loadLocalAvatar(avatarsDir, item.avatar_local);

            const fileName = createCharacter(
                item.name,
                charactersDir,
                v3Data,
                avatarBuffer,
            );

            result.success++;
            result.results.push({
                name: item.name,
                status: 'success',
                fileName,
            });

            logger.info(`[${i + 1}/${items.length}] 导入成功: ${item.name} → ${fileName}`);
        } catch (err: any) {
            result.failed++;
            result.results.push({
                name: item.name,
                status: 'failed',
                error: err.message || String(err),
            });
            logger.error(`[${i + 1}/${items.length}] 导入失败: ${item.name} - ${err.message}`);
        }
    }

    logger.info(`导入完成: 成功 ${result.success} / 失败 ${result.failed}`);
    return result;
}
