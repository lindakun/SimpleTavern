/**
 * 统一的 Multer 配置
 *
 * 提供单文件和多文件上传的标准化配置
 */

import multer from 'multer';
import path from 'node:path';
import { getConfig } from '../../config/index.js';
import { BadRequestError } from '../../common/errors.js';

// 允许的文件类型
const ALLOWED_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/json',
];

// 文件大小限制：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 创建单文件上传中间件
 *
 * @param options 上传选项
 * @returns Multer 中间件
 */
export function createSingleUpload(options?: {
    /** 字段名，默认 'file' */
    fieldName?: string;
    /** 文件大小限制（字节），默认 10MB */
    maxSize?: number;
    /** 是否启用文件类型验证，默认 true */
    validateType?: boolean;
}) {
    const {
        fieldName = 'file',
        maxSize = MAX_FILE_SIZE,
        validateType = true,
    } = options ?? {};

    const config = getConfig();
    const uploadDir = path.join(config.dataRoot, 'uploads');

    const storage = multer.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
    });

    return multer({
        storage,
        limits: { fileSize: maxSize },
        fileFilter: validateType
            ? (_req, file, cb) => {
                if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new BadRequestError(`不支持的文件类型: ${file.mimetype}。允许的类型: ${ALLOWED_MIME_TYPES.join(', ')}`));
                }
            }
            : undefined,
    }).single(fieldName);
}

/**
 * 创建多文件上传中间件
 *
 * @param options 上传选项
 * @returns Multer 中间件
 */
export function createMultiUpload(options?: {
    /** 字段名，默认 'files' */
    fieldName?: string;
    /** 最大文件数，默认 10 */
    maxCount?: number;
    /** 文件大小限制（字节），默认 10MB */
    maxSize?: number;
    /** 是否启用文件类型验证，默认 true */
    validateType?: boolean;
}) {
    const {
        fieldName = 'files',
        maxCount = 10,
        maxSize = MAX_FILE_SIZE,
        validateType = true,
    } = options ?? {};

    const config = getConfig();
    const uploadDir = path.join(config.dataRoot, 'uploads');

    const storage = multer.diskStorage({
        destination: (_req, _file, cb) => {
            cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
    });

    return multer({
        storage,
        limits: { fileSize: maxSize, files: maxCount },
        fileFilter: validateType
            ? (_req, file, cb) => {
                if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new BadRequestError(`不支持的文件类型: ${file.mimetype}。允许的类型: ${ALLOWED_MIME_TYPES.join(', ')}`));
                }
            }
            : undefined,
    }).array(fieldName, maxCount);
}

/**
 * 内存存储的单文件上传（用于小文件处理）
 *
 * @param options 上传选项
 * @returns Multer 中间件
 */
export function createMemoryUpload(options?: {
    /** 字段名，默认 'file' */
    fieldName?: string;
    /** 文件大小限制（字节），默认 5MB */
    maxSize?: number;
}) {
    const {
        fieldName = 'file',
        maxSize = 5 * 1024 * 1024,
    } = options ?? {};

    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSize },
    }).single(fieldName);
}
