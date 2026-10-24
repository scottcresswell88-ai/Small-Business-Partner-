import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repo-name>/; the deploy workflow sets this.
  base: process.env.BASE_PATH ?? '/',
})
