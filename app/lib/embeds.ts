export type EmbedKind = "twitch_clip" | "twitch_vod" | "youtube" | null;

export interface EmbedInfo {
  kind: Exclude<EmbedKind, null>;
  ref: string;
}

export function parseEmbed(url: string): EmbedInfo | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { kind: "youtube", ref: v };
    }
    if (host === "youtu.be") {
      const v = parsed.pathname.slice(1).split("?")[0];
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { kind: "youtube", ref: v };
    }
    if (host === "twitch.tv") {
      const vodMatch = parsed.pathname.match(/^\/videos\/(\d+)$/);
      if (vodMatch) return { kind: "twitch_vod", ref: vodMatch[1] };
      const clipMatch = parsed.pathname.match(/^\/\w+\/clip\/([a-zA-Z0-9_-]+)$/);
      if (clipMatch) return { kind: "twitch_clip", ref: clipMatch[1] };
    }
    if (host === "clips.twitch.tv") {
      const slug = parsed.pathname.slice(1);
      if (slug) return { kind: "twitch_clip", ref: slug };
    }
    return null;
  } catch {
    return null;
  }
}

export function getEmbedSrc(kind: Exclude<EmbedKind, null>, ref: string, host: string): string {
  if (kind === "youtube") return `https://www.youtube.com/embed/${ref}`;
  if (kind === "twitch_vod")
    return `https://player.twitch.tv/?video=${ref}&parent=${host}&autoplay=false`;
  return `https://clips.twitch.tv/embed?clip=${ref}&parent=${host}`;
}
