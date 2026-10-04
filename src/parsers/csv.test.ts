import { describe, expect, it } from 'vitest';
import { ImportError } from '../domain/errors.js';
import { parseCsv } from './csv.js';

describe('parseCsv', () => {
  it('splits records and fields', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('"MARKET, INC.",5')).toEqual([['MARKET, INC.', '5']]);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('"line one\nline two",x')).toEqual([['line one\nline two', 'x']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('preserves empty fields, including a trailing one', () => {
    expect(parseCsv('a,,c,\n')).toEqual([['a', '', 'c', '']]);
  });

  it('does not emit a record for a trailing newline or blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('returns no records for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('treats a quote in the middle of an unquoted field as a literal character', () => {
    expect(parseCsv('5" pipe,x')).toEqual([['5" pipe', 'x']]);
  });

  it('rejects an unterminated quoted field', () => {
    expect(() => parseCsv('"never closed,1\n')).toThrow(ImportError);
    expect(() => parseCsv('"never closed,1\n')).toThrow(/unterminated/i);
  });
});
