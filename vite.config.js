import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Stamps the service worker with a version made from the names of the built files, which
 * change with their contents. A new build then gets a new cache, and the old one is cleared.
 */
function stampServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle(_options, bundle) {
      const version = createHash('sha256')
        .update(Object.keys(bundle).sort().join('\n'))
        .digest('hex')
        .slice(0, 12);
      const file = join(outDir, 'sw.js');
      writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD__', version));
    }
  };
}

export default defineConfig({
  // Set VITE_BASE (e.g. "/suloop/") when the game is served from a sub path such as GitHub Pages.
  base: process.env.VITE_BASE || '/',
  build: {
    rolldownOptions: {
      output: {
        // Firebase only loads once a player signs in; its own chunk name lets the service
        // worker leave it out of what it fetches up front.
        codeSplitting: { groups: [{ name: 'firebase', test: /node_modules[\\/](@?firebase)/ }] }
      }
    }
  },
  plugins: [stampServiceWorker()]
});
