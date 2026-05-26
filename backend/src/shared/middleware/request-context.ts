import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestUser } from '../../types/models.types.js';

export interface RequestContext {
    dataRoot: string;
    user?: RequestUser;
    sessionHandle?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
    const ctx = requestContext.getStore();
    if (!ctx) {
        throw new Error('No request context available');
    }
    return ctx;
}
