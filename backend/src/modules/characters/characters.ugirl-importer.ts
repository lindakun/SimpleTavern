import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createCharacter, editCharacter, removeCharacter } from './characters.service.js';
import {
    listCharacterFiles,
    readCharacterData,
    writeCharacterData,
    getCharacterFilePath,
} from './characters.repository.js';
import { logger } from '../../common/logger.js';

/**
 * ugirl 列表 JSON 原始条目（legacy）
 */
interface UgirlLegacyItem {
    id: string;
    name: string;
    avatar_url?: string;
    avatar_local?: string;
    local_avatar?: string;
    introduction?: string;
    short_introduction?: string;
    /** 详情 API 补全的真实开场 */
    greetings?: string[];
    tags?: string[];
    is_nsfw?: boolean;
    card_type?: string;
    popularity?: number;
    favorite_count?: number;
    like_count?: number;
    rating_avg?: number;
    rating_count?: number;
    chat_count?: number;
    comment_count?: number;
    radar_tier?: string;
    radar_scores?: Record<string, number>;
    creator_nickname?: string;
    creator_level?: number;
    source?: string;
    created_at?: string;
    updated_at?: string;
    card?: UgirlCardFields;
    ugirl_id?: string;
    quality?: string;
    metrics?: Record<string, unknown>;
    avatar_file?: string;
    avatar_url_remote?: string;
    creator?: string;
    raw?: Record<string, unknown>;
}

interface UgirlCardFields {
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    creator_notes?: string;
    alternate_greetings?: string[];
}

/**
 * 导入结果
 */
export interface UgirlImportResult {
    total: number;
    success: number;
    failed: number;
    created: number;
    updated: number;
    skipped: number;
    /** 因不在本次包内而删除的 ugirl 角色数（pruneMissing） */
    pruned: number;
    results: Array<{
        name: string;
        status: 'created' | 'updated' | 'skipped' | 'failed' | 'pruned';
        fileName?: string;
        error?: string;
        matchBy?: 'ugirl_id' | 'name' | 'new';
    }>;
}

export type ImportProgressCallback = (progress: {
    current: number;
    total: number;
    currentName: string;
}) => void;

export interface UgirlImportOptions {
    /** 已存在时：update | skip | create（默认 update） */
    onExisting?: 'update' | 'skip' | 'create';
    /** 跳过 quality=low */
    skipLowQuality?: boolean;
    /** 跳过 FUNCTION 类型 */
    skipFunction?: boolean;
    /**
     * 同步模式：导入结束后，删除「带 ugirl_id 但不在本次包内」的角色。
     * 日更推荐列表会轮换 ID，不开此项库会无限膨胀（看起来像没去重）。
     */
    pruneMissing?: boolean;
    /**
     * 字段合并策略：
     * - replace：全量覆盖（日更默认）
     * - fill_empty：仅写入旧卡为空的字段，保护手改
     */
    mergeMode?: 'replace' | 'fill_empty';
    /**
     * fill_empty 时仍强制用包内值覆盖的字段（如 first_mes 冲掉模板假开场）
     * 支持顶层与 data.* 同名字段
     */
    forceFields?: string[];
}

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.jfif'];
const CONCURRENCY = 10;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

async function loadAndConvertImage(filePath: string): Promise<Buffer | undefined> {
    const raw = fs.readFileSync(filePath);

    if (raw.length >= 8 && raw.slice(0, 8).equals(PNG_SIGNATURE)) {
        return raw;
    }

    try {
        logger.info(`转换头像格式: ${path.basename(filePath)} -> PNG`);
        return await sharp(raw).png().toBuffer();
    } catch (err: any) {
        logger.warn(`头像转换失败 (${path.basename(filePath)}): ${err.message}`);
        return undefined;
    }
}

function resolveAvatarSearchDirs(jsonFilePath: string): string[] {
    const jsonDir = path.dirname(jsonFilePath);
    const dirs: string[] = [];

    // 包内 avatars/
    const pkgAvatars = path.join(jsonDir, 'avatars');
    if (fs.existsSync(pkgAvatars)) dirs.push(pkgAvatars);

    const siblingProcessed = path.join(jsonDir, 'avatars_processed');
    if (fs.existsSync(siblingProcessed)) dirs.push(siblingProcessed);

    dirs.push(jsonDir);

    const parentProcessed = path.join(path.dirname(jsonDir), 'avatars_processed');
    if (fs.existsSync(parentProcessed)) dirs.push(parentProcessed);

    const parentAvatars = path.join(path.dirname(jsonDir), 'avatars');
    if (fs.existsSync(parentAvatars)) dirs.push(parentAvatars);

    return dirs;
}

