import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    environment: "node",
    exclude: ["node_modules/**", "dist/**", "tests/emulator/**"],
  },
});
