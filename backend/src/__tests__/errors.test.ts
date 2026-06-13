/**
 * 错误层次结构单元测试
 */

import { describe, it, expect } from 'vitest';
import {
    AppError,
    NotFoundError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    TooManyRequestsError,
} from '../common/errors.js';

describe('AppError 层次结构', () => {
    it('应该正确创建 AppError', () => {
        const error = new AppError(500, 'INTERNAL_ERROR', '服务器内部错误');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.message).toBe('服务器内部错误');
        expect(error.name).toBe('AppError');
        expect(error instanceof Error).toBe(true);
    });

    it('应该正确创建 NotFoundError', () => {
        const error = new NotFoundError('User');
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('User not found');
        expect(error instanceof AppError).toBe(true);
    });

    it('应该正确创建 NotFoundError（带详情）', () => {
        const error = new NotFoundError('User', 'ID 123');
        expect(error.message).toBe('User: ID 123');
    });

    it('应该正确创建 BadRequestError', () => {
        const error = new BadRequestError('缺少必填字段');
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('BAD_REQUEST');
        expect(error.message).toBe('缺少必填字段');
    });

    it('应该正确创建 UnauthorizedError', () => {
        const error = new UnauthorizedError();
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.message).toBe('Unauthorized');
    });

    it('应该正确创建 UnauthorizedError（自定义消息）', () => {
        const error = new UnauthorizedError('请先登录');
        expect(error.message).toBe('请先登录');
    });

    it('应该正确创建 ForbiddenError', () => {
        const error = new ForbiddenError();
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe('FORBIDDEN');
        expect(error.message).toBe('Forbidden');
    });

    it('应该正确创建 ConflictError', () => {
        const error = new ConflictError('用户名已存在');
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT');
        expect(error.message).toBe('用户名已存在');
    });

    it('应该正确创建 TooManyRequestsError', () => {
        const error = new TooManyRequestsError();
        expect(error.statusCode).toBe(429);
        expect(error.code).toBe('TOO_MANY_REQUESTS');
        expect(error.message).toBe('Too many requests');
    });
});
