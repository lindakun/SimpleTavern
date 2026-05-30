import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { crc32 } from 'crc';
import sanitize from 'sanitize-filename';
import { readCharacterCardFromFile, writeCharacterCardToFile } from './characters.parser.js';
import { createDefaultCharacterData } from './characters.validator.js';
import { getPngName } from './characters.service.js';
import { logger } from '../../common/logger.js';
import { getConfig } from '../../config/index.js';

/**
 * 生成最小 1x1 PNG 图像（用于无头像的 JSON 导入）
 */
function createMinimalPng(): Buffer {
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(1, 0);
    ihdrData.writeUInt32BE(1, 4);
    ihdrData[8] = 8; ihdrData[9] = 2; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
    const ihdr = createPngChunk('IHDR', ihdrData);
    const rawScanline = Buffer.from([0, 0, 0, 0]);
    const compressed = zlib.deflateSync(rawScanline);
    const idat = createPngChunk('IDAT', compressed);
    const iend = createPngChunk('IEND', Buffer.alloc(0));
    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createPngChunk(name: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const type = Buffer.from(name, 'ascii');
    const crcVal = crc32(Buffer.concat([type, data]));
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crcVal >>> 0);
    return Buffer.concat([len, type, data, crcBuf]);
}

function getBaseImage(charactersDir: string): Buffer {
    const defaultAvatarPath = path.join(charactersDir, '..', '..', '..', 'img', 'default-user.png');
    if (fs.existsSync(defaultAvatarPath)) return fs.readFileSync(defaultAvatarPath);
    return createMinimalPng();
}

/**
 * 生成角色 PNG 文件名（兼容原 SillyTavern 的去重逻辑）
 */
function getSafePngName(name: string, charactersDir: string): string {
    const safeName = sanitize(name, { replacement: '_' });
    let fileName = `${safeName}.png`;
    if (!fs.existsSync(path.join(charactersDir, fileName))) return fileName;

    let counter = 1;
    while (fs.existsSync(path.join(charactersDir, `${safeName}_${counter}.png`))) counter++;
    return `${safeName}_${counter}.png`;
}

/**
 * 导入 PNG 角色卡 — 兼容 V2/V1 格式
 */
async function importFromPng(uploadPath: string, charactersDir: string): Promise<string> {
    const imgData = readCharacterCardFromFile(uploadPath);
    if (!imgData) throw new Error('Failed to read character data');

    const jsonData = JSON.parse(imgData);
    const name = sanitize(jsonData.data?.name || jsonData.name || 'imported', { replacement: '_' });
    const pngName = getSafePngName(name, charactersDir);
    const destPath = path.join(charactersDir, pngName);

    // V2/V3 格式：直接拷贝（兼容 chara_card_v2/v3）
    if (typeof jsonData.spec === 'string' && jsonData.spec.startsWith('chara_card_')) {
        // 清除私有字段（chat 等）
        delete jsonData.chat;
        delete jsonData.json_data;
        const jsonStr = JSON.stringify(jsonData);
        writeCharacterCardToFile(destPath, jsonStr, fs.readFileSync(uploadPath));
        fs.unlinkSync(uploadPath);
        const specVer = jsonData.spec === 'chara_card_v3' ? 'V3' : 'V2';
        logger.info(`导入 ${specVer} 角色卡: ${name}`);
        return pngName;
    }

    // V1 格式：转换为 V2
    if (jsonData.name) {
        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", '');
        }

        const char = convertV1toV3({
            name: jsonData.name,
            description: jsonData.description ?? '',
            personality: jsonData.personality ?? '',
            first_mes: jsonData.first_mes ?? '',
            mes_example: jsonData.mes_example ?? '',
            scenario: jsonData.scenario ?? '',
            creator_notes: jsonData.creator_notes ?? jsonData.creatorcomment ?? '',
            system_prompt: jsonData.system_prompt ?? '',
            post_history_instructions: jsonData.post_history_instructions ?? '',
            alternate_greetings: jsonData.alternate_greetings ?? [],
            talkativeness: jsonData.talkativeness ?? 0.5,
            creator: jsonData.creator ?? '',
            tags: jsonData.tags ?? '',
            fav: jsonData.fav ?? false,
            world: jsonData.world ?? '',
            character_version: jsonData.character_version ?? '',
        });

        const jsonStr = JSON.stringify(char);
        // 使用默认头像作为基图
        const baseImage = getBaseImage(charactersDir);
        writeCharacterCardToFile(destPath, jsonStr, baseImage);
        fs.unlinkSync(uploadPath);
        logger.info(`导入 V1 角色卡(已转V3): ${name}`);
        return pngName;
    }

    // Pygmalion/gradio 格式
    if (jsonData.char_name) {
        const name2 = sanitize(jsonData.char_name, { replacement: '_' });
        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", '');
        }

        const char = convertV1toV3({
            name: name2,
            description: jsonData.char_persona ?? '',
            personality: '',
            first_mes: jsonData.char_greeting ?? '',
            mes_example: jsonData.example_dialogue ?? '',
            scenario: jsonData.world_scenario ?? '',
            creator_notes: jsonData.creator_notes ?? '',
            talkativeness: 0.5,
        });

        const pngName2 = getSafePngName(name2, charactersDir);
        const destPath2 = path.join(charactersDir, pngName2);
        const jsonStr = JSON.stringify(char);
        writeCharacterCardToFile(destPath2, jsonStr, fs.readFileSync(uploadPath));
        fs.unlinkSync(uploadPath);
        logger.info(`导入 Pygmalion 格式(已转V3): ${name2}`);
        return pngName2;
    }

    throw new Error('Unrecognized character format');
}

