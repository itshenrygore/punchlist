import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Fresh build timestamp forces Vercel to produce new bundle filenames
    // and prevents serving stale cached assets
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Include timestamp in chunk names to bust Vercel's build cache
        entryFileNames: `assets/[name]-[hash]-v97.js`,
        chunkFileNames: `assets/[name]-[hash]-v97.js`,
        assetFileNames: `assets/[name]-[hash]-v97.[ext]`,
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
