/**
 * Slugs are the public key — URLs address content by slug, never by _id.
 * docs/DATABASE_ARCHITECTURE.md §2
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip diacritics so "Café" becomes "cafe" rather than losing the word.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}
