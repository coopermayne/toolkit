import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Plugin to inject COOP/COEP headers via middleware (works in Codespaces)
function crossOriginIsolation() {
  return {
    name: 'cross-origin-isolation',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        next();
      });
    }
  };
}

export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  site: 'https://your-site.netlify.app',
  vite: {
    plugins: [crossOriginIsolation()]
  }
});
