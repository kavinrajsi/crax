import "server-only"
import sanitizeHtml from "sanitize-html"

/**
 * Server-side allow-list for note bodies.
 *
 * The editor only emits the tags below, but a server action is a public POST
 * endpoint — the body can arrive from anywhere, and it is rendered back with
 * dangerouslySetInnerHTML. Everything not listed is dropped, hrefs are limited
 * to web/mail/tel schemes, and every link is forced to open in a new tab with
 * rel protections so a note can never navigate or script the CRM.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "del", "code", "pre",
  "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "a", "hr",
]

export function sanitizeNoteHtml(html) {
  return sanitizeHtml(String(html ?? ""), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    },
    disallowedTagsMode: "discard",
  })
    // tiptap keeps a trailing empty paragraph so the caret can leave a list;
    // it is editor chrome, not content.
    .replace(/(<p>\s*<\/p>)+$/, "")
    .trim()
}

/** True when the HTML carries no visible text — tiptap emits "<p></p>" for an empty document. */
export function isEmptyNoteHtml(html) {
  const text = sanitizeHtml(String(html ?? ""), { allowedTags: [], allowedAttributes: {} })
  return text.replace(/&nbsp;/g, " ").trim() === ""
}
