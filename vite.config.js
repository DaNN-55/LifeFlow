import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        id: "/pulse",
        name: "LifeFlow",
        short_name: "LifeFlow",
        description: "LifeFlow personal execution system PWA shell.",
        lang: "zh-CN",
        start_url: "/pulse",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f6f7fb",
        theme_color: "#0a0a0a",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    port: 5175,
    host: "0.0.0.0",
  },
});
