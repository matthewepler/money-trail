import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ImportError } from '../domain/errors.js';
import { parseChaseCsv } from './chaseCsv.js';

const HEADER = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #';
const account = 'chase-checking';

function csvWithRows(...rows: string[]): string {
  return [HEADER, ...rows].join('\n') + '\n';
}

function row(overrides: { date?: string; description?: string; amount?: string } = {}): string {
  const { date = '09/28/2026', description = 'COFFEE', amount = '-4.75' } = overrides;
  return `DEBIT,${date},"${description}",${amount},DEBIT_CARD, ,,`;
}

function expectImportError(fn: () => unknown, code: string, message: RegExp): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ImportError);
  expect((caught as ImportError).code).toBe(code);
  expect((caught as ImportError).message).toMatch(message);
}

describe('parseChaseCsv', () => {
  it('parses the fixture export into normalized transactions, in file order', () => {
    const text = readFileSync(path.resolve(process.cwd(), 'fixtures/chase-checking.csv'), 'utf8');

    const transactions = parseChaseCsv(text, { account });

    expect(transactions).toEqual([
      {
        date: '2026-09-28',
        description: 'POS DEBIT CORNER BAKERY BROOKLYN NY 1234',
        amountCents: -475,
        account,
      },
      {
        date: '2026-09-28',
        description: 'POS DEBIT CORNER BAKERY BROOKLYN NY 1234',
        amountCents: -475,
        account,
      },
      {
        date: '2026-09-27',
        description: 'ORIG CO NAME:ACME PAYROLL CO ENTRY DESCR:PAYROLL SEC:PPD',
        amountCents: 245000,
        account,
      },
      { date: '2026-09-26', description: 'CHECK 1042', amountCents: -12500, account },
      {
        date: '2026-09-25',
        description: 'MARKET, INC. #12 "DOWNTOWN"',
        amountCents: -1890,
        account,
      },
      {
        date: '2026-09-24',
        description: 'Online Transfer to SAV ...1234 transaction#: 000000000',
        amountCents: -50000,
        account,
      },
      { date: '2026-09-24', description: 'MONTHLY SERVICE FEE', amountCents: -1200, account },
      {
        date: '2026-09-23',
        description: 'ATM WITHDRAWAL 123 MAIN ST',
        amountCents: -6000,
        account,
      },
    ]);
  });

  it('keeps two identical same-day rows as two transactions', () => {
    const transactions = parseChaseCsv(csvWithRows(row(), row()), { account });

    expect(transactions).toHaveLength(2);
  });

  it.each([
    ['-3.81', -381],
    ['590.00', 59000],
    ['590', 59000],
    ['-18.9', -1890],
    ['-0.05', -5],
    ['0.00', 0],
  ])('converts amount %s to %d cents', (amount, expected) => {
    const [transaction] = parseChaseCsv(csvWithRows(row({ amount })), { account });

    expect(transaction?.amountCents).toBe(expected);
  });

  it('returns no transactions for a header-only file', () => {
    expect(parseChaseCsv(csvWithRows(), { account })).toEqual([]);
  });

  it('rejects a file whose columns are not a Chase checking export', () => {
    const creditCardExport =
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n09/28/2026,09/29/2026,COFFEE,Food,Sale,-4.75,\n';

    expectImportError(
      () => parseChaseCsv(creditCardExport, { account }),
      'IMPORT_UNSUPPORTED_FORMAT',
      /Posting Date/,
    );
  });

  it('rejects an empty file', () => {
    expectImportError(
      () => parseChaseCsv('', { account }),
      'IMPORT_UNSUPPORTED_FORMAT',
      /Chase checking/,
    );
  });

  it('names the row and the bad date', () => {
    expectImportError(
      () => parseChaseCsv(csvWithRows(row(), row({ date: '2026-09-28' })), { account }),
      'IMPORT_INVALID_ROW',
      /row 3: date '2026-09-28'/,
    );
  });

  it('rejects a date that is not a real calendar day', () => {
    expectImportError(
      () => parseChaseCsv(csvWithRows(row({ date: '02/30/2026' })), { account }),
      'IMPORT_INVALID_ROW',
      /row 2: date '02\/30\/2026' is not a real calendar date/,
    );
  });

  it('names the row and the bad amount', () => {
    expectImportError(
      () => parseChaseCsv(csvWithRows(row({ amount: '"12,3x"' })), { account }),
      'IMPORT_INVALID_ROW',
      /row 2: amount '12,3x'/,
    );
  });

  it('rejects an amount with a thousands separator rather than misreading it', () => {
    expectImportError(
      () => parseChaseCsv(csvWithRows(row({ amount: '"1,234.56"' })), { account }),
      'IMPORT_INVALID_ROW',
      /row 2: amount '1,234.56'/,
    );
  });

  it('rejects an empty description', () => {
    expectImportError(
      () => parseChaseCsv(csvWithRows(row({ description: '   ' })), { account }),
      'IMPORT_INVALID_ROW',
      /row 2: description/,
    );
  });

  it('rejects a row with too few fields', () => {
    expectImportError(
      () => parseChaseCsv(csvWithRows('DEBIT,09/28/2026,COFFEE'), { account }),
      'IMPORT_INVALID_ROW',
      /row 2: expected 7 fields but found 3/,
    );
  });
});
