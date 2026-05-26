#!/bin/bash

# ============================================
# SimpleTavern 一键开发脚本（macOS）
# 后端: http://localhost:8001
# 前端: http://localhost:3000
# ============================================

set -e

PROJECT_ROOT="/Users/linda/code/SimpleTavern"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "============================================"
echo "🚀 SimpleTavern 开发环境启动中..."
echo "============================================"

# 检查目录
if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ 后端目录不存在: $BACKEND_DIR"
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ 前端目录不存在: $FRONTEND_DIR"
  exit 1
fi

# 安装后端依赖
echo ""
echo "📦 安装后端依赖..."
cd "$BACKEND_DIR"
npm install

# 安装前端依赖
echo ""
echo "📦 安装前端依赖..."
cd "$FRONTEND_DIR"
npm install

# 启动后端
echo ""
echo "🖥️ 启动后端服务 (8001)..."
cd "$BACKEND_DIR"
npm run dev &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
echo ""
echo "🌐 启动前端服务 (3000)..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "✅ 服务已启动"
echo "============================================"
echo "前端: http://localhost:3000"
echo "后端: http://localhost:8001"
echo ""
echo "按 Ctrl + C 停止所有服务"
echo "============================================"

# 捕获退出信号
trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 保持脚本运行
wait