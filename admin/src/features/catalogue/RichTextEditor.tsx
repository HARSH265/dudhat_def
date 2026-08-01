import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiptap, constrained to the allowlist in docs/RICH_TEXT_EDITOR_DECISION.md
 * §4–§5. The allowlist is NOT widened to fit the editor — the editor is
 * configured down to match it.
 *
 * Because Tiptap is schema-driven, an extension that is not registered cannot
 * produce its node. There is no Image extension here, so this editor is
 * structurally incapable of emitting <img>.
 *
 * This is defence in depth, not the control. A request posted directly to the
 * API bypasses it entirely — server-side sanitisation in
 * `utils/richText.ts` is what actually protects the database.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // Headings restricted to 2–4: the page owns exactly one <h1>, and
        // body copy emitting another breaks the hierarchy Phase 0 fixed.
        heading: { levels: [2, 3, 4] },
        // Not in the allowlist — disabled so the schema cannot produce them.
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false, // configured explicitly below
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: false,
        // Mirrors the server's scheme allowlist. The server is authoritative;
        // this stops an unusable link being authored in the first place.
        protocols: ["http", "https", "mailto", "tel"],
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose-admin min-h-40 max-w-none px-3 py-2 focus:outline-none",
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link")["href"] as string | undefined;
    const url = window.prompt("Link URL (http, https, mailto or tel)", previous ?? "https://");

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white focus-within:outline-2 focus-within:outline-brand-500">
      <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50 p-1" role="toolbar" aria-label="Formatting">
        <ToolButton editor={editor} label="Bold" isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" aria-hidden />
        </ToolButton>
        <ToolButton editor={editor} label="Italic" isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" aria-hidden />
        </ToolButton>
        <ToolButton editor={editor} label="Underline" isActive={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" aria-hidden />
        </ToolButton>

        <Divider />

        {([2, 3, 4] as const).map((level) => (
          <ToolButton key={level} editor={editor} label={`Heading ${level}`}
            isActive={editor.isActive("heading", { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
            <span className="text-xs font-semibold">H{level}</span>
          </ToolButton>
        ))}

        <Divider />

        <ToolButton editor={editor} label="Bullet list" isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" aria-hidden />
        </ToolButton>
        <ToolButton editor={editor} label="Numbered list" isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" aria-hidden />
        </ToolButton>
        <ToolButton editor={editor} label="Quote" isActive={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" aria-hidden />
        </ToolButton>

        <Divider />

        <ToolButton editor={editor} label="Link" isActive={editor.isActive("link")} onClick={setLink}>
          <Link2 className="h-4 w-4" aria-hidden />
        </ToolButton>

        {/* No image button by design: images belong in the media library with
            alt text, dimensions and usageCount tracking. An <img> pasted into
            prose has none of that and would bypass the delete guard. */}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolButton({
  label,
  isActive,
  onClick,
  children,
}: {
  editor: Editor;
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded px-1.5 transition-colors duration-150",
        isActive ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-200"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 w-px self-stretch bg-slate-300" aria-hidden />;
}
