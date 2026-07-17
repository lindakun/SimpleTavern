import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createCharacter, editCharacter } from './characters.service.js';
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
    results: Array<{
        name: string;
        status: 'created' | 'updated' | 'skipped' | 'failed';
        fileName?: string;
        error?: string;
    }>;
}

export type ImportProgressCallback = (progress: {
    current: number;
    total: number;
    currentName: string;
}) => void;

export interface UgirlImportOptions {
    /** 已存在 ugirl_id 时：update | skip | create（默认 update） */
    onExisting?: 'update' | 'skip' | 'create';
    /** 跳过 quality=low */
    skipLowQuality?: boolean;
    /** 跳过 FUNCTION 类型 */
    skipFunction?: boolean;
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

    if (!first_mes) {
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
        alternate_greetings: [],
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

/**
 * 扫描 charactersDir，建立 ugirl_id → fileName 索引
 */
function buildUgirlIdIndex(charactersDir: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!fs.existsSync(charactersDir)) return map;

    const files = listCharacterFiles(charactersDir);
    for (const fileName of files) {
        try {
            const filePath = getCharacterFilePath(charactersDir, fileName);
            const raw = readCharacterData(filePath);
            if (!raw) continue;
            const json = JSON.parse(raw);
            const ext = json?.data?.extensions || json?.extensions || {};
            const id = ext.ugirl_id;
            if (id && typeof id === 'string') {
                map.set(id, fileName);
            }
        } catch {
            /* 单文件失败忽略 */
        }
    }
    return map;
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
        `, onExisting=${onExisting}, 头像目录: ${searchDirs.join(', ')}`,
    );

    const idIndex = buildUgirlIdIndex(charactersDir);
    logger.info(`已有 ugirl_id 索引: ${idIndex.size} 条`);

    const result: UgirlImportResult = {
        total: items.length,
        success: 0,
        failed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        results: [],
    };

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
            const existingFile = ugirlId ? idIndex.get(ugirlId) : undefined;

            try {
                if (existingFile && onExisting === 'skip') {
                    result.skipped++;
                    result.success++;
                    result.results.push({
                        name: bd.item.name,
                        status: 'skipped',
                        fileName: existingFile,
                    });
                } else if (existingFile && onExisting === 'update') {
                    updateCharacterWithOptionalAvatar(
                        existingFile,
                        charactersDir,
                        bd.v3Data,
                        bd.avatarBuffer,
                    );
                    result.updated++;
                    result.success++;
                    result.results.push({
                        name: bd.item.name,
                        status: 'updated',
                        fileName: existingFile,
                    });
                } else {
                    // create（含 onExisting=create 强制新建，或无索引）
                    const fileName = createCharacter(
                        bd.item.name,
                        charactersDir,
                        bd.v3Data,
                        bd.avatarBuffer,
                    );
                    if (ugirlId) idIndex.set(ugirlId, fileName);
                    result.created++;
                    result.success++;
                    result.results.push({
                        name: bd.item.name,
                        status: 'created',
                        fileName,
                    });
                }

                if (bd.globalIdx % 50 === 0 || bd.globalIdx === items.length - 1) {
                    const last = result.results[result.results.length - 1];
                    logger.info(
                        `[${bd.globalIdx + 1}/${items.length}] ${bd.item.name} -> ${last.fileName} (${last.status})` +
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

    logger.info(
        `导入完成: 成功 ${result.success} (新建 ${result.created} / 更新 ${result.updated} / 跳过 ${result.skipped}) / 失败 ${result.failed}`,
    );
    return result;
}
