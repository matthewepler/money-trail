import { ImportError } from '../domain/errors.js';

export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === '"' && field === '') {
      inQuotes = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text.charAt(i + 1) === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new ImportError('IMPORT_MALFORMED_FILE', 'file has an unterminated quoted field');
  }

  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}
