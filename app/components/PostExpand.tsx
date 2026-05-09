import { useState } from "react";
import { type EmbedKind, getEmbedSrc } from "~/lib/embeds";
import { renderMentions } from "~/lib/mentions";

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
        dangerouslySetInnerHTML={{ __html: renderMentions(body) }}
      />
    );
  }

  return null;
}

function PlayFacade({
  thumbnailUrl,
  label,
  onPlay,
}: {
  thumbnailUrl: string;
  label: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        display: "block",
        background: "var(--color-bg-elev-2)",
        border: "none",
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
      }}
      aria-label={`Play ${label}`}
    >
      <img
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M6 4l12 6-12 6V4z" fill="#111" />
          </svg>
        </span>
      </span>
    </button>
  );
}

const IFRAME_STYLE: React.CSSProperties = {
  width: "100%",
  aspectRatio: "16/9",
  border: "none",
  display: "block",
};

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

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
    const parent = window.location.hostname;

    if (embedKind === "youtube") {
      if (active) {
        return (
          <iframe
            src={getEmbedSrc("youtube", embedRef, parent, true)}
            title="YouTube video"
            allow={IFRAME_ALLOW}
            allowFullScreen
            style={IFRAME_STYLE}
          />
        );
      }
      return (
        <PlayFacade
          thumbnailUrl={`https://img.youtube.com/vi/${embedRef}/mqdefault.jpg`}
          label="YouTube video"
          onPlay={() => setActive(true)}
        />
      );
    }

    // Twitch clips/VODs: load immediately paused so the real first frame is visible
    return (
      <iframe
        src={getEmbedSrc(embedKind as Exclude<EmbedKind, null>, embedRef, parent, false)}
        title="Embedded content"
        allow={IFRAME_ALLOW}
        allowFullScreen
        style={IFRAME_STYLE}
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

    if (embed?.kind === "youtube") {
      if (active) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${embed.id}?autoplay=1`}
            title="YouTube video"
            allow={IFRAME_ALLOW}
            allowFullScreen
            style={IFRAME_STYLE}
          />
        );
      }
      return (
        <PlayFacade
          thumbnailUrl={`https://img.youtube.com/vi/${embed.id}/mqdefault.jpg`}
          label="YouTube video"
          onPlay={() => setActive(true)}
        />
      );
    }

    if (embed?.kind === "twitch-vod") {
      const parent = window.location.hostname;
      return (
        <iframe
          src={`https://player.twitch.tv/?video=${embed.id}&parent=${parent}&autoplay=false`}
          title="Twitch VOD"
          allow={IFRAME_ALLOW}
          allowFullScreen
          style={IFRAME_STYLE}
        />
      );
    }

    if (embed?.kind === "twitch-clip") {
      const parent = window.location.hostname;
      return (
        <iframe
          src={`https://clips.twitch.tv/embed?clip=${embed.id}&parent=${parent}&autoplay=false`}
          title="Twitch clip"
          allow={IFRAME_ALLOW}
          allowFullScreen
          style={IFRAME_STYLE}
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
