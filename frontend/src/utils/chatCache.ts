/**
 * IndexedDB 离线聊天缓存
 *
 * 用于离线时查看历史聊天记录，在线时后台同步更新缓存。
 * 使用 idb 库（IndexedDB wrapper）封装。
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { ChatMessage } from '../types';

const DB_NAME = 'simpletavern-cache';
const DB_VERSION = 1;

interface ChatCacheSchema {
  messages: {
    key: string; // characterId
    value: {
      characterId: string;
      messages: ChatMessage[];
      updatedAt: number;
    };
  };
  threads: {
    key: string; // characterId
    value: {
      characterId: string;
      characterName: string;
      lastMessageText: string;
      lastActive: string;
      messageCount: number;
      pinned: boolean;
      updatedAt: number;
    };
  };
}

let dbInstance: IDBPDatabase<ChatCacheSchema> | null = null;

async function getDb(): Promise<IDBPDatabase<ChatCacheSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ChatCacheSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'characterId' });
      }
      if (!db.objectStoreNames.contains('threads')) {
        db.createObjectStore('threads', { keyPath: 'characterId' });
      }
    },
  });

  return dbInstance;
}

// ─── Messages Cache ───

/** 保存角色聊天消息到缓存 */
export async function cacheMessages(
  characterId: string,
  messages: ChatMessage[],
): Promise<void> {
  try {
    const db = await getDb();
    await db.put('messages', {
      characterId,
      messages,
      updatedAt: Date.now(),
    });
  } catch {
    // 静默失败，不影响主流程
  }
}

/** 从缓存读取角色聊天消息 */
export async function getCachedMessages(
  characterId: string,
): Promise<ChatMessage[]> {
  try {
    const db = await getDb();
    const entry = await db.get('messages', characterId);
    return entry?.messages || [];
  } catch {
    return [];
  }
}

/** 删除角色的聊天缓存 */
export async function removeCachedMessages(characterId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('messages', characterId);
  } catch {
    // 静默
  }
}

// ─── Threads Cache ───

/** 缓存聊天线程列表 */
export async function cacheThreads(
  threads: Array<{
    characterId: string;
    characterName: string;
    lastMessageText?: string;
    lastActive?: string;
    messageCount?: number;
    pinned?: boolean;
  }>,
): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction('threads', 'readwrite');
    const now = Date.now();
    await Promise.all(
      threads.map((t) =>
        tx.store.put({
          characterId: t.characterId,
          characterName: t.characterName,
          lastMessageText: t.lastMessageText || '',
          lastActive: t.lastActive || '',
          messageCount: t.messageCount || 0,
          pinned: t.pinned || false,
          updatedAt: now,
        }),
      ),
    );
    await tx.done;
  } catch {
    // 静默
  }
}

/** 获取缓存的线程列表 */
export async function getCachedThreads(): Promise<
  ChatCacheSchema['threads']['value'][]
> {
  try {
    const db = await getDb();
    return await db.getAll('threads');
  } catch {
    return [];
  }
}

/** 获取单个线程缓存 */
export async function getCachedThread(
  characterId: string,
): Promise<ChatCacheSchema['threads']['value'] | undefined> {
  try {
    const db = await getDb();
    return await db.get('threads', characterId);
  } catch {
    return undefined;
  }
}

/** 删除线程缓存 */
export async function removeCachedThread(characterId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('threads', characterId);
  } catch {
    // 静默
  }
}

/** 清空所有缓存 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear('messages');
    await db.clear('threads');
  } catch {
    // 静默
  }
}
