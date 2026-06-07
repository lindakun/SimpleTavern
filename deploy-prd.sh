#!/bin/bash
# SimpleTavern 生产环境部署脚本
# 用法: ./deploy-prd.sh [--skip-build] [--no-rollback]
#
# 功能:
#   - 自动备份数据目录
#   - 保存环境变量配置
#   - 自动递增 SW 缓存版本号（BUILD_VERSION）
#   - 从 GitHub 拉取最新代码
#   - 重建并启动 Docker 容器
#   - 多端点健康检查 + 重试
#   - 部署后日志检查（nginx 503 error flood）
#   - 失败时提供回滚指引

set -e

REPO_URL="https://github.com/lindakun/SimpleTavern.git"
DEPLOY_DIR="/opt/simpletavern"
BACKUP_DIR="/opt/simpletavern-backup-$(date +%Y%m%d-%H%M%S)"
TIMESTAMP=$(date +%s)
SKIP_BUILD=false
NO_ROLLBACK=false
SW_FILE="frontend/public/sw.js"

# 解析参数
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --no-rollback) NO_ROLLBACK=true ;;
  esac
done

echo "=== SimpleTavern 生产部署 ==="
echo "日期: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ─── 0. 前置检查 ───
echo "[0/8] 前置环境检查..."
for cmd in git docker curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ 缺少命令: $cmd"
    exit 1
  fi
done
echo "✅ 环境正常"
echo ""

# ─── 1. 备份现有数据 ───
echo "[1/8] 备份现有数据..."
if [ -d "$DEPLOY_DIR/data" ]; then
    sudo mkdir -p "$BACKUP_DIR"
    sudo cp -r "$DEPLOY_DIR/data" "$BACKUP_DIR/"
    echo "  数据已备份到: $BACKUP_DIR"
fi

# ─── 2. 保存环境变量 ───
echo "[2/8] 保存环境变量配置..."
if [ -f "$DEPLOY_DIR/backend/.env" ]; then
    sudo cp "$DEPLOY_DIR/backend/.env" /tmp/backend-env-backup
    echo "  backend/.env 已保存"
fi
if [ -f "$DEPLOY_DIR/frontend/.env" ]; then
    sudo cp "$DEPLOY_DIR/frontend/.env" /tmp/frontend-env-backup
    echo "  frontend/.env 已保存"
fi

# ─── 3. 获取最新代码 ───
echo "[3/8] 获取最新代码..."
if [ ! -d "$DEPLOY_DIR/.git" ]; then
    # 首次部署：克隆仓库
    sudo rm -rf "$DEPLOY_DIR"
    sudo git clone "$REPO_URL" "$DEPLOY_DIR"
    sudo chown -R ubuntu:ubuntu "$DEPLOY_DIR"
    echo "  首次部署，已克隆仓库"
