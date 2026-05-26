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
