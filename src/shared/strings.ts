/**
 * String helpers used across the platform — slug generation for organizations
 * and projects, mention parsing for comments, and assorted formatting helpers.
 */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

export function truncate(input: string, maxLength: number, suffix = '…'): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, Math.max(0, maxLength - suffix.length)).trimEnd() + suffix;
}

export function capitalize(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => capitalize(word.toLowerCase()))
    .join(' ');
}

export function camelToSnake(input: string): string {
  return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(input: string): string {
  return input.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Build a short, human readable project key from a project name. For example
 * "Mobile Application" becomes "MOB". Falls back to padded characters when the
 * name is too short to derive an acronym.
 */
export function deriveProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'PRJ';
  if (words.length === 1) {
    return words[0].slice(0, 3).padEnd(3, 'X');
  }
  return words
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join('');
}

const MENTION_PATTERN = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]+)\)/g;

export interface ParsedMention {
  display: string;
  userId: string;
}

/**
 * Extract structured mentions from a comment body. Mentions are encoded by the
 * client as `@[Display Name](user:<uuid>)`.
 */
export function parseMentions(body: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(body)) !== null) {
    const [, display, userId] = match;
    if (seen.has(userId)) continue;
    seen.add(userId);
    mentions.push({ display, userId });
  }
  return mentions;
}

export function stripMentionMarkup(body: string): string {
  return body.replace(MENTION_PATTERN, (_, display) => `@${display}`);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural ?? singular + 's'}`;
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function tokenize(input: string): string[] {
  return normalizeWhitespace(input.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}