else
    cd "$DEPLOY_DIR"
    sudo git fetch origin
    # 使用当前所在分支，而非硬编码 origin/main
    CURRENT_BRANCH=$(sudo git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" = "HEAD" ]; then
      # detached HEAD 状态，使用远程默认分支
      RESET_TARGET="origin/main"
    else
      # 追踪远程同名分支
      RESET_TARGET="origin/${CURRENT_BRANCH}"
    fi
    PREV_HASH=$(sudo git rev-parse HEAD)
    sudo git reset --hard "$RESET_TARGET"
    NEW_HASH=$(sudo git rev-parse HEAD)
    echo "  $PREV_HASH → $NEW_HASH"
    if [ "$PREV_HASH" = "$NEW_HASH" ] && [ "$SKIP_BUILD" = false ]; then
        echo "  ⚠️  代码无变更，但将继续部署（确保配置最新）"
    fi
fi

# ─── 4. 自动递增 SW 缓存版本号 ───
echo "[4/8] 更新 Service Worker 缓存版本..."
SW_PATH="$DEPLOY_DIR/$SW_FILE"
if [ -f "$SW_PATH" ]; then
    # 获取当前版本号（格式：YYYY-MM-DD-N）
    CURRENT_VER=$(sudo grep "BUILD_VERSION = '" "$SW_PATH" | sed "s/.*'\(.*\)'/\1/")
    # 生成新版本号：基于当前日期 + 自增序号
    DATE_PART=$(date +%Y-%m-%d)
    if [[ "$CURRENT_VER" == "$DATE_PART-"* ]]; then
        # 同一天：递增序号
        SEQ=$(echo "$CURRENT_VER" | sed "s/.*-//")
        NEW_SEQ=$((SEQ + 1))
    else
        # 新的一天：从 1 开始
        NEW_SEQ=1
    fi
    NEW_VER="${DATE_PART}-${NEW_SEQ}"
    sudo sed -i "s/BUILD_VERSION = '${CURRENT_VER}'/BUILD_VERSION = '${NEW_VER}'/" "$SW_PATH"
    echo "  BUILD_VERSION: ${CURRENT_VER} → ${NEW_VER}"
else
    echo "  ⚠️  未找到 $SW_PATH，跳过"
fi
echo ""

# ─── 5. 恢复环境变量 ───
echo "[5/8] 恢复环境变量配置..."
if [ -f /tmp/backend-env-backup ]; then
    sudo cp /tmp/backend-env-backup "$DEPLOY_DIR/backend/.env"
    echo "  backend/.env 已恢复"
fi
if [ -f /tmp/frontend-env-backup ]; then
    sudo cp /tmp/frontend-env-backup "$DEPLOY_DIR/frontend/.env"
    echo "  frontend/.env 已恢复"
fi

# ─── 6. 恢复数据 ───
echo "[6/8] 恢复数据..."
if [ -d "$BACKUP_DIR/data" ]; then
    sudo cp -r "$BACKUP_DIR/data" "$DEPLOY_DIR/"
    echo "  数据已恢复"
fi

# ─── 7. 重建并启动容器 ───
echo "[7/8] 重建并启动 Docker 容器..."
cd "$DEPLOY_DIR"

if [ "$SKIP_BUILD" = true ]; then
    echo "  跳过构建，仅重启..."
    sudo docker compose down 2>/dev/null || true
    sudo docker compose up -d
else
    echo "  完整构建..."
    sudo docker compose down 2>/dev/null || true
    sudo docker compose up -d --build
fi
echo ""

# ─── 8. 健康检查 + 日志检查 ───
echo "[8/8] 服务健康检查..."

# 后端重试（最多 30 秒）
BACKEND_OK=false
for i in $(seq 1 15); do
    if curl -sf --connect-timeout 2 http://127.0.0.1:8001/version > /dev/null 2>&1; then
        BACKEND_OK=true
        break
    fi
    echo "  等待后端启动... ($i/15)"
    sleep 2
done

if [ "$BACKEND_OK" = true ]; then
    echo "✅  后端服务健康 (port 8001)"
else
    echo "❌  后端服务未响应 (port 8001)"
    echo "  日志: sudo docker logs simple-tavern-backend --tail 30"
    if [ "$NO_ROLLBACK" = false ]; then
        echo ""
        echo "  回滚命令:"
        echo "    sudo docker compose down"
        echo "    sudo cp -r $BACKUP_DIR/data $DEPLOY_DIR/"
        echo "    sudo git reset --hard $PREV_HASH"
        echo "    sudo docker compose up -d --build"
    fi
    exit 1
fi

# 前端重试（最多 20 秒）
FRONTEND_OK=false
for i in $(seq 1 10); do
    if curl -sf --connect-timeout 2 http://127.0.0.1:3000 > /dev/null 2>&1; then
        FRONTEND_OK=true
        break
    fi
    echo "  等待前端启动... ($i/10)"
    sleep 2
done

if [ "$FRONTEND_OK" = true ]; then
    echo "✅  前端服务健康 (port 3000)"
else
    echo "❌  前端服务未响应 (port 3000)"
    echo "  日志: sudo docker logs simple-tavern-frontend --tail 30"
    exit 1
fi

# 后端 API 关键端点验证
echo ""
echo "  API 端点验证..."
sleep 3  # 给后端一点时间完成初始化

ENDPOINTS=(
    "/version"
    "/api/discover"
    "/api/chat/providers"
)
ALL_OK=true
for EP in "${ENDPOINTS[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://127.0.0.1:8001${EP}" 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✅  GET ${EP} → ${HTTP_CODE}"
    else
        echo "  ❌  GET ${EP} → ${HTTP_CODE}"
        ALL_OK=false
    fi
done

# 检查 nginx 是否有近期 503 错误泛滥
echo ""
echo "  检查 nginx 503 错误..."
RECENT_503=$(sudo grep " 503 " /var/log/nginx/access.log 2>/dev/null | tail -20 | wc -l)
if [ "$RECENT_503" -gt 0 ]; then
    echo "  ⚠️  发现 $RECENT_503 条 503 请求（最近 20 行）"
    echo "  可能原因: SW 旧缓存引用已不存在的 chunk，需用户硬刷新页面"
else
    echo "  ✅  无近期 503 错误"
fi

# 最终结果
echo ""
if [ "$ALL_OK" = true ]; then
    echo "=== 部署完成 ✅ ==="
    echo "访问地址: https://chat.hhxxttxs.icu"
    echo "容器状态:"
    sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "查看日志:"
    echo "  sudo docker logs -f simple-tavern-backend"
    echo "  sudo docker logs -f simple-tavern-frontend"
    echo ""
    echo "⚠️  提示: 用户浏览器可能缓存了旧 SW，建议浏览器硬刷新 (Cmd+Shift+R)"
else
    echo "=== 部署完成 ⚠️ （部分 API 端点异常）==="
    echo "检查后端日志: sudo docker logs simple-tavern-backend --tail 50"
    exit 1
fi
