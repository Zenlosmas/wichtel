import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
// BASE_PATH wird nur beim Deploy auf GitHub Pages gesetzt (dort liegt die App
// unter /<repo>/). Lokal bleibt es "/", damit die Adressen kurz bleiben.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
