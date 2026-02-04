import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router-dom')) return 'react';
          if (id.includes('react-dom')) return 'react';
          if (id.includes('react')) return 'react';
          if (id.includes('lucide-react')) return 'ui';
          if (id.includes('xlsx')) return 'excel';
          if (id.includes('react-window') || id.includes('react-virtualized-auto-sizer')) return 'virtual';
          if (id.includes('axios')) return 'vendor';
          return 'vendor';
        }
      }
    }
  }
})
