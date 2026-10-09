import { defineConfig } from 'vite';

export default defineConfig({
  // Set VITE_BASE (e.g. "/suloop/") when the game is served from a sub path such as GitHub Pages.
  base: process.env.VITE_BASE || '/',
  build: {
    // three.js alone is about 540 kB; the game code itself is small.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Keep three.js in its own file, so browsers keep it cached when only the game changes.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }]
        }
      }
    }
  }
});
