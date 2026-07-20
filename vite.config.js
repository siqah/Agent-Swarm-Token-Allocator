import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'csp-nonce',
        enforce: 'post',
        transformIndexHtml(html) {
          return html.replace(
            /<script type="module"/g,
            '<script type="module" nonce="__NONCE__"'
          );
        },
      },
    ],
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || ''),
    },
    server: {
      proxy: env.VITE_API_URL ? undefined : {
        '/api': 'http://localhost:3001',
        '/v1': 'http://localhost:3001',
      },
    },
  };
});
