/**
 * 聊天日期格式化工具
 *
 * 兼容 ISO 8601 和 SillyTavern 格式（"2024-05-30 @13h 45m 12s 123ms"）
 * 智能展示：今天→时间 / 昨天→"昨天" / 一周内→星期 / 今年→月-日 / 其他→完整日期
 */

/** 尝试将各种日期字符串解析为 Date 对象 */
export function parseChatDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // 直接解析（ISO 8601 / Unix timestamp）
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  // SillyTavern 格式: "YYYY-MM-DD @HHh MMm SSs MSms"
  const stMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s/);
  if (stMatch) {
    const [, d, hours, mins, secs] = stMatch;
    const iso = `${d}T${hours.padStart(2, '0')}:${mins.padStart(2, '0')}:${secs.padStart(2, '0')}`;
    const stParsed = new Date(iso);
    if (!isNaN(stParsed.getTime())) return stParsed;
  }

  return null;
}

/** 格式化聊天日期：今天显示时间，昨天显示"昨天"，今年显示月-日，其他显示完整日期 */
export function formatChatDate(dateStr: string): string {
  const date = parseChatDate(dateStr);
  if (!date) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today.getTime() - dateDay.getTime()) / 86400000;

  if (diffDays === 0) {
    // 今天：显示时间
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekDays[date.getDay()];
  } else if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}-${date.getDate()}`;
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
