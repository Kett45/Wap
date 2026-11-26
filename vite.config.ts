import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const base = process.env.VITE_BASE_PATH || '/Wap/';

  return {
    base,
    build: {
      outDir: 'docs',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/app.[ext]',
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into docs/ and creates 404.html + .nojekyll for GitHub Pages SPA support.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const docsDir = path.resolve(__dirname, 'docs');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const docsAssets = path.resolve(docsDir, 'src/assets');
          if (fs.existsSync(docsDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, docsAssets, {recursive: true, force: true});
          }
          const indexHtml = path.resolve(docsDir, 'index.html');
          const notFoundHtml = path.resolve(docsDir, '404.html');
          const noJekyll = path.resolve(docsDir, '.nojekyll');
          if (fs.existsSync(indexHtml)) {
            fs.copyFileSync(indexHtml, notFoundHtml);
          }
          if (fs.existsSync(docsDir)) {
            fs.writeFileSync(noJekyll, '');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
