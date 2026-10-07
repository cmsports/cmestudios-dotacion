import { defineConfig } from 'vite';
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'standalone-build',
    lib: { entry: 'src/main.jsx', name: 'CMEstudiosDotacionDemo', formats: ['iife'], fileName: () => 'demo.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
