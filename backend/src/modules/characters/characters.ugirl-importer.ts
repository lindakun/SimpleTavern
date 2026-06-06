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

/** 支持的文件扩展名（按优先级排列） */
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.jfif'];

/** 从 avatar_local 路径中提取文件名 */
function extractAvatarFileName(avatarLocal: string): string {
    const normalized = avatarLocal.replace(/\\\\/g, '/');
    return path.basename(normalized);
}

/** PNG 文件签名 magic bytes */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * 加载图片文件，非 PNG 格式用 sharp 转换为 PNG
 * 先检查文件实际签名而非仅依赖扩展名（有些文件扩展名是 .png 但内容是 HEIF）
 * 如果转换失败(如HEIF格式不支持),返回 undefined
 */
async function loadAndConvertImage(filePath: string): Promise<Buffer | undefined> {
    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath);

    // 检查文件是否确实是 PNG 格式（通过 magic bytes）
    if (raw.length >= 8 && raw.slice(0, 8).equals(PNG_SIGNATURE)) {
        return raw;
    }

    // 不是真正的 PNG，尝试用 sharp 转换
    try {
        logger.info(`转换头像格式: ${path.basename(filePath)} (${ext}) -> PNG`);
        return await sharp(raw).png().toBuffer();
    } catch (err: any) {
        logger.warn(`头像转换失败 (${path.basename(filePath)}): ${err.message}`);
        return undefined;
    }
}

/**
 * 在头像目录中查找角色的头像文件
 * 策略: 1. avatar_local -> 2. 角色 ID -> 3. 角色名
 */
async function findAvatarFile(
    avatarsDir: string,
    item: UgirlItem,
): Promise<Buffer | undefined> {
    // 策略 1: avatar_local 指定的文件名
    if (item.avatar_local) {
        const fileName = extractAvatarFileName(item.avatar_local);
        const fullPath = path.join(avatarsDir, fileName);
        if (fs.existsSync(fullPath)) {
            const buffer = await loadAndConvertImage(fullPath);
            if (buffer) return buffer;
        }
    }

    // 策略 2: 按角色 ID 查找
    for (const ext of SUPPORTED_EXTENSIONS) {
        const fullPath = path.join(avatarsDir, `${item.id}${ext}`);
        if (fs.existsSync(fullPath)) {
            const buffer = await loadAndConvertImage(fullPath);
            if (buffer) return buffer;
        }
    }

    return undefined;
}

/**
 * 将 ugirl 条目转换为 V3 角色数据
 */
function buildV3CharacterData(item: UgirlItem): Record<string, unknown> {
    const tags = [...item.tags];
    if (item.is_nsfw && !tags.includes('NSFW')) {
        tags.push('NSFW');
    }

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

    const items: UgirlItem[] = Array.isArray(data)
        ? data
        : (data.items as UgirlItem[]) || [];

    if (!items.length) {
        throw new Error('JSON 文件中没有找到有效的角色数据');
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
            const avatarBuffer = avatarsDir
                ? await findAvatarFile(avatarsDir, item)
                : undefined;

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

            if (i % 50 === 0 || i === items.length - 1) {
                logger.info(`[${i + 1}/${items.length}] ${item.name} -> ${fileName}` +
                    (avatarBuffer ? ' (含头像)' : ' (无头像)'));
            }
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
