import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
// @ts-ignore — build output exists after `pnpm build`
import * as build from "../build/server/index.js";

// biome-ignore lint/suspicious/noExplicitAny: build artifact, types resolved by esbuild not tsc
export const onRequest = createPagesFunctionHandler({ build: build as any });
