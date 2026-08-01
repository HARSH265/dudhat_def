import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Served from dudhatdef.com/admin. Becomes "/" if it moves to its own
  // subdomain — react-router's basename must change with it.
  // docs/ADMIN_UI_ARCHITECTURE.md §2
  base: "/admin/",

  resolve: {
    // import.meta.dirname rather than __dirname — the latter is unsupported
    // by Vite's native config loader, which becomes the default.
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },

  server: {
    port: 5173,
    // The API sets an HttpOnly refresh cookie scoped to /api/v1/admin/auth.
    // Proxying in development keeps the app same-origin with the API, so the
    // SameSite=Strict cookie behaves exactly as it will in production.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: false,
      },
    },
  },

  build: {
    // Source maps would publish readable admin logic. docs/SECURITY_TODO.md S12
    sourcemap: false,
  },
});
