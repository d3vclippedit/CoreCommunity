import { useState } from "react";
import { type EmbedKind, getEmbedSrc } from "~/lib/embeds";

export function detectEmbed(url: string) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { kind: "youtube" as const, id: ytMatch[1] };

  const twitchVod = url.match(/twitch\.tv\/videos\/(\d+)/);
  if (twitchVod) return { kind: "twitch-vod" as const, id: twitchVod[1] };

  const twitchClip =
    url.match(/clips\.twitch\.tv\/([a-zA-Z0-9_-]+)/) ??
    url.match(/twitch\.tv\/\w+\/clip\/([a-zA-Z0-9_-]+)/);
  if (twitchClip) return { kind: "twitch-clip" as const, id: twitchClip[1] };

  const giphyId =
    url.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)(?:[/?#]|$)/)?.[1] ??
    url.match(/media\.giphy\.com\/media\/([a-zA-Z0-9]+)/)?.[1];
  if (giphyId) return { kind: "giphy" as const, id: giphyId };

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: "direct-video" as const };

  return null;
}

function EmbedPlayer({ url }: { url: string }) {
  const embed = detectEmbed(url);
  if (!embed) return null;

  const parent = window.location.hostname;

  if (embed.kind === "youtube") {
    return (
      <div className="relative w-full rounded-md overflow-hidden" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={`https://www.youtube.com/embed/${embed.id}?rel=0`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube"
        />
      </div>
    );
  }

  if (embed.kind === "twitch-vod") {
    return (
      <div className="relative w-full rounded-md overflow-hidden" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={`https://player.twitch.tv/?video=${embed.id}&parent=${parent}&autoplay=false`}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          title="Twitch"
        />
      </div>
    );
  }

  if (embed.kind === "twitch-clip") {
    return (
      <div className="relative w-full rounded-md overflow-hidden" style={{ paddingTop: "56.25%" }}>
        <iframe
          src={`https://clips.twitch.tv/embed?clip=${embed.id}&parent=${parent}&autoplay=false`}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          title="Twitch clip"
        />
      </div>
    );
  }

  if (embed.kind === "giphy") {
    return (
      <div>
        <img
          src={`https://media.giphy.com/media/${embed.id}/giphy.gif`}
          alt="GIF"
          className="rounded-md max-w-full"
          style={{ maxHeight: 360 }}
          loading="lazy"
        />
      </div>
    );
  }

  if (embed.kind === "direct-video") {
    return (
      // biome-ignore lint/a11y/useMediaCaption: user-uploaded video, no captions available
      <video src={url} controls className="w-full rounded-md" style={{ maxHeight: 480 }} />
    );
  }

  return null;
}

export function ExpandedPostContent({
  type,
  url,
  imageUrl,
  body,
  title,
  embedKind,
  embedRef,
}: {
  type: string;
  url?: string | null;
  imageUrl?: string | null;
  body?: string | null;
  title: string;
  embedKind?: string | null;
  embedRef?: string | null;
}) {
  if (type === "image" && imageUrl) {
    return (
      <div
        className="rounded-md overflow-hidden flex items-center justify-center"
        style={{ background: "var(--color-bg-elev-2)", minHeight: 80 }}
      >
        <img
          src={imageUrl}
          alt={title}
          style={{ maxWidth: "100%", maxHeight: 600, objectFit: "contain", display: "block" }}
        />
      </div>
    );
  }

  if ((type === "video" || type === "link") && url) {
    // Use stored embed data (set at post creation) — more reliable than regex detection
    if (embedKind && embedRef) {
      const parent = window.location.hostname;
      const src = getEmbedSrc(embedKind as Exclude<EmbedKind, null>, embedRef, parent);
      return (
        <div
          className="relative w-full rounded-md overflow-hidden"
          style={{ paddingTop: "56.25%" }}
        >
          <iframe
            src={src}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="Embedded content"
          />
        </div>
      );
    }
    // Fallback: detect from raw URL
    const embed = detectEmbed(url);
    if (embed) return <EmbedPlayer url={url} />;
    if (type === "link") {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs break-all hover:underline"
          style={{ color: "var(--color-text-faint)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    }
    // biome-ignore lint/a11y/useMediaCaption: user-uploaded video, no captions available
    return <video src={url} controls className="w-full rounded-md" style={{ maxHeight: 480 }} />;
  }

  if (type === "text" && body) {
    return (
      <div
        className="prose-body"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: content authored via Tiptap controlled editor
        dangerouslySetInnerHTML={{ __html: body }}
      />
    );
  }

  return null;
}

function PlayFacade({
  thumbnailUrl,
  label,
  onPlay,
  brand,
}: {
  thumbnailUrl: string | null;
  label: string;
  onPlay: () => void;
  brand?: "twitch" | "youtube" | null;
}) {
  const bgStyle = thumbnailUrl
    ? "var(--color-bg-elev-2)"
    : brand === "twitch"
      ? "linear-gradient(135deg, #1a0a2e 0%, #18181C 60%)"
      : "var(--color-bg-elev-2)";

  return (
    <button
      type="button"
      onClick={onPlay}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        display: "block",
        background: bgStyle,
        border: "none",
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
      }}
      aria-label={`Play ${label}`}
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {/* brand label when no thumbnail */}
      {!thumbnailUrl && brand === "twitch" && (
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "#a970ff",
            textTransform: "uppercase",
          }}
        >
          Twitch Clip
        </span>
      )}
      {/* overlay */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          background: thumbnailUrl ? "rgba(0,0,0,0.35)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* play circle */}
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background:
              brand === "twitch" && !thumbnailUrl
                ? "rgba(169,112,255,0.2)"
                : "rgba(255,255,255,0.92)",
            border:
              brand === "twitch" && !thumbnailUrl ? "2px solid rgba(169,112,255,0.7)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M6 4l12 6-12 6V4z"
              fill={brand === "twitch" && !thumbnailUrl ? "#a970ff" : "#111"}
            />
          </svg>
        </span>
      </span>
    </button>
  );
}

export function InlineMedia({
  type,
  url,
  imageUrl,
  embedKind,
  embedRef,
}: {
  type: string;
  url?: string | null;
  imageUrl?: string | null;
  embedKind?: string | null;
  embedRef?: string | null;
}) {
  const [active, setActive] = useState(false);

  if (type === "image" && imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        style={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block" }}
      />
    );
  }

  if ((type === "video" || type === "link") && embedKind && embedRef) {
    if (active) {
      const parent = window.location.hostname;
      const src = getEmbedSrc(embedKind as Exclude<EmbedKind, null>, embedRef, parent, true);
      return (
        <iframe
          src={src}
          title="Embedded content"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", aspectRatio: "16/9", border: "none", display: "block" }}
        />
      );
    }
    const thumbnailUrl =
      embedKind === "youtube" ? `https://img.youtube.com/vi/${embedRef}/mqdefault.jpg` : null;
    const brand = embedKind === "youtube" ? "youtube" : "twitch";
    return (
      <PlayFacade
        thumbnailUrl={thumbnailUrl}
        label={embedKind === "youtube" ? "YouTube video" : "Twitch clip"}
        onPlay={() => setActive(true)}
        brand={brand}
      />
    );
  }

  if ((type === "video" || type === "link") && url) {
    const embed = detectEmbed(url);
    if (embed?.kind === "giphy") {
      return (
        <img
          src={`https://media.giphy.com/media/${embed.id}/giphy.gif`}
          alt="GIF"
          loading="lazy"
          style={{ width: "100%", maxHeight: 500, objectFit: "contain", display: "block" }}
        />
      );
    }
    if (
      embed?.kind === "youtube" ||
      embed?.kind === "twitch-vod" ||
      embed?.kind === "twitch-clip"
    ) {
      if (active) {
        const parent = window.location.hostname;
        let src = "";
        if (embed.kind === "youtube") src = `https://www.youtube.com/embed/${embed.id}?autoplay=1`;
        if (embed.kind === "twitch-vod")
          src = `https://player.twitch.tv/?video=${embed.id}&parent=${parent}&autoplay=true`;
        if (embed.kind === "twitch-clip")
          src = `https://clips.twitch.tv/embed?clip=${embed.id}&parent=${parent}&autoplay=true`;
        return (
          <iframe
            src={src}
            title="Embedded content"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", aspectRatio: "16/9", border: "none", display: "block" }}
          />
        );
      }
      const thumbnailUrl =
        embed.kind === "youtube" ? `https://img.youtube.com/vi/${embed.id}/mqdefault.jpg` : null;
      const brand = embed.kind === "youtube" ? "youtube" : "twitch";
      return (
        <PlayFacade
          thumbnailUrl={thumbnailUrl}
          label={embed.kind === "youtube" ? "YouTube video" : "Twitch clip"}
          onPlay={() => setActive(true)}
          brand={brand}
        />
      );
    }
    if (embed?.kind === "direct-video") {
      return (
        // biome-ignore lint/a11y/useMediaCaption: user-uploaded video, no captions available
        <video
          src={url}
          controls
          preload="none"
          style={{ width: "100%", maxHeight: 200, display: "block" }}
        />
      );
    }
  }

  return null;
}

export function ExpandChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        color: "var(--color-text-faint)",
        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
        flexShrink: 0,
        marginTop: 3,
      }}
      aria-hidden="true"
    >
      <path d="M3 5L7 9L11 5" />
    </svg>
  );
}
