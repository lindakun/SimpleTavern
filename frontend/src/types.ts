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
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  avatarColor?: string; // Hex color for color cycling/changing avatar
  tagline: string;
  creator: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  description: string;
  worldBook?: string; // 世界书 (detailed settings, background lore, speaking rules)
  voiceType?: 'sweet' | 'mature'; // 甜美少女 vs 成熟御姐
  status?: 'online' | 'offline' | 'draft' | 'private';
  lastActiveLabel?: string;
  reviews?: Review[];
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
  lastMessageText?: string;
  unreadCount: number;
  messages: ChatMessage[];
  updatedAt?: string;
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