async function downloadRemoteAvatar(url: string): Promise<Buffer | undefined> {
    if (!url || !/^https?:\/\//i.test(url)) return undefined;
    try {
        const resp = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (compatible; SimpleTavern-ugirl-importer/1.0)',
                Referer: 'https://www.ugirl.vip/',
                Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(20000),
        });
        if (!resp.ok) {
            logger.warn(`远端头像下载失败 HTTP ${resp.status}: ${url.slice(0, 120)}`);
            return undefined;
        }
        const ab = await resp.arrayBuffer();
        const raw = Buffer.from(ab);
        if (raw.length < 100) return undefined;
        if (raw.length >= 8 && raw.slice(0, 8).equals(PNG_SIGNATURE)) {
            return raw;
        }
        try {
            return await sharp(raw).png().toBuffer();
        } catch {
            return raw;
        }
    } catch (err: any) {
        logger.warn(`远端头像下载异常: ${err?.message || err}`);
        return undefined;
    }
}

async function findAvatarFile(
    searchDirs: string[],
    item: UgirlLegacyItem,
    packageRoot: string,
): Promise<Buffer | undefined> {
    // 1) st-package avatar_file（相对 package 根）
    if (item.avatar_file) {
        const p = path.isAbsolute(item.avatar_file)
            ? item.avatar_file
            : path.join(packageRoot, item.avatar_file);
        if (fs.existsSync(p)) {
            const buffer = await loadAndConvertImage(p);
            if (buffer) return buffer;
        }
    }

    const id = item.ugirl_id || item.id;
    const locals = [item.avatar_local, item.local_avatar].filter(Boolean) as string[];

    for (const dir of searchDirs) {
        for (const loc of locals) {
            const fullPath = path.join(dir, path.basename(loc));
            if (fs.existsSync(fullPath)) {
                const buffer = await loadAndConvertImage(fullPath);
                if (buffer) return buffer;
            }
        }

        if (id) {
            for (const ext of SUPPORTED_EXTENSIONS) {
                const fullPath = path.join(dir, `${id}${ext}`);
                if (fs.existsSync(fullPath)) {
                    const buffer = await loadAndConvertImage(fullPath);
                    if (buffer) return buffer;
                }
            }
        }
    }

    // 2) 本地没有时，尝试远端 URL（无需先把图片拷到服务器）
    const remote =
        item.avatar_url_remote ||
        (item.avatar_url && /^https?:\/\//i.test(item.avatar_url) ? item.avatar_url : '');
    if (remote) {
        const buf = await downloadRemoteAvatar(remote);
        if (buf) return buf;
    }

    return undefined;
}

function clip(text: string, max: number): string {
    const s = (text || '').trim();
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
}

function synthesizeFirstMes(name: string, description: string, shortIntro: string): string {
    const hook = (shortIntro || description || '').replace(/\s+/g, ' ').trim();
    const snippet = hook.length > 220 ? hook.slice(0, 220) + '…' : hook;
    if (!snippet) {
        return `（场景缓缓展开。）\n\n「……你来了。」\n\n${name || '角色'}看向你，等待你的回应。`;
    }
    return (
        `（世界的轮廓在你眼前清晰起来。）\n\n` +
        `${snippet}\n\n` +
        `（现在，主动权在你手上——你想先做什么？）`
    );
}

/**
 * legacy 列表文案启发式拆分（与 ugirl_craw/lib/card_enrich.js 对齐的精简版）
 * 优先使用包内已 enrich 的 card 字段。
 */
function heuristicCardFromLegacy(item: UgirlLegacyItem): UgirlCardFields {
    const intro = (item.introduction || '').replace(/\r\n/g, '\n').trim();
    const shortIntro = (item.short_introduction || '').trim();

    const headingRe =
        /(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:【[ \t]*)?(玩法与特别注意事项|玩法与注意事项|玩法要素|注意事项|玩法说明|深层玩法|玩法聚焦|玩法|性格设定|性格|场景设定|场景|世界观|开场白|开场|系统提示|角色设定|背景设定|背景)(?:[ \t]*】)?[ \t]*([^：:\n【】]{0,24})?[ \t]*[:：]?[ \t]*/g;

    const matches: Array<{ key: string; index: number; end: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(intro)) !== null) {
        const raw = m[1];
        let key = 'gameplay';
        if (/^玩法|^深层玩法|玩法要素|玩法说明|玩法与/.test(raw)) key = 'gameplay';
        else if (/注意事项/.test(raw)) key = 'notes';
        else if (/性格/.test(raw)) key = 'personality';
        else if (/场景/.test(raw)) key = 'scenario';
        else if (/世界观|背景|设定|角色设定/.test(raw)) key = 'setting';
        else if (/开场/.test(raw)) key = 'greeting';
        else if (/系统/.test(raw)) key = 'system';
        matches.push({ key, index: m.index, end: m.index + m[0].length });
    }

    let description = intro || shortIntro;
    let personality = '';
    let scenario = '';
    let first_mes = '';
    let system_prompt = '';

    if (matches.length) {
        const preamble = intro.slice(0, matches[0].index).trim();
        description = preamble || intro;
        const sections: Record<string, string> = {};
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].end;
            const end = i + 1 < matches.length ? matches[i + 1].index : intro.length;
            const body = intro.slice(start, end).trim();
            if (!body) continue;
            sections[matches[i].key] = sections[matches[i].key]
                ? sections[matches[i].key] + '\n\n' + body
                : body;
        }
        personality = sections.personality || '';
        scenario = sections.scenario || sections.setting || '';
        first_mes = sections.greeting || '';
        const parts: string[] = [];
        if (sections.gameplay) parts.push(sections.gameplay);
        if (sections.notes) parts.push('【注意事项】\n' + sections.notes);
        if (sections.system) parts.push(sections.system);
        system_prompt = parts.join('\n\n');
        if (!scenario && sections.gameplay) {
            scenario = clip(sections.gameplay.split(/\n{2,}/)[0] || sections.gameplay, 800);
        }
    }

    const greetings = Array.isArray(item.greetings)
        ? item.greetings.map((g) => String(g || '').trim()).filter(Boolean)
        : [];
    let alternate_greetings: string[] = [];
    if (greetings.length) {
        first_mes = greetings[0];
        alternate_greetings = greetings.slice(1);
    } else if (!first_mes) {
        first_mes = synthesizeFirstMes(item.name, description, shortIntro);
    }

    return {
        description: clip(description, 5000),
        personality: clip(personality, 3000),
        scenario: clip(scenario, 3000),
        first_mes: clip(first_mes, 5000),
        mes_example: '',
        system_prompt: clip(system_prompt, 5000),
        post_history_instructions: '',
        creator_notes: clip(shortIntro || description.slice(0, 200), 3000),
        alternate_greetings,
    };
}

