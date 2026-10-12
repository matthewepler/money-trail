import { describe, expect, it } from 'vitest';
import { assertTestDatabase, deriveTestDatabaseUrl } from './testDatabase.js';

describe('deriveTestDatabaseUrl', () => {
  it('points at a sibling database named with a _test suffix, keeping everything else', () => {
    expect(deriveTestDatabaseUrl('postgres://user:pw@localhost:5432/money_trail')).toBe(
      'postgres://user:pw@localhost:5432/money_trail_test',
    );
  });

  it('leaves a URL that already names a _test database alone', () => {
    expect(deriveTestDatabaseUrl('postgres://user:pw@db:5432/money_trail_test')).toBe(
      'postgres://user:pw@db:5432/money_trail_test',
    );
  });

  it('rejects a URL with no database name', () => {
    expect(() => deriveTestDatabaseUrl('postgres://user:pw@localhost:5432')).toThrow(
      /database name/,
    );
  });
});

describe('assertTestDatabase', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(() => assertTestDatabase('money_trail_test')).not.toThrow();
  });

  it('refuses any other database, naming it', () => {
    expect(() => assertTestDatabase('money_trail')).toThrow(/money_trail/);
    expect(() => assertTestDatabase('test_money_trail')).toThrow();
  });
});
