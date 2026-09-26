import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const base = process.env.GITHUB_ACTIONS === 'true' ? '/PersonalTrainer/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
})
