import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            // 所有 /api/* 请求转发到后端（8001 端口）
            '/api': {
                target: 'http://localhost:8001',
                changeOrigin: true,
            },
        },
    },
});
