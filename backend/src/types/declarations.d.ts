// ============================================================================
// Session 类型扩展
// ============================================================================

import type { AuthSession } from './session.types.js';
import type { File } from 'multer';

declare global {
    namespace Express {
        interface Request {
            /** 类型安全的 Session 对象 */
            session: AuthSession | null;
            /** Multer 单文件上传 */
            file?: File;
            /** Multer 多文件上传 */
            files?: { [fieldname: string]: File[] } | File[];
        }
    }
}
