/**
 * 统一错误类型层次结构
 * 替代旧代码中散落的 throw new Error()
 */

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, detail?: string) {
        super(404, 'NOT_FOUND', detail ? `${resource}: ${detail}` : `${resource} not found`);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string) {
        super(400, 'BAD_REQUEST', message);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(401, 'UNAUTHORIZED', message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(403, 'FORBIDDEN', message);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, 'CONFLICT', message);
    }
}

export class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests') {
        super(429, 'TOO_MANY_REQUESTS', message);
    }
}
