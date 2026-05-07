import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface Props {
  onChange: (html: string) => void;
  placeholder?: string;
}

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

export function TiptapEditor({ onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
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
