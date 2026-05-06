import { resolve } from "node:path";
import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { getLoadContext } from "./load-context";

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "app"),
    },
    conditions: ["worker", "browser", "module", "import", "default"],
  },
  ssr: {
    target: "webworker",
    noExternal: true,
  },
  plugins: [
    remixCloudflareDevProxy({ getLoadContext }),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tailwindcss(),
  ],
});
