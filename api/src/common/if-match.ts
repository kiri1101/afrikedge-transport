const VERSION = /^[0-9A-F]{16}$/i;

/** Extracts the 16-hex rowversion from an If-Match header (`"…"` or `W/"…"`), or null when absent or malformed. */
export function parseIfMatch(header: string | undefined): string | null {
  if (!header) return null;
  const value = header
    .trim()
    .replace(/^W\//, '')
    .replace(/^"(.*)"$/, '$1');
  return VERSION.test(value) ? value.toUpperCase() : null;
}
