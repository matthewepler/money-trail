import argon2 from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// A malformed stored hash rejects rather than returning false: that is corrupt data to be
// noticed, not a wrong password to be quietly refused.
export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
