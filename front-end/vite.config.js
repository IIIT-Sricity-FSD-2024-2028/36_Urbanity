import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || "http://localhost:3000",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
    },
  };
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: { port: 4173, strictPort: true, proxy },
  };
});
