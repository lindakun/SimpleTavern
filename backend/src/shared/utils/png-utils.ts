/**
 * PNG 工具函数
 *
 * 提供 PNG 角色卡创建和名称处理功能
 */

import { Buffer } from 'node:buffer';
import { deflate } from 'node:zlib';
import { promisify } from 'node:util';
import sanitize from 'sanitize-filename';

const deflateAsync = promisify(deflate);

/**
 * 创建最小的有效 PNG 文件（1x1 透明像素）- 同步版本
 */
export function createMinimalPngSync(): Buffer {
    // 1x1 透明 PNG
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(1, 0);  // width
    ihdrData.writeUInt32BE(1, 4);  // height
    ihdrData[8] = 8;               // bit depth
    ihdrData[9] = 6;               // color type (RGBA)
    ihdrData[10] = 0;              // compression
    ihdrData[11] = 0;              // filter
    ihdrData[12] = 0;              // interlace

    const rawData = Buffer.alloc(4); // RGBA: 0,0,0,0 (transparent)
    const compressed = require('node:zlib').deflateSync(rawData);

    const ihdr = createPngChunk('IHDR', ihdrData);
    const idat = createPngChunk('IDAT', compressed);
    const iend = createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG signature
        ihdr,
        idat,
        iend,
    ]);
}

/**
 * 创建最小的有效 PNG 文件（1x1 透明像素）- 异步版本
 */
export async function createMinimalPng(): Promise<Buffer> {
    // 1x1 透明 PNG
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(1, 0);  // width
    ihdrData.writeUInt32BE(1, 4);  // height
    ihdrData[8] = 8;               // bit depth
    ihdrData[9] = 6;               // color type (RGBA)
    ihdrData[10] = 0;              // compression
    ihdrData[11] = 0;              // filter
    ihdrData[12] = 0;              // interlace

    const rawData = Buffer.alloc(4); // RGBA: 0,0,0,0 (transparent)
    const compressed = await deflateAsync(rawData);

    const ihdr = createPngChunk('IHDR', ihdrData);
    const idat = createPngChunk('IDAT', compressed);
    const iend = createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG signature
        ihdr,
        idat,
        iend,
    ]);
}

/**
 * 创建 PNG 数据块
 */
export function createPngChunk(name: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const type = Buffer.from(name, 'ascii');
    const typeAndData = Buffer.concat([type, data]);

    const crcData = Buffer.concat([type, data]);
    const crcValue = crc32(crcData);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crcValue >>> 0, 0);

    return Buffer.concat([length, typeAndData, crc]);
}

/**
 * 计算 CRC32（简化版）
 */
function crc32(data: Buffer): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * 安全的文件名处理
 */
export function sanitizeFileName(name: string): string {
    return sanitize(name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

/**
 * 获取安全的 PNG 文件名
 */
export function getSafePngName(name: string, charactersDir: string): string {
    const safeName = sanitizeFileName(name);
    return `${safeName}.png`;
}

/**
 * 获取 PNG 文件名（带目录）
 */
export function getPngName(name: string, charactersDir: string): string {
    const safeName = sanitizeFileName(name);
    return `${charactersDir}/${safeName}.png`;
}
