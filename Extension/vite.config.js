import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { cpSync, readFileSync, writeFileSync } from 'fs';

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension-copy',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      const staticDirs = ['services', 'config', 'icons'];
      for (const dir of staticDirs) {
        cpSync(resolve(__dirname, dir), resolve(distDir, dir), { recursive: true });
      }

      cpSync(resolve(__dirname, 'background.js'), resolve(distDir, 'background.js'));

      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));
      manifest.action.default_popup = 'popup.html';
      writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [
    svelte(),
    chromeExtensionPlugin(),
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@services': resolve(__dirname, 'services'),
      '@config': resolve(__dirname, 'config'),
    },
  },
});
