import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../dist/webview'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Single JS and CSS file for the webview
        entryFileNames: 'index.js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
  // Prevent Vite from clearing the terminal in watch mode
  clearScreen: false,
});
