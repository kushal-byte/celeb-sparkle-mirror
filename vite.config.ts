import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Allow deep-importing the mediapipe wasm helper via the package subpath
      // Vite's import analysis can be blocked by package.json "exports" maps,
      // so map the wasm folder to the real node_modules location.
      "@mediapipe/tasks-vision/wasm": path.resolve(
        __dirname,
        "./node_modules/@mediapipe/tasks-vision/wasm"
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
  },
  build: {
    target: 'es2020',
    sourcemap: mode !== 'production',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  }
}));
