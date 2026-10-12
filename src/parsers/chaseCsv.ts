import { ImportError, ValidationError } from '../domain/errors.js';
import { createTransaction, isRealCalendarDate, type Transaction } from '../domain/transaction.js';
import { parseCsv } from './csv.js';

const EXPECTED_HEADER = [
  'Details',
  'Posting Date',
  'Description',
  'Amount',
  'Type',
  'Balance',
  'Check or Slip #',
];

const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

function parseDate(raw: string): string {
  const match = DATE_PATTERN.exec(raw);
  if (!match) {
    throw new ValidationError(`date '${raw}' is not in MM/DD/YYYY format`);
  }
  const [, month, day, year] = match;
  const iso = `${year}-${month}-${day}`;
  // Report the date as it appears in the file, not our converted form of it.
  if (!isRealCalendarDate(iso))
    throw new ValidationError(`date '${raw}' is not a real calendar date`);
  return iso;
}

// Amounts never pass through a float: '-18.9' must be exactly -1890 cents.
function parseAmountToCents(raw: string): number {
  const match = AMOUNT_PATTERN.exec(raw.trim());
  if (!match) {
    throw new ValidationError(`amount '${raw}' is not a plain decimal number like -12.34`);
  }
  const [, sign, dollars, fraction = ''] = match;
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' && cents !== 0 ? -cents : cents;
}

function parseRow(fields: string[], rowNumber: number, account: string): Transaction {
  if (fields.length < EXPECTED_HEADER.length) {
    throw new ImportError(
      'IMPORT_INVALID_ROW',
      `row ${rowNumber}: expected ${EXPECTED_HEADER.length} fields but found ${fields.length}`,
    );
  }

  const [, postingDate = '', description = '', amount = ''] = fields;

  try {
    return createTransaction({
      date: parseDate(postingDate.trim()),
      description: description.replace(/\s+/g, ' ').trim(),
      amountCents: parseAmountToCents(amount),
      account,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ImportError('IMPORT_INVALID_ROW', `row ${rowNumber}: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * Parses a Chase checking-account CSV export. The file carries no account identity, so the
 * caller supplies it. Rows come back in file order; Chase exports are newest-first.
 */
export function parseChaseCsv(text: string, options: { account: string }): Transaction[] {
  const [header, ...rows] = parseCsv(text);

  if (!header || !EXPECTED_HEADER.every((name, i) => header[i]?.trim() === name)) {
    throw new ImportError(
      'IMPORT_UNSUPPORTED_FORMAT',
      `not a Chase checking export: expected columns ${EXPECTED_HEADER.join(', ')}`,
    );
  }

  // Row numbers match a spreadsheet's: the header is row 1, the first transaction row 2.
  return rows.map((fields, index) => parseRow(fields, index + 2, options.account));
}
