import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const manifest = JSON.parse(
  readFileSync(new URL("./src/pwa/manifest.json", import.meta.url), "utf8"),
);

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "service-worker.js",
      injectRegister: false,
      includeAssets: ["icon.svg"],
      manifest,
      devOptions: {
        enabled: false,
      },
    }),
  ],
});

