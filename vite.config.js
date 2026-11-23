import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const pdfjs = normalizePath(fileURLToPath(new URL('./node_modules/pdfjs-dist', import.meta.url)));

export default defineConfig({
  optimizeDeps: { include: ['pdfjs-dist/legacy/build/pdf.mjs', '@neslinesli93/qpdf-wasm'] },
  plugins: [
    react(),
    viteStaticCopy({
      targets: ['cmaps', 'standard_fonts', 'wasm', 'iccs'].map(folder => ({
        src: `${pdfjs}/${folder}`,
        dest: 'pdfjs',
      })),
    }),
  ],
});
