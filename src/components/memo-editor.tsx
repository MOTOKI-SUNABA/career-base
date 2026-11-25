"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import { Bold, Italic, Underline, List, ListOrdered, IndentIncrease, IndentDecrease, Undo2, Redo2, Link2, Unlink, Eraser, Highlighter, ImagePlus, Trash2 } from "lucide-react";
import { memoEditorContent } from "@/lib/memo-content";
import { MAX_MEMO_IMAGE_DATA, prepareMemoImage } from "@/lib/memo-image";
import type { Memo } from "@/types";

function indent(editor: Editor, backwards = false) {
  if (editor.isActive("listItem")) {
    return backwards ? editor.chain().focus().liftListItem("listItem").run() : editor.chain().focus().sinkListItem("listItem").run();
  }
  if (!backwards) return editor.chain().focus().insertContent("\t").run();
  const { $from, from, empty } = editor.state.selection;
  if (!empty) return false;
  const before = $from.parent.textBetween(0, $from.parentOffset);
  const whitespace = before.match(/(?:\t| {1,4})$/)?.[0];
  if (whitespace) return editor.chain().focus().deleteRange({ from: from - whitespace.length, to: from }).run();
  if ($from.parent.textContent.startsWith("\t")) return editor.chain().focus().deleteRange({ from: $from.start(), to: $from.start() + 1 }).run();
  return false;
}

