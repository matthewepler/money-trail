import { describe, expect, it } from 'vitest';
import { createTransaction } from './transaction.js';
import { ValidationError } from './errors.js';

const validInput = {
  date: '2026-09-29',
  description: 'CORNER BAKERY',
  amountCents: -381,
  account: 'chase-checking',
};

describe('createTransaction', () => {
  it('builds a transaction from valid normalized fields', () => {
    const transaction = createTransaction(validInput);

    expect(transaction).toEqual(validInput);
  });

  it('rejects a non-ISO date', () => {
    expect(() => createTransaction({ ...validInput, date: '09/29/2026' })).toThrow(ValidationError);
  });

  it('rejects a date that is not a real calendar day', () => {
    expect(() => createTransaction({ ...validInput, date: '2026-02-30' })).toThrow(ValidationError);
  });

  it('rejects a non-integer amount', () => {
    expect(() => createTransaction({ ...validInput, amountCents: 12.5 })).toThrow(ValidationError);
  });

  it('rejects a NaN amount', () => {
    expect(() => createTransaction({ ...validInput, amountCents: NaN })).toThrow(ValidationError);
  });

  it('rejects an empty description', () => {
    expect(() => createTransaction({ ...validInput, description: '   ' })).toThrow(ValidationError);
  });

  it('rejects an empty account', () => {
    expect(() => createTransaction({ ...validInput, account: '' })).toThrow(ValidationError);
  });

  it('includes the offending field and value in the error message', () => {
    expect(() => createTransaction({ ...validInput, amountCents: 12.5 })).toThrow(/amount/i);
  });
});
