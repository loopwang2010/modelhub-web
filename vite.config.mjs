import { defineConfig } from 'vite';

// Vite dev server is used by the Electron build path. The Next.js production
// build is the primary surface (see next.config.mjs) — this proxy mirrors
// the same /v1/* and /admin/* targets so the Electron + Next surfaces hit
// the same modelhub-backend during local dev.
const BACKEND = process.env.MODELHUB_BACKEND_URL || 'http://localhost:6666';

export default defineConfig({
    base: './',
    server: {
        proxy: {
            '/v1':    { target: BACKEND, changeOrigin: true, secure: false },
            '/admin': { target: BACKEND, changeOrigin: true, secure: false },
        }
    }
});
