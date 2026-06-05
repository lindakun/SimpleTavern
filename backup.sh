#!/bin/bash
# SimpleTavern 数据备份脚本
# 用法: ./backup.sh [--keep-days N]
#
# 功能:
#   - 备份 data/ 目录、环境变量、cookie secret
#   - 自动清理旧备份
#   - 适合 cron 定时执行（建议每天凌晨 3:00）
#
# Cron 示例 (crontab -e):
#   0 3 * * * /opt/simpletavern/backup.sh >> /var/log/simpletavern-backup.log 2>&1

set -e

DEPLOY_DIR="/opt/simpletavern"
BACKUP_ROOT="/opt/simpletavern-backups"
KEEP_DAYS=7
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/backup-${TIMESTAMP}"

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-days) KEEP_DAYS="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

echo "=== SimpleTavern 数据备份 ==="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "备份目录: ${BACKUP_DIR}"
echo ""

# ─── 1. 创建备份目录 ───
sudo mkdir -p "${BACKUP_DIR}"

# ─── 2. 备份数据目录 ───
echo "[1/4] 备份数据目录..."
if [ -d "${DEPLOY_DIR}/data" ]; then
    sudo cp -r "${DEPLOY_DIR}/data" "${BACKUP_DIR}/"
    echo "  ✅ data/ 已备份"
else
    echo "  ⚠️  data/ 目录不存在，跳过"
fi

# ─── 3. 备份环境变量 ───
echo "[2/4] 备份环境变量..."
ENV_BACKUP_DIR="${BACKUP_DIR}/env"
sudo mkdir -p "${ENV_BACKUP_DIR}"

if [ -f "${DEPLOY_DIR}/backend/.env" ]; then
    sudo cp "${DEPLOY_DIR}/backend/.env" "${ENV_BACKUP_DIR}/backend.env"
    echo "  ✅ backend/.env 已备份"
fi
if [ -f "${DEPLOY_DIR}/frontend/.env" ]; then
    sudo cp "${DEPLOY_DIR}/frontend/.env" "${ENV_BACKUP_DIR}/frontend.env"
    echo "  ✅ frontend/.env 已备份"
fi

# ─── 4. 备份 cookie secret ───
echo "[3/4] 备份 cookie secret..."
COOKIE_SECRET="${DEPLOY_DIR}/data/cookie-secret.txt"
if [ -f "${COOKIE_SECRET}" ]; then
    sudo cp "${COOKIE_SECRET}" "${BACKUP_DIR}/cookie-secret.txt"
    echo "  ✅ cookie-secret.txt 已备份"
else
    echo "  ⚠️  cookie-secret.txt 不存在，跳过"
fi

# ─── 5. 清理旧备份 ───
echo "[4/4] 清理 ${KEEP_DAYS} 天前的旧备份..."
DELETED=0
for old_backup in $(sudo ls -1d "${BACKUP_ROOT}"/backup-* 2>/dev/null | sort); do
    backup_date=$(echo "$old_backup" | grep -oP 'backup-\K\d{8}')
    if [ -n "$backup_date" ]; then
        backup_epoch=$(date -d "$backup_date" +%s 2>/dev/null || echo 0)
        keep_until=$(date -d "-${KEEP_DAYS} days" +%s)
        if [ "$backup_epoch" -lt "$keep_until" ]; then
            sudo rm -rf "$old_backup"
            echo "  已删除: $(basename $old_backup)"
            DELETED=$((DELETED + 1))
        fi
    fi
done
if [ "$DELETED" -eq 0 ]; then
    echo "  无需清理"
else
    echo "  共清理 ${DELETED} 个旧备份"
fi

# ─── 6. 备份大小统计 ───
BACKUP_SIZE=$(sudo du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
echo ""
echo "=== 备份完成 ✅ ==="
echo "备份位置: ${BACKUP_DIR}"
echo "备份大小: ${BACKUP_SIZE}"
echo "保留天数: ${KEEP_DAYS}"
echo ""
echo "恢复命令:"
echo "  sudo cp -r ${BACKUP_DIR}/data ${DEPLOY_DIR}/"
echo "  sudo cp ${BACKUP_DIR}/env/backend.env ${DEPLOY_DIR}/backend/.env"
echo "  sudo cp ${BACKUP_DIR}/env/frontend.env ${DEPLOY_DIR}/frontend/.env"
echo "  cd ${DEPLOY_DIR} && sudo docker compose restart"
