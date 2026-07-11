import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The app is hosted below a CloudBase subpath; relative assets also keep local root access working.
  base: "./",
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