function buildV3CharacterData(item: UgirlLegacyItem): Record<string, unknown> {
    const ugirlId = item.ugirl_id || item.id;
    const tags = [...(item.tags || [])];
    if (item.is_nsfw && !tags.includes('NSFW')) {
        tags.push('NSFW');
    }

    // 优先包内 card（st-package v1）
    const fromPackage = item.card && typeof item.card === 'object';
    const cardFields: UgirlCardFields = fromPackage
        ? {
            description: item.card!.description || '',
            personality: item.card!.personality || '',
            scenario: item.card!.scenario || '',
            first_mes: item.card!.first_mes || '',
            mes_example: item.card!.mes_example || '',
            system_prompt: item.card!.system_prompt || '',
            post_history_instructions: item.card!.post_history_instructions || '',
            creator_notes: item.card!.creator_notes || item.short_introduction || '',
            alternate_greetings: Array.isArray(item.card!.alternate_greetings)
                ? item.card!.alternate_greetings
                : [],
        }
        : heuristicCardFromLegacy(item);

    if (!cardFields.first_mes) {
        cardFields.first_mes = synthesizeFirstMes(
            item.name,
            cardFields.description || '',
            item.short_introduction || '',
        );
    }

    const metrics = item.metrics || {};
    const popularity = Number(metrics.popularity ?? item.popularity ?? 0);
    const ratingAvg = Number(metrics.rating_avg ?? item.rating_avg ?? 0);
    const radarTier = String(metrics.radar_tier ?? item.radar_tier ?? '');

    return {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        name: item.name,
        description: cardFields.description || '',
        personality: cardFields.personality || '',
        scenario: cardFields.scenario || '',
        first_mes: cardFields.first_mes || '',
        mes_example: cardFields.mes_example || '',
        creatorcomment: cardFields.creator_notes || '',
        talkativeness: 0.5,
        fav: false,
        tags,
        create_date: new Date().toISOString(),
        data: {
            name: item.name,
            description: cardFields.description || '',
            personality: cardFields.personality || '',
            scenario: cardFields.scenario || '',
            first_mes: cardFields.first_mes || '',
            mes_example: cardFields.mes_example || '',
            creator_notes: cardFields.creator_notes || '',
            system_prompt: cardFields.system_prompt || '',
            post_history_instructions: cardFields.post_history_instructions || '',
            tags,
            creator: item.creator || item.creator_nickname || '',
            character_version: '1.0',
            alternate_greetings: cardFields.alternate_greetings || [],
            extensions: {
                talkativeness: 0.5,
                fav: false,
                world: '',
                depth_prompt: {
                    prompt: '',
                    depth: 4,
                    role: 'system',
                },
                ugirl_id: ugirlId,
                ugirl_popularity: popularity,
                ugirl_rating_avg: ratingAvg,
                ugirl_radar_tier: radarTier,
                ugirl_source: item.source || 'ugirl.vip',
                ugirl_quality: item.quality || '',
            },
        },
    };
}

