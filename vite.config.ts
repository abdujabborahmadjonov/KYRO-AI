import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = Number(process.env.API_PORT ?? 8787);

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: {
      "/api": { target: `http://localhost:${apiPort}`, changeOrigin: true },
      "/ws": { target: `ws://localhost:${apiPort}`, ws: true },
    },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
