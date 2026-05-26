import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { crc32 } from 'crc';
import _ from 'lodash';
import {
    listCharacterFiles,
    readCharacterData,
    writeCharacterData,
    deleteCharacterFile,
    getCharacterFilePath,
    getCharacterChatDir,
} from './characters.repository.js';
import { createDefaultCharacterData, validateCharacterData } from './characters.validator.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';

/**
 * 生成角色的 PNG 文件名（去重）
 */
export function getPngName(name: string, charactersDir: string): string {
    const safeName = sanitizeFileName(name);
    let fileName = `${safeName}.png`;
    if (!fs.existsSync(path.join(charactersDir, fileName))) {
        return fileName;
    }
    let counter = 1;
    while (fs.existsSync(path.join(charactersDir, `${safeName}_${counter}.png`))) {
        counter++;
    }
    return `${safeName}_${counter}.png`;
}

function sanitizeFileName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9_一-鿿\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 128) || 'character';
}

/**
 * 转换角色为 V2 格式（兼容 V1/V2/V3）
 */
function toV2(char: Record<string, unknown>): Record<string, unknown> {
    // V2/V3: 透传原始数据，从 data 补齐顶层字段
    if (typeof char.spec === 'string' && char.spec.startsWith('chara_card_')) {
        const charData = char.data as Record<string, unknown> | undefined;
        const name = String(charData?.name || char.name || '');
        if (!char.name) char.name = name;
        if (!char.description) char.description = String(charData?.description || '');
        if (!char.personality) char.personality = String(charData?.personality || '');
        if (!char.scenario) char.scenario = String(charData?.scenario || '');
        if (!char.first_mes) char.first_mes = String(charData?.first_mes || '');
        if (!char.mes_example) char.mes_example = String(charData?.mes_example || '');
        if (!char.avatar) char.avatar = 'none';
        if (!char.create_date) char.create_date = new Date().toISOString();
        if (char.talkativeness === undefined) char.talkativeness = charData ? (charData as any)?.extensions?.talkativeness ?? 0.5 : 0.5;
        if (char.fav === undefined) char.fav = false;
        if (!char.tags) {
            const dataTags = charData?.tags;
            char.tags = Array.isArray(dataTags) ? dataTags : [];
        }
        if (!char.creatorcomment) char.creatorcomment = String(charData?.creator_notes || '');
        return char;
    }

    // V1 → V2 转换
    const v1Name = String(char.name || '');
    const defaults = createDefaultCharacterData(v1Name);
    const v2 = _.cloneDeep(defaults);
    v2.name = v1Name;
    v2.description = String(char.description || '');
    v2.personality = String(char.personality || '');
    v2.scenario = String(char.scenario || '');
    v2.first_mes = String(char.first_mes || '');
    v2.mes_example = String(char.mes_example || '');
    if (v2.data) {
        const d = v2.data as Record<string, unknown>;
        d.name = v1Name;
        d.description = String(char.description || '');
        d.personality = String(char.personality || '');
        d.scenario = String(char.scenario || '');
        d.first_mes = String(char.first_mes || '');
        d.mes_example = String(char.mes_example || '');
    }
    return v2;
}

/**
 * 计算聊天数据大小
 */
function calculateChatSize(charDir: string): { chatSize: number; dateLastChat: number } {
    let chatSize = 0;
    let dateLastChat = 0;
    if (fs.existsSync(charDir)) {
        const chats = fs.readdirSync(charDir);
        for (const chat of chats) {
            const chatStat = fs.statSync(path.join(charDir, chat));
            chatSize += chatStat.size;
            dateLastChat = Math.max(dateLastChat, chatStat.mtimeMs);
        }
    }
    return { chatSize, dateLastChat };
}

/**
 * 处理单个角色数据
 */
export function processCharacter(
    fileName: string,
    charactersDir: string,
    chatsDir: string,
    shallow: boolean,
): Record<string, unknown> | null {
    const filePath = path.join(charactersDir, fileName);
    const imgData = readCharacterData(filePath);
    if (!imgData) return null;

    let jsonObject: Record<string, unknown>;
    try {
        jsonObject = JSON.parse(imgData);
    } catch {
        return null;
    }

    const character = toV2(jsonObject);
    character.avatar = fileName;
    character.json_data = imgData;

    const stat = fs.statSync(filePath);
    character.date_added = stat.ctimeMs;
    character.create_date = (character.create_date as string) || new Date(Math.round(stat.ctimeMs)).toISOString();

    const chatDir = getCharacterChatDir(chatsDir, fileName);
    const { chatSize, dateLastChat } = calculateChatSize(chatDir);
    character.chat_size = chatSize;
    character.date_last_chat = dateLastChat;
    character.data_size = calculateDataSize(character.data);

    if (shallow) {
        return toShallow(character);
    }

    return character;
}

function toShallow(character: Record<string, unknown>): Record<string, unknown> {
    return {
        shallow: true,
        name: character.name,
        avatar: character.avatar,
        chat: character.chat,
        fav: character.fav,
        date_added: character.date_added,
        create_date: character.create_date,
        date_last_chat: character.date_last_chat,
        chat_size: character.chat_size,
        data_size: character.data_size,
        tags: character.tags,
        data: {
            name: _.get(character, 'data.name', ''),
            character_version: _.get(character, 'data.character_version', ''),
            creator: _.get(character, 'data.creator', ''),
            creator_notes: _.get(character, 'data.creator_notes', ''),
            tags: _.get(character, 'data.tags', []),
            extensions: {
                fav: _.get(character, 'data.extensions.fav', false),
                world: _.get(character, 'data.extensions.world', ''),
            },
        },
    };
}

