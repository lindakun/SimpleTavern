# 日志配置

## 概述

SimpleTavern 后端使用自定义日志系统，支持四个日志级别：`debug`、`info`、`warn`、`error`。

## 配置方式

### 环境变量

通过 `LOG_LEVEL` 环境变量设置日志级别：

```bash
# 开发环境 - 查看所有日志
LOG_LEVEL=debug npm run dev

# 生产环境 - 只查看警告和错误
LOG_LEVEL=warn npm run start

# 默认级别（未设置时）
# 默认为 'info'
```

### 日志级别

| 级别 | 数值 | 说明 | 输出内容 |
|------|------|------|----------|
| `debug` | 0 | 调试信息 | 所有日志 |
| `info` | 1 | 一般信息 | info、warn、error |
| `warn` | 2 | 警告信息 | warn、error |
| `error` | 3 | 错误信息 | 只输出 error |

级别具有累加性：设置 `warn` 级别会同时输出 `warn` 和 `error` 级别的日志。

## 日志格式

每条日志包含以下信息：

```
[ISO8601时间戳] [级别] 消息内容
```

示例：
```
[2026-06-13T04:47:14.870Z] [INFO] 服务器启动成功
[2026-06-13T04:47:15.123Z] [WARN] 配置文件不存在，使用默认配置
[2026-06-13T04:47:16.456Z] [ERROR] 数据库连接失败
```

## 颜色输出

不同级别的日志使用不同的颜色（使用 chalk）：

- **debug**: 灰色 (gray)
- **info**: 青色 (cyan)
- **warn**: 黄色 (yellow)
- **error**: 红色 (red)

## 无效级别处理

如果设置了无效的日志级别，系统会：

1. 输出警告信息：`[Logger] 无效的日志级别 "invalid"，回退到 "info"`
2. 自动回退到 `info` 级别

## 使用方法

```typescript
import { logger } from '../common/logger.js';

// 不同级别的日志
logger.debug('调试信息', variable);
logger.info('一般信息');
logger.warn('警告信息');
logger.error('错误信息', error);

// 获取当前日志级别
const level = logger.getLevel();

// 检查某个级别是否启用
if (logger.isDebugEnabled('debug')) {
    logger.debug('详细的调试信息');
}
```

## 最佳实践

1. **开发环境**: 使用 `debug` 级别查看所有信息
2. **生产环境**: 使用 `warn` 或 `error` 级别减少日志量
3. **性能敏感代码**: 使用 `isEnabled()` 检查级别，避免不必要的字符串拼接
4. **错误处理**: 总是使用 `logger.error()` 记录错误，包含 Error 对象

## 测试

运行日志测试：

```bash
npm test -- src/__tests__/logger.test.ts
```

测试覆盖：
- 各级别日志输出
- 日志级别过滤
- 无效级别回退
- 日志格式验证
- Error 对象处理
