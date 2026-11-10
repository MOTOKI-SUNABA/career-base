"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, Underline, List, ListOrdered, IndentIncrease, IndentDecrease, Undo2, Redo2, Link2, Unlink, Eraser, Highlighter } from "lucide-react";
import { memoEditorContent } from "@/lib/memo-content";
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, defaultProtocol: "https", protocols: ["http", "https", "mailto"] } }), TextStyleKit, Highlight.configure({ multicolor: true })],
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    content: memoEditorContent(memo),
    parseOptions: { preserveWhitespace: "full" },
    editorProps: {
      // Keep the caret above the fixed navigation and below the sticky toolbar.
      scrollThreshold: { top: 110, bottom: 120, left: 12, right: 12 },
      scrollMargin: { top: 120, bottom: 140, left: 12, right: 12 },
      attributes: { class: "memo-rich-text", role: "textbox", "aria-label": "メモ本文", "aria-multiline": "true", "data-placeholder": "ここから自由に書き始めましょう…" },
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

  return <div className="memo-writing-area">
    <div className="memo-format-toolbar" ref={toolbar} role="group" aria-label="本文の書式">
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
    {linkOpen && <form className="memo-link-form" onSubmit={(event) => { event.preventDefault(); applyLink(); }}><label>リンク先<input type="text" autoFocus value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" /></label><button type="submit" className="secondary-button">適用</button><button type="button" className="secondary-button" onClick={() => { setLinkOpen(false); editor.commands.focus(); }}>閉じる</button>{linkError && <p role="alert">{linkError}</p>}</form>}
    <EditorContent editor={editor} />
  </div>;
}
