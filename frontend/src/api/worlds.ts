/**
 * 世界书相关 API
 */

import { useApiClient } from './client';

// ── 世界书条目 ──

export interface WorldEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: number;
  addMemo: boolean;
  order: number;
  position: number;
  disable: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: number;
  probability: number;
  useProbability: boolean;
  depth: number;
  outletName: string;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: number;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
}

export function createEmptyEntry(uid: number): WorldEntry {
  return {
    uid,
    key: [],
    keysecondary: [],
    comment: '',
    content: '',
    constant: false,
    vectorized: false,
    selective: false,
    selectiveLogic: 0,
    addMemo: false,
    order: 100,
    position: 0,
    disable: false,
    ignoreBudget: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: 0,
    probability: 100,
    useProbability: true,
    depth: 4,
    outletName: '',
    group: '',
    groupOverride: false,
    groupWeight: 100,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: 0,
    sticky: null,
    cooldown: null,
    delay: null,
  };
}

// ── 世界书数据 ──

export interface WorldBookData {
  name?: string;
  entries: Record<string, WorldEntry>;
  extensions?: Record<string, unknown>;
}

// ── 列表项 ──

export interface WorldListItem {
  file_id: string;
  name: string;
  entriesCount: number;
  extensions?: Record<string, unknown>;
}

export interface WorldDetail {
  file_id: string;
  name: string;
  entriesCount: number;
  promptText: string;
}

// ── API hooks ──

export function useWorldApi() {
  const { post, request } = useApiClient();

  return {
    /** 用户端 - 列出所有世界书 */
    listWorlds: () => post<WorldListItem[]>('/api/worlds/list'),

    /** 用户端 - 获取世界书详情 */
    getWorld: (fileId: string) =>
      post<WorldDetail>('/api/worlds/get', { file_id: fileId }),

    /** 管理员 - 列出所有世界书（含更多字段） */
    adminListWorlds: () => post<WorldListItem[]>('/api/worlds/admin-list'),

    /** 管理员 - 获取世界书完整内容 */
    adminGetWorld: (name: string) =>
      post<WorldBookData>('/api/worlds/admin-get', { name }),

    /** 管理员 - 保存世界书 */
    adminSaveWorld: (name: string, data: WorldBookData) =>
      post<{ ok: boolean }>('/api/worlds/admin-save', { name, data }),

    /** 管理员 - 删除世界书 */
    adminDeleteWorld: (name: string) =>
      post<{ ok: boolean }>('/api/worlds/admin-delete', { name }),

    /** 管理员 - 导入世界书（上传 .json 文件，使用 API 客户端） */
    adminImportWorld: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // 使用 API 客户端的 request 方法以保持一致的错误处理和认证
      return request<{ ok: boolean; name: string }>('/api/worlds/admin-import', {
        method: 'POST',
        body: formData,
        // 不设置 Content-Type，让浏览器自动设置 multipart/form-data boundary
      });
    },
  };
}
