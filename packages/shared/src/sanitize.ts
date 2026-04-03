// ─── URL Validation ─────────────────────────────────

const BLOCKED_PROTOCOLS = ["javascript:", "data:", "blob:", "vbscript:"];

/**
 * Allows:
 *  - Absolute HTTPS URLs
 *  - Relative paths starting with "/" (for uploaded media, etc.)
 * Blocks javascript:, data:, blob:, vbscript:, and any other protocol.
 */
export function isUrlSafe(url: string): boolean {
  // Relative path — safe, no protocol means no script execution possible
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) return false;
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string): string | null {
  if (!isUrlSafe(url)) return null;
  return url;
}

// ─── Basic Text Sanitization ────────────────────────
// Strips HTML tags for plain-text contexts.
// For rich modal body content, use DOMPurify on the server.

const HTML_TAG_RE = /<[^>]*>/g;

export function stripHtmlTags(input: string): string {
  return input.replace(HTML_TAG_RE, "");
}

// ─── Slug Validation ────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 48 && SLUG_RE.test(slug);
}
