FROM node:22-alpine

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码
COPY . .

# 编译 TypeScript（排除测试文件）
RUN npx tsc -p tsconfig.build.json

# 复制 data 目录到 dist 子目录（seed service 通过 __dirname 解析路径）
RUN cp -r src/data dist/data

EXPOSE 8001

CMD ["node", "dist/server.js"]
