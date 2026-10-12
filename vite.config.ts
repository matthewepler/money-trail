import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser only ever talks to its own origin; Vite forwards /api to the loopback-only
// server, which keeps the session cookie same-origin (no CORS, no cross-site cookie).
const api = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': api } },
  preview: { proxy: { '/api': api } },
});
