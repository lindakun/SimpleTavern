FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html

# nginx 配置：代理 /api 请求到后端
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 3000;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # API 代理到后端（禁用缓冲以支持 SSE 流式响应）
    location /api/ {
        proxy_pass http://backend:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # SPA 路由：所有非文件请求返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
