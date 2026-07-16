/**
 * 管理员面板类型定义
 */

// 用户视图模型（对应后端 UserViewModel）
export interface UserViewModel {
  handle: string;
  name: string;
  created: number;
  avatar: string;
  admin: boolean;
  password: boolean;
  enabled?: boolean;
}

// 创建用户请求
export interface CreateUserRequest {
  handle: string;
  name?: string;
  password?: string;
  admin?: boolean;
}

// 用户操作请求
export interface UserActionRequest {
  handle: string;
  purge?: boolean;
}

// 仪表盘统计（对齐 GET /api/admin/stats）
export interface AdminStats {
  users: {
    total: number;
    enabled: number;
    admins: number;
    createdLast7d: number;
  };
  characters: {
    seed: number;
    publishedPublic: number;
    publishedPrivate: number;
    filePng: number;
  };
  chats: {
    fileCount: number;
  };
  system: {
    version: string;
    dataRoot: string;
    uptimeSec: number;
  };
}

/** @deprecated 使用 AdminStats */
export interface DashboardStats {
  totalUsers: number;
  adminCount: number;
  enabledCount: number;
  totalCharacters: number;
  totalChats: number;
}

export type AdminCharacterSource = 'seed' | 'published' | 'file';

export interface AdminReviewItem {
  id: string;
  username: string;
  rating: number;
  comment: string;
  date: string;
  store: 'seed' | 'imported' | 'png' | 'published';
  characterKey: string;
}

export interface AdminCharacterDetailResponse {
  character: AdminCharacterItem;
  reviews: AdminReviewItem[];
  readonly: boolean;
}

export interface AdminLlmProvider {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  active: boolean;
  isLocal: boolean;
  configured: boolean;
  apiKeyLast4: string | null;
}

export interface AdminLlmListResponse {
  providers: AdminLlmProvider[];
  activeId: string | null;
}

export interface AdminLlmTestResult {
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
}

// 管理员世界书数据
export interface AdminWorldItem {
  file_id: string;
  name: string;
  entriesCount: number;
  extensions: Record<string, unknown>;
}

// 世界书条目
export interface WorldInfoEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  content: string;
  comment: string;
  constant: boolean;
  selective: boolean;
  order: number;
  position: number;
  disable: boolean;
  probability: number;
  group: string;
  [key: string]: unknown;
}

// 世界书完整数据
export interface WorldInfoData {
  name?: string;
  entries: Record<string, WorldInfoEntry>;
  extensions?: Record<string, unknown>;
}

// ugirl 批量导入结果
export interface UgirlImportResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    name: string;
    status: 'success' | 'failed';
    fileName?: string;
    error?: string;
  }>;
}

// 管理员角色数据（来自后端 admin-all 接口）
export interface AdminCharacterItem {
  _owner: string;
  _fileName: string;
  _source: string;
  id?: string;
  name: string;
  tags: string[];
  description: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  avatar: string;
  privacyType?: 'public' | 'private';
  date_added?: number;
  data_size?: number;
  chat_size?: number;
  shallow?: boolean;
  [key: string]: unknown;
}
