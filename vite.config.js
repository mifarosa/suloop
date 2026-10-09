import { defineConfig } from 'vite';

export default defineConfig({
  // Set VITE_BASE (e.g. "/suloop/") when the game is served from a sub path such as GitHub Pages.
  base: process.env.VITE_BASE || '/'
});
