import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置：启用 Vue 插件与路径别名
export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // 拆分大依赖为独立 chunk，减小主包体积
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia')) {
              return 'vue-vendor'
            }
            if (id.includes('xlsx')) {
              return 'xlsx-vendor'
            }
            if (id.includes('pdf-lib') || id.includes('fontkit')) {
              return 'pdf-vendor'
            }
            if (id.includes('file-saver')) {
              return 'saver-vendor'
            }
          }
        },
      },
    },
  },
})
