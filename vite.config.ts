import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the build runs from any folder it's deployed to
  base: '',
  plugins: [react()],
  build: {
    // The WebGPU build of three makes one chunk of about 2 MB
    chunkSizeWarningLimit: 2500,
  },
})
