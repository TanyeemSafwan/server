/**
 * Index-friendly search.
 *
 * Documents store `searchTokens`: lowercase words from their searchable fields.
 * A query like "john sm" becomes `{ searchTokens: { $all: [/^john/, /^sm/] } }`.
 * Anchored, case-sensitive regexes on a lowercase multikey field can use the index,
 * unlike `/john/i` on `name`, which forces a collection scan.
 */

const MAX_SEARCH_TERMS = 5;

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lowercase, accent-free words (letters/digits) from the given values, de-duplicated. */
export function tokenize(...values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const normalized = value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    for (const word of normalized.split(/[^\p{L}\p{N}]+/u)) {
      if (word) tokens.add(word);
    }
  }
  return [...tokens];
}

/** The part of an email before `@`, for tokenizing (avoids noise tokens like "com"). */
export function emailLocalPart(email?: string | null) {
  return email?.split('@')[0];
}

/** Mongo filter fragment for a free-text search string, or `{}` when empty. */
export function buildSearchFilter(search?: string) {
  const terms = tokenize(search).slice(0, MAX_SEARCH_TERMS);
  if (terms.length === 0) return {};
  return {
    searchTokens: { $all: terms.map((term) => new RegExp(`^${escapeRegex(term)}`)) },
  };
}
