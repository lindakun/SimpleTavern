export enum ScreenId {
  WELCOME = 'welcome',                         // 欢迎登录 - 换色头像 - 柚姬AI
  EMAIL_LOGIN = 'email_login',                 // 邮箱登录 - 柚姬AI
  REGISTER = 'register',                       // 注册账号 - 柚姬AI
  DISCOVER = 'discover',                       // 角色发现 - 柚姬AI
  CHARACTER_DETAIL = 'character_detail',       // 角色详情 - 增加创作者与评价 - 柚姬AI
  CHAT = 'chat',                               // 对话 - 柚姬AI
  CREATE_CHOICE = 'create_choice',             // 创建方式选择 - 柚姬AI
  CREATE_CHARACTER = 'create_character',       // 创建角色 - 增加世界书 - 柚姬AI
  MESSAGE_CENTER = 'message_center',           // 消息中心 - 霓虹幻彩版 - 柚姬AI
  PROFILE = 'profile',                         // 个人中心 - 动态添加收藏 - 柚姬AI
  MY_CHARACTERS = 'my_characters',             // 我的角色 - 柚姬AI
  MY_FAVORITES = 'my_favorites',               // 我的收藏 - 柚姬AI
  SETTINGS = 'settings',                       // 设置 - 柚姬AI
  HELP_FEEDBACK = 'help_feedback',             // 帮助与反馈 - 柚姬AI
  FORGOT_PASSWORD = 'forgot_password',           // 忘记密码 - 柚姬AI
  RESET_PASSWORD = 'reset_password',             // 重置密码 - 柚姬AI
}

export interface RouteState {
  screen: ScreenId;
  characterId?: string;
  source?: ScreenId;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  avatarColor?: string;
  creator: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  status?: 'online' | 'offline' | 'draft' | 'private';
  lastActiveLabel?: string;
  reviews?: Review[];

  // V3 角色卡 data 字段
  description: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_version?: string;
  extensions?: Record<string, unknown>;

  // 兼容旧字段
  tagline?: string;
  worldBook?: string;
  voiceType?: 'sweet' | 'mature';

  // 世界书名称（用于详情页展示）
  worldBookName?: string;

  // 图片导出时的原始文件名
  avatar_url?: string;
}

export interface Review {
  id: string;
  username: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface ChatThread {
  characterId: string;
  characterName?: string;
  lastMessageText?: string;
  lastActive?: string;
  messageCount?: number;
  unreadCount: number;
  messages: ChatMessage[];
  updatedAt?: string;
  pinned?: boolean;
}

export interface AppState {
  currentScreen: ScreenId;
  navigationHistory: ScreenId[];
  user: {
    email: string;
    username: string;
    isLoggedIn?: boolean;
    avatar?: string;
  } | null;
  characters: Character[];
  selectedCharacterId: string;
  chatThreads: Record<string, ChatThread>; // characterId -> Thread
  favoriteIds: string[]; // Dynamically added favorites
  isLoading: boolean;
}

/** 聊天消息发送状态 */
export type SendState = 'idle' | 'sending' | 'streaming' | 'error';

/** 每个角色的发送状态 */
export interface CharacterSendState {
  state: SendState;
}
