/**
 * 评价数据持久化仓库
 *
 * 评价数据与角色数据分离存储，按角色类型分文件管理：
 * - seed-reviews.json    → 种子角色评价（key: 角色 id）
 * - imported-reviews.json → 导入 PNG 角色评价（key: 文件名）
 * - png-reviews.json     → 用户目录 PNG 角色卡评价（key: handle/characters/filename.png）
 */

import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../common/logger.js';
import { getConfig } from '../../config/index.js';

export interface ReviewData {
    id: string;
    username: string;
    rating: number;
    comment: string;
    date: string;
}

type ReviewStore = Record<string, ReviewData[]>;

/**
 * 获取评价存储文件的目录路径
 */
function getReviewsDir(): string {
    const config = getConfig();
    const reviewsDir = path.join(config.dataRoot, 'reviews');
    if (!fs.existsSync(reviewsDir)) {
        fs.mkdirSync(reviewsDir, { recursive: true });
    }
    return reviewsDir;
}

/**
 * 从 JSON 文件加载评价数据
 */
function loadReviewStore(fileName: string): ReviewStore {
    const filePath = path.join(getReviewsDir(), fileName);
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        logger.error(`加载评价数据失败: ${fileName}`, err);
        return {};
    }
}

/**
 * 将评价数据写入 JSON 文件
 */
function saveReviewStore(fileName: string, store: ReviewStore): void {
    const filePath = path.join(getReviewsDir(), fileName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
        logger.error(`保存评价数据失败: ${fileName}`, err);
    }
}

// ============================================================
// 种子角色评价
// ============================================================

const SEED_REVIEWS_FILE = 'seed-reviews.json';

/**
 * 获取种子角色的所有评价
 */
export function getSeedReviews(characterId: string): ReviewData[] {
    const store = loadReviewStore(SEED_REVIEWS_FILE);
    return store[characterId] || [];
}

/**
 * 获取所有种子角色评价（用于服务启动时合并到角色数据）
 */
export function getAllSeedReviews(): ReviewStore {
    return loadReviewStore(SEED_REVIEWS_FILE);
}

/**
 * 为种子角色添加评价
 */
export function addSeedReview(characterId: string, review: ReviewData): ReviewData[] {
    const store = loadReviewStore(SEED_REVIEWS_FILE);
    if (!store[characterId]) {
        store[characterId] = [];
    }
    store[characterId] = [review, ...store[characterId]];
    saveReviewStore(SEED_REVIEWS_FILE, store);
    return store[characterId];
}

// ============================================================
// 导入 PNG 角色评价
// ============================================================

const IMPORTED_REVIEWS_FILE = 'imported-reviews.json';

/**
 * 获取导入 PNG 角色的所有评价
 */
export function getImportedReviews(fileName: string): ReviewData[] {
    const store = loadReviewStore(IMPORTED_REVIEWS_FILE);
    return store[fileName] || [];
}

/**
 * 获取所有导入角色评价（用于扫描时合并）
 */
export function getAllImportedReviews(): ReviewStore {
    return loadReviewStore(IMPORTED_REVIEWS_FILE);
}

/**
 * 为导入 PNG 角色添加评价
 */
export function addImportedReview(fileName: string, review: ReviewData): ReviewData[] {
    const store = loadReviewStore(IMPORTED_REVIEWS_FILE);
    if (!store[fileName]) {
        store[fileName] = [];
    }
    store[fileName] = [review, ...store[fileName]];
    saveReviewStore(IMPORTED_REVIEWS_FILE, store);
    return store[fileName];
}

// ============================================================
// 用户目录 PNG 角色卡评价
// ============================================================

const PNG_REVIEWS_FILE = 'png-reviews.json';

/**
 * 获取用户目录 PNG 角色卡的所有评价
 * @param key 格式为 "handle/characters/filename.png"
 */
export function getPngReviews(key: string): ReviewData[] {
    const store = loadReviewStore(PNG_REVIEWS_FILE);
    return store[key] || [];
}

/**
 * 获取所有用户 PNG 角色评价（用于扫描时合并）
 */
export function getAllPngReviews(): ReviewStore {
    return loadReviewStore(PNG_REVIEWS_FILE);
}

/**
 * 为用户目录 PNG 角色卡添加评价
 * @param key 格式为 "handle/characters/filename.png"
 */
export function addPngReview(key: string, review: ReviewData): ReviewData[] {
    const store = loadReviewStore(PNG_REVIEWS_FILE);
    if (!store[key]) {
        store[key] = [];
    }
    store[key] = [review, ...store[key]];
    saveReviewStore(PNG_REVIEWS_FILE, store);
    return store[key];
}
