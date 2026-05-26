import 'dotenv/config';
import { parseCommandLineArgs } from './config/env.js';
import { loadConfig, getConfig } from './config/index.js';
import { logger } from './common/logger.js';
import { createApp } from './app.js';
import { initUserStorage } from './modules/users/users.repository.js';

async function main() {
    try {
        // 1. 解析 CLI 和配置
        const cliArgs = parseCommandLineArgs();
        loadConfig(cliArgs);
        const config = getConfig();

        logger.info(`数据目录: ${config.dataRoot}`);

        // 2. 初始化用户存储
        await initUserStorage(config.dataRoot);

        // 3. 创建 Express 应用
        const app = createApp(config);

        // 4. 启动服务器
        const server = app.listen(config.port, config.host, () => {
            logger.info(`SimpleTavern 服务器已启动: http://${config.host}:${config.port}`);
            logger.info(`原项目在 http://localhost:8000（提示：前端的 API base URL 指向此地址）`);
        });

        // 优雅关闭
        const shutdown = async () => {
            logger.info('正在关闭服务器...');
            server.close(() => {
                logger.info('服务器已关闭');
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (err) {
        logger.error('启动失败:', err);
        process.exit(1);
    }
}

main();
