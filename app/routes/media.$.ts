import type { LoaderFunctionArgs } from "@remix-run/cloudflare";

// Serves files stored in R2. No auth — community media is public.
export async function loader({ params, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const key = params["*"];
  if (!key) throw new Response("Not found", { status: 404 });

  const obj = await env.R2.get(key);
  if (!obj) throw new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);

  return new Response(obj.body as ReadableStream, { headers });
}
