/**
 * Session 类型定义
 *
 * 用于替代 `req.session as Record<string, any>`，提供类型安全的 Session 访问
 */

export interface AuthSession {
  /** 用户唯一标识 */
  handle?: string | null;
  /** CSRF 令牌 */
  csrfToken?: string | null;
  /** Session 版本号 */
  version?: string | null;
  /** 最后访问时间戳 */
  touch?: number;
  /** 是否为管理员 */
  admin?: boolean | null;
}
