export interface ParsedInboxMarkdown {
  url: string | null;
  bodyMd: string | null;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

const URL_KEYS = ['url', 'link'] as const;

/** Accepts only http(s) URLs for safe external opening. */
export function normalizeInboxUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function urlFromFrontmatter(frontmatter: string): string | null {
  const lines = frontmatter.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const key = match[1].toLowerCase();
    if (!URL_KEYS.includes(key as (typeof URL_KEYS)[number])) {
      continue;
    }
    const url = normalizeInboxUrl(match[2]);
    if (url) {
      return url;
    }
  }
  return null;
}

/**
 * Parses optional YAML-style frontmatter from an inbox markdown file.
 * The body (after frontmatter) becomes the action description; `url` or `link`
 * in frontmatter becomes the action link.
 */
export function parseInboxMarkdown(content: string): ParsedInboxMarkdown {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    const body = content.trim();
    return { url: null, bodyMd: body || null };
  }

  const url = urlFromFrontmatter(match[1]);
  const body = (match[2] ?? '').trim();
  return { url, bodyMd: body || null };
}
