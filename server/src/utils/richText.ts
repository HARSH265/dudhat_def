import sanitizeHtml from "sanitize-html";

/**
 * THE allowlist. Single source of truth for every rich-text field.
 *
 * Contract: docs/RICH_TEXT_EDITOR_DECISION.md §4–§6.
 * Rule: docs/SECURITY_TODO.md S1/S2 — the allowlist is NEVER widened to
 * accommodate an editor feature. Tiptap's schema was constrained to match
 * this; if a control is missing from the toolbar, that is the design working.
 *
 * Used by `Product.description` and, when it exists, the CMS `richText`
 * section. Two implementations would become two allowlists.
 */

/** §4. `h1` excluded — the page owns exactly one, and body copy must not emit another. */
export const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "h2",
  "h3",
  "h4",
  "blockquote",
] as const;

/** §5. Everything not listed is dropped, including class, style, id and data-*. */
export const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
};

/**
 * §5. The single most important rule here: a tag-only allowlist is bypassed
 * by `<a href="javascript:…">`. Anything outside this list is dropped.
 */
export const ALLOWED_SCHEMES = ["http", "https", "mailto", "tel"] as const;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: [...ALLOWED_SCHEMES],
  // Protocol-relative `//evil.com` inherits the page scheme and escapes the
  // scheme allowlist entirely.
  allowProtocolRelative: false,
  // Belt and braces: sanitize-html drops these by default, but stating them
  // means a future edit to allowedTags cannot silently re-admit their content.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  // `rel` and `target` are FORCED, never accepted from input — an author
  // cannot opt out of noopener, and a stored `target` cannot be weaponised.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs["href"] ? { href: attribs["href"] } : {}),
        ...(attribs["title"] ? { title: attribs["title"] } : {}),
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      },
    }),
  },
  // Discard rather than escape: an empty document should be empty, not a
  // page of visible markup.
  disallowedTagsMode: "discard",
};

/**
 * Sanitises on WRITE, so the database never holds an attack payload and a
 * future consumer that forgets to escape is not immediately vulnerable.
 * docs/SECURITY_ARCHITECTURE.md §6
 *
 * Strips silently — never throws. Someone pasting from Word should get clean
 * output, not a validation error they cannot act on.
 */
export function sanitizeRichText(input: string | undefined | null): string {
  if (!input) return "";
  return sanitizeHtml(input, OPTIONS);
}

/**
 * True when sanitising would change the input. Used only for logging, so a
 * spike in stripped content is visible rather than silent.
 */
export function wouldStrip(input: string | undefined | null): boolean {
  if (!input) return false;
  return sanitizeRichText(input) !== input;
}