interface CharIndexes {
    /** ugirl_id → fileName */
    byId: Map<string, string>;
    /** 角色名 → fileName[]（同名可能多份） */
    byName: Map<string, string[]>;
    /** fileName → ugirl_id（可空） */
    fileToId: Map<string, string | null>;
}

/**
 * 扫描 charactersDir，建立 ugirl_id / 名称索引，用于去重
 */
function buildCharIndexes(charactersDir: string): CharIndexes {
    const byId = new Map<string, string>();
    const byName = new Map<string, string[]>();
    const fileToId = new Map<string, string | null>();
    if (!fs.existsSync(charactersDir)) return { byId, byName, fileToId };

    const files = listCharacterFiles(charactersDir);
    for (const fileName of files) {
        try {
            const filePath = getCharacterFilePath(charactersDir, fileName);
            const raw = readCharacterData(filePath);
            if (!raw) continue;
            const json = JSON.parse(raw);
            const data = (json?.data || json) as Record<string, unknown>;
            const ext = (data.extensions || json?.extensions || {}) as Record<string, unknown>;
            const id = typeof ext.ugirl_id === 'string' ? ext.ugirl_id : null;
            const name = String(data.name || json?.name || '').trim();

            fileToId.set(fileName, id);
            if (id) byId.set(id, fileName);
            if (name) {
                const list = byName.get(name) || [];
                list.push(fileName);
                byName.set(name, list);
            }
        } catch {
            /* 单文件失败忽略 */
        }
    }
    return { byId, byName, fileToId };
}

/**
 * 解析已存在文件：优先 ugirl_id，其次唯一同名文件（含无 id 的旧卡）
 */
function resolveExistingFile(
    ugirlId: string | undefined,
    name: string,
    indexes: CharIndexes,
): { fileName: string; matchBy: 'ugirl_id' | 'name' } | undefined {
    if (ugirlId && indexes.byId.has(ugirlId)) {
        return { fileName: indexes.byId.get(ugirlId)!, matchBy: 'ugirl_id' };
    }

    const nameKey = (name || '').trim();
    if (!nameKey) return undefined;

    const candidates = indexes.byName.get(nameKey) || [];
    if (candidates.length === 0) return undefined;

    // 唯一同名 → 直接复用（补写 ugirl_id，避免再 create 出 _1.png）
    if (candidates.length === 1) {
        return { fileName: candidates[0], matchBy: 'name' };
    }

    // 多份同名：优先没有 ugirl_id 的旧卡；否则用第一份
    const withoutId = candidates.find((f) => !indexes.fileToId.get(f));
    if (withoutId) {
        return { fileName: withoutId, matchBy: 'name' };
    }
    return { fileName: candidates[0], matchBy: 'name' };
}

