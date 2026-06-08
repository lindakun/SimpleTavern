import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../../common/logger.js';
import { getAllSeedReviews, addSeedReview } from './reviews.repository.js';

interface Review {
    id: string;
    username: string;
    rating: number;
    comment: string;
    date: string;
}

export interface SeedCharacter {
    id: string;
    name: string;
    avatar: string;
    avatarColor?: string;
    creator: string;
    rating: number;
    reviewCount: number;
    tags: string[];
    status?: 'online' | 'offline' | 'draft' | 'private';
    lastActiveLabel?: string;
    reviews: Review[];
    // V3 角色卡字段
    description: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    character_version?: string;
    extensions?: Record<string, unknown>;
    // 兼容旧字段
    tagline?: string;
    worldBook?: string;
    voiceType?: 'sweet' | 'mature';
    [key: string]: unknown;
}

let characters: SeedCharacter[] | null = null;

/**
 * 加载种子角色数据
 */
function loadSeedCharacters(): SeedCharacter[] {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const dataPath = path.resolve(__dirname, '../../data/seed-characters.json');

    try {
        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath, 'utf-8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                logger.info(`已加载 ${data.length} 个种子角色`);
                return data;
            }
        }
    } catch (err) {
        logger.error('加载种子角色数据失败:', err);
    }
    return [];
}

export function getSeedCharacters(): SeedCharacter[] {
    if (!characters) {
        characters = loadSeedCharacters();
    }
    // 合并持久化的评价数据（从 seed-reviews.json）
    const allReviews = getAllSeedReviews();
    return characters.map(c => {
        const persistedReviews = allReviews[c.id] || [];
        // 优先使用持久化评价（最新）
        const mergedReviews = persistedReviews.length > 0 ? persistedReviews : (c.reviews || []);
        const totalRating = mergedReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = mergedReviews.length > 0
            ? parseFloat((totalRating / mergedReviews.length).toFixed(1))
            : (c.rating || 0);
        return {
            ...c,
            privacyType: 'public' as const,
            reviews: mergedReviews,
            rating: avgRating,
            reviewCount: mergedReviews.length,
        };
    });
}

export function getSeedCharacterById(id: string): SeedCharacter | undefined {
    return getSeedCharacters().find(c => c.id === id);
}

export function addReviewToCharacter(characterId: string, review: Review): SeedCharacter | null {
    const chars = getSeedCharacters();
    const char = chars.find(c => c.id === characterId);
    if (!char) return null;

    // 持久化到 seed-reviews.json
    const savedReviews = addSeedReview(characterId, review);

    // 同步内存中的评价列表
    char.reviews = savedReviews;

    // 重新计算评分
    const totalRating = char.reviews.reduce((sum, r) => sum + r.rating, 0);
    char.rating = parseFloat((totalRating / char.reviews.length).toFixed(1));
    char.reviewCount = char.reviews.length;

    return char;
}
