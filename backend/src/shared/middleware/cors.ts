import corsLib from 'cors';
import { getConfig } from '../../config/index.js';

export function createCorsMiddleware() {
    const config = getConfig();
    if (!config.corsEnabled) {
        return (_req: any, _res: any, next: any) => next();
    }
    return corsLib({
        origin: true,
        credentials: true,
    });
}
