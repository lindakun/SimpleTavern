/**
 * 数据埋点工具
 *
 * 功能：
 * - 页面浏览追踪（ScreenId 变化时上报）
 * - 关键事件追踪（发送消息、收藏、搜索、登录等）
 * - Web Vitals 指标采集与上报
 *
 * 设计：轻量级，不依赖第三方服务。事件先暂存，批量发送到后端 /api/analytics/events
 * 失败时静默丢弃，不影响主流程。
 */

import type { ScreenId } from '../types';

// ─── 类型定义 ───

export type AnalyticsEventType =
  | 'page_view'
  | 'send_message'
  | 'toggle_favorite'
  | 'search'
  | 'login'
  | 'register'
  | 'logout'
  | 'create_character'
  | 'start_chat'
  | 'view_character_detail'
  | 'submit_review'
  | 'copy_character'
  | 'web_vital';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  screen: ScreenId | null;
  properties?: Record<string, unknown>;
}

export interface WebVitalMetric {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// ─── 内部状态 ───

const eventQueue: AnalyticsEvent[] = [];
let currentScreen: ScreenId | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_QUEUE_SIZE = 50;
const FLUSH_INTERVAL = 10_000; // 10s 批量发送
const MAX_RETRIES = 2;

// 是否启用埋点（可通过设置控制）
let enabled = true;

// ─── 核心 API ───

/** 初始化埋点（在主入口调用） */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  enabled = true;
  // 页面关闭前发送所有待发送事件
  window.addEventListener('beforeunload', flush);
  window.addEventListener('pagehide', flush);
  if (import.meta.env.PROD) {
    initWebVitals();
  }
}

/** 启用/禁用埋点 */
export function setAnalyticsEnabled(on: boolean): void {
  enabled = on;
}

/** 追踪页面浏览 */
export function trackPageView(screen: ScreenId): void {
  currentScreen = screen;
  track('page_view', { screen_id: screen });
}

/** 追踪自定义事件 */
export function track(
  type: AnalyticsEventType,
  properties?: Record<string, unknown>,
): void {
  if (!enabled) return;

  const event: AnalyticsEvent = {
    type,
    timestamp: Date.now(),
    screen: currentScreen as ScreenId | null,
    properties,
  };

  eventQueue.push(event);

  // 队列超过上限时立即发送
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flush();
  } else if (!flushTimer) {
    // 启动延迟发送
    flushTimer = setTimeout(flush, FLUSH_INTERVAL);
  }
}

/** 立即发送所有待发送事件 */
export function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0);
  sendBatch(batch, 0);
}

// ─── 内部实现 ───

function sendBatch(batch: AnalyticsEvent[], retryCount: number): void {
  if (batch.length === 0) return;

  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
    keepalive: true, // 页面卸载时也能发送
  }).catch(() => {
    if (retryCount < MAX_RETRIES) {
      // 重试
      setTimeout(() => sendBatch(batch, retryCount + 1), 2000 * (retryCount + 1));
    }
    // 超过重试次数，静默丢弃
  });
}

// ─── Web Vitals ───

function initWebVitals(): void {
  // 动态导入 web-vitals，仅在 PROD 环境使用
  import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
    const reportVital = (metric: WebVitalMetric) => {
      track('web_vital', {
        metric_name: metric.name,
        metric_value: Math.round(metric.value),
        metric_rating: metric.rating,
      });
    };

    onLCP((m: { value: number; rating: string }) =>
      reportVital({ name: 'LCP', value: m.value, rating: m.rating as WebVitalMetric['rating'] }));
    onINP((m: { value: number; rating: string }) =>
      reportVital({ name: 'INP', value: m.value, rating: m.rating as WebVitalMetric['rating'] }));
    onCLS((m: { value: number; rating: string }) =>
      reportVital({ name: 'CLS', value: m.value, rating: m.rating as WebVitalMetric['rating'] }));
    onFCP((m: { value: number; rating: string }) =>
      reportVital({ name: 'FCP', value: m.value, rating: m.rating as WebVitalMetric['rating'] }));
    onTTFB((m: { value: number; rating: string }) =>
      reportVital({ name: 'TTFB', value: m.value, rating: m.rating as WebVitalMetric['rating'] }));
  }).catch(() => {
    // web-vitals 加载失败不影响主流程
  });
}
