import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

const allowedHosts = [
  "mikapedia.online",
  "www.mikapedia.online",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
];

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts,
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
});