export function MemoEditor({ memo, onChange }: { memo: Memo; onChange: (content: string, richContent: string) => void }) {
  const toolbar = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const importing = useRef(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, defaultProtocol: "https", protocols: ["http", "https", "mailto"] } }), TextStyleKit, Highlight.configure({ multicolor: true }), ImageExtension.configure({ allowBase64: true })],
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    content: memoEditorContent(memo),
    parseOptions: { preserveWhitespace: "full" },
    editorProps: {
      // Keep the caret above the fixed navigation and below the sticky toolbar.
      scrollThreshold: { top: 110, bottom: 120, left: 12, right: 12 },
      scrollMargin: { top: 120, bottom: 140, left: 12, right: 12 },
      attributes: { class: "memo-rich-text", role: "textbox", "aria-label": "メモ本文", "aria-multiline": "true", "data-placeholder": "ここから自由に書き始めましょう…" },
      handleClickOn: (view, _position, node, nodePosition, _event, direct) => {
        if (!direct || node.type.name !== "image") return false;
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePosition)));
        view.focus();
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const currentEditor = (view.dom as HTMLElement & { editor: Editor }).editor;
        if (position) currentEditor.commands.setTextSelection(position.pos);
        void insertImages(files, currentEditor); return true;
      },
      handleKeyDown: (view, event) => {
        if (event.isComposing || view.composing) return false;
        if (event.key === "Escape") { toolbar.current?.querySelector("select")?.focus(); return true; }
        if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return false;
        if (editor) indent(editor, event.shiftKey);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getText({ blockSeparator: "\n" }), editor.getHTML()),
  });

  async function insertImages(files: File[], editor: Editor | null) {
    if (!editor || editor.isDestroyed || importing.current) return;
    importing.current = true; setImageBusy(true); setImageError("");
    try {
      // Prepare before inserting so an unsupported file never leaves a partial batch.
      const images = await Promise.all(files.slice(0, 6).map(async (file) => ({ src: await prepareMemoImage(file), alt: file.name || "貼り付けた画像" })));
      if (!mounted.current || editor.isDestroyed) return;
      let embeddedSize = 0;
      editor.state.doc.descendants((node) => { if (node.type.name === "image" && typeof node.attrs.src === "string" && node.attrs.src.startsWith("data:")) embeddedSize += node.attrs.src.length; });
      if (files.length > 6 || embeddedSize + images.reduce((sum, image) => sum + image.src.length, 0) > MAX_MEMO_IMAGE_DATA) throw new Error("このメモの画像容量が上限に達します。画像を減らすか別のメモに追加してください。");
      editor.chain().focus().insertContent([...images.map((attrs) => ({ type: "image", attrs })), { type: "paragraph" }]).run();
    } catch (error) {
      if (mounted.current) setImageError(error instanceof Error ? error.message : "画像を読み込めませんでした。別の画像でお試しください。");
    } finally {
      importing.current = false;
      if (mounted.current) setImageBusy(false);
    }
  }

  if (!editor) return <p className="memo-editor-loading">編集画面を読み込んでいます…</p>;

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) { editor!.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); return; }
    const normalized = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
    try {
      const parsed = new URL(normalized);
      if (!["https:", "http:", "mailto:"].includes(parsed.protocol) || (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:\/\/|mailto:)/i.test(url))) throw new Error();
      editor!.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run(); setLinkOpen(false); setLinkError("");
    } catch { setLinkError("https://、http://、mailto: のリンクを入力してください。"); }
  }

  const tool = (label: string, icon: React.ReactNode, action: () => void, active?: boolean, disabled = false) => <button type="button" className="memo-tool" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={action}>{icon}</button>;
  const heading = editor.isActive("heading", { level: 1 }) ? "1" : editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "0";

  return <div className="memo-writing-area" onPasteCapture={(event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.closest(".memo-rich-text")) return;
    const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => !!file);
    if (!files.length) return;
    event.preventDefault(); event.stopPropagation(); void insertImages(files, editor);
  }}>
    <div className="memo-format-toolbar" ref={toolbar} role="group" aria-label="本文の書式">
      <button type="button" className="memo-tool" aria-label="画像を追加" title="画像を追加" disabled={imageBusy} onMouseDown={(event) => event.preventDefault()} onClick={() => imageInput.current?.click()}><ImagePlus size={18} /></button>
      {editor.isActive("image") && <span className="memo-tool-group"><select aria-label="画像の表示サイズ" value={[160, 320, 640].includes(Number(editor.getAttributes("image").width)) ? String(editor.getAttributes("image").width) : ""} onChange={(event) => {
        const width = Number(event.target.value);
        if (width) editor.chain().focus().updateAttributes("image", { width, height: null }).run();
      }}><option value="" disabled>画像サイズ</option><option value="160">小</option><option value="320">中</option><option value="640">大</option></select>{tool("選択した画像を削除", <Trash2 size={17} />, () => { editor.chain().focus().deleteSelection().run(); })}</span>}
      <select aria-label="書体" value={editor.getAttributes("textStyle").fontFamily || ""} onChange={(event) => event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run()}><option value="">ゴシック</option><option value="Yu Mincho, Hiragino Mincho ProN, serif">明朝</option><option value="monospace">等幅</option></select>
      <select aria-label="見出し" value={heading} onChange={(event) => { const level = Number(event.target.value); if (!level) editor.chain().focus().setParagraph().run(); else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run(); }}><option value="0">本文</option><option value="1">大見出し</option><option value="2">中見出し</option><option value="3">小見出し</option></select>
      <select aria-label="文字サイズ" value={editor.getAttributes("textStyle").fontSize || ""} onChange={(event) => event.target.value ? editor.chain().focus().setFontSize(event.target.value).run() : editor.chain().focus().unsetFontSize().run()}><option value="">標準</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="24px">24</option><option value="32px">32</option></select>
      <span className="memo-tool-group">
        {tool("太字", <Bold size={17} />, () => { editor.chain().focus().toggleBold().run(); }, editor.isActive("bold"))}
        {tool("斜体", <Italic size={17} />, () => { editor.chain().focus().toggleItalic().run(); }, editor.isActive("italic"))}
        {tool("下線", <Underline size={17} />, () => { editor.chain().focus().toggleUnderline().run(); }, editor.isActive("underline"))}
      </span>
      <label className="memo-color-tool" title="文字色"><span>文字色</span><input type="color" aria-label="文字色" value={editor.getAttributes("textStyle").color || "#17211c"} onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} /></label>
      <span className="memo-tool-group">
        {tool("蛍光ペン", <Highlighter size={17} />, () => { editor.chain().focus().toggleHighlight({ color: "#fff0a6" }).run(); }, editor.isActive("highlight"))}
        {tool("箇条書き", <List size={17} />, () => { editor.chain().focus().toggleBulletList().run(); }, editor.isActive("bulletList"))}
        {tool("番号付きリスト", <ListOrdered size={17} />, () => { editor.chain().focus().toggleOrderedList().run(); }, editor.isActive("orderedList"))}
        {tool("字下げ", <IndentIncrease size={17} />, () => { indent(editor); })}
        {tool("字下げ解除", <IndentDecrease size={17} />, () => { indent(editor, true); })}
      </span>
      <span className="memo-tool-group">
        {tool("リンクを設定", <Link2 size={17} />, () => { setLinkUrl(editor.getAttributes("link").href || ""); setLinkError(""); setLinkOpen(!linkOpen); }, editor.isActive("link"))}
        {tool("リンクを解除", <Unlink size={17} />, () => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); }, undefined, !editor.isActive("link"))}
        {tool("書式を解除", <Eraser size={17} />, () => { editor.chain().focus().unsetAllMarks().clearNodes().run(); })}
        {tool("元に戻す", <Undo2 size={17} />, () => { editor.chain().focus().undo().run(); }, undefined, !editor.can().undo())}
        {tool("やり直す", <Redo2 size={17} />, () => { editor.chain().focus().redo().run(); }, undefined, !editor.can().redo())}
      </span>
    </div>
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden aria-label="メモに追加する画像" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void insertImages(files, editor); }} />
    {imageBusy && <p className="memo-image-notice" role="status">画像を追加しています…</p>}
    {imageError && <p className="memo-image-error" role="alert">{imageError}</p>}
    {linkOpen && <form className="memo-link-form" onSubmit={(event) => { event.preventDefault(); applyLink(); }}><label>リンク先<input type="text" autoFocus value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" /></label><button type="submit" className="secondary-button">適用</button><button type="button" className="secondary-button" onClick={() => { setLinkOpen(false); editor.commands.focus(); }}>閉じる</button>{linkError && <p role="alert">{linkError}</p>}</form>}
    <EditorContent editor={editor} />
  </div>;
}
