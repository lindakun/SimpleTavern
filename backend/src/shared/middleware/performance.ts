/**
 * 性能监控中间件
 *
 * 监控 API 响应时间、内存使用情况等性能指标
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../common/logger.js';

interface PerformanceMetrics {
    /** 请求开始时间 */
    startTime: number;
    /** 请求路径 */
    path: string;
    /** 请求方法 */
    method: string;
}

// 性能指标存储（简单实现，生产环境可使用 Redis 或数据库）
const metrics: {
    totalRequests: number;
    totalResponseTime: number;
    slowRequests: Array<{ path: string; method: string; duration: number; timestamp: number }>;
    statusCodes: Record<number, number>;
} = {
    totalRequests: 0,
    totalResponseTime: 0,
    slowRequests: [],
    statusCodes: {},
};

// 慢请求阈值（毫秒）
const SLOW_REQUEST_THRESHOLD = 1000;

/**
 * 性能监控中间件
 * 记录请求响应时间、状态码统计
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // 响应完成时记录性能指标
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const { method, path } = req;
        const statusCode = res.statusCode;

        // 更新统计
        metrics.totalRequests++;
        metrics.totalResponseTime += duration;
        metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;

        // 记录慢请求
        if (duration > SLOW_REQUEST_THRESHOLD) {
            metrics.slowRequests.push({
                path,
                method,
                duration,
                timestamp: Date.now(),
            });

            // 只保留最近 100 条慢请求
            if (metrics.slowRequests.length > 100) {
                metrics.slowRequests.shift();
            }

            logger.warn(`慢请求: ${method} ${path} ${duration}ms`);
        }
    });

    next();
}

/**
 * 获取性能指标
 */
export function getMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequestCount: number;
    statusCodes: Record<number, number>;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
    };
} {
    const avgResponseTime = metrics.totalRequests > 0
        ? Math.round(metrics.totalResponseTime / metrics.totalRequests)
        : 0;

    const memUsage = process.memoryUsage();

    return {
        totalRequests: metrics.totalRequests,
        averageResponseTime: avgResponseTime,
        slowRequestCount: metrics.slowRequests.length,
        statusCodes: { ...metrics.statusCodes },
        memoryUsage: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024), // MB
        },
    };
}

/**
 * 获取最近的慢请求
 */
export function getSlowRequests(limit = 10): Array<{
    path: string;
    method: string;
    duration: number;
    timestamp: number;
}> {
    return metrics.slowRequests.slice(-limit);
}

/**
 * 重置性能指标（用于测试）
 */
export function resetMetrics(): void {
    metrics.totalRequests = 0;
    metrics.totalResponseTime = 0;
    metrics.slowRequests = [];
    metrics.statusCodes = {};
}
