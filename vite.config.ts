import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isCloudflare = mode === "cloudflare";

  return {
    server: {
      port: 3000,
    },
    resolve: {
      tsconfigPaths: true,
      dedupe: ["react", "react-dom", "@tanstack/react-router"],
    },
    plugins: [
      ...(isCloudflare ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
      tanstackStart({
        // Preserve the existing SSR error wrapper.
        server: { entry: "./server.ts" },
      }),
      ...(!isCloudflare ? [nitro()] : []),
      viteReact(),
      tailwindcss(),
    ],
  };
});
