import { createRequestHandler } from "@remix-run/cloudflare";

// Imported at build time — produced by `remix vite:build`; types resolved by esbuild, not tsc
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as serverBuild from "./build/server/index.js";

// biome-ignore lint/suspicious/noExplicitAny: build artifact, types resolved by esbuild not tsc
const handleRequest = createRequestHandler(serverBuild as any);

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
        // biome-ignore lint/suspicious/noExplicitAny: Workers CacheStorage type mismatch
        caches: caches as any,
      },
    });
  },
} satisfies ExportedHandler<Env & { ASSETS: Fetcher }>;
