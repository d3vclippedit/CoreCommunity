import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
// @ts-expect-error — build output exists after `pnpm build`
import * as build from "../build/server/index.js";

export const onRequest = createPagesFunctionHandler({ build });
