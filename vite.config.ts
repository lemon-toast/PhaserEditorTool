import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { projectService } from './server/projectService';

export default defineConfig({
  plugins: [vue(), projectService()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          renderer: ['phaser', '@esotericsoftware/spine-phaser-v3'],
          docking: ['dockview-vue'],
        },
      },
    },
  },
});
