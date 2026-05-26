import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import extract from 'png-chunks-extract';
import PNGtext from 'png-chunk-text';
import { crc32 } from 'crc';

/**
 * 从 PNG 图像中读取角色卡元数据
 * 支持 V2 (chara) 和 V3 (ccv3) 格式，V3 优先
 */
export function readCharacterCard(image: Buffer): string {
    const chunks = extract(new Uint8Array(image));
    const textChunks = chunks
        .filter((c: { name: string }) => c.name === 'tEXt')
        .map((c: { name: string; data: Uint8Array }) => PNGtext.decode(c.data));

    if (textChunks.length === 0) {
        throw new Error('No PNG metadata.');
    }

    const ccv3 = textChunks.find((t: { keyword: string }) => t.keyword.toLowerCase() === 'ccv3');
    if (ccv3) {
        return Buffer.from(ccv3.text, 'base64').toString('utf8');
    }

    const chara = textChunks.find((t: { keyword: string }) => t.keyword.toLowerCase() === 'chara');
    if (chara) {
        return Buffer.from(chara.text, 'base64').toString('utf8');
    }

    throw new Error('No PNG metadata.');
}

/**
 * 将角色卡数据写入 PNG 图像缓冲区
 * 移除旧的 chara/ccv3 块，添加新的 chara 和 ccv3 块
 */
export function writeCharacterCard(image: Buffer, data: string): Buffer {
    const chunks = extract(new Uint8Array(image));
    const textChunks = chunks.filter((c: { name: string }) => c.name === 'tEXt');

    // 移除旧的 chara/ccv3 块
    for (const chunk of textChunks) {
        const decoded = PNGtext.decode(chunk.data);
        if (decoded.keyword.toLowerCase() === 'chara' || decoded.keyword.toLowerCase() === 'ccv3') {
            const idx = chunks.indexOf(chunk);
            if (idx !== -1) chunks.splice(idx, 1);
        }
    }

    // 添加新的 chara 块（V2）
    const base64Data = Buffer.from(data, 'utf8').toString('base64');
    chunks.splice(-1, 0, PNGtext.encode('chara', base64Data));

    // 添加新的 ccv3 块（V3）
    try {
        const v3Data = JSON.parse(data);
        v3Data.spec = 'chara_card_v3';
        v3Data.spec_version = '3.0';
        const v3Base64 = Buffer.from(JSON.stringify(v3Data), 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('ccv3', v3Base64));
    } catch {
        // 忽略 V3 块添加失败
    }

    return Buffer.from(encodePng(chunks));
}

/**
 * 从文件读取角色卡
 */
export function readCharacterCardFromFile(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return readCharacterCard(buffer);
}

/**
 * 将角色卡写入文件
 */
export function writeCharacterCardToFile(filePath: string, data: string, imageBuffer?: Buffer): void {
    const image = imageBuffer || fs.readFileSync(filePath);
    const output = writeCharacterCard(image, data);
    fs.writeFileSync(filePath, output);
}

/**
 * 编码 PNG 块为 PNG 文件格式
 */
function encodePng(chunks: Array<{ name: string; data: Uint8Array }>): Uint8Array {
    const uint8 = new Uint8Array(4);
    const int32 = new Int32Array(uint8.buffer);
    const uint32 = new Uint32Array(uint8.buffer);

    let totalSize = 8;
    let idx = totalSize;

    for (let i = 0; i < chunks.length; i++) {
        totalSize += chunks[i].data.length;
        totalSize += 12;
    }

    const output = new Uint8Array(totalSize);

    // PNG 签名
    output[0] = 0x89; output[1] = 0x50; output[2] = 0x4E; output[3] = 0x47;
    output[4] = 0x0D; output[5] = 0x0A; output[6] = 0x1A; output[7] = 0x0A;

    for (let i = 0; i < chunks.length; i++) {
        const { name, data } = chunks[i];
        const size = data.length;
        const nameChars = [
            name.charCodeAt(0), name.charCodeAt(1),
            name.charCodeAt(2), name.charCodeAt(3),
        ];

        uint32[0] = size;
        output[idx++] = uint8[3]; output[idx++] = uint8[2];
        output[idx++] = uint8[1]; output[idx++] = uint8[0];

        output[idx++] = nameChars[0]; output[idx++] = nameChars[1];
        output[idx++] = nameChars[2]; output[idx++] = nameChars[3];

        for (let j = 0; j < size;) output[idx++] = data[j++];

        const crc = crc32(Buffer.from(data), crc32(Buffer.from(nameChars)));
        int32[0] = crc;
        output[idx++] = uint8[3]; output[idx++] = uint8[2];
        output[idx++] = uint8[1]; output[idx++] = uint8[0];
    }

    return output;
}