function updateCharacterWithOptionalAvatar(
    fileName: string,
    charactersDir: string,
    v3Data: Record<string, unknown>,
    avatarBuffer?: Buffer,
): boolean {
    if (avatarBuffer) {
        const filePath = getCharacterFilePath(charactersDir, fileName);
        return writeCharacterData(filePath, JSON.stringify(v3Data), avatarBuffer);
    }
    return editCharacter(fileName, charactersDir, v3Data);
}

function isEmptyFieldValue(v: unknown): boolean {
    if (v == null) return true;
    if (typeof v === 'string') return !v.trim();
    if (Array.isArray(v)) return v.length === 0 || v.every((x) => !String(x ?? '').trim());
    return false;
}

const TEXT_MERGE_FIELDS = [
    'description',
    'personality',
    'scenario',
    'first_mes',
    'mes_example',
    'system_prompt',
    'post_history_instructions',
    'creator_notes',
    'creatorcomment',
] as const;

/**
 * fill_empty：旧卡非空字段保留；forceFields 强制用包内新值。
 * extensions.ugirl_* 元数据总是更新。
 */
function mergeV3ForFillEmpty(
    existingRaw: Record<string, unknown>,
    incoming: Record<string, unknown>,
    forceFields: string[] = [],
): Record<string, unknown> {
    const force = new Set(forceFields.map((f) => f.trim()).filter(Boolean));
    const existingData = (existingRaw.data && typeof existingRaw.data === 'object'
        ? existingRaw.data
        : {}) as Record<string, unknown>;
    const incomingData = (incoming.data && typeof incoming.data === 'object'
        ? incoming.data
        : {}) as Record<string, unknown>;

    const pick = (field: string, oldVal: unknown, newVal: unknown): unknown => {
        if (force.has(field)) {
            return !isEmptyFieldValue(newVal) ? newVal : oldVal;
        }
        if (!isEmptyFieldValue(oldVal)) return oldVal;
        return newVal;
    };

    const mergedTop: Record<string, unknown> = { ...incoming };
    for (const field of TEXT_MERGE_FIELDS) {
        const oldVal = existingRaw[field] ?? existingData[field];
        const newVal = incoming[field] ?? incomingData[field];
        const chosen = pick(field, oldVal, newVal);
        mergedTop[field] = chosen;
    }

    // alternate_greetings 仅在 data 层
    const oldAlts = existingData.alternate_greetings;
    const newAlts = incomingData.alternate_greetings;
    const alts = force.has('alternate_greetings')
        ? (!isEmptyFieldValue(newAlts) ? newAlts : oldAlts)
        : (!isEmptyFieldValue(oldAlts) ? oldAlts : newAlts);

    // tags：旧卡有则保留，否则用新
    const oldTags = existingRaw.tags ?? existingData.tags;
    const newTags = incoming.tags ?? incomingData.tags;
    const tags = !isEmptyFieldValue(oldTags) ? oldTags : newTags;
    mergedTop.tags = tags;

    const oldExt = (existingData.extensions && typeof existingData.extensions === 'object'
        ? existingData.extensions
        : {}) as Record<string, unknown>;
    const newExt = (incomingData.extensions && typeof incomingData.extensions === 'object'
        ? incomingData.extensions
        : {}) as Record<string, unknown>;

    // 保留用户可能手改的 fav / talkativeness / world / depth_prompt；ugirl_* 用新
    const mergedExt: Record<string, unknown> = {
        ...oldExt,
        ...newExt,
        talkativeness: oldExt.talkativeness ?? newExt.talkativeness ?? 0.5,
        fav: oldExt.fav ?? newExt.fav ?? false,
        world: oldExt.world ?? newExt.world ?? '',
        depth_prompt: oldExt.depth_prompt ?? newExt.depth_prompt,
    };

    const mergedData: Record<string, unknown> = {
        ...incomingData,
        description: mergedTop.description,
        personality: mergedTop.personality,
        scenario: mergedTop.scenario,
        first_mes: mergedTop.first_mes,
        mes_example: mergedTop.mes_example,
        system_prompt: pick(
            'system_prompt',
            existingData.system_prompt,
            incomingData.system_prompt,
        ),
        post_history_instructions: pick(
            'post_history_instructions',
            existingData.post_history_instructions,
            incomingData.post_history_instructions,
        ),
        creator_notes: pick(
            'creator_notes',
            existingData.creator_notes ?? existingRaw.creatorcomment,
            incomingData.creator_notes ?? incoming.creatorcomment,
        ),
        tags,
        alternate_greetings: alts ?? [],
        creator: existingData.creator || incomingData.creator || '',
        name: incomingData.name || existingData.name || incoming.name,
        character_version: incomingData.character_version || existingData.character_version || '1.0',
        extensions: mergedExt,
    };

    // 顶层与 data 对齐
    mergedTop.description = mergedData.description;
    mergedTop.personality = mergedData.personality;
    mergedTop.scenario = mergedData.scenario;
    mergedTop.first_mes = mergedData.first_mes;
    mergedTop.mes_example = mergedData.mes_example;
    mergedTop.creatorcomment = mergedData.creator_notes;
    mergedTop.data = mergedData;
    // 保留旧 create_date
    if (existingRaw.create_date) mergedTop.create_date = existingRaw.create_date;

    return mergedTop;
}

