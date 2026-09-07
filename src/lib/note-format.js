/**
 * Helpers shared by the note editor (client) and the note actions (server).
 * No Node-only imports here — this file is bundled into the browser.
 */

/**
 * Notes written before the rich-text editor are plain text. Rows written since
 * are HTML from tiptap, which always starts with a block element. Matched on a
 * known block tag rather than a bare "<" so a legacy note that happens to open
 * with an angle bracket is still shown as text, never parsed as markup.
 */
const RICH_NOTE = /^\s*<(p|ul|ol|h[1-6]|blockquote|pre|hr)(\s|>|\/)/i

export function isRichNote(body) {
  return RICH_NOTE.test(body ?? "")
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Lifts a legacy plain-text note into the editor: blank-line separated
 * paragraphs, single newlines as hard breaks. Only used to seed the editor
 * when someone edits an old note — the stored row is untouched until they save.
 */
export function plainTextToHtml(text) {
  const paragraphs = String(text ?? "").replace(/\r\n?/g, "\n").split(/\n{2,}/)
  return paragraphs
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("")
}