function calculateDataSize(data: unknown): number {
    if (typeof data !== 'object' || !data) return 0;
    return Object.values(data as Record<string, unknown>)
        .reduce((acc: number, val) => acc + String(val).length, 0);
}

/**
 * 获取所有角色列表
 */
export function getAllCharacters(
    charactersDir: string,
    chatsDir: string,
    shallow = false,
): Record<string, unknown>[] {
    const files = listCharacterFiles(charactersDir);
    return files
        .map(f => processCharacter(f, charactersDir, chatsDir, shallow))
        .filter((c): c is Record<string, unknown> => c !== null);
}

/**
 * 获取单个角色
 */
export function getCharacter(
    fileName: string,
    charactersDir: string,
    chatsDir: string,
): Record<string, unknown> {
    const filePath = getCharacterFilePath(charactersDir, fileName);
    if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Character', fileName);
    }
    const result = processCharacter(fileName, charactersDir, chatsDir, false);
    if (!result) {
        throw new NotFoundError('Character', fileName);
    }
    return result;
}

/**
 * 生成最小有效的 1x1 PNG 图像
 */
function createMinimalPng(): Buffer {
    // PNG 签名
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    // IHDR 块: 1x1, 8-bit RGB
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(1, 0);   // width
    ihdrData.writeUInt32BE(1, 4);   // height
    ihdrData[8] = 8;                // bit depth
    ihdrData[9] = 2;                // color type (RGB)
    ihdrData[10] = 0;               // compression
    ihdrData[11] = 0;               // filter
    ihdrData[12] = 0;               // interlace
    const ihdr = createPngChunk('IHDR', ihdrData);

    // IDAT 块: 最小压缩数据
    // 扫描线: filter byte(0) + RGB(0,0,0)
    const rawScanline = Buffer.from([0, 0, 0, 0]);
    const compressed = zlib.deflateSync(rawScanline);
    const idat = createPngChunk('IDAT', compressed);

    // IEND 块
    const iend = createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createPngChunk(name: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const type = Buffer.from(name, 'ascii');
    const crcInput = Buffer.concat([type, data]);
    const crcVal = crc32(crcInput);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0);
    return Buffer.concat([len, type, data, crcBuf]);
}

/**
 * 创建新角色
 */
export function createCharacter(
    name: string,
    charactersDir: string,
    data?: Record<string, unknown>,
    imageBuffer?: Buffer,
): string {
    const charData = data || createDefaultCharacterData(name) as Record<string, unknown>;
    const validation = validateCharacterData(charData);
    if (!validation.valid) {
        throw new BadRequestError(validation.errors.join('; '));
    }

    // 确保目录存在
    if (!fs.existsSync(charactersDir)) {
        fs.mkdirSync(charactersDir, { recursive: true });
    }

    const fileName = getPngName(name, charactersDir);
    const filePath = path.join(charactersDir, fileName);
    const jsonStr = JSON.stringify(charData);

    // 使用传入的图像或生成最小 PNG
    const imgBuffer = imageBuffer || createMinimalPng();

    const success = writeCharacterData(filePath, jsonStr, imgBuffer);
    if (!success) {
        throw new Error('Failed to create character');
    }
    return fileName;
}

/**
 * 编辑角色（替换角色卡数据）
 */
export function editCharacter(
    fileName: string,
    charactersDir: string,
    data: Record<string, unknown>,
): boolean {
    const filePath = getCharacterFilePath(charactersDir, fileName);
    if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Character', fileName);
    }
    return writeCharacterData(filePath, JSON.stringify(data));
}

/**
 * 删除角色
 */
export function removeCharacter(fileName: string, charactersDir: string): boolean {
    const filePath = getCharacterFilePath(charactersDir, fileName);
    return deleteCharacterFile(filePath);
}

/**
 * 重命名角色
 */
export function renameCharacter(
    oldFileName: string,
    newName: string,
    charactersDir: string,
    chatsDir: string,
): string {
    const oldPath = getCharacterFilePath(charactersDir, oldFileName);
    if (!fs.existsSync(oldPath)) {
        throw new NotFoundError('Character', oldFileName);
    }

    // 读取现有数据并更新名称
    const imgData = readCharacterData(oldPath);
    if (!imgData) {
        throw new Error('Failed to read character data');
    }

    let jsonObject: Record<string, unknown>;
    try {
        jsonObject = JSON.parse(imgData);
    } catch {
        throw new Error('Invalid character data');
    }

    jsonObject.name = newName;
    _.set(jsonObject, 'data.name', newName);

    const newFileName = getPngName(newName, charactersDir);
    const newPath = path.join(charactersDir, newFileName);

    // 写入新文件
    const imgBuffer = fs.readFileSync(oldPath);
    writeCharacterData(newPath, JSON.stringify(jsonObject), imgBuffer);

    // 删除旧文件
    fs.unlinkSync(oldPath);

    // 重命名聊天目录
    const oldChatDir = getCharacterChatDir(chatsDir, oldFileName);
    const newChatDir = getCharacterChatDir(chatsDir, newFileName);
    if (fs.existsSync(oldChatDir) && !fs.existsSync(newChatDir)) {
        fs.renameSync(oldChatDir, newChatDir);
    }

    return newFileName;
}
