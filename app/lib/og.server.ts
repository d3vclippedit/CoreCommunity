import type { KVNamespace } from "@cloudflare/workers-types";

export type OgPreview = {
  title: string | null;
  description: string | null;
  image: string | null;
};

const TTL = 60 * 60 * 24; // 24h

export async function getOgPreview(url: string, kv: KVNamespace): Promise<OgPreview | null> {
  const key = `og:${url}`;
  const cached = await kv.get(key, "json");
  if (cached) return cached as OgPreview;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "COREbot/1.0 (+https://core.pages.dev)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const preview: OgPreview = {
      title: meta(html, "og:title") ?? tag(html, "title"),
      description: meta(html, "og:description") ?? metaName(html, "description"),
      image: meta(html, "og:image"),
    };

    await kv.put(key, JSON.stringify(preview), { expirationTtl: TTL });
    return preview;
  } catch {
    return null;
  }
}

function meta(html: string, property: string): string | null {
  const m =
    html.match(
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    ) ??
    html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    );
  return m?.[1] ?? null;
}

function metaName(html: string, name: string): string | null {
  const m =
    html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"));
  return m?.[1] ?? null;
}

function tag(html: string, tagName: string): string | null {
  const m = html.match(new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, "i"));
  return m?.[1]?.trim() ?? null;
}
