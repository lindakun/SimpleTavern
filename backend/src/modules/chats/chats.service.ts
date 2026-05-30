import path from 'node:path';
import fs from 'node:fs';
import * as chatRepo from './chats.repository.js';
import { ChatInfo } from './chats.types.js';
import { NotFoundError } from '../../common/errors.js';

/**
 * 获取聊天信息
 */
export function getChatInfo(
    chatsDir: string,
    characterFileName: string,
    chatFileName: string,
): ChatInfo {
    const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterFileName);
    const filePath = chatRepo.getChatFilePath(chatsDir, characterFileName.replace('.png', ''), chatFileName);

    if (!chatRepo.isPathUnderParent(chatDir, filePath)) {
        throw new Error('Invalid chat file path');
    }

    if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Chat', chatFileName);
    }

    const parsed = path.parse(filePath);
    const stats = fs.statSync(filePath);
    const chatData = chatRepo.readChatFile(filePath);

    const lastMessage = chatData.length > 1 ? chatData[chatData.length - 1] : null;

    return {
        file_id: parsed.name,
        file_name: parsed.base,
        file_size: stats.size,
        chat_items: Math.max(0, chatData.length - 1),
        mes: lastMessage?.mes || '[The chat is empty]',
        last_mes: lastMessage?.send_date || stats.mtimeMs,
    };
}

/**
 * 获取聊天数据（完整消息列表）
 */
export function getChatData(
    chatsDir: string,
    characterFileName: string,
    chatFileName: string,
): any[] {
    const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterFileName);
    const filePath = chatRepo.getChatFilePath(chatsDir, characterFileName.replace('.png', ''), chatFileName);

    if (!chatRepo.isPathUnderParent(chatDir, filePath)) {
        throw new Error('Invalid chat file path');
    }

    return chatRepo.readChatFile(filePath);
}

/**
 * 保存聊天数据
 */
export function saveChat(
    chatsDir: string,
    characterFileName: string,
    chatFileName: string,
    chatData: any[],
): void {
    const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterFileName);
    const filePath = chatRepo.getChatFilePath(chatsDir, characterFileName.replace('.png', ''), chatFileName);

    if (!chatRepo.isPathUnderParent(chatDir, filePath)) {
        throw new Error('Invalid chat file path');
    }

    if (!fs.existsSync(chatDir)) {
        fs.mkdirSync(chatDir, { recursive: true });
    }

    chatRepo.writeChatFile(filePath, chatData);
}

/**
 * 列出角色的所有聊天
 */
export function listCharacterChats(
    chatsDir: string,
    characterFileName: string,
): ChatInfo[] {
    const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterFileName);

    if (!fs.existsSync(chatDir)) {
        return [];
    }

    const files = chatRepo.listChatFiles(chatDir);
    return files.map(file => {
        try {
            return getChatInfo(chatsDir, characterFileName, file);
        } catch {
            return null;
        }
    }).filter((c): c is ChatInfo => c !== null);
}

/**
 * 重命名聊天
 */
export function renameChat(
    chatsDir: string,
    characterFileName: string,
    oldFileName: string,
    newFileName: string,
): void {
    const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterFileName);
    const oldPath = chatRepo.getChatFilePath(chatsDir, characterFileName.replace('.png', ''), oldFileName);
    const newPath = chatRepo.getChatFilePath(chatsDir, characterFileName.replace('.png', ''), newFileName);

    if (!chatRepo.isPathUnderParent(chatDir, oldPath) || !chatRepo.isPathUnderParent(chatDir, newPath)) {
        throw new Error('Invalid chat file path');
    }

    if (!fs.existsSync(oldPath)) {
        throw new NotFoundError('Chat', oldFileName);
    }

    fs.renameSync(oldPath, newPath);
}

/**
 * 删除聊天
 */
export function deleteChat(
    chatsDir: string,
    characterFileName: string,
    chatFileName: string,
): void {
    const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterFileName);
    const filePath = chatRepo.getChatFilePath(chatsDir, characterFileName.replace('.png', ''), chatFileName);

    if (!chatRepo.isPathUnderParent(chatDir, filePath)) {
        throw new Error('Invalid chat file path');
    }

    chatRepo.deleteChatFile(filePath);
}

/**
 * 批量删除聊天（按角色 ID 列表）
 * 每个角色 ID 对应一个聊天目录，删除整个目录
 */
export function batchDeleteChats(
    chatsDir: string,
    characterIds: string[],
): number {
    let deletedCount = 0;
    for (const characterId of characterIds) {
        const chatDir = chatRepo.getCharacterChatDir(chatsDir, characterId);
        if (!chatRepo.isPathUnderParent(chatsDir, chatDir)) continue;
        if (!fs.existsSync(chatDir)) continue;

        const files = chatRepo.listChatFiles(chatDir);
        const filePaths = files.map(f => path.join(chatDir, f));
        const deleted = chatRepo.batchDeleteChatFiles(filePaths);
        deletedCount += deleted;

        // 删除空目录
        try {
            const remaining = fs.readdirSync(chatDir);
            if (remaining.length === 0) {
                fs.rmdirSync(chatDir);
            }
        } catch {
            // 忽略删除空目录失败
        }
    }

    // 从置顶列表中也清除
    const pinned = chatRepo.readPinnedList(chatsDir);
    const pinnedSet = new Set(pinned);
    let pinnedChanged = false;
    for (const id of characterIds) {
        if (pinnedSet.has(id)) {
            pinnedSet.delete(id);
            pinnedChanged = true;
        }
    }
    if (pinnedChanged) {
        chatRepo.writePinnedList(chatsDir, Array.from(pinnedSet));
    }

    return deletedCount;
}

/**
 * 切换聊天置顶状态
 */
export function togglePinChat(
    chatsDir: string,
    characterId: string,
    pinned: boolean,
): boolean {
    const pinnedList = chatRepo.readPinnedList(chatsDir);
    const pinnedSet = new Set(pinnedList);

    if (pinned) {
        if (pinnedSet.has(characterId)) return true; // 已置顶
        pinnedSet.add(characterId);
    } else {
        if (!pinnedSet.has(characterId)) return false; // 未置顶
        pinnedSet.delete(characterId);
    }

    chatRepo.writePinnedList(chatsDir, Array.from(pinnedSet));
    return pinned;
}

/**
 * 获取置顶列表
 */
export function getPinnedList(chatsDir: string): string[] {
    return chatRepo.readPinnedList(chatsDir);
}
