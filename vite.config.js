import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Plugin to correct the packaging typo in @mediapipe/tasks-vision:
 * On disk, the source map is named `vision_bundle.mjs.map`,
 * but vision_bundle.mjs references `vision_bundle_mjs.js.map`.
 */
function mediapipeSourceMapPlugin() {
  return {
    name: 'mediapipe-sourcemap-fix',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.includes('vision_bundle_mjs.js.map')) {
        return source.replace('vision_bundle_mjs.js.map', 'vision_bundle.mjs.map');
      }
      return null;
    },
    load(id) {
      const cleanId = id.split('?')[0].replace(/\\/g, '/');
      if (cleanId.includes('@mediapipe/tasks-vision') && cleanId.endsWith('vision_bundle.mjs')) {
        const filePath = path.resolve(cleanId);
        if (fs.existsSync(filePath)) {
          let code = fs.readFileSync(filePath, 'utf-8');
          // Strip the invalid source map comment so Vite does not trigger ENOENT on vision_bundle_mjs.js.map
          code = code.replace(/\/\/# sourceMappingURL=vision_bundle_mjs\.js\.map/, '');
          return { code, map: null };
        }
      }
      return null;
    },
    transform(code, id) {
      const cleanId = id.split('?')[0].replace(/\\/g, '/');
      if (cleanId.includes('@mediapipe/tasks-vision') && cleanId.endsWith('vision_bundle.mjs')) {
        return {
          code: code.replace(/\/\/# sourceMappingURL=vision_bundle_mjs\.js\.map/, ''),
          map: null
        };
      }
      return null;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.includes('vision_bundle_mjs.js.map')) {
          req.url = req.url.replace('vision_bundle_mjs.js.map', 'vision_bundle.mjs.map');
        }
        next();
      });
    }
  };
}

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.task', '**/*.wasm'],
  plugins: [mediapipeSourceMapPlugin()],
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR' && warning.id?.includes('@mediapipe')) {
          return;
        }
        warn(warning);
      }
    }
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']
  }
});
