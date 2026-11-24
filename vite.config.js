import { defineConfig } from 'vite';

// Interface servie à la fenêtre Tauri (WebView2 / Edge Chromium).
export default defineConfig({
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
