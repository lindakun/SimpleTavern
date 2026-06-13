#!/usr/bin/env tsx
/**
 * 数据库迁移脚本
 *
 * 用于数据格式变更时的迁移操作
 * 使用方式：npx tsx scripts/migrate.ts [--dry-run] [--version <version>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../src/common/logger.js';

interface Migration {
    version: string;
    description: string;
    up: () => Promise<void>;
    down?: () => Promise<void>;
}

// 迁移注册表
const migrations: Migration[] = [
    {
        version: '1.0.0',
        description: '初始版本：创建默认用户目录结构',
        up: async () => {
            const dataRoot = process.env.SIMPLE_TAVERN_DATA_ROOT || './data';
            const defaultUserDir = path.join(dataRoot, 'default-user');
            const charactersDir = path.join(defaultUserDir, 'characters');
            const chatsDir = path.join(defaultUserDir, 'chats');

            // 创建默认用户目录
            if (!fs.existsSync(defaultUserDir)) {
                fs.mkdirSync(defaultUserDir, { recursive: true });
                logger.info(`创建默认用户目录: ${defaultUserDir}`);
            }

            // 创建角色目录
            if (!fs.existsSync(charactersDir)) {
                fs.mkdirSync(charactersDir, { recursive: true });
                logger.info(`创建角色目录: ${charactersDir}`);
            }

            // 创建聊天目录
            if (!fs.existsSync(chatsDir)) {
                fs.mkdirSync(chatsDir, { recursive: true });
                logger.info(`创建聊天目录: ${chatsDir}`);
            }
        },
    },
    {
        version: '1.1.0',
        description: '添加世界书目录',
        up: async () => {
            const dataRoot = process.env.SIMPLE_TAVERN_DATA_ROOT || './data';
            const worldsDir = path.join(dataRoot, 'worlds');

            if (!fs.existsSync(worldsDir)) {
                fs.mkdirSync(worldsDir, {recursive: true });
                logger.info(`创建世界书目录: ${worldsDir}`);
            }
        },
    },
    {
        version: '1.2.0',
        description: '添加评价目录',
        up: async () => {
            const dataRoot = process.env.SIMPLE_TAVERN_DATA_ROOT || './data';
            const reviewsDir = path.join(dataRoot, 'reviews');

            if (!fs.existsSync(reviewsDir)) {
                fs.mkdirSync(reviewsDir, { recursive: true });
                logger.info(`创建评价目录: ${reviewsDir}`);

                // 创建初始评价文件
                const seedReviewsPath = path.join(reviewsDir, 'seed-reviews.json');
                const importedReviewsPath = path.join(reviewsDir, 'imported-reviews.json');
                const pngReviewsPath = path.join(reviewsDir, 'png-reviews.json');

                if (!fs.existsSync(seedReviewsPath)) {
                    fs.writeFileSync(seedReviewsPath, '{}', 'utf-8');
                    logger.info(`创建种子角色评价文件: ${seedReviewsPath}`);
                }

                if (!fs.existsSync(importedReviewsPath)) {
                    fs.writeFileSync(importedReviewsPath, '{}', 'utf-8');
                    logger.info(`创建导入角色评价文件: ${importedReviewsPath}`);
                }

                if (!fs.existsSync(pngReviewsPath)) {
                    fs.writeFileSync(pngReviewsPath, '{}', 'utf-8');
                    logger.info(`创建 PNG 角色评价文件: ${pngReviewsPath}`);
                }
            }
        },
    },
    {
        version: '1.3.0',
        description: '添加上传目录',
        up: async () => {
            const dataRoot = process.env.SIMPLE_TAVERN_DATA_ROOT || './data';
            const uploadsDir = path.join(dataRoot, 'uploads');

            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
                logger.info(`创建上传目录: ${uploadsDir}`);
            }
        },
    },
];

/**
 * 获取已执行的迁移版本
 */
function getExecutedMigrations(): string[] {
    const dataRoot = process.env.SIMPLE_TAVERN_DATA_ROOT || './data';
    const migrationFile = path.join(dataRoot, '.migration.json');

    if (!fs.existsSync(migrationFile)) {
        return [];
    }

    try {
        const content = fs.readFileSync(migrationFile, 'utf-8');
        const data = JSON.parse(content);
        return data.executed || [];
    } catch {
        return [];
    }
}

/**
 * 记录已执行的迁移
 */
function recordMigration(version: string): void {
    const dataRoot = process.env.SIMPLE_TAVERN_DATA_ROOT || './data';
    const migrationFile = path.join(dataRoot, '.migration.json');

    const executed = getExecutedMigrations();
    if (!executed.includes(version)) {
        executed.push(version);
        fs.writeFileSync(migrationFile, JSON.stringify({ executed }, null, 2), 'utf-8');
        logger.info(`记录迁移版本: ${version}`);
    }
}

/**
 * 执行迁移
 */
async function runMigrations(dryRun: boolean, targetVersion?: string): Promise<void> {
    logger.info('开始执行数据库迁移...');
    if (dryRun) {
        logger.info('【试运行模式】不会实际执行迁移');
    }

    const executed = getExecutedMigrations();
    const pendingMigrations = migrations.filter(m => !executed.includes(m.version));

    if (pendingMigrations.length === 0) {
        logger.info('没有待执行的迁移');
        return;
    }

    logger.info(`发现 ${pendingMigrations.length} 个待执行迁移`);

    for (const migration of pendingMigrations) {
        if (targetVersion && migration.version > targetVersion) {
            break;
        }

        logger.info(`执行迁移 ${migration.version}: ${migration.description}`);

        if (!dryRun) {
            try {
                await migration.up();
                recordMigration(migration.version);
                logger.info(`迁移 ${migration.version} 完成`);
            } catch (err) {
                logger.error(`迁移 ${migration.version} 失败:`, err);
                throw err;
            }
        }
    }

    logger.info('数据库迁移完成');
}

/**
 * 显示迁移状态
 */
function showStatus(): void {
    const executed = getExecutedMigrations();

    console.log('\n=== 迁移状态 ===');
    console.log(`已执行: ${executed.length} 个`);
    console.log(`待执行: ${migrations.length - executed.length} 个`);
    console.log('\n所有迁移:');

    for (const migration of migrations) {
        const status = executed.includes(migration.version) ? '✅' : '⏳';
        console.log(`  ${status} ${migration.version}: ${migration.description}`);
    }
}

// 主函数
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const statusMode = args.includes('--status');
    const versionIndex = args.indexOf('--version');
    const targetVersion = versionIndex !== -1 ? args[versionIndex + 1] : undefined;

    if (statusMode) {
        showStatus();
        return;
    }

    await runMigrations(dryRun, targetVersion);
}

main().catch(err => {
    logger.error('迁移脚本执行失败:', err);
    process.exit(1);
});
