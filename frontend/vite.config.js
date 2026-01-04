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
      proxy: {
        [env.VITE_API_BASE_PATH]: {
          target: env.VITE_API_TARGET_URL,
          changeOrigin: true,
        }
      }
    }
  }
})
