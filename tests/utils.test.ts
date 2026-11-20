import { describe, expect, it } from 'vitest';
import { fillBuckets, resolveRange } from '../src/modules/dashboard/dashboard.service.js';
import { buildDateRange } from '../src/utils/dateRange.js';
import { buildMeta } from '../src/utils/pagination.js';
import { buildSearchFilter, escapeRegex, tokenize } from '../src/utils/search.js';

describe('search', () => {
  it('tokenizes into lowercase, accent-free, unique words', () => {
    expect(tokenize('Dr. José Smith-Ñúñez', 'josé')).toEqual(['dr', 'jose', 'smith', 'nunez']);
  });

  it('builds an anchored prefix filter per word (index-friendly)', () => {
    expect(buildSearchFilter('John  sm')).toEqual({
      searchTokens: { $all: [/^john/, /^sm/] },
    });
  });

  it('returns no filter for blank searches', () => {
    expect(buildSearchFilter('   ')).toEqual({});
    expect(buildSearchFilter(undefined)).toEqual({});
  });

  it('escapes regex metacharacters (no regex injection)', () => {
    expect(escapeRegex('a.*(b)')).toBe('a\\.\\*\\(b\\)');
  });
});

describe('date ranges', () => {
  it('treats a date-only `to` as inclusive of the whole day', () => {
    const range = buildDateRange(new Date('2026-01-01'), new Date('2026-01-31'));
    expect(range).toEqual({
      $gte: new Date('2026-01-01T00:00:00.000Z'),
      $lt: new Date('2026-02-01T00:00:00.000Z'),
    });
  });

  it('returns undefined when no bounds are given', () => {
    expect(buildDateRange()).toBeUndefined();
  });

  it('defaults the dashboard range to the last 30 days', () => {
    const range = resolveRange({});
    expect((range.$lt.getTime() - range.$gte.getTime()) / 86_400_000).toBe(30);
  });
});

describe('dashboard buckets', () => {
  const range = resolveRange({ from: new Date('2026-01-07'), to: new Date('2026-01-20') });

  it('fills every day in the range, with zeros for empty days', () => {
    const points = fillBuckets([{ _id: new Date('2026-01-08T00:00:00Z'), count: 5 }], range, 'day');
    expect(points).toHaveLength(14);
    expect(points.slice(0, 2)).toEqual([
      { date: '2026-01-07T00:00:00.000Z', count: 0 },
      { date: '2026-01-08T00:00:00.000Z', count: 5 },
    ]);
  });

  it('aligns weekly buckets to Mondays (like $dateTrunc)', () => {
    const points = fillBuckets([], range, 'week');
    expect(points.map((p) => new Date(p.date).getUTCDay())).toEqual([1, 1, 1]);
  });
});

describe('pagination meta', () => {
  it('computes total pages and never returns 0 pages', () => {
    expect(buildMeta(2, 10, 248)).toEqual({ page: 2, limit: 10, total: 248, totalPages: 25 });
    expect(buildMeta(1, 10, 0).totalPages).toBe(1);
  });
});
