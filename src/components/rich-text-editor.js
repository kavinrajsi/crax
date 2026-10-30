"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, Extension, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extensions"
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  ListIcon,
  ListOrderedIcon,
  TextQuoteIcon,
  LinkIcon,
  Undo2Icon,
  Redo2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function ToolbarButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn("text-muted-foreground", active && "bg-muted text-foreground")}
      // Keep the selection inside the editor; a focus change would collapse it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

const EDITOR_PROPS = {
  attributes: { class: "tiptap min-h-16 px-2.5 py-2 text-sm outline-none" },
}

function normaliseUrl(raw) {
  const value = raw.trim()
  if (!value) return ""
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value
  return `https://${value}`
}

/**
 * tiptap-backed note editor.
 *
 * @param {object}   props
 * @param {string}   [props.content]      initial HTML; only read on mount
 * @param {string}   [props.placeholder]
 * @param {boolean}  [props.disabled]
 * @param {boolean}  [props.autoFocus]
 * @param {Function} [props.onChange]     (html, isEmpty) on every edit
 * @param {Function} [props.onSubmit]     Mod-Enter
 * @param {object}   [props.editorRef]    receives the tiptap Editor for clearContent/setContent
 */
export function RichTextEditor({
  content = "",
  placeholder = "Write a note…",
  disabled = false,
  autoFocus = false,
  onChange,
  onSubmit,
  editorRef,
  className,
}) {
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => {
    onChangeRef.current = onChange
    onSubmitRef.current = onSubmit
  }, [onChange, onSubmit])

  /* Everything handed to useEditor must be referentially stable. On every
     render the hook compares the options against the live editor and, when
     any value differs, calls editor.setOptions() — which re-applies the
     ProseMirror props and redraws the document, blocking the main thread for
     hundreds of milliseconds and dropping focus. A fresh extensions array or
     editorProps object on each render is enough to trip that. */
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        code: false,
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
      /* Mod-Enter submits the surrounding form. Priority sits above
         StarterKit's HardBreak, which binds the same chord to a line break. */
      Extension.create({
        name: "submitShortcut",
        priority: 1000,
        addKeyboardShortcuts: () => ({
          "Mod-Enter": () => {
            onSubmitRef.current?.()
            return true
          },
        }),
      }),
    ],
    [placeholder],
  )

  const editor = useEditor(
    {
      extensions,
      content,
      autofocus: autoFocus ? "end" : false,
      editable: !disabled,
      // The server renders nothing for the editor; hydrating a ProseMirror
      // view from SSR markup would mismatch.
      immediatelyRender: false,
      editorProps: EDITOR_PROPS,
      onUpdate: ({ editor: e }) => onChangeRef.current?.(e.getHTML(), e.isEmpty),
    },
    [],
  )

  useEffect(() => {
    if (editorRef) editorRef.current = editor
  }, [editor, editorRef])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // useEditor no longer re-renders on every transaction, so the toolbar reads
  // its active state through a selector.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            blockquote: e.isActive("blockquote"),
            link: e.isActive("link"),
            linkHref: e.getAttributes("link").href ?? "",
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  })

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")

  function openLink() {
    if (!editor) return
    setLinkUrl(state?.linkHref ?? "")
    setLinkOpen(true)
  }

  function applyLink() {
    if (!editor) return
    const href = normaliseUrl(linkUrl)
    const chain = editor.chain().focus().extendMarkRange("link")
    if (href) chain.setLink({ href }).run()
    else chain.unsetLink().run()
    setLinkOpen(false)
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run()
    setLinkOpen(false)
  }

  const run = (fn) => () => editor && fn(editor.chain().focus()).run()

  return (
    <div
      data-slot="rich-text-editor"
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1"
      >
        <ToolbarButton label="Bold" active={state?.bold} onClick={run((c) => c.toggleBold())}>
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={state?.italic} onClick={run((c) => c.toggleItalic())}>
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton label="Underline" active={state?.underline} onClick={run((c) => c.toggleUnderline())}>
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state?.strike} onClick={run((c) => c.toggleStrike())}>
          <StrikethroughIcon />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Bullet list" active={state?.bulletList} onClick={run((c) => c.toggleBulletList())}>
          <ListIcon />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={state?.orderedList} onClick={run((c) => c.toggleOrderedList())}>
          <ListOrderedIcon />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={state?.blockquote} onClick={run((c) => c.toggleBlockquote())}>
          <TextQuoteIcon />
        </ToolbarButton>
        <ToolbarButton label="Link" active={state?.link} onClick={openLink}>
          <LinkIcon />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Undo" disabled={!state?.canUndo} onClick={run((c) => c.undo())}>
          <Undo2Icon />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state?.canRedo} onClick={run((c) => c.redo())}>
          <Redo2Icon />
        </ToolbarButton>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-1.5 border-b border-input px-1.5 py-1">
          <Input
            autoFocus
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyLink()
              } else if (e.key === "Escape") {
                e.preventDefault()
                setLinkOpen(false)
              }
            }}
            className="h-7 text-xs md:text-xs"
            aria-label="Link URL"
          />
          <Button type="button" size="xs" onClick={applyLink}>Apply</Button>
          {state?.link && (
            <Button type="button" size="xs" variant="ghost" onClick={removeLink}>Remove</Button>
          )}
          <Button type="button" size="xs" variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
