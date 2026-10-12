import { isRealCalendarDate } from '../../domain/transaction.js';
import { ValidationError } from '../../domain/errors.js';

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;

function asRecord(query: unknown): Record<string, unknown> {
  return typeof query === 'object' && query !== null ? (query as Record<string, unknown>) : {};
}

function readDate(name: string, raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !isRealCalendarDate(raw)) {
    throw new ValidationError(`${name} must be a date like 2026-09-30`);
  }
  return raw;
}

function readWholeNumber(name: string, raw: unknown, fallback: number, min: number, max: number) {
  if (raw === undefined) return fallback;
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!(value >= min && value <= max)) {
    throw new ValidationError(`${name} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

/** Optional inclusive date range. */
export function readOptionalDateRange(query: unknown): { from?: string; to?: string } {
  const { from, to } = asRecord(query);
  const range = { from: readDate('from', from), to: readDate('to', to) };
  if (range.from && range.to && range.from > range.to) {
    throw new ValidationError('from must not be after to');
  }
  return range;
}

/** Both ends of an inclusive date range, required. */
export function readRequiredDateRange(query: unknown): { from: string; to: string } {
  const { from, to } = readOptionalDateRange(query);
  if (!from || !to) {
    throw new ValidationError('from and to are required, like ?from=2026-09-01&to=2026-09-30');
  }
  return { from, to };
}

export function readPage(query: unknown): { limit: number; offset: number } {
  const { limit, offset } = asRecord(query);
  return {
    limit: readWholeNumber('limit', limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    offset: readWholeNumber('offset', offset, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}
