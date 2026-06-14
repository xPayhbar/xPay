import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  define: { global: "globalThis" },
  resolve: { alias: { buffer: "buffer/" } },
  optimizeDeps: {
    include: ["buffer"],
    esbuildOptions: { define: { global: "globalThis" } },
  },
  server: { proxy: { "/api": "http://localhost:3001" } },
});
