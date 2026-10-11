import { defineConfig } from 'vite';

// HiGHS (el solver del optimizador) se precarga para que el servidor de desarrollo no recargue la página
// la primera vez que se optimiza; los procesos del optimizador se empaquetan como módulos.
export default defineConfig({
  optimizeDeps: { include: ['highs'] },
  worker: { format: 'es' },
});