/**
 * 导入 JSON 角色 — 兼容 V2 Spec / V1 / Pygmalion
 */
async function importFromJson(uploadPath: string, charactersDir: string): Promise<string> {
    const data = fs.readFileSync(uploadPath, 'utf8');
    fs.unlinkSync(uploadPath);

    const jsonData = JSON.parse(data);

    // V2/V3 Spec JSON（兼容 chara_card_v2/v3 及未来版本）
    if (typeof jsonData.spec === 'string' && jsonData.spec.startsWith('chara_card_')) {
        const name = sanitize(jsonData.data?.name || jsonData.name || 'imported', { replacement: '_' });
        const pngName = getSafePngName(name, charactersDir);
        const destPath = path.join(charactersDir, pngName);

        delete jsonData.chat;
        delete jsonData.json_data;

        writeCharacterCardToFile(destPath, JSON.stringify(jsonData), getBaseImage(charactersDir));
        return pngName;
    }

    // V1 JSON
    if (jsonData.name) {
        const name = sanitize(jsonData.name, { replacement: '_' });
        const pngName = getSafePngName(name, charactersDir);
        const destPath = path.join(charactersDir, pngName);

        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", '');
        }

        const char = convertV1toV3({
            name: jsonData.name,
            description: jsonData.description ?? '',
            personality: jsonData.personality ?? '',
            first_mes: jsonData.first_mes ?? '',
            mes_example: jsonData.mes_example ?? '',
            scenario: jsonData.scenario ?? '',
            creator_notes: jsonData.creator_notes ?? jsonData.creatorcomment ?? '',
            system_prompt: jsonData.system_prompt ?? '',
            post_history_instructions: jsonData.post_history_instructions ?? '',
            alternate_greetings: jsonData.alternate_greetings ?? [],
            talkativeness: jsonData.talkativeness ?? 0.5,
            creator: jsonData.creator ?? '',
            tags: jsonData.tags ?? '',
            character_version: jsonData.character_version ?? '',
        });

        writeCharacterCardToFile(destPath, JSON.stringify(char), getBaseImage(charactersDir));
        return pngName;
    }

    // Pygmalion/gradio JSON
    if (jsonData.char_name) {
        const name = sanitize(jsonData.char_name, { replacement: '_' });
        const pngName = getSafePngName(name, charactersDir);
        const destPath = path.join(charactersDir, pngName);

        if (jsonData.creator_notes) {
            jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", '');
        }

        const char = convertV1toV3({
            name: jsonData.char_name,
            description: jsonData.char_persona ?? '',
            personality: '',
            first_mes: jsonData.char_greeting ?? '',
            mes_example: jsonData.example_dialogue ?? '',
            scenario: jsonData.world_scenario ?? '',
            creator_notes: jsonData.creator_notes ?? '',
            talkativeness: 0.5,
        });

        writeCharacterCardToFile(destPath, JSON.stringify(char), getBaseImage(charactersDir));
        return pngName;
    }

    throw new Error('Unrecognized JSON format');
}

/**
 * V1 → V3 格式转换
 */
function convertV1toV3(data: {
    name: string;
    description: string;
    personality: string;
    first_mes: string;
    mes_example: string;
    scenario: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    talkativeness?: number;
    creator?: string;
    tags?: string;
    fav?: boolean;
    world?: string;
    character_version?: string;
    depth_prompt_prompt?: string;
    depth_prompt_depth?: number;
    depth_prompt_role?: string;
}): Record<string, unknown> {
    const tags = typeof data.tags === 'string'
        ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : (Array.isArray(data.tags) ? data.tags : []);

    return {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        name: data.name,
        description: data.description || '',
        personality: data.personality || '',
        scenario: data.scenario || '',
        first_mes: data.first_mes || '',
        mes_example: data.mes_example || '',
        creatorcomment: data.creator_notes || '',
        avatar: 'none',
        chat: `${data.name} - ${new Date().toLocaleString('zh-CN')}`,
        talkativeness: data.talkativeness ?? 0.5,
        fav: data.fav === true,
        tags,
        create_date: new Date().toISOString(),
        data: {
            name: data.name,
            description: data.description || '',
            personality: data.personality || '',
            scenario: data.scenario || '',
            first_mes: data.first_mes || '',
            mes_example: data.mes_example || '',
            creator_notes: data.creator_notes || '',
            system_prompt: data.system_prompt || '',
            post_history_instructions: data.post_history_instructions || '',
            tags,
            creator: data.creator || '',
            character_version: data.character_version || '1.0',
            alternate_greetings: data.alternate_greetings || [],
            extensions: {
                talkativeness: data.talkativeness ?? 0.5,
                fav: data.fav === true,
                world: typeof data.world === 'string' ? data.world : '',
                depth_prompt: {
                    prompt: data.depth_prompt_prompt || '',
                    depth: data.depth_prompt_depth ?? 4,
                    role: data.depth_prompt_role || 'system',
                },
            },
        },
    };
}

/**
 * 统一入口 — 根据文件扩展名选择导入方式
 */
export async function importCharacterFile(
    uploadPath: string,
    originalName: string,
    charactersDir: string,
): Promise<string> {
    const ext = path.extname(originalName).toLowerCase();

    switch (ext) {
        case '.png':
            return importFromPng(uploadPath, charactersDir);
        case '.json':
            return importFromJson(uploadPath, charactersDir);
        default:
            fs.unlinkSync(uploadPath);
            throw new Error(`Unsupported file format: ${ext}（仅支持 .png 和 .json）`);
    }
}