function readExistingCharacterJson(
    fileName: string,
    charactersDir: string,
): Record<string, unknown> | null {
    try {
        const filePath = getCharacterFilePath(charactersDir, fileName);
        const raw = readCharacterData(filePath);
        if (!raw) return null;
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/**
 * 批量导入 ugirl JSON / st-package v1
 */
export async function importUgirlCharacters(
    jsonFilePath: string,
    charactersDir: string,
    onProgress?: ImportProgressCallback,
    options: UgirlImportOptions = {},
): Promise<UgirlImportResult> {
    const {
        onExisting = 'update',
        skipLowQuality = false,
        skipFunction = false,
        pruneMissing = false,
        mergeMode = 'replace',
        forceFields = ['first_mes', 'alternate_greetings'],
    } = options;

    const raw = fs.readFileSync(jsonFilePath, 'utf-8');
    const data = JSON.parse(raw);
    const packageRoot = path.dirname(path.resolve(jsonFilePath));
    const isPackage = data?.format === 'ugirl-st-package/v1';

    let items: UgirlLegacyItem[] = Array.isArray(data)
        ? data
        : (data.items as UgirlLegacyItem[]) || [];

    if (!items.length) {
        throw new Error('JSON 文件中没有找到有效的角色数据');
    }

    if (skipFunction) {
        items = items.filter((it) => String(it.card_type || '').toUpperCase() !== 'FUNCTION');
    }
    if (skipLowQuality) {
        items = items.filter((it) => it.quality !== 'low');
    }

    const searchDirs = resolveAvatarSearchDirs(jsonFilePath);
    logger.info(
        `开始导入 ugirl 角色: 共 ${items.length} 个` +
        (isPackage ? ' [st-package/v1]' : ' [legacy]') +
        `, onExisting=${onExisting}, mergeMode=${mergeMode}, pruneMissing=${pruneMissing}, 头像目录: ${searchDirs.join(', ')}`,
    );

    const indexes = buildCharIndexes(charactersDir);
    logger.info(
        `已有索引: ugirl_id=${indexes.byId.size} 条, 角色名=${indexes.byName.size} 组`,
    );

    const result: UgirlImportResult = {
        total: items.length,
        success: 0,
        failed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        pruned: 0,
        results: [],
    };

    const packageIds = new Set<string>();
    for (const it of items) {
        const id = it.ugirl_id || it.id;
        if (id) packageIds.add(id);
    }

    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch = items.slice(i, i + CONCURRENCY);

        const batchData = await Promise.all(
            batch.map(async (item, batchIdx) => {
                const globalIdx = i + batchIdx;
                try {
                    const v3Data = buildV3CharacterData(item);
                    const avatarBuffer = await findAvatarFile(searchDirs, item, packageRoot);
                    return { item, v3Data, avatarBuffer, globalIdx };
                } catch (err: any) {
                    return {
                        item,
                        v3Data: null as Record<string, unknown> | null,
                        avatarBuffer: undefined as Buffer | undefined,
                        globalIdx,
                        error: err.message || String(err),
                    };
                }
            }),
        );

        for (const bd of batchData) {
            if (bd.error || !bd.v3Data) {
                result.failed++;
                result.results.push({
                    name: bd.item.name,
                    status: 'failed',
                    error: bd.error || 'unknown',
                });
                logger.error(`[${bd.globalIdx + 1}/${items.length}] 准备数据失败: ${bd.item.name} - ${bd.error}`);
                continue;
            }

            const ugirlId = bd.item.ugirl_id || bd.item.id;
            const existing = onExisting === 'create'
                ? undefined
                : resolveExistingFile(ugirlId, bd.item.name, indexes);

            try {
                if (existing && onExisting === 'skip') {
                    result.skipped++;
                    result.success++;
                    result.results.push({
                        name: bd.item.name,
                        status: 'skipped',
                        fileName: existing.fileName,
                        matchBy: existing.matchBy,
                    });
                } else if (existing && onExisting === 'update') {
                    let payload = bd.v3Data;
                    if (mergeMode === 'fill_empty') {
                        const oldJson = readExistingCharacterJson(existing.fileName, charactersDir);
                        if (oldJson) {
                            payload = mergeV3ForFillEmpty(oldJson, bd.v3Data, forceFields);
                        }
                    }
                    updateCharacterWithOptionalAvatar(
                        existing.fileName,
                        charactersDir,
                        payload,
                        bd.avatarBuffer,
                    );
                    if (ugirlId) {
                        const oldId = indexes.fileToId.get(existing.fileName);
                        if (oldId && oldId !== ugirlId) indexes.byId.delete(oldId);
                        indexes.byId.set(ugirlId, existing.fileName);
                        indexes.fileToId.set(existing.fileName, ugirlId);
                    }
                    result.updated++;
                    result.success++;
                    result.results.push({
                        name: bd.item.name,
                        status: 'updated',
                        fileName: existing.fileName,
                        matchBy: existing.matchBy,
                    });
                } else {
                    const fileName = createCharacter(
                        bd.item.name,
                        charactersDir,
                        bd.v3Data,
                        bd.avatarBuffer,
                    );
                    if (ugirlId) indexes.byId.set(ugirlId, fileName);
                    indexes.fileToId.set(fileName, ugirlId || null);
                    const nameKey = (bd.item.name || '').trim();
                    if (nameKey) {
                        const list = indexes.byName.get(nameKey) || [];
                        list.push(fileName);
                        indexes.byName.set(nameKey, list);
                    }
                    result.created++;
                    result.success++;
                    result.results.push({
                        name: bd.item.name,
                        status: 'created',
                        fileName,
                        matchBy: 'new',
                    });
                }

                if (bd.globalIdx % 50 === 0 || bd.globalIdx === items.length - 1) {
                    const last = result.results[result.results.length - 1];
                    logger.info(
                        `[${bd.globalIdx + 1}/${items.length}] ${bd.item.name} -> ${last.fileName}` +
                        ` (${last.status}${last.matchBy ? '/' + last.matchBy : ''})` +
                        (bd.avatarBuffer ? ' (含头像)' : ' (无头像)'),
                    );
                }
            } catch (err: any) {
                result.failed++;
                result.results.push({
                    name: bd.item.name,
                    status: 'failed',
                    error: err.message || String(err),
                });
                logger.error(`[${bd.globalIdx + 1}/${items.length}] 导入失败: ${bd.item.name} - ${err.message}`);
            }

            if (onProgress) {
                onProgress({
                    current: result.success + result.failed,
                    total: items.length,
                    currentName: bd.item.name,
                });
            }
        }
    }

    if (pruneMissing) {
        const toPrune: Array<{ id: string; fileName: string }> = [];
        for (const [id, fileName] of indexes.byId.entries()) {
            if (!packageIds.has(id)) toPrune.push({ id, fileName });
        }
        logger.info(`pruneMissing: 将删除 ${toPrune.length} 个不在本次包内的 ugirl 角色`);
        for (const p of toPrune) {
            try {
                removeCharacter(p.fileName, charactersDir);
                result.pruned++;
                result.results.push({
                    name: p.id,
                    status: 'pruned',
                    fileName: p.fileName,
                });
            } catch (err: any) {
                logger.warn(`删除过期角色失败 ${p.fileName}: ${err?.message || err}`);
            }
        }
    }

    logger.info(
        `导入完成: 成功 ${result.success} (新建 ${result.created} / 更新 ${result.updated} / 跳过 ${result.skipped})` +
        ` / 清理 ${result.pruned} / 失败 ${result.failed}`,
    );
    return result;
}
