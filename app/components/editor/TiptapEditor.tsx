import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { createRoot } from "react-dom/client";

// ── Suggestion item types ────────────────────────────────────────────────────

type SuggestionItem = {
  id: string;
  label: string;
  displayName?: string;
  avatarUrl?: string | null;
  type: "user" | "community";
};

// ── MentionList — the floating dropdown ─────────────────────────────────────

type MentionListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

const MentionList = forwardRef<
  MentionListHandle,
  { items: SuggestionItem[]; command: (item: { id: string; label: string }) => void }
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when new items arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: items reference changing is the reset trigger
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ key }: KeyboardEvent) {
      if (key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (key === "Enter") {
        const item = items[selectedIndex];
        if (item) command({ id: item.id, label: item.label });
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div
      style={{
        background: "var(--color-bg-elev-2)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        minWidth: 200,
        maxWidth: 280,
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            command({ id: item.id, label: item.label });
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
          style={{
            background: i === selectedIndex ? "var(--color-bg-elev-1)" : "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text)",
          }}
        >
          {item.type === "user" ? (
            <>
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                style={{ background: "var(--color-border)" }}
              >
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (item.displayName ?? item.label).charAt(0).toUpperCase()
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                  {item.displayName ?? item.label}
                </span>
                <span className="ml-1 text-xs" style={{ color: "var(--color-text-faint)" }}>
                  @{item.label}
                </span>
              </span>
            </>
          ) : (
            <>
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                c/
              </span>
              <span className="font-medium" style={{ color: "#a78bfa" }}>
                c/{item.label}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = "MentionList";

// ── Build suggestion config ───────────────────────────────────────────────────

function buildSuggestion(trigger: "@" | "c/") {
  return {
    char: trigger,
    allowedPrefixes: null,
    items: async ({ query }: { query: string }) => {
      if (!query) return [];
      const type = trigger === "@" ? "user" : "community";
      const res = await fetch(
        `/api/mention-suggestions?q=${encodeURIComponent(query)}&type=${type}`,
      );
      if (!res.ok) return [];
      return (await res.json()) as SuggestionItem[];
    },
    render() {
      let container: HTMLElement | null = null;
      // biome-ignore lint/suspicious/noExplicitAny: createRoot returns opaque Root type
      let root: any = null;
      const listRef = { current: null as MentionListHandle | null };

      const renderInto = (
        items: SuggestionItem[],
        command: (item: { id: string; label: string }) => void,
        rect: DOMRect | null,
      ) => {
        if (!container) return;
        if (rect) {
          container.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;z-index:9999;`;
        }
        root.render(<MentionList ref={listRef} items={items} command={command} />);
      };

      return {
        onStart(props: {
          items: SuggestionItem[];
          command: (item: { id: string; label: string }) => void;
          clientRect?: (() => DOMRect | null) | null;
        }) {
          container = document.createElement("div");
          document.body.appendChild(container);
          root = createRoot(container);
          renderInto(props.items, props.command, props.clientRect?.() ?? null);
        },
        onUpdate(props: {
          items: SuggestionItem[];
          command: (item: { id: string; label: string }) => void;
          clientRect?: (() => DOMRect | null) | null;
        }) {
          renderInto(props.items, props.command, props.clientRect?.() ?? null);
        },
        onKeyDown({ event }: { event: KeyboardEvent }) {
          if (event.key === "Escape") {
            container?.remove();
            return true;
          }
          return listRef.current?.onKeyDown(event) ?? false;
        },
        onExit() {
          setTimeout(() => {
            root?.unmount();
            container?.remove();
            container = null;
            root = null;
          }, 0);
        },
      };
    },
  };
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="px-1.5 py-0.5 rounded text-xs font-mono select-none transition-colors"
      style={{
        background: active ? "var(--color-bg-elev-2)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-text-faint)",
        border: "1px solid",
        borderColor: active ? "var(--color-border)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

// ── Main editor component ─────────────────────────────────────────────────────

interface Props {
  onChange: (html: string) => void;
  placeholder?: string;
}

export function TiptapEditor({ onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Write something… (type @ to mention)" }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Mention.configure({
        HTMLAttributes: { class: "mention mention-user" },
        renderHTML({ options, node }) {
          return [
            "a",
            { href: `/u/${node.attrs.id}`, class: options.HTMLAttributes.class },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
        suggestion: buildSuggestion("@"),
      }),
    ],
    editorProps: { attributes: { class: "prose-editor" } },
    onUpdate({ editor: ed }) {
      const html = ed.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-elev-2)",
        }}
      >
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          B
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <em>I</em>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          {"</>"}
        </ToolBtn>
        <span
          style={{
            width: 1,
            height: 14,
            background: "var(--color-border)",
            margin: "0 4px",
            display: "inline-block",
          }}
        />
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          ≡
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          1.
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          "
        </ToolBtn>
        <span
          style={{
            width: 1,
            height: 14,
            background: "var(--color-border)",
            margin: "0 4px",
            display: "inline-block",
          }}
        />
        <ToolBtn onClick={setLink} active={editor.isActive("link")} title="Link">
          🔗
        </ToolBtn>
        <span
          className="ml-auto text-xs"
          style={{ color: "var(--color-text-faint)", paddingRight: 4 }}
        >
          @ mention
        </span>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="px-3 py-2.5"
        style={{ minHeight: "140px", background: "var(--color-bg-elev-1)" }}
      />
    </div>
  );
}
