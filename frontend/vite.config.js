import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
      host: env.HOST || '0.0.0.0',
      port: parseInt(env.PORT) || 3000,
      proxy: {
        '/api': {
          target: env.API_URL || 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  }
})
