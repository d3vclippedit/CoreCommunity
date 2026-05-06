import { createRequestHandler } from "@remix-run/cloudflare";

// Imported at build time — produced by `remix vite:build`
// @ts-expect-error — not in tsconfig paths, resolved by esbuild
import * as serverBuild from "./build/server/index.js";

const handleRequest = createRequestHandler(serverBuild);

export default {
  async fetch(request: Request, env: Env & { ASSETS: Fetcher }, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Static assets (hashed filenames under /assets/) — serve from CDN
    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/brand/")) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    }

    // Favicon and other root-level public files
    if (url.pathname === "/favicon.ico") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    }

    return handleRequest(request, {
      cloudflare: {
        env,
        ctx,
        cf: (request as unknown as { cf: IncomingRequestCfProperties }).cf,
        caches,
      },
    });
  },
} satisfies ExportedHandler<Env & { ASSETS: Fetcher }>;
